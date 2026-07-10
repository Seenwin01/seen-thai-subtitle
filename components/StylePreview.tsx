"use client";

import { useEffect, useState } from "react";
import type { SubtitleStyle } from "@/lib/types";
import { fontStack } from "@/lib/fonts";

// Sample phrase split into karaoke "groups" (Thai, no inter-word spaces).
const SAMPLE = ["แค่", "พูด", "ก็ได้", "ซับ", "ไวรัล", "ทันที"];

/**
 * Animated mini-preview of a subtitle style: loops a sample Thai phrase with the
 * style's colours, outline, box, bold and — when enabled — the karaoke highlight
 * and word-pop. Lets users see exactly how each style behaves before rendering.
 */
export default function StylePreview({
  style,
  height = 92,
  fontSize = 24,
}: {
  style: SubtitleStyle;
  height?: number;
  fontSize?: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!style.wordHighlight) return;
    const id = setInterval(() => setI((p) => (p + 1) % SAMPLE.length), 550);
    return () => clearInterval(id);
  }, [style.wordHighlight]);

  const emphasisColor = style.emphasisColor ?? style.highlightColor;
  // Treat the 4th group as an "emphasised keyword" demo for static styles.
  const emphIdx = 4;

  const justify =
    style.position === "top"
      ? "flex-start"
      : style.position === "center"
      ? "center"
      : "flex-end";

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 14,
        overflow: "hidden",
        minHeight: height,
        display: "flex",
        alignItems: justify,
        justifyContent: "center",
        padding: "14px 16px",
        background:
          "linear-gradient(135deg,#23233a,#101019 70%), radial-gradient(120px 80px at 80% 0%, rgba(168,85,247,.25), transparent)",
      }}
    >
      <p
        style={{
          margin: 0,
          textAlign: "center",
          fontFamily: fontStack(style.font),
          fontWeight: style.bold ? 700 : 400,
          color: style.color,
          fontSize,
          lineHeight: 1.25,
          textTransform: style.uppercase ? "uppercase" : "none",
          textShadow:
            style.boxOpacity > 0
              ? "none"
              : `0 0 ${style.outlineWidth + 2}px ${style.outlineColor}, 0 2px 6px rgba(0,0,0,.9)`,
          background:
            style.boxOpacity > 0 ? `rgba(0,0,0,${style.boxOpacity})` : "transparent",
          padding: style.boxOpacity > 0 ? "4px 12px" : 0,
          borderRadius: 8,
        }}
      >
        {SAMPLE.map((w, j) => {
          const active = style.wordHighlight && j === i;
          const isEmph = !style.wordHighlight && style.autoEmphasis && j === emphIdx;
          const color = active
            ? style.highlightColor
            : isEmph
            ? emphasisColor
            : undefined;
          const pop = active && style.wordPop;
          return (
            <span
              key={j}
              style={{
                color,
                display: pop ? "inline-block" : undefined,
                transform: pop ? "scale(1.2)" : undefined,
                transition: "transform .16s ease, color .12s ease",
                margin: "0 1px",
              }}
            >
              {w}
            </span>
          );
        })}
      </p>
    </div>
  );
}
