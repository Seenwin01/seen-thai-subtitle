"use client";

import { useEffect, useState } from "react";

type Clip = { start: number; end: number; score: number; title?: string };

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function ClipsPage() {
  const [jobId, setJobId] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [done, setDone] = useState<Record<number, string>>({});
  const [err, setErr] = useState("");

  useEffect(() => {
    const j = new URLSearchParams(window.location.search).get("job") || "";
    setJobId(j);
    if (j) load(j);
  }, []);

  async function load(j: string) {
    setLoading(true);
    setErr("");
    setClips([]);
    setDone({});
    try {
      const r = await fetch(`/api/clips/${j}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setClips(Array.isArray(d.clips) ? d.clips : []);
    } catch {
      setErr("หาคลิปไม่สำเร็จ ตรวจสอบรหัสงานอีกครั้ง");
    }
    setLoading(false);
  }

  async function cut(c: Clip, i: number) {
    setBusy(i);
    setErr("");
    try {
      const r = await fetch("/api/cut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, start: c.start, end: c.end, vertical: true }),
      });
      const d = await r.json();
      const newId: string = d.jobId;
      if (!newId) throw new Error();
      let ok = false;
      for (let k = 0; k < 90; k++) {
        await new Promise((res) => setTimeout(res, 2000));
        const exists = await fetch(`/api/job/${newId}`)
          .then((x) => x.ok)
          .catch(() => false);
        if (exists) {
          ok = true;
          break;
        }
      }
      if (!ok) throw new Error();
      setDone((p) => ({ ...p, [i]: newId }));
    } catch {
      setErr("ตัดคลิปไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
    setBusy(null);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">ตัดคลิปไวรัลอัตโนมัติ</h1>
      <p className="mb-6 text-sm opacity-70">
        AI หาช่วงที่น่าสนใจที่สุดในคลิปยาว แล้วตัดเป็นคลิปสั้นแนวตั้งให้
      </p>

      <div className="mb-6 flex gap-2">
        <input
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          placeholder="รหัสงาน เช่น mqq..."
          className="flex-1 rounded border border-white/20 bg-transparent px-3 py-2 text-sm"
        />
        <button
          onClick={() => jobId && load(jobId)}
          className="rounded bg-indigo-500 px-4 py-2 text-sm font-medium text-white"
        >
          ค้นหาคลิปเด่น
        </button>
      </div>

      {loading && <p className="text-sm opacity-70">กำลังวิเคราะห์...</p>}
      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}
      {!loading && !err && jobId && clips.length === 0 && (
        <p className="text-sm opacity-70">ยังไม่พบคลิปเด่น</p>
      )}

      <div className="space-y-3">
        {clips.map((c, i) => (
          <div key={i} className="rounded-lg border border-white/15 p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold">คลิปที่ {i + 1}</span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                คะแนน {Math.round(c.score)}
              </span>
            </div>
            <div className="mb-2 text-sm opacity-70">
              {fmt(c.start)} - {fmt(c.end)} ({Math.round(c.end - c.start)} วินาที)
            </div>
            {c.title && <div className="mb-3 text-sm">“{c.title}”</div>}
            {done[i] ? (
              <a
                href={`/studio?job=${done[i]}`}
                className="inline-block rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-white"
              >
                เปิดในสตูดิโอ
              </a>
            ) : (
              <button
                onClick={() => cut(c, i)}
                disabled={busy !== null}
                className="rounded bg-pink-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy === i ? "กำลังตัด..." : "ตัดคลิปนี้"}
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
