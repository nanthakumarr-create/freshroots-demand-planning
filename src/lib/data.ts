import "server-only";
import { sql } from "./db";
import type { Action, Flag } from "./rules";

export interface SkuRow {
  sku_id: string;
  name: string;
  category: string;
  perishability: "Low" | "High";
  standard_reorder_qty: number;
  unit_of_measure: string;
  distributor_id: string;
  distributor_name: string;
  region: string;
  purchase_rate: number;
  zoho_item_id: string | null;
  zoho_vendor_id: string | null;
  units_on_hand: number;
  as_of_date: string;
}

export interface RunRow {
  id: string;
  created_at: Date;
  as_of_date: string;
  festival_month: boolean;
  sku_count: number;
  flagged_count: number;
  ai_summary: string | null;
  ai_model: string | null;
  ai_error: string | null;
}

export interface RecommendationRow {
  id: string;
  run_id: string;
  sku_id: string;
  sku_name: string;
  category: string;
  perishability: "Low" | "High";
  distributor_name: string;
  standard_reorder_qty: number;
  purchase_rate: number;
  priority: number;
  avg_12w: number;
  avg_4w: number;
  demand_change_pct: number;
  planning_demand: number;
  units_on_hand: number;
  weeks_cover: number;
  min_weeks: number;
  max_weeks: number;
  flags: Flag[];
  action: Action;
  suggested_qty: number;
  approved_qty: number | null;
  status: "pending" | "approved" | "rejected" | "ordered" | "no_action";
  rule_reason: string;
  ai_reason: string | null;
  reviewer_note: string | null;
}

export interface PurchaseOrderRow {
  id: string;
  created_at: Date;
  run_id: string;
  distributor_id: string;
  distributor_name: string;
  zoho_po_id: string | null;
  zoho_po_number: string | null;
  zoho_status: string | null;
  total: number | null;
  line_items: { sku_id: string; name: string; quantity: number; rate: number }[];
  error: string | null;
}

export async function getSkus(): Promise<SkuRow[]> {
  const rows = await sql<SkuRow[]>`
    select s.sku_id, s.name, s.category, s.perishability, s.standard_reorder_qty, s.unit_of_measure,
           s.distributor_id, d.name as distributor_name, d.region, s.purchase_rate::float8 as purchase_rate,
           s.zoho_item_id, d.zoho_vendor_id,
           coalesce(i.units_on_hand, 0) as units_on_hand, coalesce(i.as_of_date::text, '') as as_of_date
    from freshroots.skus s
    join freshroots.distributors d using (distributor_id)
    left join lateral (
      select sum(units_on_hand)::int as units_on_hand, max(as_of_date) as as_of_date
      from freshroots.inventory_snapshots x
      where x.sku_id = s.sku_id
        and x.as_of_date = (select max(as_of_date) from freshroots.inventory_snapshots)
    ) i on true
    order by s.sku_id`;
  return rows;
}

export async function getWeeklySales() {
  return sql<{ sku_id: string; week: string; units_sold: number }[]>`
    select sku_id, week, units_sold from freshroots.weekly_sales order by week, sku_id`;
}

export async function isFestivalMonth(asOf: string) {
  const [row] = await sql<{ is_festival_month: boolean }[]>`
    select is_festival_month from freshroots.calendar where year_month = ${asOf.slice(0, 7)}`;
  return row?.is_festival_month ?? false;
}

export async function getLatestRun(): Promise<RunRow | null> {
  const [run] = await sql<RunRow[]>`
    select id, created_at, as_of_date::text, festival_month, sku_count, flagged_count, ai_summary, ai_model, ai_error
    from freshroots.planning_runs order by created_at desc limit 1`;
  return run ?? null;
}

export async function getRun(id: string): Promise<RunRow | null> {
  const [run] = await sql<RunRow[]>`
    select id, created_at, as_of_date::text, festival_month, sku_count, flagged_count, ai_summary, ai_model, ai_error
    from freshroots.planning_runs where id = ${id}`;
  return run ?? null;
}

export async function getRunCount() {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from freshroots.planning_runs`;
  return r.n;
}

export async function getRecommendations(runId: string): Promise<RecommendationRow[]> {
  return sql<RecommendationRow[]>`
    select r.id, r.run_id, r.sku_id, s.name as sku_name, s.category, s.perishability, d.name as distributor_name,
           s.standard_reorder_qty, s.purchase_rate::float8 as purchase_rate, r.priority,
           r.avg_12w::float8 as avg_12w, r.avg_4w::float8 as avg_4w, r.demand_change_pct::float8 as demand_change_pct,
           r.planning_demand::float8 as planning_demand, r.units_on_hand, r.weeks_cover::float8 as weeks_cover,
           r.min_weeks::float8 as min_weeks, r.max_weeks::float8 as max_weeks, r.flags, r.action,
           r.suggested_qty, r.approved_qty, r.status, r.rule_reason, r.ai_reason, r.reviewer_note
    from freshroots.recommendations r
    join freshroots.skus s using (sku_id)
    join freshroots.distributors d on d.distributor_id = s.distributor_id
    where r.run_id = ${runId}
    order by r.priority, r.weeks_cover, r.sku_id`;
}

export async function getPurchaseOrders(): Promise<PurchaseOrderRow[]> {
  return sql<PurchaseOrderRow[]>`
    select p.id, p.created_at, p.run_id, p.distributor_id, d.name as distributor_name, p.zoho_po_id,
           p.zoho_po_number, p.zoho_status, p.total::float8 as total, p.line_items, p.error
    from freshroots.purchase_orders p
    join freshroots.distributors d using (distributor_id)
    order by p.created_at desc
    limit 100`;
}
