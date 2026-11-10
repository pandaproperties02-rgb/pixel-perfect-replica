// M-Pesa STK Push. Uses Daraja when keys are configured; otherwise reports demo mode so the
// UI can make it explicit that no real request was sent (it never reports a fake success).
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { darajaPassword, darajaTimestamp, getAccessToken, readDarajaConfig } from "./mpesa.server";

export type StkInitResult =
  | { ok: true; mode: "live" | "demo"; checkoutRequestId: string; merchantRequestId?: string; message: string }
  | { ok: false; error: string };

export type StkQueryResult = {
  status: "processing" | "completed" | "failed" | "cancelled";
  message: string;
};

export const getMpesaMode = createServerFn({ method: "GET" }).handler(async () => {
  return { mode: readDarajaConfig() ? ("live" as const) : ("demo" as const) };
});

export const initiateStkPush = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        phone: z.string().regex(/^254(7|1)\d{8}$/, "Phone must be in 2547XXXXXXXX format"),
        amount: z.number().int().min(1).max(250000),
        reference: z.string().min(1).max(12),
        description: z.string().max(13).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<StkInitResult> => {
    const cfg = readDarajaConfig();
    if (!cfg) {
      return {
        ok: true,
        mode: "demo",
        checkoutRequestId: `DEMO-${Date.now().toString(36).toUpperCase()}`,
        message: "Demo mode: M-Pesa keys are not configured, no request was sent to the phone.",
      };
    }
    try {
      const token = await getAccessToken(cfg);
      const timestamp = darajaTimestamp();
      const origin = new URL(getRequest().url).origin;
      const callback = process.env["MPESA_CALLBACK_URL"] || `${origin}/api/public/mpesa/callback`;
      const res = await fetch(`${cfg.baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          BusinessShortCode: cfg.shortcode,
          Password: darajaPassword(cfg, timestamp),
          Timestamp: timestamp,
          TransactionType: cfg.transactionType,
          Amount: data.amount,
          PartyA: data.phone,
          PartyB: cfg.shortcode,
          PhoneNumber: data.phone,
          CallBackURL: callback.startsWith("https://") ? callback : "https://example.com/mpesa/callback",
          AccountReference: data.reference,
          TransactionDesc: data.description ?? "Savora order",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, string>;
      if (!res.ok || json["ResponseCode"] !== "0") {
        console.error("STK push rejected", res.status, json);
        return { ok: false, error: json["errorMessage"] || json["ResponseDescription"] || "M-Pesa rejected the request" };
      }
      return {
        ok: true,
        mode: "live",
        checkoutRequestId: json["CheckoutRequestID"]!,
        merchantRequestId: json["MerchantRequestID"],
        message: json["CustomerMessage"] || "Request sent to customer's phone",
      };
    } catch (err) {
      console.error("STK push error", err);
      return { ok: false, error: err instanceof Error ? err.message : "Could not reach M-Pesa" };
    }
  });

export const queryStkPush = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ checkoutRequestId: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data }): Promise<StkQueryResult> => {
    const cfg = readDarajaConfig();
    if (!cfg || data.checkoutRequestId.startsWith("DEMO-")) {
      return { status: "processing", message: "Demo mode: waiting for a simulated response" };
    }
    try {
      const token = await getAccessToken(cfg);
      const timestamp = darajaTimestamp();
      const res = await fetch(`${cfg.baseUrl}/mpesa/stkpushquery/v1/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          BusinessShortCode: cfg.shortcode,
          Password: darajaPassword(cfg, timestamp),
          Timestamp: timestamp,
          CheckoutRequestID: data.checkoutRequestId,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, string>;
      // While the customer hasn't responded Daraja returns an error code like 500.001.1001.
      if (json["errorCode"]) return { status: "processing", message: "Waiting for customer to complete payment" };
      const code = String(json["ResultCode"] ?? "");
      if (code === "0") return { status: "completed", message: json["ResultDesc"] || "Payment received" };
      if (code === "1032") return { status: "cancelled", message: "Customer cancelled the request" };
      if (code === "1037") return { status: "failed", message: "Customer's phone could not be reached" };
      if (code === "1") return { status: "failed", message: "Insufficient M-Pesa balance" };
      if (code === "2001") return { status: "failed", message: "Wrong M-Pesa PIN entered" };
      if (code) return { status: "failed", message: json["ResultDesc"] || "Payment failed" };
      return { status: "processing", message: "Waiting for customer to complete payment" };
    } catch (err) {
      console.error("STK query error", err);
      return { status: "processing", message: "Checking payment status…" };
    }
  });
