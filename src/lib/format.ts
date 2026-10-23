import type { Action, Flag } from "./rules";

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const int = (n: number) => new Intl.NumberFormat("en-IN").format(Math.round(n));

export const dateTime = (d: Date | string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(d));

export const dateOnly = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(d));

export const FLAG_META: Record<Flag, { label: string; tone: "critical" | "serious" | "warning" | "info" }> = {
  stockout_risk: { label: "Stockout risk", tone: "critical" },
  overstock_risk: { label: "Overstock", tone: "serious" },
  high_demand: { label: "High demand", tone: "warning" },
  needs_judgment: { label: "Needs judgment", tone: "info" },
};

export const ACTION_LABEL: Record<Action, string> = {
  reorder_now: "Reorder now",
  reorder_1_5x: "Reorder 1.5×",
  pause: "Pause next order",
  hold: "No action",
  judgment: "Planner decides",
};
