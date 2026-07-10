"use client";

import { useState } from "react";
import type { SubtitleStyle } from "@/lib/types";
import { STYLE_PRESETS } from "@/lib/styles";
import { FONT_OPTIONS, fontStack } from "@/lib/fonts";
import StylePreview from "./StylePreview";

// Tiny static sample that shows a style's colours/outline/box at a glance,
// rendered inside each template button.
function MiniSample({ s }: { s: SubtitleStyle }) {
  return (
    <div
      style={{
        borderRadius: 8,
        padding: "7px 4px",
        textAlign: "center",
        overflow: "hidden",
        background: "linear-gradient(135deg,#242438,#0f0f18)",
      }}
    >
      <span
        style={{
          fontFamily: fontStack(s.font),
          fontWeight: s.bold ? 700 : 400,
          fontSize: 13,
          color: s.color,
          textShadow:
            s.boxOpacity > 0 ? "none" : `0 0 3px ${s.outlineColor}, 0 1px 2px rgba(0,0,0,.9)`,
          background: s.boxOpacity > 0 ? `rgba(0,0,0,${s.boxOpacity})` : "transparent",
          padding: s.boxOpacity > 0 ? "1px 6px" : 0,
          borderRadius: 5,
          textTransform: s.uppercase ? "uppercase" : "none",
          whiteSpace: "nowrap",
        }}
      >
        ใส่ซับ<span style={{ color: s.highlightColor }}>ไวรัล</span>
      </span>
    </div>
  );
}

export default function StylePicker({
  style,
  onChange,
  templates = [],
  onSaveTemplate,
  onDeleteTemplate,
}: {
  style: SubtitleStyle;
  onChange: (s: SubtitleStyle) => void;
  templates?: SubtitleStyle[];
  onSaveTemplate?: (name: string) => void;
  onDeleteTemplate?: (id: string) => void;
}) {
  const set = (patch: Partial<SubtitleStyle>) => onChange({ ...style, ...patch });
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  function save() {
    const n = name.trim();
    if (!n || !onSaveTemplate) return;
    onSaveTemplate(n);
    setName("");
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      {/* Live animated preview of the selected style */}
      <div>
        <p className="mb-2 text-sm font-semibold text-white/80">ตัวอย่างสด</p>
        <StylePreview style={style} />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-white/80">เทมเพลตซับ</p>
        <div className="grid grid-cols-2 gap-2">
          {STYLE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => onChange({ ...p })}
              className={`overflow-hidden rounded-xl p-2 transition ${
                style.id === p.id
                  ? "btn-grad ring-2 ring-white/40"
                  : "glass hover:border-brand-400"
              }`}
            >
              <MiniSample s={p} />
              <div className="mt-1.5 truncate text-center text-xs font-semibold">
                {p.name}
              </div>
            </button>
          ))}
        </div>

        {templates.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-sm font-semibold text-white/80">
              เทมเพลตของฉัน
            </p>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={`group relative overflow-hidden rounded-xl transition ${
                    style.id === t.id
                      ? "btn-grad ring-2 ring-white/40"
                      : "glass hover:border-brand-400"
                  }`}
                >
                  <button
                    onClick={() => onChange({ ...t })}
                    className="w-full p-2 text-left"
                    title={t.name}
                  >
                    <MiniSample s={t} />
                    <div className="mt-1.5 truncate px-1 text-center text-xs font-semibold">
                      {t.name}
                    </div>
                  </button>
                  {onDeleteTemplate && (
                    <button
                      onClick={() => onDeleteTemplate(t.id)}
                      aria-label="ลบเทมเพลต"
                      className="absolute right-1 top-1 rounded bg-black/40 px-1.5 text-white/60 hover:text-red-300"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {onSaveTemplate &&
          (saving ? (
            <div className="mt-3 flex gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                placeholder="ตั้งชื่อเทมเพลต"
                className="flex-1 rounded-lg bg-white/5 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button onClick={save} className="btn-grad rounded-lg px-3 py-1.5 text-sm font-semibold">
                บันทึก
              </button>
              <button
                onClick={() => {
                  setSaving(false);
                  setName("");
                }}
                className="glass rounded-lg px-3 py-1.5 text-sm"
              >
                ยกเลิก
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSaving(true)}
              className="glass mt-3 w-full rounded-lg px-3 py-2 text-sm hover:border-brand-400"
            >
              + บันทึกสไตล์นี้เป็นเทมเพลต
            </button>
          ))}
      </div>

      <Control label="ฟอนต์">
        <select
          value={style.font}
          onChange={(e) => set({ font: e.target.value })}
          style={{ fontFamily: fontStack(style.font) }}
          className="w-full rounded-lg bg-white/5 px-2 py-1.5 text-sm"
        >
          {(["viral", "clean", "display"] as const).map((cat) => (
            <optgroup
              key={cat}
              label={
                cat === "viral" ? "ไวรัล / แคปชัน" : cat === "clean" ? "อ่านง่าย / ทางการ" : "ดิสเพลย์ / ลายมือ"
              }
            >
              {FONT_OPTIONS.filter((f) => f.category === cat).map((f) => (
                <option key={f.name} value={f.name} style={{ fontFamily: fontStack(f.name) }}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Control>

      <Control label="ขนาดฟอนต์">
        <input
          type="range"
          min={24}
          max={80}
          value={style.fontSize}
          onChange={(e) => set({ fontSize: Number(e.target.value) })}
          className="w-full accent-brand-500"
        />
        <span className="w-10 text-right text-xs text-white/60">{style.fontSize}</span>
      </Control>

      <Control label="ตำแหน่ง">
        <select
          value={style.position}
          onChange={(e) => set({ position: e.target.value as any })}
          className="w-full rounded-lg bg-white/5 px-2 py-1.5 text-sm"
        >
          <option value="bottom">ล่าง</option>
          <option value="center">กลาง</option>
          <option value="top">บน</option>
        </select>
      </Control>

      <div className="grid grid-cols-2 gap-3">
        <Control label="สีตัวอักษร">
          <input
            type="color"
            value={style.color}
            onChange={(e) => set({ color: e.target.value })}
            className="h-8 w-full rounded bg-transparent"
          />
        </Control>
        <Control label="สีไฮไลท์">
          <input
            type="color"
            value={style.highlightColor}
            onChange={(e) => set({ highlightColor: e.target.value })}
            className="h-8 w-full rounded bg-transparent"
          />
        </Control>
      </div>

      <Control label="คำต่อบรรทัด">
        <input
          type="range"
          min={1}
          max={12}
          value={style.maxWordsPerCue}
          onChange={(e) => set({ maxWordsPerCue: Number(e.target.value) })}
          className="w-full accent-brand-500"
        />
        <span className="w-10 text-right text-xs text-white/60">{style.maxWordsPerCue}</span>
      </Control>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={style.wordHighlight}
          onChange={(e) => set({ wordHighlight: e.target.checked })}
          className="h-4 w-4 accent-brand-500"
        />
        ไฮไลท์คำที่กำลังพูด (คาราโอเกะ)
      </label>

      {style.wordHighlight && (
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={style.wordPop ?? false}
            onChange={(e) => set({ wordPop: e.target.checked })}
            className="h-4 w-4 accent-brand-500"
          />
          คำเด้ง (pop animation)
        </label>
      )}

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={style.bold}
          onChange={(e) => set({ bold: e.target.checked })}
          className="h-4 w-4 accent-brand-500"
        />
        ตัวหนา
      </label>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={style.uppercase}
          onChange={(e) => set({ uppercase: e.target.checked })}
          className="h-4 w-4 accent-brand-500"
        />
        ตัวพิมพ์ใหญ่ (A–Z)
      </label>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={style.autoEmphasis ?? false}
          onChange={(e) => set({ autoEmphasis: e.target.checked })}
          className="h-4 w-4 accent-brand-500"
        />
        AI เน้นคำสำคัญอัตโนมัติ
      </label>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={style.autoEmoji ?? false}
          onChange={(e) => set({ autoEmoji: e.target.checked })}
          className="h-4 w-4 accent-brand-500"
        />
        เติม emoji อัตโนมัติ
      </label>

      {style.autoEmphasis && (
        <Control label="สีคำที่เน้น">
          <input
            type="color"
            value={style.emphasisColor ?? style.highlightColor}
            onChange={(e) => set({ emphasisColor: e.target.value })}
            className="h-8 w-full rounded bg-transparent"
          />
        </Control>
      )}
    </div>
  );
}

function Control({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-white/60">{label}</p>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
