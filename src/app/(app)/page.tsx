import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { AlertOctagon, Archive, ArrowRight, CalendarClock, Flame, IndianRupee, PlayCircle, Sparkles } from "lucide-react";
import { getLatestRun, getRecommendations, getSkus, getWeeklySales } from "@/lib/data";
import { ACTION_LABEL, dateOnly, dateTime, inr, int } from "@/lib/format";
import { CoverChart, TrendChart, type CoverDatum } from "@/components/charts";
import { RunButton } from "@/components/run-button";
import { EmptyState, FlagPill, PageHeader, Pill, StatTile, PageSkeleton } from "@/components/ui";

async function Content() {
  await connection();
  const run = await getLatestRun();
  const [skus, sales] = await Promise.all([getSkus(), getWeeklySales()]);
  const asOf = skus[0]?.as_of_date;

  if (!run) {
    return (
      <>
        <PageHeader title="Demand planning" subtitle={`SAP data as of ${asOf ? dateOnly(asOf) : "—"}`} />
        <EmptyState
          icon={PlayCircle}
          title="No planning run yet"
          body="Run demand planning to pull the latest SAP sales and stock, apply Raghav's rules, and build this week's review queue."
          action={<RunButton />}
        />
      </>
    );
  }

  const recs = await getRecommendations(run.id);
  const count = (flag: string) => recs.filter((r) => r.flags.includes(flag as never)).length;
  const reorderValue = recs
    .filter((r) => r.suggested_qty > 0)
    .reduce((sum, r) => sum + r.suggested_qty * r.purchase_rate, 0);
  const pending = recs.filter((r) => r.status === "pending").length;
  const priority = recs.filter((r) => r.action !== "hold").slice(0, 6);

  const cover: CoverDatum[] = recs.map((r) => ({
    sku: r.sku_id,
    name: r.sku_name,
    cover: r.weeks_cover,
    min: r.min_weeks,
    max: r.max_weeks,
    status: r.flags.includes("stockout_risk")
      ? "Stockout risk"
      : r.flags.includes("overstock_risk")
        ? "Overstock"
        : r.flags.includes("high_demand")
          ? "High demand"
          : "Within limits",
  }));

  const trend = skus.map((s) => ({
    sku: s.sku_id,
    name: s.name.replace("Freshroots ", ""),
    weeks: sales.filter((w) => w.sku_id === s.sku_id).map((w) => ({ week: w.week, units: w.units_sold })),
  }));

  return (
    <>
      <PageHeader
        title="Demand planning"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>Last run {dateTime(run.created_at)} · SAP data as of {dateOnly(run.as_of_date)}</span>
            {run.festival_month && <Pill tone="warning">Festival month · +25% demand</Pill>}
          </span>
        }
        actions={<RunButton label="Run again" />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Stockout risk" value={count("stockout_risk")} hint="Below minimum weeks of cover" icon={AlertOctagon} tone="critical" />
        <StatTile label="Overstock risk" value={count("overstock_risk")} hint="Above maximum weeks of cover" icon={Archive} tone="serious" />
        <StatTile label="High demand" value={count("high_demand")} hint="Last 4 wks >20% above 12-wk avg" icon={Flame} tone="warning" />
        <StatTile label="Suggested reorder value" value={inr(reorderValue)} hint="At demo purchase rates" icon={IndianRupee} tone="info" />
      </div>

      <div className="card mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f1eefc] text-[#6250d6]">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">AI briefing for Raghav</p>
          {run.ai_summary ? (
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{run.ai_summary}</p>
          ) : (
            <p className="mt-1 text-sm text-ink-2">
              AI notes unavailable for this run{run.ai_error ? ` (${run.ai_error})` : ""}. The rule-based reasons below are complete on their own.
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            Written by {run.ai_model ?? "Gemini"} from the rule outputs. AI explains the numbers; the rules set them.
          </p>
        </div>
        <Link
          href={`/review?run=${run.id}`}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-page"
        >
          Review {pending} pending <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <section className="card p-4 sm:p-5 xl:col-span-3">
          <h2 className="text-sm font-semibold">Weeks of stock cover by SKU</h2>
          <p className="mb-4 text-xs text-muted">Stock on hand ÷ weekly demand (after festival uplift)</p>
          <CoverChart data={cover} />
        </section>
        <section className="card p-4 sm:p-5 xl:col-span-2">
          <h2 className="text-sm font-semibold">Demand trend</h2>
          <p className="mb-4 text-xs text-muted">16 weeks of SAP sales · W27–W42 2026</p>
          <TrendChart series={trend} />
        </section>
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold">Priority SKUs</h2>
            <p className="text-xs text-muted">Most urgent first</p>
          </div>
          <Link href={`/review?run=${run.id}`} className="text-sm font-medium text-brand hover:underline">
            Open review queue
          </Link>
        </div>
        <ul className="divide-y divide-line">
          {priority.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  <span className="text-muted">{r.sku_id}</span> · {r.sku_name.replace("Freshroots ", "")}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {r.flags.map((f) => <FlagPill key={f} flag={f} />)}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="tabular text-ink-2">{r.weeks_cover.toFixed(1)} wks cover</span>
                <span className="tabular w-36 text-right font-medium">
                  {ACTION_LABEL[r.action]}{r.suggested_qty > 0 ? ` · ${int(r.suggested_qty)}` : ""}
                </span>
              </div>
            </li>
          ))}
          {!priority.length && (
            <li className="flex items-center gap-2 px-5 py-6 text-sm text-ink-2">
              <CalendarClock className="size-4" aria-hidden /> Every SKU is within its limits this cycle.
            </li>
          )}
        </ul>
      </section>
    </>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Demand planning" />}>
      <Content />
    </Suspense>
  );
}
