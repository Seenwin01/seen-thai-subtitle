"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Clip } from "@/lib/clips";
import ProgressBar from "../../components/ProgressBar";
import { pollJob } from "../../components/poll";
import Spinner from "../../components/Spinner";

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Repurpose() {
  const params = useSearchParams();
  const router = useRouter();
  const jobId = params.get("job") || "";

  const [clips, setClips] = useState<Clip[] | null>(null);
  const [videoFile, setVideoFile] = useState("");
  const [ranker, setRanker] = useState<"ai" | "heuristic">("heuristic");
  const [error, setError] = useState("");
  const [vertical, setVertical] = useState(true);
  const [cutting, setCutting] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ pct: number; step: string } | null>(null);

  useEffect(() => {
    if (!jobId) return;
    fetch(`/api/clips/${jobId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject("ไม่พบงานนี้")))
      .then((data) => {
        setClips(data.clips);
        setVideoFile(data.videoFile);
        setRanker(data.ranker ?? "heuristic");
      })
      .catch((e) => setError(String(e)));
  }, [jobId]);

  async function makeClip(clip: Clip) {
    setCutting(clip.id);
    setError("");
    setProgress({ pct: 0, step: "เข้าคิว" });
    try {
      const res = await fetch("/api/cut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, start: clip.start, end: clip.end, vertical }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { jobId: newId } = await res.json();
      const final = await pollJob(newId, (s) =>
        setProgress({ pct: s.progress, step: s.step })
      );
      if (final.state === "done") {
        router.push(`/studio?job=${encodeURIComponent(newId)}`);
      } else {
        throw new Error(final.error ?? final.step);
      }
    } catch (e: any) {
      setError(e?.message ?? "ตัดคลิปไม่สำเร็จ");
      setCutting(null);
      setProgress(null);
    }
  }

  if (!jobId) return <Center>ไม่พบรหัสงาน — กลับไปอัปโหลดวิดีโอใหม่</Center>;
  if (error && !clips) return <Center>{error}</Center>;
  if (!clips) return <Center><Spinner label="กำลังวิเคราะห์หาช่วงไวรัล…" /></Center>;

  const src = `/api/file/${jobId}/${videoFile}`;

  return (
    <main className="mx-auto max-w-5xl px-5 py-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-xl font-extrabold">
          ซับไทย<span className="text-brand-400">AI</span>
        </Link>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={vertical}
            onChange={(e) => setVertical(e.target.checked)}
            className="h-4 w-4 accent-brand-500"
          />
          แปลงเป็นแนวตั้ง 9:16 (ตรวจจับใบหน้า)
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">
          จัดอันดับ {clips.length} ช่วงที่น่าจะไวรัล
        </h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            ranker === "ai" ? "bg-brand-500/20 text-brand-200" : "bg-white/10 text-white/60"
          }`}
        >
          {ranker === "ai" ? "จัดอันดับโดย AI" : "จัดอันดับด้วยระบบให้คะแนน"}
        </span>
      </div>
      <p className="mt-1 text-sm text-white/60">
        เรียงจากโอกาสไวรัลมากไปน้อย — เลือกคลิปที่ชอบ แล้วระบบจะตัดให้ พร้อมพาไปใส่ซับต่อ
      </p>

      {progress && (
        <div className="mt-4 glass rounded-xl p-4">
          <ProgressBar progress={progress.pct} step={progress.step} />
        </div>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>
      )}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {clips.map((clip, i) => (
          <div key={clip.id} className="glass rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <RankBadge rank={clip.rank ?? i + 1} />
                <div>
                  <p className="font-semibold leading-snug">{clip.title}</p>
                  <p className="mt-1 text-xs text-white/50">
                    {fmt(clip.start)} → {fmt(clip.end)} · {clip.duration}s
                  </p>
                </div>
              </div>
              <ScoreBadge score={clip.score} />
            </div>

            <video
              src={`${src}#t=${clip.start},${clip.end}`}
              controls
              preload="metadata"
              className="mt-3 w-full rounded-lg bg-black"
            />

            {clip.reasons.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {clip.reasons.map((r, k) => (
                  <span
                    key={k}
                    className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/60"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={() => makeClip(clip)}
              disabled={cutting !== null}
              className="btn-grad mt-4 w-full rounded-lg px-4 py-2.5 font-semibold disabled:opacity-60"
            >
              {cutting === clip.id ? "กำลังตัดคลิป…" : "ตัดคลิปนี้ + ใส่ซับ"}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1 ? "#FFD700" : rank === 2 ? "#C0C0C0" : rank === 3 ? "#CD7F32" : "";
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
      style={{
        background: medal ? `${medal}22` : "rgba(255,255,255,0.06)",
        color: medal || "rgba(255,255,255,0.6)",
        border: medal ? `1px solid ${medal}66` : "1px solid rgba(255,255,255,0.1)",
      }}
    >
      #{rank}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "#00E5A0" : score >= 45 ? "#FFD166" : "#9CA3AF";
  return (
    <div
      className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl"
      style={{ background: `${color}22`, color }}
    >
      <span className="text-base font-extrabold leading-none">{score}</span>
      <span className="text-[9px] opacity-70">viral</span>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5 text-center text-white/70">
      {children}
    </div>
  );
}

export default function RepurposePage() {
  return (
    <Suspense fallback={<Center><Spinner label="กำลังโหลด…" /></Center>}>
      <Repurpose />
    </Suspense>
  );
}
