// Server-only M-Pesa Daraja helpers. Never import from components.

export interface DarajaConfig {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  baseUrl: string;
  transactionType: "CustomerPayBillOnline" | "CustomerBuyGoodsOnline";
}

export function readDarajaConfig(): DarajaConfig | null {
  const consumerKey = process.env["MPESA_CONSUMER_KEY"];
  const consumerSecret = process.env["MPESA_CONSUMER_SECRET"];
  const shortcode = process.env["MPESA_SHORTCODE"];
  const passkey = process.env["MPESA_PASSKEY"];
  if (!consumerKey || !consumerSecret || !shortcode || !passkey) return null;
  const env = (process.env["MPESA_ENV"] ?? "sandbox").toLowerCase();
  return {
    consumerKey,
    consumerSecret,
    shortcode,
    passkey,
    baseUrl: env === "production" || env === "live" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke",
    transactionType: process.env["MPESA_TRANSACTION_TYPE"] === "CustomerBuyGoodsOnline" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
  };
}

export async function getAccessToken(cfg: DarajaConfig) {
  const basic = btoa(`${cfg.consumerKey}:${cfg.consumerSecret}`);
  const res = await fetch(`${cfg.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) {
    console.error("Daraja auth failed", res.status, await res.text().catch(() => ""));
    throw new Error("Could not authenticate with M-Pesa. Check the consumer key and secret.");
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("M-Pesa did not return an access token");
  return json.access_token;
}

/** Daraja timestamp in East Africa Time: YYYYMMDDHHmmss */
export function darajaTimestamp(date = new Date()) {
  const eat = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${eat.getUTCFullYear()}${p(eat.getUTCMonth() + 1)}${p(eat.getUTCDate())}${p(eat.getUTCHours())}${p(eat.getUTCMinutes())}${p(eat.getUTCSeconds())}`;
}

export function darajaPassword(cfg: DarajaConfig, timestamp: string) {
  return btoa(`${cfg.shortcode}${cfg.passkey}${timestamp}`);
}
