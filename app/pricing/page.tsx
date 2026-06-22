"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Account, Plan } from "@/lib/credits";

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/account", { cache: "no-store" });
    const data = await res.json();
    setPlans(data.plans);
    setAccount(data.account);
  }

  useEffect(() => {
    load();
  }, []);

  async function choose(planId: string) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      setAccount(data.account);
      setMsg(`เปลี่ยนเป็นแผน ${data.plan.name} แล้ว — ได้ ${data.account.credits} เครดิต`);
    } catch {
      setMsg("เปลี่ยนแผนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-xl font-extrabold">
          ซับไทย<span className="text-brand-400">AI</span>
        </Link>
        {account && (
          <span className="glass rounded-full px-4 py-1.5 text-sm">
            เครดิตคงเหลือ <b className="text-brand-300">{account.credits}</b>
          </span>
        )}
      </div>

      <h1 className="text-3xl font-extrabold">แพ็กเกจสำหรับครีเอเตอร์</h1>
      <p className="mt-1 text-sm text-white/60">
        ไม่มีข้อผูกมัด · ยกเลิกได้ทุกเมื่อ (เดโม — เปลี่ยนแผนได้ทันทีเพื่อทดลอง)
      </p>

      {msg && (
        <p className="mt-4 rounded-lg bg-brand-500/15 p-3 text-sm text-brand-100">
          {msg}
        </p>
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {plans.map((p) => {
          const current = account?.planId === p.id;
          return (
            <div
              key={p.id}
              className={`glass rounded-2xl p-6 ${
                p.id === "viral_sub" ? "border-brand-500/50" : ""
              }`}
            >
              {p.id === "viral_sub" && (
                <span className="mb-2 inline-block rounded-full btn-grad px-3 py-0.5 text-xs font-semibold">
                  POPULAR
                </span>
              )}
              <h3 className="text-xl font-extrabold">{p.name}</h3>
              <p className="mt-2 text-3xl font-extrabold">
                ฿{p.priceMonthly}
                <span className="text-sm font-normal text-white/50">/เดือน</span>
              </p>
              <p className="text-xs text-white/40">
                {p.priceYearly > 0 ? `หรือ ฿${p.priceYearly}/ปี` : "ตลอดชีพ"}
              </p>

              <ul className="mt-4 space-y-2 text-sm text-white/70">
                {p.features.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-brand-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => choose(p.id)}
                disabled={busy || current}
                className={`mt-6 w-full rounded-xl px-4 py-2.5 font-semibold disabled:opacity-60 ${
                  current ? "glass" : "btn-grad"
                }`}
              >
                {current ? "แผนปัจจุบัน" : "เลือกแผนนี้"}
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
