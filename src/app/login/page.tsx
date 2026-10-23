import type { Metadata } from "next";
import { Suspense } from "react";
import { Sprout } from "lucide-react";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-navy px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl">
        <span className="grid size-10 place-items-center rounded-xl bg-[#1baf7a] text-white">
          <Sprout className="size-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold">Freshroots Demand Planning</h1>
        <p className="mt-1 text-sm text-ink-2">Enter the team passcode to continue.</p>
        <Suspense fallback={<div className="mt-6 h-32" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
