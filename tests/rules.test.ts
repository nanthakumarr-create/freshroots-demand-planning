// Run: npm test  (Node's built-in test runner with type stripping)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateSku } from "../src/lib/rules.ts";

const read = (f: string) =>
  readFileSync(new URL(`../data/sap-export/${f}`, import.meta.url), "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(","));

const skus = read("sku_master.csv");
const sales = read("weekly_sales.csv");
const stock = Object.fromEntries(read("current_inventory.csv").map((r) => [r[0], Number(r[2])]));

function evalSku(id: string, festival = true) {
  const s = skus.find((r) => r[0] === id)!;
  return evaluateSku(
    {
      skuId: id,
      name: s[1],
      perishability: s[3] as "Low" | "High",
      standardReorderQty: Number(s[4]),
      unitsOnHand: stock[id],
      weeklySales: sales.filter((r) => r[0] === id).map((r) => Number(r[2])),
    },
    festival,
  );
}

test("SKU001 mango drink: high demand + stockout -> reorder 1.5x now", () => {
  const e = evalSku("SKU001");
  assert.deepEqual(e.flags.sort(), ["high_demand", "stockout_risk"]);
  assert.equal(e.action, "reorder_now");
  assert.equal(e.suggestedQty, 750);
});

test("SKU004 almond milk (high perishability): below 3-week minimum", () => {
  const e = evalSku("SKU004");
  assert.equal(e.minWeeks, 3);
  assert.ok(e.weeksCover < 3);
  assert.equal(e.action, "reorder_now");
  assert.equal(e.suggestedQty, 150);
});

test("SKU006 quinoa: overstock -> pause", () => {
  const e = evalSku("SKU006");
  assert.equal(e.action, "pause");
  assert.equal(e.suggestedQty, 0);
});

test("SKU007 coconut water: over 4-week perishable max -> pause", () => {
  const e = evalSku("SKU007");
  assert.equal(e.maxWeeks, 4);
  assert.equal(e.action, "pause");
});

test("festival uplift is applied before the cover check", () => {
  // 700 units at 100/week = 7 weeks (fine); with +25% demand = 5.6 weeks (stockout risk).
  const sku = { skuId: "X", name: "X", perishability: "Low" as const, standardReorderQty: 200, unitsOnHand: 700, weeklySales: Array(16).fill(100) };
  assert.equal(evaluateSku(sku, false).action, "hold");
  const festival = evaluateSku(sku, true);
  assert.equal(festival.action, "reorder_now");
  assert.equal(festival.weeksCover, 5.6);
});

test("SKU002 oats cookies: within limits", () => {
  const e = evalSku("SKU002");
  assert.equal(e.action, "hold");
  assert.deepEqual(e.flags, []);
});

test("short history goes to planner judgment", () => {
  const e = evaluateSku(
    { skuId: "NEW", name: "New launch", perishability: "Low", standardReorderQty: 100, unitsOnHand: 50, weeklySales: [10, 12, 15] },
    false,
  );
  assert.equal(e.action, "judgment");
  assert.deepEqual(e.flags, ["needs_judgment"]);
});
