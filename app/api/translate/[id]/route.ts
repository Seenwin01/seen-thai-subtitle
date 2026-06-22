import { NextRequest, NextResponse } from "next/server";
import { safeJobId } from "@/lib/storage";
import { rankConfig, callLLM } from "@/lib/rank";
import { buildTranslatePrompt, parseTranslation, getLanguage } from "@/lib/translate";
import type { Segment } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface Body {
  segments: Segment[];
  target: string; // language code
}

// Translate the (edited) segments into a target language using the LLM.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    safeJobId(params.id);
    const body = (await req.json()) as Body;
    const lang = getLanguage(body.target);
    if (!lang) return NextResponse.json({ error: "ภาษาไม่ถูกต้อง" }, { status: 400 });
    if (!Array.isArray(body.segments) || body.segments.length === 0) {
      return NextResponse.json({ error: "ไม่มีซับให้แปล" }, { status: 400 });
    }

    const cfg = rankConfig();
    if (cfg.provider === "none" || !cfg.apiKey) {
      return NextResponse.json(
        { error: "ต้องตั้งค่า ANTHROPIC_API_KEY หรือ OPENAI_API_KEY เพื่อใช้งานแปล" },
        { status: 400 }
      );
    }

    const prompt = buildTranslatePrompt(body.segments, lang.english);
    const text = await callLLM(prompt, cfg);
    const translated = parseTranslation(text, body.segments);

    return NextResponse.json({ segments: translated, target: lang.code });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "แปลไม่สำเร็จ" }, { status: 500 });
  }
}
