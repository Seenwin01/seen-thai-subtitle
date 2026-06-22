"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Small header chip showing the current plan + credit balance.
// Refreshes on mount and whenever a "credits-updated" window event fires.
export default function CreditBadge() {
  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState<string>("");

  async function load() {
    try {
      const res = await fetch("/api/account", { cache: "no-store" });
      const data = await res.json();
      setCredits(data.account?.credits ?? null);
      setPlan(data.plan?.name ?? "");
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("credits-updated", h);
    return () => window.removeEventListener("credits-updated", h);
  }, []);

  return (
    <Link
      href="/pricing"
      className="glass rounded-full px-3 py-1.5 text-xs hover:border-brand-400"
      title="ดูแผนและราคา"
    >
      {plan && <span className="text-white/50">{plan} · </span>}
      <span className="font-semibold text-brand-300">
        {credits === null ? "…" : credits}
      </span>
      <span className="text-white/50"> เครดิต</span>
    </Link>
  );
}
