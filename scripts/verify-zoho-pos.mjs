// Cross-checks every saved PO against Zoho Inventory. Usage: node --env-file=.env.local scripts/verify-zoho-pos.mjs
import postgres from "postgres";
const e = process.env;
const t = await (await fetch(`${e.ZOHO_ACCOUNTS_SERVER}/oauth/v2/token`, { method: "POST", body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: e.ZOHO_REFRESH_TOKEN, client_id: e.ZOHO_CLIENT_ID, client_secret: e.ZOHO_CLIENT_SECRET }) })).json();
const sql = postgres(e.DATABASE_URL_SESSION, { ssl: "require", max: 1 });
const pos = await sql`select zoho_po_id, zoho_po_number, zoho_status, total::float8 from freshroots.purchase_orders where error is null order by created_at`;
for (const p of pos) {
  const j = await (await fetch(`${e.ZOHO_API_DOMAIN}/inventory/v1/purchaseorders/${p.zoho_po_id}?organization_id=${e.ZOHO_ORG_ID}`, { headers: { Authorization: `Zoho-oauthtoken ${t.access_token}` } })).json();
  const po = j.purchaseorder;
  console.log(`DB ${p.zoho_po_number} ${p.zoho_status} ₹${p.total} | Zoho ${po.purchaseorder_number} status=${po.status} vendor=${po.vendor_name} total=${po.total} lines=${po.line_items.map(l => l.sku + "x" + l.quantity).join(",")}`);
}
console.log(await sql`select status, count(*)::int from freshroots.recommendations where run_id = (select id from freshroots.planning_runs order by created_at desc limit 1) group by 1 order by 1`);
await sql.end();
