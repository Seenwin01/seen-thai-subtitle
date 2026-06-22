import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { jobDir, jobPath, safeJobId } from "@/lib/storage";
import { probe } from "@/lib/ffmpeg";
import { generateAss } from "@/lib/ass";
import { generateSrt } from "@/lib/srt";
import { pickEmphasis } from "@/lib/keywords";
import { emojiForCue } from "@/lib/emoji";
import type { RenderRequest, Transcript } from "@/lib/types";

export const runtime = "nodejs";

// Generate .srt or .ass from the current (edited) segments without burning.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = safeJobId(params.id);
    const body = (await req.json()) as RenderRequest & { type?: "srt" | "ass" };
    const type = body.type === "ass" ? "ass" : "srt";

    let content: string;
    if (type === "srt") {
      content = generateSrt(body.segments);
    } else {
      const jp = jobPath(id, "job.json");
      if (!fs.existsSync(jp)) {
        return NextResponse.json({ error: "job not found" }, { status: 404 });
      }
      const job: Transcript = JSON.parse(fs.readFileSync(jp, "utf-8"));
      const info = await probe(path.join(jobDir(id), job.videoFile));
      content = generateAss(
        body.segments, body.style, info.width, info.height, undefined, pickEmphasis, emojiForCue
      );
    }

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="subtitles.${type}"`,
      },
    });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "failed", { status: 500 });
  }
}
