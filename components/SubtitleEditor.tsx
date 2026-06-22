"use client";

import type { Segment } from "@/lib/types";
import { setText, setTiming, deleteSeg, mergeNext, splitSeg } from "@/lib/editops";

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SubtitleEditor({
  segments,
  onChange,
}: {
  segments: Segment[];
  onChange: (s: Segment[]) => void;
}) {
  return (
    <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
      {segments.length === 0 && (
        <p className="text-sm text-white/50">ไม่พบข้อความซับ</p>
      )}
      {segments.map((seg, i) => (
        <div key={seg.id} className="glass rounded-xl p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] text-white/50">
            <span className="text-white/40">#{i + 1}</span>
            <input
              type="number"
              step="0.1"
              min="0"
              value={seg.start}
              onChange={(e) => onChange(setTiming(segments, seg.id, Number(e.target.value), seg.end))}
              className="w-16 rounded bg-white/5 px-1.5 py-1 text-center outline-none focus:ring-1 focus:ring-brand-500"
            />
            <span>→</span>
            <input
              type="number"
              step="0.1"
              min="0"
              value={seg.end}
              onChange={(e) => onChange(setTiming(segments, seg.id, seg.start, Number(e.target.value)))}
              className="w-16 rounded bg-white/5 px-1.5 py-1 text-center outline-none focus:ring-1 focus:ring-brand-500"
            />
            <span className="ml-auto text-white/30">{fmt(seg.start)}–{fmt(seg.end)}</span>
          </div>

          <textarea
            value={seg.text}
            onChange={(e) => onChange(setText(segments, seg.id, e.target.value))}
            rows={2}
            className="w-full resize-none rounded-lg bg-white/5 p-2 text-sm outline-none focus:ring-1 focus:ring-brand-500"
          />

          <div className="mt-2 flex gap-2 text-xs">
            <button
              onClick={() => onChange(splitSeg(segments, seg.id))}
              className="glass rounded px-2 py-1 hover:border-brand-400"
              title="แบ่งครึ่ง"
            >
              ✂ แบ่ง
            </button>
            <button
              onClick={() => onChange(mergeNext(segments, seg.id))}
              disabled={i >= segments.length - 1}
              className="glass rounded px-2 py-1 hover:border-brand-400 disabled:opacity-40"
              title="รวมกับอันถัดไป"
            >
              ⬇ รวม
            </button>
            <button
              onClick={() => onChange(deleteSeg(segments, seg.id))}
              className="ml-auto rounded px-2 py-1 text-red-300 hover:bg-red-500/10"
              title="ลบ"
            >
              ✕ ลบ
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
