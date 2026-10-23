import "server-only";

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken() {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${process.env.ZOHO_ACCOUNTS_SERVER}/oauth/v2/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
      client_id: process.env.ZOHO_CLIENT_ID!,
      client_secret: process.env.ZOHO_CLIENT_SECRET!,
    }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Zoho login failed: ${json.error ?? res.status}`);
  cached = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function zoho<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const url = new URL(`${process.env.ZOHO_API_DOMAIN}/inventory/v1${path}`);
  url.searchParams.set("organization_id", process.env.ZOHO_ORG_ID!);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${await accessToken()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`Zoho: ${json.message ?? "request failed"} (code ${json.code})`);
  return json as T;
}

export interface PoLine {
  item_id: string;
  quantity: number;
  rate: number;
  description?: string;
}

export interface CreatedPo {
  purchaseorder_id: string;
  purchaseorder_number: string;
  status: string;
  total: number;
}

/** Creates a purchase order in Zoho Inventory. Zoho saves API-created POs as drafts. */
export async function createDraftPurchaseOrder(input: {
  vendorId: string;
  reference: string;
  notes: string;
  lines: PoLine[];
}): Promise<CreatedPo> {
  const json = await zoho<{ purchaseorder: CreatedPo }>("POST", "/purchaseorders", {
    vendor_id: input.vendorId,
    reference_number: input.reference,
    date: new Date().toISOString().slice(0, 10),
    notes: input.notes,
    line_items: input.lines,
  });
  return json.purchaseorder;
}

export function zohoPoUrl(poId: string) {
  return `${process.env.ZOHO_APP_URL}/app/${process.env.ZOHO_ORG_ID}#/purchaseorders/${poId}`;
}
