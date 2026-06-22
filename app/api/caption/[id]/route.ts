import { NextRequest, NextResponse } from "next/server";
import { safeJobId } from "@/lib/storage";
import { rankConfig, callLLM } from "@/lib/rank";
import { buildCaptionPrompt, parseCaption, generateCaptionHeuristic } from "@/lib/caption";
import type { Segment } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

// Generate a post caption + hashtags from the (edited) subtitles.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    safeJobId(params.id);
    const { segments } = (await req.json()) as { segments: Segment[] };
    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: "ไม่มีซับให้สร้างแคปชั่น" }, { status: 400 });
    }

    const cfg = rankConfig();
    if (cfg.provider !== "none" && cfg.apiKey) {
      try {
        const text = await callLLM(buildCaptionPrompt(segments), cfg);
        const parsed = parseCaption(text);
        if (parsed.caption) {
          return NextResponse.json({ ...parsed, source: "ai" });
        }
      } catch {
        /* fall through to heuristic */
      }
    }

    return NextResponse.json({ ...generateCaptionHeuristic(segments), source: "heuristic" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "สร้างแคปชั่นไม่สำเร็จ" }, { status: 500 });
  }
}
