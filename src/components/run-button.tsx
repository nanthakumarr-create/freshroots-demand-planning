"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Play } from "lucide-react";
import { runPlanning } from "@/app/actions";

function Inner({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#256abf] disabled:opacity-70"
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
      {pending ? "Running rules + AI notes…" : label}
    </button>
  );
}

export function RunButton({ label = "Run Demand Planning" }: { label?: string }) {
  return (
    <form action={runPlanning}>
      <Inner label={label} />
    </form>
  );
}
