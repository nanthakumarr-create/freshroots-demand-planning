"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";
import { evaluateSku } from "@/lib/rules";
import { explainRecommendations } from "@/lib/gemini";
import { createDraftPurchaseOrder } from "@/lib/zoho";
import { getSkus, getWeeklySales, isFestivalMonth } from "@/lib/data";

async function requireSession() {
  const value = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  if (!value || !safeEqual(value, await sessionToken())) throw new Error("Not signed in");
}

// ---------- Login ----------
export async function login(_: unknown, form: FormData) {
  const passcode = String(form.get("passcode") ?? "");
  const expected = process.env.APP_PASSCODE ?? "";
  if (!expected || !safeEqual(passcode, expected)) return { error: "Wrong passcode." };
  (await cookies()).set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  const next = String(form.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------- Run demand planning ----------
export async function runPlanning() {
  await requireSession();
  const [skus, sales] = await Promise.all([getSkus(), getWeeklySales()]);
  const asOf = skus.find((s) => s.as_of_date)?.as_of_date ?? new Date().toISOString().slice(0, 10);
  const festival = await isFestivalMonth(asOf);

  const salesBySku = new Map<string, number[]>();
  for (const row of sales) {
    const list = salesBySku.get(row.sku_id) ?? [];
    list.push(row.units_sold);
    salesBySku.set(row.sku_id, list);
  }

  const evaluations = skus.map((s) => ({
    sku: s,
    ev: evaluateSku(
      {
        skuId: s.sku_id,
        name: s.name,
        perishability: s.perishability,
        standardReorderQty: s.standard_reorder_qty,
        unitsOnHand: s.units_on_hand,
        weeklySales: salesBySku.get(s.sku_id) ?? [],
      },
      festival,
    ),
  }));
  const flagged = evaluations.filter(({ ev }) => ev.action !== "hold");

  let ai: Awaited<ReturnType<typeof explainRecommendations>> | null = null;
  let aiError: string | null = null;
  if (flagged.length) {
    try {
      ai = await explainRecommendations(
        flagged.map(({ sku, ev }) => ({
          skuId: ev.skuId,
          name: sku.name,
          action: ev.action,
          suggestedQty: ev.suggestedQty,
          ruleReason: ev.ruleReason,
        })),
        { asOf, festivalMonth: festival },
      );
    } catch (err) {
      aiError = err instanceof Error ? err.message : String(err);
    }
  }

  const runId = await sql.begin(async (tx) => {
    const [run] = await tx<{ id: string }[]>`
      insert into freshroots.planning_runs
        (as_of_date, festival_month, sku_count, flagged_count, ai_summary, ai_model, ai_error)
      values (${asOf}, ${festival}, ${skus.length}, ${flagged.length}, ${ai?.summary ?? null},
              ${ai?.model ?? null}, ${aiError})
      returning id`;
    await tx`insert into freshroots.recommendations ${tx(
      evaluations.map(({ ev }) => ({
        run_id: run.id,
        sku_id: ev.skuId,
        priority: ev.priority,
        avg_12w: ev.avg12w,
        avg_4w: ev.avg4w,
        demand_change_pct: ev.demandChangePct,
        planning_demand: ev.planningDemand,
        units_on_hand: skus.find((s) => s.sku_id === ev.skuId)!.units_on_hand,
        weeks_cover: Number.isFinite(ev.weeksCover) ? ev.weeksCover : 999,
        min_weeks: ev.minWeeks,
        max_weeks: ev.maxWeeks,
        flags: ev.flags,
        action: ev.action,
        suggested_qty: ev.suggestedQty,
        approved_qty: ev.suggestedQty,
        status: ev.action === "hold" ? "no_action" : "pending",
        rule_reason: ev.ruleReason,
        ai_reason: ai?.reasons[ev.skuId] ?? null,
      })),
    )}`;
    return run.id;
  });

  revalidatePath("/", "layout");
  redirect(`/review?run=${runId}`);
}

// ---------- Review ----------
export async function reviewRecommendation(input: {
  id: string;
  decision: "approved" | "rejected" | "pending";
  qty: number;
  note?: string;
}) {
  await requireSession();
  const [rec] = await sql<{ status: string; standard_reorder_qty: number; action: string }[]>`
    select r.status, s.standard_reorder_qty, r.action
    from freshroots.recommendations r join freshroots.skus s using (sku_id)
    where r.id = ${input.id}`;
  if (!rec) return { error: "Recommendation not found." };
  if (rec.status === "ordered") return { error: "Already ordered in Zoho — cannot change." };

  const qty = Math.round(Number(input.qty));
  const max = rec.standard_reorder_qty * 10;
  if (input.decision === "approved" && rec.action !== "pause") {
    if (!Number.isFinite(qty) || qty < 1 || qty > max) {
      return { error: `Quantity must be between 1 and ${max} units.` };
    }
  }
  await sql`
    update freshroots.recommendations
    set status = ${input.decision},
        approved_qty = ${rec.action === "pause" ? 0 : qty},
        reviewer_note = ${input.note?.slice(0, 300) || null},
        reviewed_at = now()
    where id = ${input.id}`;
  revalidatePath("/review");
  revalidatePath("/");
  return { ok: true };
}

// ---------- Zoho purchase orders ----------
export async function createPurchaseOrders(runId: string) {
  await requireSession();
  const rows = await sql<
    {
      id: string; sku_id: string; name: string; approved_qty: number; purchase_rate: number;
      zoho_item_id: string | null; distributor_id: string; distributor_name: string; zoho_vendor_id: string | null;
    }[]
  >`
    select r.id, r.sku_id, s.name, r.approved_qty, s.purchase_rate::float8 as purchase_rate, s.zoho_item_id,
           d.distributor_id, d.name as distributor_name, d.zoho_vendor_id
    from freshroots.recommendations r
    join freshroots.skus s using (sku_id)
    join freshroots.distributors d on d.distributor_id = s.distributor_id
    where r.run_id = ${runId} and r.status = 'approved' and r.approved_qty > 0
    order by d.distributor_id, r.sku_id`;

  if (!rows.length) return { error: "No approved reorder lines to send. Approve at least one SKU first." };

  // Validate everything before touching Zoho.
  const problems = rows.flatMap((r) => [
    !r.zoho_item_id ? `${r.sku_id} has no Zoho item mapping` : null,
    !r.zoho_vendor_id ? `${r.distributor_name} has no Zoho vendor mapping` : null,
    !(r.purchase_rate > 0) ? `${r.sku_id} has no purchase rate` : null,
    !(Number.isInteger(r.approved_qty) && r.approved_qty > 0) ? `${r.sku_id} has an invalid quantity` : null,
  ]).filter(Boolean);
  if (problems.length) return { error: `Validation failed: ${problems.join("; ")}.` };

  const byVendor = new Map<string, (typeof rows)[number][]>();
  for (const r of rows) byVendor.set(r.distributor_id, [...(byVendor.get(r.distributor_id) ?? []), r]);

  const results: { vendor: string; ok: boolean; message: string }[] = [];
  for (const [distributorId, lines] of byVendor) {
    const lineItems = lines.map((l) => ({ sku_id: l.sku_id, name: l.name, quantity: l.approved_qty, rate: l.purchase_rate }));
    try {
      const po = await createDraftPurchaseOrder({
        vendorId: lines[0].zoho_vendor_id!,
        reference: `FR-${runId.slice(0, 8).toUpperCase()}`,
        notes: "Raised from Freshroots Demand Planning after planner approval. Draft — review rates before issuing.",
        lines: lines.map((l) => ({
          item_id: l.zoho_item_id!,
          quantity: l.approved_qty,
          rate: l.purchase_rate,
          description: `${l.sku_id} · approved by planner`,
        })),
      });
      await sql.begin(async (tx) => {
        await tx`
          insert into freshroots.purchase_orders
            (run_id, distributor_id, zoho_po_id, zoho_po_number, zoho_status, total, line_items)
          values (${runId}, ${distributorId}, ${po.purchaseorder_id}, ${po.purchaseorder_number},
                  ${po.status}, ${po.total}, ${tx.json(lineItems)})`;
        await tx`update freshroots.recommendations set status = 'ordered' where id in ${tx(lines.map((l) => l.id))}`;
      });
      results.push({ vendor: lines[0].distributor_name, ok: true, message: po.purchaseorder_number });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await sql`
        insert into freshroots.purchase_orders (run_id, distributor_id, line_items, error)
        values (${runId}, ${distributorId}, ${sql.json(lineItems)}, ${message})`;
      results.push({ vendor: lines[0].distributor_name, ok: false, message });
    }
  }

  revalidatePath("/", "layout");
  return { results };
}
