import { createFileRoute } from "@tanstack/react-router";

// Daraja posts the STK result here. The POS confirms payments by querying Daraja directly,
// so this endpoint only acknowledges receipt and logs the result (no data is returned).
export const Route = createFileRoute("/api/public/mpesa/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            Body?: { stkCallback?: { CheckoutRequestID?: string; ResultCode?: number; ResultDesc?: string } };
          };
          const cb = body.Body?.stkCallback;
          console.log("M-Pesa callback", cb?.CheckoutRequestID, cb?.ResultCode, cb?.ResultDesc);
        } catch {
          // ignore malformed bodies
        }
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
