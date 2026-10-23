import type { Metadata } from "next";
import { Check, Minus, X } from "lucide-react";
import { RULES } from "@/lib/rules";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Why this, first" };

type Mark = "yes" | "partial" | "no";

const CHECKS: { check: string; demand: Mark; service: Mark; ops: Mark; note: string }[] = [
  { check: "Loss is quantified in ₹", demand: "yes", service: "partial", ops: "partial", note: "₹28–34L/qtr vs one ₹9L incident vs anecdotes + ₹28L account at risk" },
  { check: "A numeric baseline exists today", demand: "yes", service: "no", ops: "yes", note: "No archived WhatsApp data, no categories, no response times in Distributor Service" },
  { check: "Data is available and structured", demand: "yes", service: "no", ops: "yes", note: "3 yrs SAP exports confirmed vs unstructured WhatsApp threads" },
  { check: "Decision logic can be written down", demand: "yes", service: "partial", ops: "yes", note: "Raghav documented rules covering 80–85% of decisions" },
  { check: "Bottleneck is something software can remove", demand: "yes", service: "partial", ops: "no", note: "Raghav: “the manual data work is” the bottleneck; Ops’ bottleneck is who acts and how fast" },
  { check: "Clear owner who will use it weekly", demand: "yes", service: "partial", ops: "no", note: "Raghav reviews; procurement acts. Ops has no one who monitors SAP daily" },
  { check: "Human stays in the loop where AI is weak", demand: "yes", service: "partial", ops: "yes", note: "Every PO needs planner approval; judgment cases routed to Raghav" },
  { check: "Fits ₹15L, 90 days, no AI team", demand: "yes", service: "partial", ops: "yes", note: "Rules + thin AI layer + existing SAP/Zoho; WhatsApp Business API + SAP lookups is a bigger build" },
  { check: "Outcome measurable within a quarter", demand: "yes", service: "no", ops: "partial", note: "Stockout + write-off ₹ are already tracked; CS has nothing to compare against" },
];

function MarkIcon({ m }: { m: Mark }) {
  if (m === "yes") return <span className="inline-flex items-center gap-1 text-[#16661a]"><Check className="size-4" aria-hidden /><span className="sr-only">Yes</span></span>;
  if (m === "partial") return <span className="inline-flex items-center gap-1 text-[#b07a00]"><Minus className="size-4" aria-hidden /><span className="sr-only">Partial</span></span>;
  return <span className="inline-flex items-center gap-1 text-critical"><X className="size-4" aria-hidden /><span className="sr-only">No</span></span>;
}

const DECISIONS = [
  {
    title: "1 · Outcome",
    body: "After this system runs, procurement places orders from SAP data no more than 3–4 days old, twice a week, and Freshroots’ quarterly demand-planning losses (stockouts + overstock write-offs) fall from ₹28–34 lakhs to ₹20 lakhs or less within two quarters.",
  },
  {
    title: "2 · Baseline",
    body: "Monthly cycle; 2 working days of manual SAP → Excel work per cycle; forecast data 3–4 weeks old when it reaches procurement; stockouts ₹18–22L/qtr; overstock write-offs ₹10–12L/qtr (mostly perishables).",
  },
  {
    title: "3 · Workflow change",
    body: "Raghav moves from pulling data to reviewing decisions. Data refresh from SAP is automated; the rules run on click; Raghav approves, edits or rejects every flag, and judgment cases (new launches, volatile SKUs) are routed to him explicitly. POs land in Zoho as drafts only. To counter automation bias there is no “approve all” button and every edit from the rule quantity is visible.",
  },
  {
    title: "4 · Measurement",
    body: "In the world, not the logs: stockout incidents per SKU-week, overstock write-off ₹, age of data at PO creation, and Raghav’s hours per cycle. Secondary: override rate (how often Raghav changes the rule quantity) and the reason, reviewed monthly to improve the rules.",
  },
  {
    title: "5 · Kill criterion",
    body: "Stop and redesign if, after 8 weeks of twice-weekly runs, stockout + write-off ₹ is not below the baseline run-rate, or if Raghav overrides more than 30% of rule quantities for 3 cycles in a row (the rules no longer describe reality). Halt immediately if a PO ever reaches Zoho without an approval record.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="Why demand planning, first"
        subtitle="Deepa’s 90-day mandate: ₹15 lakhs, no AI team, something running by Q1. Three candidate areas, one build."
      />

      <section className="card relative overflow-x-auto">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">Pre-build checks across the three briefs</h2>
          <p className="text-xs text-muted">✓ passes · – partial · ✕ fails</p>
        </div>
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-page text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium sm:px-5">Check</th>
              <th className="px-3 py-2 text-center font-medium">Demand planning</th>
              <th className="px-3 py-2 text-center font-medium">Distributor service</th>
              <th className="px-3 py-2 text-center font-medium">Ops intelligence</th>
              <th className="px-4 py-2 font-medium">Evidence from the briefs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {CHECKS.map((c) => (
              <tr key={c.check}>
                <td className="px-4 py-2.5 font-medium sm:px-5">{c.check}</td>
                <td className="px-3 py-2.5 text-center"><MarkIcon m={c.demand} /></td>
                <td className="px-3 py-2.5 text-center"><MarkIcon m={c.service} /></td>
                <td className="px-3 py-2.5 text-center"><MarkIcon m={c.ops} /></td>
                <td className="px-4 py-2.5 text-ink-2">{c.note}</td>
              </tr>
            ))}
            <tr className="bg-page font-semibold">
              <td className="px-4 py-2.5 sm:px-5">Score</td>
              <td className="px-3 py-2.5 text-center">9 / 9</td>
              <td className="px-3 py-2.5 text-center">0 / 9 <span className="font-normal text-muted">(6 partial)</span></td>
              <td className="px-3 py-2.5 text-center">5 / 9 <span className="font-normal text-muted">(2 partial)</span></td>
              <td className="px-4 py-2.5 font-normal text-ink-2">
                Distributor Service is first in line once query logging creates a baseline. Ops Intelligence needs an owner and a daily
                decision process before software.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        {DECISIONS.map((d) => (
          <div key={d.title} className="card p-4 sm:p-5">
            <h3 className="text-sm font-semibold">{d.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{d.body}</p>
          </div>
        ))}
        <div className="card p-4 sm:p-5">
          <h3 className="text-sm font-semibold">What the AI does — and doesn’t</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-ink-2">
            <li>Rules compute every flag and quantity (deterministic, auditable).</li>
            <li>Gemini writes a plain-English reason per SKU and a briefing for Raghav. It never sets numbers.</li>
            <li>If Gemini fails, the run still completes with the exact rule trace.</li>
            <li>Zoho receives drafts only, after validation of vendor, item, rate and quantity.</li>
          </ul>
        </div>
      </section>

      <section className="card mt-4 p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Encoded rules (from Raghav’s documentation)</h2>
        <ul className="tabular mt-2 grid gap-2 text-sm text-ink-2 sm:grid-cols-2">
          <li>High demand: last 4 wks &gt; {RULES.highDemandThresholdPct}% above 12-wk avg → reorder {RULES.highDemandMultiplier}× standard</li>
          <li>Stockout risk: stock &lt; {RULES.standard.minWeeks} wks of avg weekly sales → reorder now</li>
          <li>Overstock risk: stock &gt; {RULES.standard.maxWeeks} wks → pause next order</li>
          <li>Festival months (Oct, Nov, Mar): +{RULES.festivalUplift * 100}% demand before checks</li>
          <li>High perishability: min {RULES.highPerishability.minWeeks} / max {RULES.highPerishability.maxWeeks} wks of stock</li>
          <li>Added: &lt;{RULES.minHistoryWeeks} wks history or volatile sales → “needs judgment” (Raghav’s 15–20%)</li>
        </ul>
      </section>
    </>
  );
}
