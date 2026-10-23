"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Check, CheckCircle2, ExternalLink, Loader2, RotateCcw, Search, Send, Sparkles, X, XCircle } from "lucide-react";
import { createPurchaseOrders, reviewRecommendation } from "@/app/actions";
import type { RecommendationRow } from "@/lib/data";
import { ACTION_LABEL, inr, int } from "@/lib/format";
import { FlagPill, Pill } from "@/components/ui";

type Tab = "review" | "approved" | "all";

const STATUS_PILL: Record<RecommendationRow["status"], { tone: "warning" | "good" | "neutral" | "info" | "critical"; label: string }> = {
  pending: { tone: "warning", label: "Needs review" },
  approved: { tone: "good", label: "Approved" },
  rejected: { tone: "neutral", label: "Rejected" },
  ordered: { tone: "info", label: "PO drafted" },
  no_action: { tone: "neutral", label: "No action" },
};

function Row({ rec }: { rec: RecommendationRow }) {
  const [qty, setQty] = useState(String(rec.approved_qty ?? rec.suggested_qty));
  const [error, setError] = useState<string | null>(null);
  const [showRule, setShowRule] = useState(!rec.ai_reason);
  const [pending, start] = useTransition();
  const isPause = rec.action === "pause";
  const locked = rec.status === "ordered" || rec.status === "no_action";
  const edited = Number(qty) !== rec.suggested_qty && !isPause;

  const decide = (decision: "approved" | "rejected" | "pending") =>
    start(async () => {
      setError(null);
      const res = await reviewRecommendation({ id: rec.id, decision, qty: Number(qty) });
      if (res?.error) setError(res.error);
    });

  const pill = STATUS_PILL[rec.status];

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">
              <span className="text-muted">{rec.sku_id}</span> · {rec.sku_name.replace("Freshroots ", "")}
            </p>
            <Pill tone={pill.tone}>{pill.label}</Pill>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {rec.category} · {rec.perishability} perishability · {rec.distributor_name}
          </p>
          {rec.flags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rec.flags.map((f) => <FlagPill key={f} flag={f} />)}
            </div>
          )}

          <dl className="tabular mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted">On hand</dt>
              <dd className="font-medium">{int(rec.units_on_hand)} units</dd>
            </div>
            <div>
              <dt className="text-muted">Weeks of cover</dt>
              <dd className="font-medium">
                {rec.weeks_cover.toFixed(1)} <span className="font-normal text-muted">/ {rec.min_weeks}–{rec.max_weeks}</span>
              </dd>
            </div>
            <div>
              <dt className="text-muted">12-wk avg / week</dt>
              <dd className="font-medium">{int(rec.avg_12w)}</dd>
            </div>
            <div>
              <dt className="text-muted">Last 4 wks vs avg</dt>
              <dd className={`font-medium ${rec.demand_change_pct > 20 ? "text-[#a4471f]" : ""}`}>
                {rec.demand_change_pct >= 0 ? "+" : ""}
                {rec.demand_change_pct.toFixed(1)}%
              </dd>
            </div>
          </dl>

          <div className="mt-3 rounded-lg bg-page px-3 py-2.5 text-sm">
            {rec.ai_reason && !showRule ? (
              <p className="flex gap-2 text-ink-2">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[#6250d6]" aria-hidden />
                <span>{rec.ai_reason}</span>
              </p>
            ) : (
              <p className="text-ink-2">{rec.rule_reason}</p>
            )}
            {rec.ai_reason && (
              <button onClick={() => setShowRule((v) => !v)} className="mt-1 text-xs font-medium text-brand hover:underline">
                {showRule ? "Show AI explanation" : "Show exact rule trace"}
              </button>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-64">
          <p className="text-xs text-muted">
            Rule says: <b className="text-ink">{ACTION_LABEL[rec.action]}</b>
            {rec.suggested_qty > 0 && <> · {int(rec.suggested_qty)} units</>}
          </p>
          {!isPause && !locked && rec.status !== "rejected" && (
            <label className="flex items-center gap-2 text-sm">
              <span className="shrink-0 whitespace-nowrap text-ink-2">Order qty</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                disabled={rec.status === "approved" || pending}
                className="tabular w-full rounded-lg border border-line px-2.5 py-1.5 text-right text-sm disabled:bg-page"
                aria-label={`Order quantity for ${rec.sku_id}`}
              />
            </label>
          )}
          {edited && rec.status === "pending" && <p className="text-xs text-[#a4471f]">Edited from rule suggestion ({rec.suggested_qty}).</p>}
          {rec.approved_qty != null && rec.status !== "pending" && !isPause && rec.status !== "rejected" && (
            <p className="tabular text-xs text-ink-2">
              Approved {int(rec.approved_qty)} × {inr(rec.purchase_rate)} = <b>{inr(rec.approved_qty * rec.purchase_rate)}</b>
            </p>
          )}

          {rec.status === "pending" && (
            <div className="flex gap-2">
              <button
                onClick={() => decide("approved")}
                disabled={pending}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#16661a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#12561a] disabled:opacity-60"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" aria-hidden />}
                {isPause ? "Confirm pause" : "Approve"}
              </button>
              <button
                onClick={() => decide("rejected")}
                disabled={pending}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-page disabled:opacity-60"
              >
                <X className="size-4" aria-hidden /> Reject
              </button>
            </div>
          )}
          {(rec.status === "approved" || rec.status === "rejected") && (
            <button
              onClick={() => decide("pending")}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-page disabled:opacity-60"
            >
              <RotateCcw className="size-4" aria-hidden /> Undo decision
            </button>
          )}
          {error && <p className="text-xs text-critical">{error}</p>}
        </div>
      </div>
    </li>
  );
}

export function ReviewQueue({ runId, recs }: { runId: string; recs: RecommendationRow[] }) {
  const [tab, setTab] = useState<Tab>("review");
  const [flag, setFlag] = useState("all");
  const [query, setQuery] = useState("");
  const [sending, startSend] = useTransition();
  const [result, setResult] = useState<Awaited<ReturnType<typeof createPurchaseOrders>> | null>(null);

  const counts = {
    review: recs.filter((r) => r.status === "pending").length,
    approved: recs.filter((r) => r.status === "approved" || r.status === "ordered").length,
    all: recs.length,
  };

  const visible = useMemo(
    () =>
      recs.filter((r) => {
        if (tab === "review" && r.status !== "pending") return false;
        if (tab === "approved" && r.status !== "approved" && r.status !== "ordered") return false;
        if (flag !== "all" && !r.flags.includes(flag as never)) return false;
        const q = query.trim().toLowerCase();
        return !q || `${r.sku_id} ${r.sku_name} ${r.category} ${r.distributor_name}`.toLowerCase().includes(q);
      }),
    [recs, tab, flag, query],
  );

  const toOrder = recs.filter((r) => r.status === "approved" && (r.approved_qty ?? 0) > 0);
  const orderValue = toOrder.reduce((s, r) => s + (r.approved_qty ?? 0) * r.purchase_rate, 0);
  const vendors = new Set(toOrder.map((r) => r.distributor_name)).size;

  return (
    <>
      <div className="card mb-4 flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center">
        <div className="flex gap-1 rounded-lg bg-page p-1" role="tablist">
          {(["review", "approved", "all"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium sm:px-3 sm:text-sm ${tab === t ? "bg-white shadow-sm" : "text-ink-2 hover:text-ink"}`}
            >
              {t === "review" ? "Needs review" : t === "approved" ? "Approved" : "All SKUs"}{" "}
              <span className="tabular text-muted">{counts[t]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SKU, product, distributor"
              className="w-full rounded-lg border border-line py-2 pr-3 pl-8 text-sm"
            />
          </label>
          <select value={flag} onChange={(e) => setFlag(e.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-2 text-sm" aria-label="Filter by flag">
            <option value="all">All flags</option>
            <option value="stockout_risk">Stockout risk</option>
            <option value="overstock_risk">Overstock</option>
            <option value="high_demand">High demand</option>
            <option value="needs_judgment">Needs judgment</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {visible.length ? (
          <ul className="divide-y divide-line">
            {visible.map((r) => <Row key={`${r.id}-${r.status}`} rec={r} />)}
          </ul>
        ) : (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <CheckCircle2 className="size-8 text-good" aria-hidden />
            <p className="mt-3 text-sm font-medium">{tab === "review" ? "All caught up — nothing left to review." : "No SKUs match these filters."}</p>
          </div>
        )}
      </div>

      {result && "results" in result && result.results && (
        <div className="card mt-4 p-4">
          <p className="text-sm font-semibold">Zoho Inventory response</p>
          <ul className="mt-2 space-y-1 text-sm">
            {result.results.map((r) => (
              <li key={r.vendor} className="flex items-start gap-2">
                {r.ok ? <CheckCircle2 className="mt-0.5 size-4 text-good" aria-hidden /> : <XCircle className="mt-0.5 size-4 text-critical" aria-hidden />}
                <span>
                  {r.vendor}: {r.ok ? <>draft PO <b>{r.message}</b> created</> : <span className="text-critical">{r.message}</span>}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/orders" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
            View purchase orders <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}
      {result && "error" in result && result.error && <p className="card mt-4 p-4 text-sm text-critical">{result.error}</p>}

      <div className="sticky bottom-0 z-20 mt-4 -mx-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="tabular text-sm text-ink-2">
            <b className="text-ink">{toOrder.length}</b> approved line{toOrder.length === 1 ? "" : "s"} · {vendors} vendor{vendors === 1 ? "" : "s"} ·{" "}
            <b className="text-ink">{inr(orderValue)}</b>
          </p>
          <button
            disabled={!toOrder.length || sending}
            onClick={() =>
              startSend(async () => {
                setResult(null);
                setResult(await createPurchaseOrders(runId));
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#256abf] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            {sending ? "Creating drafts in Zoho…" : "Create draft POs in Zoho"}
          </button>
        </div>
      </div>
    </>
  );
}
