"use client";

import { useEffect, useRef, useState } from "react";
import type { Segment, SubtitleStyle } from "@/lib/types";
import { buildCues, activeCue } from "@/lib/cues";
import { pickEmphasis } from "@/lib/keywords";
import { emojiForCue } from "@/lib/emoji";

export default function VideoPreview({
  src,
  segments,
  style,
  onReady,
}: {
  src: string;
  segments: Segment[];
  style: SubtitleStyle;
  onReady?: (api: { seek: (t: number) => void }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastSampleRef = useRef(0);
  const [t, setT] = useState(0);
  const [videoH, setVideoH] = useState(0);
  const [luma, setLuma] = useState(255); // scene brightness 0-255 (subtitle band)

  // auto-contrast matches the render (lib/ass.ts): on unless style.autoContrast===false
  const autoContrast = (style as { autoContrast?: boolean }).autoContrast !== false;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    let raf = 0;
    const tick = () => {
      setT(v.currentTime);
      const h = v.clientHeight;
      setVideoH((prev) => (prev !== h ? h : prev));

      // sample subtitle-band brightness ~4x/sec (cheap, same-origin video)
      const now = performance.now();
      if (autoContrast && v.videoWidth && now - lastSampleRef.current > 250) {
        lastSampleRef.current = now;
        try {
          const c = canvasRef.current!;
          c.width = 8;
          c.height = 8;
          const ctx = c.getContext("2d", { willReadFrequently: true })!;
          const sh = Math.floor(v.videoHeight / 3);
          const sy =
            style.position === "top"
              ? 0
              : style.position === "center"
              ? Math.floor(v.videoHeight / 3)
              : Math.floor((v.videoHeight * 2) / 3);
          ctx.drawImage(v, 0, sy, v.videoWidth, sh, 0, 0, 8, 8);
          const d = ctx.getImageData(0, 0, 8, 8).data;
          let sum = 0;
          for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          setLuma(sum / (d.length / 4));
        } catch {
          /* tainted/unavailable -> keep last luma */
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoContrast, style.position]);

  useEffect(() => {
    onReady?.({
      seek: (t: number) => {
        const v = videoRef.current;
        if (v) {
          v.currentTime = Math.max(0, t);
          v.play?.().catch(() => {});
        }
      },
    });
  }, [onReady]);

  const cues = buildCues(segments, style.maxWordsPerCue);
  const cue = activeCue(cues, t);
  const emph =
    cue && style.autoEmphasis ? pickEmphasis(cue.words.map((w) => w.text)) : null;
  const emphasisColor = style.emphasisColor ?? style.highlightColor;
  const emoji = cue && style.autoEmoji ? emojiForCue(cue.words.map((w) => w.text)) : null;

  const align =
    style.position === "top"
      ? "items-start pt-[8%]"
      : style.position === "center"
      ? "items-center"
      : "items-end pb-[8%]";

  // match lib/ass.ts: fontSize/outline scale with the video height (1000px ref)
  const scale = videoH > 0 ? videoH / 1000 : 0.4;
  const fontSizePx = Math.max(10, style.fontSize * scale);
  const outlinePx = Math.max(1, style.outlineWidth * scale);

  // per-cue base + outline colour (auto-contrast or the chosen style colours)
  const bright = luma >= 140;
  const baseColor = autoContrast ? (bright ? "#0B0B0B" : "#FFFFFF") : style.color;
  const outlineColor = autoContrast ? (bright ? "#FFFFFF" : "#000000") : style.outlineColor;

  return (
    <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} src={src} controls className="h-auto w-full" playsInline />
      <div
        className={`pointer-events-none absolute inset-0 flex justify-center px-4 text-center ${align}`}
      >
        {cue && (
          <p
            style={{
              fontSize: `${fontSizePx}px`,
              fontWeight: style.bold ? 800 : 500,
              color: baseColor,
              textShadow:
                style.boxOpacity > 0
                  ? "none"
                  : `0 0 ${outlinePx + 1}px ${outlineColor}, ${outlinePx}px 0 ${outlineColor}, -${outlinePx}px 0 ${outlineColor}, 0 ${outlinePx}px ${outlineColor}, 0 -${outlinePx}px ${outlineColor}`,
              background:
                style.boxOpacity > 0 ? `rgba(0,0,0,${style.boxOpacity})` : "transparent",
              padding: style.boxOpacity > 0 ? "4px 12px" : 0,
              borderRadius: 8,
              lineHeight: 1.25,
              textTransform: style.uppercase ? "uppercase" : "none",
            }}
          >
            {cue.words.map((w, i) => {
              const active = style.wordHighlight && t >= w.start && t <= w.end;
              const color = active
                ? style.highlightColor
                : emph && emph[i]
                ? emphasisColor
                : undefined;
              const pop = active && style.wordPop;
              return (
                <span
                  key={i}
                  style={{
                    color,
                    display: pop ? "inline-block" : undefined,
                    transform: pop ? "scaleY(1.2)" : undefined,
                    transformOrigin: "bottom",
                    transition: "transform .12s ease",
                  }}
                >
                  {w.text}
                  {i < cue.words.length - 1 ? " " : ""}
                </span>
              );
            })}
            {emoji ? ` ${emoji}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
