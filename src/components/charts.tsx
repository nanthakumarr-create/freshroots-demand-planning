"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const INK = { grid: "#e1e0d9", axis: "#898781", text: "#52514e" };
const STATUS = { critical: "#d03b3b", serious: "#ec835a", warning: "#fab219", good: "#0ca30c" };
const SERIES = "#2a78d6";

export interface CoverDatum {
  sku: string;
  name: string;
  cover: number;
  min: number;
  max: number;
  status: "Stockout risk" | "Overstock" | "High demand" | "Within limits";
}

const STATUS_COLOR: Record<CoverDatum["status"], string> = {
  "Stockout risk": STATUS.critical,
  Overstock: STATUS.serious,
  "High demand": STATUS.warning,
  "Within limits": STATUS.good,
};

function TooltipBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg">{children}</div>;
}

export function CoverChart({ data }: { data: CoverDatum[] }) {
  const sorted = [...data].sort((a, b) => a.cover - b.cover);
  const cap = 24;
  const rows = sorted.map((d) => ({ ...d, shown: Math.min(d.cover, cap) }));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {(Object.keys(STATUS_COLOR) as CoverDatum["status"][]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: STATUS_COLOR[s] }} />
            {s}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-[#898781]" /> 6 / 14 wk standard window
        </span>
      </div>
      <div style={{ height: rows.length * 26 + 40 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }} barCategoryGap={4}>
            <CartesianGrid horizontal={false} stroke={INK.grid} />
            <XAxis
              type="number"
              domain={[0, cap]}
              ticks={[0, 3, 6, 10, 14, 20, 24]}
              tick={{ fill: INK.axis, fontSize: 11 }}
              axisLine={{ stroke: "#c3c2b7" }}
              tickLine={false}
              unit="w"
            />
            <YAxis
              type="category"
              dataKey="sku"
              width={56}
              tick={{ fill: INK.text, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine x={6} stroke="#898781" strokeDasharray="4 3" />
            <ReferenceLine x={14} stroke="#898781" strokeDasharray="4 3" />
            <Tooltip
              cursor={{ fill: "#f1f2f5" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as CoverDatum;
                return (
                  <TooltipBox>
                    <p className="font-semibold text-ink">{d.sku} · {d.name}</p>
                    <p className="mt-1 text-ink-2">
                      Cover <b className="text-ink">{d.cover >= 999 ? "∞" : d.cover.toFixed(1)} wks</b> · window {d.min}–{d.max} wks
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-ink-2">
                      <span className="size-2 rounded-sm" style={{ background: STATUS_COLOR[d.status] }} />
                      {d.status}
                    </p>
                  </TooltipBox>
                );
              }}
            />
            <Bar dataKey="shown" radius={[0, 4, 4, 0]} maxBarSize={16} label={{ position: "right", fontSize: 10, fill: INK.text, formatter: (v: unknown) => `${Number(v).toFixed(1)}` }}>
              {rows.map((d) => (
                <Cell key={d.sku} fill={STATUS_COLOR[d.status]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted">High-perishability SKUs (SKU004, SKU007, SKU011) use a tighter 3–4 week window — hover a bar for its limits.</p>
    </div>
  );
}

export interface TrendSeries {
  sku: string;
  name: string;
  weeks: { week: string; units: number }[];
}

export function TrendChart({ series }: { series: TrendSeries[] }) {
  const [selected, setSelected] = useState("ALL");
  const data = useMemo(() => {
    if (selected !== "ALL") return series.find((s) => s.sku === selected)?.weeks ?? [];
    const totals = new Map<string, number>();
    for (const s of series) for (const w of s.weeks) totals.set(w.week, (totals.get(w.week) ?? 0) + w.units);
    return [...totals.entries()].sort().map(([week, units]) => ({ week, units }));
  }, [selected, series]);

  const last12 = data.slice(-12);
  const avg12 = last12.length ? last12.reduce((a, b) => a + b.units, 0) / last12.length : 0;
  const label = selected === "ALL" ? "All SKUs" : `${selected} · ${series.find((s) => s.sku === selected)?.name}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">Weekly units sold — {label}</p>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm"
          aria-label="Choose SKU"
        >
          <option value="ALL">All SKUs</option>
          {series.map((s) => (
            <option key={s.sku} value={s.sku}>
              {s.sku} · {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke={INK.grid} />
            <XAxis
              dataKey="week"
              tickFormatter={(w: string) => w.slice(5)}
              tick={{ fill: INK.axis, fontSize: 11 }}
              axisLine={{ stroke: "#c3c2b7" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: INK.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
              domain={[(min: number) => Math.max(0, Math.floor((min * 0.8) / 10) * 10), (max: number) => Math.ceil((max * 1.1) / 10) * 10]}
            />
            <ReferenceLine
              y={avg12}
              stroke="#898781"
              strokeDasharray="4 3"
              label={{ value: `12-wk avg ${Math.round(avg12)}`, position: "insideTopLeft", fill: INK.text, fontSize: 11 }}
            />
            <Tooltip
              cursor={{ stroke: "#c3c2b7" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as { week: string; units: number };
                return (
                  <TooltipBox>
                    <p className="font-semibold text-ink">{d.week}</p>
                    <p className="text-ink-2">
                      <b className="text-ink">{d.units.toLocaleString("en-IN")}</b> units
                    </p>
                  </TooltipBox>
                );
              }}
            />
            <Line isAnimationActive={false} type="monotone" dataKey="units" stroke={SERIES} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
