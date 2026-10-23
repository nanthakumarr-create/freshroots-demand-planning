"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ClipboardCheck, Database, FileText, LayoutDashboard, LogOut, Menu, Sprout, Truck, X } from "lucide-react";
import { logout } from "@/app/actions";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/review", label: "Review queue", icon: ClipboardCheck },
  { href: "/orders", label: "Purchase orders", icon: Truck },
  { href: "/data", label: "SAP data", icon: Database },
  { href: "/about", label: "Why this, first", icon: FileText },
];

function NavLinks({ onNavigate, reviewBadge }: { onNavigate?: () => void; reviewBadge: React.ReactNode }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? "bg-white/12 font-medium text-white" : "text-white/70 hover:bg-white/6 hover:text-white"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            <span className="flex-1">{label}</span>
            {href === "/review" && reviewBadge}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-[#1baf7a] text-white">
        <Sprout className="size-4" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">Freshroots</p>
        <p className="text-xs text-white/60">Demand Planning</p>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-auto border-t border-white/10 pt-4">
      <p className="text-xs text-white/50">Signed in as planner</p>
      <form action={logout}>
        <button className="mt-2 flex items-center gap-2 text-sm text-white/70 hover:text-white">
          <LogOut className="size-4" aria-hidden /> Sign out
        </button>
      </form>
    </div>
  );
}

export function Shell({ children, reviewBadge }: { children: React.ReactNode; reviewBadge: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-8 bg-navy px-4 py-6 lg:flex">
        <Brand />
        <NavLinks reviewBadge={reviewBadge} />
        <Footer />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between bg-navy px-4 py-3 lg:hidden">
          <Brand />
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-white hover:bg-white/10">
            <Menu className="size-5" />
          </button>
        </header>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-64 flex-col gap-8 bg-navy px-4 py-6">
              <div className="flex items-center justify-between">
                <Brand />
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-1 text-white hover:bg-white/10">
                  <X className="size-5" />
                </button>
              </div>
              <NavLinks reviewBadge={reviewBadge} onNavigate={() => setOpen(false)} />
              <Footer />
            </aside>
          </div>
        )}

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
