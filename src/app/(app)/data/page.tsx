import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { AlertTriangle, Database } from "lucide-react";
import { getSkus, getWeeklySales } from "@/lib/data";
import { dateOnly, inr, int } from "@/lib/format";
import { PageHeader, Pill, PageSkeleton } from "@/components/ui";

export const metadata: Metadata = { title: "SAP data" };

const QUALITY_NOTES = [
  "Distributor master lists PeakSource Supply (Karnataka) and Meridian Trade Co. (Gujarat), but the brief says Freshroots only distributes in Maharashtra and Goa. Kept as-is; confirm with IT before go-live.",
  "Each SKU maps to exactly one distributor, while the brief describes 1,200 distributors. Real SAP exports will need a SKU × distributor sales table.",
  "Only 16 weeks of sales (2026-W27 to W42) are in the sample, against three years in SAP. The rules need 12; the extra history would allow back-testing.",
  "Purchase rates are not in the SAP export. The rates shown are demo values used only to price Zoho draft POs.",
];

async function Content() {
  await connection();
  const [skus, sales] = await Promise.all([getSkus(), getWeeklySales()]);
  const weeks = [...new Set(sales.map((s) => s.week))];
  const recentWeeks = weeks.slice(-8);

  return (
    <>
      <PageHeader
        title="SAP data"
        subtitle={
          <span className="inline-flex items-center gap-2">
            <Database className="size-4" aria-hidden />
            Simulated SAP in Supabase · {skus.length} SKUs · {sales.length} weekly sales rows · stock as of {skus[0]?.as_of_date ? dateOnly(skus[0].as_of_date) : "—"}
          </span>
        }
      />

      <section className="card mb-4 border-[#f6dd9d] bg-[#fffaf0] p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="size-4 text-[#b07a00]" aria-hidden /> Data quality notes
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
          {QUALITY_NOTES.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </section>

      <section className="card mb-4 overflow-x-auto">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">SKU master + current stock</h2>
        </div>
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-page text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">SKU</th>
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Perishability</th>
              <th className="px-4 py-2 text-right font-medium">Std reorder</th>
              <th className="px-4 py-2 text-right font-medium">On hand</th>
              <th className="px-4 py-2 font-medium">Distributor</th>
              <th className="px-4 py-2 text-right font-medium">Demo rate</th>
              <th className="px-4 py-2 font-medium">Zoho</th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-line">
            {skus.map((s) => (
              <tr key={s.sku_id}>
                <td className="px-4 py-2 text-muted">{s.sku_id}</td>
                <td className="px-4 py-2 font-medium">{s.name.replace("Freshroots ", "")}</td>
                <td className="px-4 py-2">{s.category}</td>
                <td className="px-4 py-2">{s.perishability === "High" ? <Pill tone="serious">High</Pill> : <Pill>Low</Pill>}</td>
                <td className="px-4 py-2 text-right">{int(s.standard_reorder_qty)}</td>
                <td className="px-4 py-2 text-right">{int(s.units_on_hand)}</td>
                <td className="px-4 py-2">
                  {s.distributor_name} <span className="text-muted">· {s.region}</span>
                </td>
                <td className="px-4 py-2 text-right">{inr(s.purchase_rate)}</td>
                <td className="px-4 py-2">{s.zoho_item_id ? <Pill tone="good">Mapped</Pill> : <Pill tone="critical">Missing</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">Weekly units sold — last 8 weeks</h2>
        </div>
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-page text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">SKU</th>
              {recentWeeks.map((w) => (
                <th key={w} className="px-3 py-2 text-right font-medium">{w.slice(5)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-line">
            {skus.map((s) => (
              <tr key={s.sku_id}>
                <td className="px-4 py-2 font-medium">{s.sku_id}</td>
                {recentWeeks.map((w) => (
                  <td key={w} className="px-3 py-2 text-right">
                    {sales.find((x) => x.sku_id === s.sku_id && x.week === w)?.units_sold ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

export default function DataPage() {
  return (
    <Suspense fallback={<PageSkeleton title="SAP data" />}>
      <Content />
    </Suspense>
  );
}
