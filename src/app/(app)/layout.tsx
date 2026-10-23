import { Suspense } from "react";
import { connection } from "next/server";
import { Shell } from "@/components/shell";
import { sql } from "@/lib/db";

async function PendingBadge() {
  await connection();
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from freshroots.recommendations
    where status = 'pending'
      and run_id = (select id from freshroots.planning_runs order by created_at desc limit 1)`;
  if (!row?.n) return null;
  return <span className="rounded-full bg-[#fab219] px-1.5 text-xs font-semibold text-[#0b0b0b]">{row.n}</span>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell
      reviewBadge={
        <Suspense fallback={null}>
          <PendingBadge />
        </Suspense>
      }
    >
      {children}
    </Shell>
  );
}
