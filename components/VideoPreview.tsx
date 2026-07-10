"use client";

import { useEffect, useRef, useState } from "react";
import type { Segment, SubtitleStyle } from "@/lib/types";
import { buildCues, activeCue, activeUntil } from "@/lib/cues";
import { fontStack } from "@/lib/fonts";
import { isThai } from "@/lib/thai";
import { pickEmphasis } from "@/lib/keywords";
import { emojiForCue } from "@/lib/emoji";

export default function VideoPreview({
  src,
  segments,
  style,
  onReady,
  showSafeZones = true,
}: {
  src: string;
  segments: Segment[];
  style: SubtitleStyle;
  onReady?: (api: { seek: (t: number) => void }) => void;
  /** Show TikTok/Reels UI safe-zone guides over the 9:16 frame. */
  showSafeZones?: boolean;
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
  // Thai has no inter-word spaces; keep groups joined so phrases read naturally.
  const sep = cue && isThai(cue.words.map((w) => w.text).join("")) ? "" : " ";

  const align =
    style.position === "top"
      ? "items-start pt-[8%]"
      : style.position === "center"
      ? "items-center"
      : "items-end pb-[8%]";

  return (
    <div
      className="relative mx-auto aspect-[9/16] w-full max-w-sm overflow-hidden rounded-2xl bg-black"
      // container-type: size lets the caption size in `cqh` (1% of THIS frame's
      // height) instead of viewport `vw`, so the preview font is the exact same
      // fraction of the frame that lib/ass.ts burns (fontSize/1000 of height).
      style={{ containerType: "size" }}
    >
      <video
        ref={videoRef}
        src={src}
        controls
        className="absolute inset-0 h-full w-full object-contain"
        playsInline
      />
      <div
        className={`pointer-events-none absolute inset-0 flex justify-center px-4 text-center ${align}`}
      >
        {cue && (
          <p
            style={{
              fontFamily: fontStack(style.font),
              // Same formula as lib/ass.ts: fontSize/1000 of frame height.
              // cqh = 1% of the container height, so fontSize/10 cqh == that.
              fontSize: `${style.fontSize / 10}cqh`,
              // 700/400 = the weights actually loaded (globals.css) and the ones
              // in the bundled .ttf, so the preview weight matches the burn.
              fontWeight: style.bold ? 700 : 400,
              color: style.color,
              textShadow:
                style.boxOpacity > 0
                  ? "none"
                  : `0 0 ${(style.outlineWidth + 1) / 10}cqh ${style.outlineColor}, 0 0.2cqh 0.6cqh rgba(0,0,0,.9)`,
              background:
                style.boxOpacity > 0 ? `rgba(0,0,0,${style.boxOpacity})` : "transparent",
              padding: style.boxOpacity > 0 ? "0.15em 0.5em" : 0,
              borderRadius: 8,
              lineHeight: 1.25,
              textTransform: style.uppercase ? "uppercase" : "none",
            }}
          >
            {cue.words.map((w, i) => {
              // Karaoke: a group stays highlighted until the next group begins,
              // so the highlight moves continuously instead of flickering.
              const until = activeUntil(cue.words, i, cue.end);
              const active = style.wordHighlight && t >= w.start && t < until;
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
                  {i < cue.words.length - 1 ? sep : ""}
                </span>
              );
            })}
            {emoji ? ` ${emoji}` : ""}
          </p>
        )}
      </div>
      {showSafeZones && (
        <div className="pointer-events-none absolute inset-0">
          {/* bottom: TikTok caption / CTA area */}
          <div className="absolute inset-x-0 bottom-0 h-[15%] border-t border-dashed border-white/25" />
          {/* right: like / comment / share buttons */}
          <div className="absolute inset-y-0 right-0 w-[14%] border-l border-dashed border-white/25" />
          <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[10px] text-white/60">
            เขตปลอดภัย
          </span>
        </div>
      )}
    </div>
  );
}
