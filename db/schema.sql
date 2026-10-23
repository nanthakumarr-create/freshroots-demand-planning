-- Freshroots demand planning: "simulated SAP" tables + planning workflow tables.
-- Lives in its own schema on the shared Supabase project. Accessed server-side only.
create schema if not exists freshroots;
set search_path = freshroots;

-- ---------- Simulated SAP master/transaction data (seeded from CSV exports) ----------
create table if not exists distributors (
  distributor_id   text primary key,
  name             text not null,
  region           text not null,
  status           text not null,
  zoho_vendor_id   text
);

create table if not exists skus (
  sku_id                text primary key,
  name                  text not null,
  category              text not null,
  perishability         text not null check (perishability in ('Low', 'High')),
  standard_reorder_qty  integer not null check (standard_reorder_qty > 0),
  unit_of_measure       text not null,
  distributor_id        text not null references distributors (distributor_id),
  -- Demo purchase rate (INR/unit). Not in the SAP export; used only to price Zoho draft POs.
  purchase_rate         numeric(10, 2) not null,
  zoho_item_id          text
);

create table if not exists weekly_sales (
  sku_id      text not null references skus (sku_id),
  week        text not null,             -- ISO week, e.g. 2026-W42
  units_sold  integer not null check (units_sold >= 0),
  primary key (sku_id, week)
);

create table if not exists inventory_snapshots (
  sku_id         text not null references skus (sku_id),
  location       text not null,
  units_on_hand  integer not null check (units_on_hand >= 0),
  as_of_date     date not null,
  primary key (sku_id, location, as_of_date)
);

create table if not exists calendar (
  year_month        text primary key,    -- 2026-10
  year              integer not null,
  month             integer not null,
  is_festival_month boolean not null
);

-- ---------- Planning workflow ----------
create table if not exists planning_runs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  as_of_date      date not null,
  festival_month  boolean not null,
  sku_count       integer not null,
  flagged_count   integer not null,
  ai_summary      text,
  ai_model        text,
  ai_error        text
);

create table if not exists recommendations (
  id                 uuid primary key default gen_random_uuid(),
  run_id             uuid not null references planning_runs (id) on delete cascade,
  sku_id             text not null references skus (sku_id),
  priority           integer not null,
  avg_12w            numeric(10, 2) not null,
  avg_4w             numeric(10, 2) not null,
  demand_change_pct  numeric(8, 2) not null,
  planning_demand    numeric(10, 2) not null,  -- weekly demand used for checks (after festival uplift)
  units_on_hand      integer not null,
  weeks_cover        numeric(8, 2) not null,
  min_weeks          numeric(5, 2) not null,
  max_weeks          numeric(5, 2) not null,
  flags              text[] not null default '{}',
  action             text not null check (action in ('reorder_now', 'reorder_1_5x', 'pause', 'hold', 'judgment')),
  suggested_qty      integer not null,
  approved_qty       integer,
  status             text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected', 'ordered', 'no_action')),
  rule_reason        text not null,
  ai_reason          text,
  reviewer_note      text,
  reviewed_at        timestamptz,
  unique (run_id, sku_id)
);

create table if not exists purchase_orders (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  run_id           uuid not null references planning_runs (id) on delete cascade,
  distributor_id   text not null references distributors (distributor_id),
  zoho_po_id       text,
  zoho_po_number   text,
  zoho_status      text,
  total            numeric(12, 2),
  line_items       jsonb not null,
  error            text
);

create index if not exists recommendations_run_idx on recommendations (run_id);
create index if not exists purchase_orders_run_idx on purchase_orders (run_id);

-- Server-only access: keep these tables away from the public PostgREST roles.
revoke all on all tables in schema freshroots from anon, authenticated;
revoke usage on schema freshroots from anon, authenticated;
