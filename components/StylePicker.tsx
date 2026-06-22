"use client";

import { useState } from "react";
import type { SubtitleStyle } from "@/lib/types";
import { STYLE_PRESETS } from "@/lib/styles";

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
      <div>
        <p className="mb-2 text-sm font-semibold text-white/80">เทมเพลตซับ</p>
        <div className="grid grid-cols-2 gap-2">
          {STYLE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => onChange({ ...p })}
              className={`rounded-xl px-3 py-2 text-sm transition ${
                style.id === p.id
                  ? "btn-grad font-semibold"
                  : "glass hover:border-brand-400"
              }`}
            >
              {p.name}
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
                  className={`group relative flex items-center rounded-xl text-sm transition ${
                    style.id === t.id
                      ? "btn-grad font-semibold"
                      : "glass hover:border-brand-400"
                  }`}
                >
                  <button
                    onClick={() => onChange({ ...t })}
                    className="flex-1 truncate px-3 py-2 text-left"
                    title={t.name}
                  >
                    {t.name}
                  </button>
                  {onDeleteTemplate && (
                    <button
                      onClick={() => onDeleteTemplate(t.id)}
                      aria-label="ลบเทมเพลต"
                      className="px-2 text-white/50 hover:text-red-300"
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
