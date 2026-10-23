// Creates the freshroots schema and loads the SAP-style CSV exports into Supabase.
// Usage: node --env-file=.env.local scripts/seed.mjs
// Re-runnable: master data is upserted, sales/inventory are replaced.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL_SESSION, { ssl: "require", max: 1 });
const dir = new URL("../data/sap-export/", import.meta.url);

function readCsv(name) {
  const [header, ...rows] = readFileSync(new URL(name, dir), "utf8").trim().split(/\r?\n/);
  const cols = header.split(",");
  return rows.map((r) => Object.fromEntries(r.split(",").map((v, i) => [cols[i], v.trim()])));
}

// Demo purchase rates (INR per unit). The SAP export has no prices; Zoho POs need one.
const DEMO_RATES = {
  SKU001: 18, SKU002: 32, SKU003: 85, SKU004: 120, SKU005: 95,
  SKU006: 210, SKU007: 35, SKU008: 22, SKU009: 140, SKU010: 160,
  SKU011: 38, SKU012: 110, SKU013: 150, SKU014: 75, SKU015: 260,
};

await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));

const distributors = readCsv("distributor_master.csv");
const skus = readCsv("sku_master.csv");
const sales = readCsv("weekly_sales.csv");
const inventory = readCsv("current_inventory.csv");
const calendar = readCsv("calendar.csv");

await sql.begin(async (tx) => {
  for (const d of distributors) {
    await tx`
      insert into freshroots.distributors (distributor_id, name, region, status)
      values (${d.Distributor_ID}, ${d.Distributor_Name}, ${d.Region}, ${d.Status})
      on conflict (distributor_id) do update
        set name = excluded.name, region = excluded.region, status = excluded.status`;
  }
  for (const s of skus) {
    await tx`
      insert into freshroots.skus (sku_id, name, category, perishability, standard_reorder_qty,
                                   unit_of_measure, distributor_id, purchase_rate)
      values (${s.SKU_ID}, ${s.SKU_Name}, ${s.Category}, ${s.Perishability}, ${Number(s.Standard_Reorder_Qty)},
              ${s.Unit_of_Measure}, ${s.Distributor_ID}, ${DEMO_RATES[s.SKU_ID] ?? 50})
      on conflict (sku_id) do update
        set name = excluded.name, category = excluded.category, perishability = excluded.perishability,
            standard_reorder_qty = excluded.standard_reorder_qty, unit_of_measure = excluded.unit_of_measure,
            distributor_id = excluded.distributor_id, purchase_rate = excluded.purchase_rate`;
  }
  await tx`delete from freshroots.weekly_sales`;
  await tx`insert into freshroots.weekly_sales ${tx(
    sales.map((r) => ({ sku_id: r.SKU_ID, week: r.Week, units_sold: Number(r.Units_Sold) })),
  )}`;
  await tx`delete from freshroots.inventory_snapshots`;
  await tx`insert into freshroots.inventory_snapshots ${tx(
    inventory.map((r) => ({
      sku_id: r.SKU_ID, location: r.Location, units_on_hand: Number(r.Units_On_Hand), as_of_date: r.As_Of_Date,
    })),
  )}`;
  await tx`delete from freshroots.calendar`;
  await tx`insert into freshroots.calendar ${tx(
    calendar.map((r) => ({
      year_month: r.Year_Month, year: Number(r.Year), month: Number(r.Month),
      is_festival_month: r.Is_Festival_Month.toUpperCase() === "TRUE",
    })),
  )}`;
});

const [counts] = await sql`
  select (select count(*) from freshroots.distributors)::int as distributors,
         (select count(*) from freshroots.skus)::int as skus,
         (select count(*) from freshroots.weekly_sales)::int as weekly_sales,
         (select count(*) from freshroots.inventory_snapshots)::int as inventory,
         (select count(*) from freshroots.calendar)::int as calendar`;
console.log("Seeded:", counts);
await sql.end();
