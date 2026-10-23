// Creates (or finds) one Zoho Inventory vendor per distributor and one item per SKU,
// then stores the Zoho IDs back in Supabase so the app can raise draft POs.
// Usage: node --env-file=.env.local scripts/seed-zoho.mjs   (safe to re-run)
import postgres from "postgres";

const env = process.env;
const sql = postgres(env.DATABASE_URL_SESSION, { ssl: "require", max: 1 });

async function accessToken() {
  const res = await fetch(`${env.ZOHO_ACCOUNTS_SERVER}/oauth/v2/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: env.ZOHO_REFRESH_TOKEN,
      client_id: env.ZOHO_CLIENT_ID,
      client_secret: env.ZOHO_CLIENT_SECRET,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Zoho token refresh failed: ${json.error}`);
  return json.access_token;
}

const token = await accessToken();

async function zoho(method, path, body, query = {}) {
  const url = new URL(`${env.ZOHO_API_DOMAIN}/inventory/v1${path}`);
  url.search = new URLSearchParams({ organization_id: env.ZOHO_ORG_ID, ...query });
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`${method} ${path} failed: ${json.code} ${json.message}`);
  return json;
}

const distributors = await sql`select * from freshroots.distributors order by distributor_id`;
for (const d of distributors) {
  let vendorId = d.zoho_vendor_id;
  if (!vendorId) {
    const found = await zoho("GET", "/contacts", null, { contact_name: d.name, contact_type: "vendor" });
    vendorId = found.contacts?.[0]?.contact_id;
  }
  if (!vendorId) {
    const created = await zoho("POST", "/contacts", {
      contact_name: d.name,
      company_name: d.name,
      contact_type: "vendor",
      notes: `Demo vendor for Freshroots demand planning (${d.distributor_id}, ${d.region}).`,
    });
    vendorId = created.contact.contact_id;
    console.log("created vendor", d.distributor_id, d.name);
  }
  await sql`update freshroots.distributors set zoho_vendor_id = ${vendorId} where distributor_id = ${d.distributor_id}`;
}

const skus = await sql`select * from freshroots.skus order by sku_id`;
for (const s of skus) {
  let itemId = s.zoho_item_id;
  if (!itemId) {
    const found = await zoho("GET", "/items", null, { sku: s.sku_id });
    itemId = found.items?.find((i) => i.sku === s.sku_id)?.item_id;
  }
  if (!itemId) {
    const created = await zoho("POST", "/items", {
      name: s.name,
      sku: s.sku_id,
      unit: "pcs",
      product_type: "goods",
      item_type: "inventory",
      rate: Math.round(Number(s.purchase_rate) * 1.35 * 100) / 100,
      purchase_rate: Number(s.purchase_rate),
      description: `${s.category} · ${s.perishability} perishability · demo rates`,
    });
    itemId = created.item.item_id;
    console.log("created item", s.sku_id, s.name);
  }
  await sql`update freshroots.skus set zoho_item_id = ${itemId} where sku_id = ${s.sku_id}`;
}

const [check] = await sql`
  select (select count(*) from freshroots.distributors where zoho_vendor_id is not null)::int as vendors,
         (select count(*) from freshroots.skus where zoho_item_id is not null)::int as items`;
console.log("Zoho mapping:", check);
await sql.end();
