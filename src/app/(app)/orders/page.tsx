import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, FileWarning, Truck } from "lucide-react";
import { getPurchaseOrders } from "@/lib/data";
import { zohoPoUrl } from "@/lib/zoho";
import { dateTime, inr, int } from "@/lib/format";
import { EmptyState, PageHeader, Pill, StatTile, PageSkeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Purchase orders" };

async function Content() {
  await connection();
  const orders = await getPurchaseOrders();
  const ok = orders.filter((o) => o.zoho_po_id);
  const failed = orders.filter((o) => o.error);
  const value = ok.reduce((s, o) => s + (o.total ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Purchase orders"
        subtitle="Draft POs raised in Zoho Inventory after planner approval. Procurement issues them from Zoho."
      />

      {!orders.length ? (
        <EmptyState
          icon={Truck}
          title="No purchase orders yet"
          body="Approve reorder lines in the review queue, then press “Create draft POs in Zoho”. They will appear here with a link to Zoho."
          action={
            <Link href="/review" className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#256abf]">
              Go to review queue
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatTile label="Draft POs in Zoho" value={ok.length} icon={Truck} tone="info" />
            <StatTile label="Total draft value" value={inr(value)} hint="At demo purchase rates" icon={Truck} tone="good" />
            <StatTile label="Failed attempts" value={failed.length} hint="Nothing was sent for these" icon={FileWarning} tone={failed.length ? "critical" : "neutral"} />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-line bg-page text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">PO number</th>
                  <th className="px-4 py-2.5 font-medium">Vendor</th>
                  <th className="px-4 py-2.5 font-medium">Lines</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((o) => (
                  <tr key={o.id} className="align-top">
                    <td className="px-4 py-3 font-medium">{o.zoho_po_number ?? "—"}</td>
                    <td className="px-4 py-3">{o.distributor_name}</td>
                    <td className="px-4 py-3 text-ink-2">
                      <ul className="space-y-0.5">
                        {o.line_items.map((l) => (
                          <li key={l.sku_id} className="tabular">
                            {l.sku_id} · {l.name.replace("Freshroots ", "")} × {int(l.quantity)}
                          </li>
                        ))}
                      </ul>
                      {o.error && <p className="mt-1 text-xs text-critical">{o.error}</p>}
                    </td>
                    <td className="tabular px-4 py-3 text-right">{o.total != null ? inr(o.total) : "—"}</td>
                    <td className="px-4 py-3">
                      {o.error ? <Pill tone="critical">Failed</Pill> : <Pill tone="info">{o.zoho_status ?? "draft"}</Pill>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-2">{dateTime(o.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {o.zoho_po_id && (
                        <a
                          href={zohoPoUrl(o.zoho_po_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-brand hover:underline"
                        >
                          Open in Zoho <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Purchase orders" />}>
      <Content />
    </Suspense>
  );
}
