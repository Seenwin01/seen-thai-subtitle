import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { jobPath, safeJobId } from "@/lib/storage";
import { detectClips } from "@/lib/clips";
import { rankClips } from "@/lib/rank";
import type { Transcript } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

// Detect candidate viral clips from a job's transcript, then rank them
// (LLM when configured, otherwise heuristic by score).
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = safeJobId(params.id);
    const p = jobPath(id, "job.json");
    if (!fs.existsSync(p)) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const job: Transcript = JSON.parse(fs.readFileSync(p, "utf-8"));

    const clips = detectClips(job.segments);

    // Attach full spoken text per clip so the ranker has real content to judge.
    const segById = new Map(job.segments.map((s) => [s.id, s]));
    for (const c of clips) {
      c.text = c.segmentIds
        .map((sid) => segById.get(sid)?.text ?? "")
        .join(" ")
        .trim();
    }

    const { clips: ranked, ranker } = await rankClips(clips);
    // Strip the transient text field from the response payload.
    const out = ranked.map(({ text, ...rest }) => rest);

    return NextResponse.json({
      jobId: id,
      videoFile: job.videoFile,
      ranker,
      clips: out,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 400 });
  }
}
