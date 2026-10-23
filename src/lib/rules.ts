// Raghav Kulkarni's documented forecasting rules, encoded as a pure function.
// Every number the app shows or sends to Zoho comes from here, never from the AI.

export const RULES = {
  highDemandThresholdPct: 20, // last-4-week avg more than 20% above 12-week avg
  highDemandMultiplier: 1.5, // reorder at 1.5x standard quantity
  standard: { minWeeks: 6, maxWeeks: 14 },
  highPerishability: { minWeeks: 3, maxWeeks: 4 },
  festivalUplift: 0.25, // Oct, Nov, Mar: +25% demand before threshold checks
  minHistoryWeeks: 12,
  volatilityCv: 0.25, // coefficient of variation above this -> flag for Raghav's judgment
} as const;

export type Flag =
  | "stockout_risk"
  | "overstock_risk"
  | "high_demand"
  | "needs_judgment";

export type Action = "reorder_now" | "reorder_1_5x" | "pause" | "hold" | "judgment";

export interface SkuInput {
  skuId: string;
  name: string;
  perishability: "Low" | "High";
  standardReorderQty: number;
  unitsOnHand: number;
  /** Weekly units sold, oldest first. */
  weeklySales: number[];
}

export interface Evaluation {
  skuId: string;
  avg12w: number;
  avg4w: number;
  demandChangePct: number;
  planningDemand: number;
  weeksCover: number;
  minWeeks: number;
  maxWeeks: number;
  flags: Flag[];
  action: Action;
  suggestedQty: number;
  priority: number;
  ruleReason: string;
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function evaluateSku(sku: SkuInput, festivalMonth: boolean): Evaluation {
  const window = sku.perishability === "High" ? RULES.highPerishability : RULES.standard;
  const history = sku.weeklySales;
  const flags: Flag[] = [];
  const notes: string[] = [];

  if (history.length < RULES.minHistoryWeeks) {
    const avg = history.length ? mean(history) : 0;
    return {
      skuId: sku.skuId,
      avg12w: round(avg),
      avg4w: round(history.length ? mean(history.slice(-4)) : 0),
      demandChangePct: 0,
      planningDemand: round(avg),
      weeksCover: avg > 0 ? round(sku.unitsOnHand / avg) : 0,
      minWeeks: window.minWeeks,
      maxWeeks: window.maxWeeks,
      flags: ["needs_judgment"],
      action: "judgment",
      suggestedQty: 0,
      priority: 3,
      ruleReason: `Only ${history.length} weeks of sales history (rules need ${RULES.minHistoryWeeks}). Treat like a new launch: Raghav to decide.`,
    };
  }

  const last12 = history.slice(-12);
  const avg12 = mean(last12);
  const avg4 = mean(history.slice(-4));
  const uplift = festivalMonth ? 1 + RULES.festivalUplift : 1;
  // The uplift applies to demand before any threshold check. Applying it to both averages
  // leaves the 4w-vs-12w ratio unchanged, so only the stock-cover checks move.
  const planningDemand = avg12 * uplift;
  const demandChangePct = (avg4 / avg12 - 1) * 100;
  const weeksCover = planningDemand > 0 ? sku.unitsOnHand / planningDemand : Infinity;

  const highDemand = demandChangePct > RULES.highDemandThresholdPct;
  const stockout = weeksCover < window.minWeeks;
  const overstock = weeksCover > window.maxWeeks;
  if (stockout) flags.push("stockout_risk");
  if (overstock) flags.push("overstock_risk");
  if (highDemand) flags.push("high_demand");

  const sd = Math.sqrt(mean(last12.map((x) => (x - avg12) ** 2)));
  if (avg12 > 0 && sd / avg12 > RULES.volatilityCv) {
    flags.push("needs_judgment");
    notes.push("Sales are unusually volatile, so check this one by hand.");
  }

  const coverText = `${round(weeksCover, 1)} wks of cover vs ${window.minWeeks}–${window.maxWeeks} wk window${sku.perishability === "High" ? " (high perishability)" : ""}`;
  const demandText = festivalMonth
    ? `Festival month: weekly demand uplifted 25% to ${Math.round(planningDemand)} units.`
    : `Weekly demand ${Math.round(planningDemand)} units.`;
  const trendText = `Last 4 wks ${demandChangePct >= 0 ? "+" : ""}${round(demandChangePct, 1)}% vs 12-wk avg.`;

  let action: Action;
  let suggestedQty = 0;
  let priority: number;
  let decision: string;

  if (overstock) {
    action = "pause";
    priority = 4;
    decision = "Overstock risk: pause the next order.";
    if (highDemand) notes.push("Demand is rising too, so the overstock may clear faster than usual.");
  } else if (stockout) {
    action = "reorder_now";
    suggestedQty = Math.round(sku.standardReorderQty * (highDemand ? RULES.highDemandMultiplier : 1));
    priority = 1;
    decision = highDemand
      ? `Stockout risk + high demand: reorder ${suggestedQty} units now (1.5× standard ${sku.standardReorderQty}).`
      : `Stockout risk: reorder ${suggestedQty} units now (standard quantity).`;
  } else if (highDemand) {
    action = "reorder_1_5x";
    suggestedQty = Math.round(sku.standardReorderQty * RULES.highDemandMultiplier);
    priority = 2;
    decision = `High demand: reorder ${suggestedQty} units (1.5× standard ${sku.standardReorderQty}).`;
  } else {
    action = "hold";
    priority = 5;
    decision = "Within limits: no order needed this cycle.";
  }

  return {
    skuId: sku.skuId,
    avg12w: round(avg12),
    avg4w: round(avg4),
    demandChangePct: round(demandChangePct),
    planningDemand: round(planningDemand),
    weeksCover: round(weeksCover),
    minWeeks: window.minWeeks,
    maxWeeks: window.maxWeeks,
    flags,
    action,
    suggestedQty,
    priority,
    ruleReason: [decision, coverText + ".", trendText, demandText, ...notes].join(" "),
  };
}
