"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Spinner from "../../components/Spinner";
import ProgressBar from "../../components/ProgressBar";
import type { JobSummary } from "@/lib/jobsummary";

const STATE_COLOR: Record<string, string> = {
  done: "#00E5A0",
  processing: "#FFD166",
  queued: "#9CA3AF",
  error: "#FF6B6B",
  unknown: "#9CA3AF",
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const data = await res.json();
      setJobs(data.jobs ?? []);
    } catch {
      setJobs([]);
    }
  }

  useEffect(() => {
    load();
    // auto-refresh while anything is processing
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  async function del(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-xl font-extrabold">
          ซับไทย<span className="text-brand-400">AI</span>
        </Link>
        <button onClick={load} className="glass rounded-lg px-4 py-2 text-sm hover:border-brand-400">
          รีเฟรช
        </button>
      </div>

      <h1 className="text-2xl font-extrabold">งานทั้งหมด</h1>
      <p className="mt-1 text-sm text-white/60">
        งานที่ถอดเสียง/เรนเดอร์/ตัดคลิปไว้ — เปิดแก้ต่อ ดาวน์โหลด หรือลบได้
      </p>

      {jobs === null && (
        <div className="mt-8 text-white/60">
          <Spinner label="กำลังโหลด…" />
        </div>
      )}

      {jobs && jobs.length === 0 && (
        <div className="glass mt-8 rounded-2xl p-10 text-center text-white/50">
          ยังไม่มีงาน — <Link href="/" className="text-brand-300 hover:underline">เริ่มอัปโหลดวิดีโอ</Link>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {jobs?.map((j) => (
          <div key={j.id} className="glass fade-in rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: `${STATE_COLOR[j.state]}22`, color: STATE_COLOR[j.state] }}
              >
                {j.label}
              </span>
              <span className="font-mono text-xs text-white/40">{j.id}</span>
              {j.segments > 0 && (
                <span className="text-xs text-white/40">{j.segments} ท่อนซับ</span>
              )}
              <div className="ml-auto flex gap-2 text-sm">
                {j.canOpen && (
                  <Link
                    href={`/studio?job=${j.id}`}
                    className="btn-grad rounded-lg px-3 py-1.5 font-semibold"
                  >
                    เปิด
                  </Link>
                )}
                {j.canDownload && (
                  <a
                    href={`/api/file/${j.id}/output.mp4?download=1`}
                    className="glass rounded-lg px-3 py-1.5 hover:border-brand-400"
                  >
                    MP4
                  </a>
                )}
                <button
                  onClick={() => del(j.id)}
                  disabled={busy === j.id}
                  className="rounded-lg px-3 py-1.5 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                >
                  ลบ
                </button>
              </div>
            </div>

            {j.state === "processing" && (
              <div className="mt-3">
                <ProgressBar progress={j.progress} step={j.step} />
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
