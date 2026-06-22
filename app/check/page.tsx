"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Spinner from "@/components/Spinner";

interface Check {
  key: string;
  label: string;
  required: boolean;
  ok: boolean;
  detail: string;
}

export default function CheckPage() {
  const [data, setData] = useState<{ ready: boolean; checks: Check[] } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      setData(await res.json());
    } catch (e: any) {
      setErr(e?.message ?? "ตรวจสอบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-xl font-extrabold">
          ซับไทย<span className="text-brand-400">AI</span>
        </Link>
        <button onClick={load} className="glass rounded-lg px-4 py-2 text-sm">
          ตรวจสอบใหม่
        </button>
      </div>

      <h1 className="text-2xl font-extrabold">ตรวจสอบระบบ</h1>
      <p className="mt-1 text-sm text-white/60">
        เช็คว่าเครื่องมือที่จำเป็นพร้อมใช้งานหรือยัง ก่อนเริ่มถอดเสียงและเรนเดอร์
      </p>

      {loading && <div className="mt-6 text-white/60"><Spinner label="กำลังตรวจสอบ…" /></div>}
      {err && <p className="mt-6 text-red-300">{err}</p>}

      {data && (
        <>
          <div
            className={`mt-6 rounded-xl p-4 text-center font-semibold ${
              data.ready
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-amber-500/15 text-amber-300"
            }`}
          >
            {data.ready
              ? "✓ ระบบพร้อมใช้งาน — ส่วนที่จำเป็นครบแล้ว"
              : "⚠ ยังขาดส่วนที่จำเป็น โปรดดูรายการด้านล่าง"}
          </div>

          <div className="mt-5 space-y-2">
            {data.checks.map((c) => (
              <div
                key={c.key}
                className="glass flex items-start gap-3 rounded-xl p-4"
              >
                <span
                  className={`mt-0.5 text-lg ${
                    c.ok
                      ? "text-emerald-400"
                      : c.required
                      ? "text-red-400"
                      : "text-amber-400"
                  }`}
                >
                  {c.ok ? "✓" : c.required ? "✕" : "!"}
                </span>
                <div>
                  <p className="font-semibold">
                    {c.label}{" "}
                    <span className="text-xs font-normal text-white/40">
                      {c.required ? "(จำเป็น)" : "(ไม่บังคับ)"}
                    </span>
                  </p>
                  <p className="text-sm text-white/55">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
