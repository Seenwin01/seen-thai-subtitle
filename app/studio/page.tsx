"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Segment, SubtitleStyle, Transcript } from "@/lib/types";
import { STYLE_PRESETS } from "@/lib/styles";
import { LANGUAGES } from "@/lib/translate";
import { ASPECTS } from "@/lib/aspect";
import { RESOLUTIONS } from "@/lib/export";
import { searchSegments } from "@/lib/search";
import { parseSrt } from "@/lib/srtparse";
import { removeFillers, countFillers } from "@/lib/clean";
import StylePicker from "@/components/StylePicker";
import SubtitleEditor from "@/components/SubtitleEditor";
import VideoPreview from "@/components/VideoPreview";
import CreditBadge from "@/components/CreditBadge";
import ProgressBar from "@/components/ProgressBar";
import Spinner from "@/components/Spinner";
import { pollJob } from "@/components/poll";
import { useCustomTemplates } from "@/components/useCustomTemplates";

function Studio() {
  const params = useSearchParams();
  const jobId = params.get("job") || "";

  const [job, setJob] = useState<Transcript | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [style, setStyle] = useState<SubtitleStyle>(STYLE_PRESETS[0]);
  const [tab, setTab] = useState<"style" | "text">("style");
  const { templates, save: saveTemplate, remove: removeTemplate } =
    useCustomTemplates();
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; step: string } | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [target, setTarget] = useState("en");
  const [aspect, setAspect] = useState("");
  const [scale, setScale] = useState("");
  const [transparent, setTransparent] = useState(false);
  const [caption, setCaption] = useState<{ caption: string; hashtags: string[]; source: string } | null>(null);
  const [capBusy, setCapBusy] = useState(false);
  const [query, setQuery] = useState("");
  const seekRef = useRef<((t: number) => void) | null>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    fetch(`/api/job/${jobId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject("ไม่พบงานนี้")))
      .then((data: Transcript) => {
        setJob(data);
        setSegments(data.segments);
      })
      .catch((e) => setError(String(e)));
  }, [jobId]);

  async function render() {
    setRendering(true);
    setError("");
    setOutput(null);
    setProgress({ pct: 0, step: "เริ่มเรนเดอร์" });
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, segments, style, aspect: aspect || undefined, scale: scale || undefined, transparent }),
      });
      if (!res.ok) {
        let m = "render ไม่สำเร็จ";
        try {
          const j = await res.json();
          m = j.error ?? m;
        } catch {
          m = (await res.text()) || m;
        }
        throw new Error(m);
      }
      const final = await pollJob(jobId, (s) =>
        setProgress({ pct: s.progress, step: s.step })
      );
      if (final.state === "done") {
        setOutput(String(final.result?.output ?? "output.mp4"));
        window.dispatchEvent(new Event("credits-updated"));
      } else {
        throw new Error(final.error ?? final.step);
      }
    } catch (e: any) {
      setError(e?.message ?? "render ไม่สำเร็จ");
    } finally {
      setRendering(false);
      setProgress(null);
    }
  }

  async function translate() {
    setTranslating(true);
    setError("");
    try {
      const res = await fetch(`/api/translate/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments, target }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "แปลไม่สำเร็จ");
      const data = await res.json();
      setSegments(data.segments);
    } catch (e: any) {
      setError(e?.message ?? "แปลไม่สำเร็จ");
    } finally {
      setTranslating(false);
    }
  }

  function revert() {
    if (job) setSegments(job.segments);
  }

  async function downloadSubs(type: "srt" | "ass") {
    try {
      const res = await fetch(`/api/subtitles/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, segments, style, type }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `subtitles.${type}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setError(e?.message ?? "ดาวน์โหลดไม่สำเร็จ");
    }
  }

  async function importSrt(file: File) {
    setError("");
    try {
      const segs = parseSrt(await file.text());
      if (segs.length === 0) throw new Error("ไฟล์ SRT ไม่ถูกต้อง");
      setSegments(segs);
    } catch (e: any) {
      setError(e?.message ?? "นำเข้า SRT ไม่สำเร็จ");
    }
  }

  async function genCaption() {
    setCapBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/caption/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "สร้างแคปชั่นไม่สำเร็จ");
      setCaption(await res.json());
    } catch (e: any) {
      setError(e?.message ?? "สร้างแคปชั่นไม่สำเร็จ");
    } finally {
      setCapBusy(false);
    }
  }

  function copyCaption() {
    if (!caption) return;
    const text = caption.caption + "\n\n" + caption.hashtags.join(" ");
    navigator.clipboard?.writeText(text);
  }

  if (!jobId) return <Center>ไม่พบรหัสงาน — กลับไปอัปโหลดวิดีโอใหม่</Center>;
  if (error && !job) return <Center>{error}</Center>;
  if (!job) return <Center><Spinner label="กำลังโหลดงาน…" /></Center>;

  const videoSrc = `/api/file/${jobId}/${job.videoFile}`;

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/" className="text-xl font-extrabold">
          ซับไทย<span className="text-brand-400">AI</span>
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <CreditBadge />
          <select
            value={aspect}
            onChange={(e) => setAspect(e.target.value)}
            className="rounded-lg bg-white/5 px-2 py-2 text-sm outline-none"
            title="อัตราส่วนผลลัพธ์"
          >
            <option value="">อัตราส่วนต้นฉบับ</option>
            {ASPECTS.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <select
            value={scale}
            onChange={(e) => setScale(e.target.value)}
            className="rounded-lg bg-white/5 px-2 py-2 text-sm outline-none"
            title="ความละเอียดผลลัพธ์"
          >
            {RESOLUTIONS.map((r) => (
              <option key={r.id} value={r.id === "source" ? "" : r.id}>{r.label}</option>
            ))}
          </select>
          <button
            onClick={render}
            disabled={rendering}
            className="btn-grad rounded-xl px-6 py-2.5 font-semibold disabled:opacity-60"
          >
            {rendering ? "กำลัง Render…" : "Render & ดาวน์โหลด"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Preview */}
        <div className="glass rounded-2xl p-5">
          <VideoPreview
            src={videoSrc}
            segments={segments}
            style={style}
            onReady={(api) => (seekRef.current = api.seek)}
          />
          <div className="mt-3 flex items-center justify-center gap-3 text-xs">
            <span className="text-white/40">ส่งออกไฟล์ซับ:</span>
            <button onClick={() => downloadSubs("srt")} className="glass rounded px-3 py-1 hover:border-brand-400">
              .srt
            </button>
            <button onClick={() => downloadSubs("ass")} className="glass rounded px-3 py-1 hover:border-brand-400">
              .ass
            </button>
            <label className="flex items-center gap-1.5 text-white/50" title="ส่งออกซับโปร่งใส .mov สำหรับ overlay">
              <input
                type="checkbox"
                checked={transparent}
                onChange={(e) => setTransparent(e.target.checked)}
                className="h-3.5 w-3.5 accent-brand-500"
              />
              ซับโปร่งใส
            </label>
          </div>

          <div className="mt-4">
            <button
              onClick={genCaption}
              disabled={capBusy}
              className="glass w-full rounded-lg px-3 py-2 text-sm hover:border-brand-400 disabled:opacity-60"
            >
              {capBusy ? "กำลังสร้างแคปชั่น…" : "✨ สร้างแคปชั่น + แฮชแท็ก"}
            </button>
            {caption && (
              <div className="mt-3 rounded-xl bg-white/5 p-3 text-sm">
                <p className="whitespace-pre-wrap">{caption.caption}</p>
                {caption.hashtags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {caption.hashtags.map((h, i) => (
                      <span key={i} className="rounded-full bg-brand-500/15 px-2 py-0.5 text-xs text-brand-200">{h}</span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs">
                  <button onClick={copyCaption} className="btn-grad rounded px-3 py-1 font-semibold">คัดลอกทั้งหมด</button>
                  <span className="text-white/40">{caption.source === "ai" ? "สร้างโดย AI" : "สร้างจากระบบ"}</span>
                </div>
              </div>
            )}
          </div>

          {progress && (
            <div className="mt-5">
              <ProgressBar progress={progress.pct} step={progress.step} />
            </div>
          )}

          {output && (
            <div className="mt-5 rounded-xl border border-brand-500/40 bg-brand-500/10 p-4 text-center">
              <p className="font-semibold text-brand-100">Render เสร็จแล้ว 🎉</p>
              <div className="mt-3 flex flex-wrap justify-center gap-3 text-sm">
                <a
                  className="btn-grad rounded-lg px-4 py-2 font-semibold"
                  href={`/api/file/${jobId}/${output}?download=1`}
                >
                  ดาวน์โหลดวิดีโอ (MP4)
                </a>
                <a
                  className="glass rounded-lg px-4 py-2"
                  href={`/api/file/${jobId}/subtitles.srt?download=1`}
                >
                  ดาวน์โหลด SRT
                </a>
              </div>
            </div>
          )}
          {error && (
            <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-center text-sm text-red-300">
              {error}
            </p>
          )}
        </div>

        {/* Panel */}
        <div className="glass rounded-2xl p-5">
          <div className="mb-4 flex gap-2">
            <TabBtn active={tab === "style"} onClick={() => setTab("style")}>
              สไตล์
            </TabBtn>
            <TabBtn active={tab === "text"} onClick={() => setTab("text")}>
              แก้ข้อความ
            </TabBtn>
          </div>
          {tab === "style" ? (
            <StylePicker
              style={style}
              onChange={setStyle}
              templates={templates}
              onSaveTemplate={(name) => setStyle(saveTemplate(name, style))}
              onDeleteTemplate={removeTemplate}
            />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="mr-auto text-white/50">{segments.length} ท่อนซับ</span>
                <button
                  onClick={() => setSegments(removeFillers(segments))}
                  disabled={countFillers(segments) === 0}
                  className="glass rounded-lg px-3 py-1.5 hover:border-brand-400 disabled:opacity-40"
                  title="ลบ เอ่อ/อืม/อ่า ฯลฯ"
                >
                  ลบคำเติม{countFillers(segments) ? ` (${countFillers(segments)})` : ""}
                </button>
                <button
                  onClick={() => srtInputRef.current?.click()}
                  className="glass rounded-lg px-3 py-1.5 hover:border-brand-400"
                >
                  นำเข้า .srt
                </button>
                <input
                  ref={srtInputRef}
                  type="file"
                  accept=".srt,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const fl = e.target.files?.[0];
                    if (fl) importSrt(fl);
                  }}
                />
              </div>
              <div className="mb-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ค้นหาในซับ…"
                  className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-brand-500"
                />
                {query && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-white/5 p-1 text-sm">
                    {searchSegments(segments, query).length === 0 ? (
                      <p className="p-2 text-white/40">ไม่พบ &ldquo;{query}&rdquo;</p>
                    ) : (
                      searchSegments(segments, query).map((r) => (
                        <button
                          key={r.id}
                          onClick={() => seekRef.current?.(r.start)}
                          className="block w-full truncate rounded px-2 py-1 text-left hover:bg-white/10"
                          title="กระโดดไปช่วงนี้"
                        >
                          <span className="text-brand-300">
                            {Math.floor(r.start / 60)}:{String(Math.floor(r.start % 60)).padStart(2, "0")}
                          </span>{" "}
                          {r.text}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div className="mb-3 flex items-center gap-2 text-sm">
                <span className="text-white/50">แปลเป็น</span>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="flex-1 rounded-lg bg-white/5 px-2 py-1.5 outline-none"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={translate}
                  disabled={translating}
                  className="btn-grad rounded-lg px-3 py-1.5 font-semibold disabled:opacity-60"
                >
                  {translating ? "กำลังแปล…" : "แปล"}
                </button>
                <button
                  onClick={revert}
                  className="glass rounded-lg px-3 py-1.5"
                  title="คืนข้อความต้นฉบับ"
                >
                  ↺
                </button>
              </div>
              <p className="mb-3 text-[11px] text-white/40">
                * การแปลใช้ AI — ต้องตั้ง API key (ดู README); เวลาของซับคงเดิม
              </p>
              <SubtitleEditor segments={segments} onChange={setSegments} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
        active ? "btn-grad font-semibold" : "glass"
      }`}
    >
      {children}
    </button>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5 text-center text-white/70">
      {children}
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<Center><Spinner label="กำลังโหลด…" /></Center>}>
      <Studio />
    </Suspense>
  );
}
