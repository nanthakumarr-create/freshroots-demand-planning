import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { getLatestRun, getRecommendations, getRun } from "@/lib/data";
import { dateOnly, dateTime } from "@/lib/format";
import { RunButton } from "@/components/run-button";
import { EmptyState, PageHeader, Pill, PageSkeleton } from "@/components/ui";
import { ReviewQueue } from "./queue";

export const metadata: Metadata = { title: "Review queue" };

const UUID = /^[0-9a-f-]{36}$/i;

async function Content({ searchParams }: PageProps<"/review">) {
  await connection();
  const { run: runParam } = await searchParams;
  const run = typeof runParam === "string" && UUID.test(runParam) ? await getRun(runParam) : await getLatestRun();

  if (!run) {
    return (
      <>
        <PageHeader title="Review queue" />
        <EmptyState
          icon={ClipboardCheck}
          title="Nothing to review yet"
          body="Run demand planning first. Every flagged SKU will land here for Raghav to check, edit and approve."
          action={<RunButton />}
        />
      </>
    );
  }

  const recs = await getRecommendations(run.id);
  const latest = await getLatestRun();

  return (
    <>
      <PageHeader
        title="Review queue"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>Run {dateTime(run.created_at)} · data as of {dateOnly(run.as_of_date)}</span>
            {latest && latest.id !== run.id && <Pill tone="warning">Older run</Pill>}
          </span>
        }
      />
      <ReviewQueue runId={run.id} recs={recs} />
    </>
  );
}

export default function ReviewPage(props: PageProps<"/review">) {
  return (
    <Suspense fallback={<PageSkeleton title="Review queue" />}>
      <Content {...props} />
    </Suspense>
  );
}
