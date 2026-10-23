import { AlertOctagon, Archive, Flame, HelpCircle, type LucideIcon } from "lucide-react";
import { FLAG_META } from "@/lib/format";
import type { Flag } from "@/lib/rules";

const TONE: Record<string, string> = {
  critical: "bg-[#fdeeee] text-[#a32424] ring-[#f3c7c7]",
  serious: "bg-[#fdf1ec] text-[#a4471f] ring-[#f5cdbd]",
  warning: "bg-[#fff6e0] text-[#7a5200] ring-[#f6dd9d]",
  info: "bg-[#eef2fb] text-[#2c4a8a] ring-[#cfdaf2]",
  good: "bg-[#eaf7ea] text-[#16661a] ring-[#c4e6c4]",
  neutral: "bg-[#f1f2f5] text-[#4a5672] ring-[#e1e4ec]",
};

const FLAG_ICON: Record<Flag, LucideIcon> = {
  stockout_risk: AlertOctagon,
  overstock_risk: Archive,
  high_demand: Flame,
  needs_judgment: HelpCircle,
};

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof TONE; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[tone]}`}>
      {children}
    </span>
  );
}

export function FlagPill({ flag }: { flag: Flag }) {
  const meta = FLAG_META[flag];
  const Icon = FLAG_ICON[flag];
  return (
    <Pill tone={meta.tone}>
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </Pill>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: "critical" | "serious" | "warning" | "good" | "neutral" | "info";
}) {
  const iconTone: Record<string, string> = {
    critical: "bg-[#fdeeee] text-critical",
    serious: "bg-[#fdf1ec] text-[#c4602f]",
    warning: "bg-[#fff6e0] text-[#b07a00]",
    good: "bg-[#eaf7ea] text-good",
    info: "bg-[#eef2fb] text-brand",
    neutral: "bg-[#f1f2f5] text-ink-2",
  };
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-ink-2">{label}</p>
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${iconTone[tone]}`}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-[#eef2fb] text-brand">
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-ink-2">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageSkeleton({ title }: { title: string }) {
  return (
    <div aria-busy="true" aria-label={`Loading ${title}`}>
      <h1 className="mb-6 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-24 animate-pulse bg-white" />
        ))}
      </div>
      <div className="card mt-4 h-72 animate-pulse" />
    </div>
  );
}
