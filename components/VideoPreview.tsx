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
  const [t, setT] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let raf = 0;
    const tick = () => {
      setT(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

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

  return (
    <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} src={src} controls className="h-auto w-full" playsInline />
      <div
        className={`pointer-events-none absolute inset-0 flex justify-center px-4 text-center ${align}`}
      >
        {cue && (
          <p
            style={{
              fontSize: `clamp(16px, ${style.fontSize / 12}vw, 40px)`,
              fontWeight: style.bold ? 800 : 500,
              color: style.color,
              textShadow:
                style.boxOpacity > 0
                  ? "none"
                  : `0 0 ${style.outlineWidth + 2}px ${style.outlineColor}, 0 2px 6px rgba(0,0,0,.9)`,
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
                    transform: pop ? "scale(1.18)" : undefined,
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
