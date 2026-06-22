"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { pollJob } from "./poll";
import ProgressBar from "./ProgressBar";

type Target = "studio" | "repurpose";

export default function UploadDropzone({
  target = "studio",
}: {
  target?: Target;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; step: string } | null>(null);

  function dest(jobId: string) {
    const d = target === "repurpose" ? "/repurpose" : "/studio";
    router.push(`${d}?job=${encodeURIComponent(jobId)}`);
  }

  async function track(jobId: string) {
    setProgress({ pct: 0, step: "เข้าคิว" });
    const final = await pollJob(jobId, (s) =>
      setProgress({ pct: s.progress, step: s.step })
    );
    if (final.state === "done") dest(jobId);
    else {
      setStatus("เกิดข้อผิดพลาด: " + (final.error ?? final.step));
      setBusy(false);
      setProgress(null);
    }
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("video/")) {
      setStatus("กรุณาเลือกไฟล์วิดีโอ (mp4, mov, ...)");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const fd = new FormData();
      fd.append("video", file);
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.text()) || "อัปโหลดไม่สำเร็จ");
      const { jobId } = await res.json();
      await track(jobId);
    } catch (e: any) {
      setStatus("เกิดข้อผิดพลาด: " + (e?.message ?? "ไม่ทราบสาเหตุ"));
      setBusy(false);
    }
  }

  async function handleUrl() {
    if (!url.trim()) return;
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) throw new Error((await res.text()) || "นำเข้าไม่สำเร็จ");
      const { jobId } = await res.json();
      await track(jobId);
    } catch (e: any) {
      setStatus("เกิดข้อผิดพลาด: " + (e?.message ?? "ไม่ทราบสาเหตุ"));
      setBusy(false);
    }
  }

  if (busy && progress) {
    return (
      <div className="glass rounded-2xl p-8">
        <ProgressBar progress={progress.pct} step={progress.step} />
        <p className="mt-4 text-center text-xs text-white/40">
          กำลังประมวลผล… ปล่อยให้ทำงานเบื้องหลังได้เลย
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex gap-2 text-sm">
        <button
          onClick={() => setMode("file")}
          className={`flex-1 rounded-lg px-3 py-2 transition ${
            mode === "file" ? "btn-grad font-semibold" : "glass"
          }`}
        >
          อัปโหลดไฟล์
        </button>
        <button
          onClick={() => setMode("url")}
          className={`flex-1 rounded-lg px-3 py-2 transition ${
            mode === "url" ? "btn-grad font-semibold" : "glass"
          }`}
        >
          ลิงก์ YouTube
        </button>
      </div>

      {mode === "file" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          onClick={() => !busy && inputRef.current?.click()}
          className={`glass cursor-pointer rounded-2xl p-10 text-center transition ${
            drag ? "border-brand-500 bg-brand-500/10" : ""
          } ${busy ? "opacity-70" : "hover:border-brand-400"}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full btn-grad text-2xl">
            ⬆
          </div>
          <p className="text-lg font-semibold">ลากวิดีโอมาวาง หรือคลิกเพื่อเลือกไฟล์</p>
          <p className="mt-1 text-sm text-white/50">
            รองรับ mp4, mov, mkv —{" "}
            {target === "repurpose"
              ? "อัปโหลดคลิปยาว ระบบจะหาช่วงไวรัลให้"
              : "แนะนำคลิปแนวตั้งสำหรับ TikTok / Reels"}
          </p>
        </div>
      ) : (
        <div className="glass rounded-2xl p-6">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="วางลิงก์ YouTube ที่นี่"
            className="w-full rounded-lg bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            onClick={handleUrl}
            disabled={busy}
            className="btn-grad mt-3 w-full rounded-lg px-4 py-2.5 font-semibold disabled:opacity-60"
          >
            นำเข้าจากลิงก์
          </button>
          <p className="mt-2 text-xs text-white/40">
            ต้องติดตั้ง yt-dlp บนเซิร์ฟเวอร์ (ดู README)
          </p>
        </div>
      )}

      {status && <p className="mt-3 text-center text-sm text-brand-100">{status}</p>}
    </div>
  );
}
