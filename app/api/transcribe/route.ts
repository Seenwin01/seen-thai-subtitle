import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { jobPath, newJobId } from "@/lib/storage";
import { transcribeJob } from "@/lib/pipeline";
import { setStatus } from "@/lib/jobstatus";
import { getQueue } from "@/lib/queue";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("video");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "no video" }, { status: 400 });
    }

    const jobId = newJobId();
    const ext = path.extname((file as File).name) || ".mp4";
    const videoFile = jobPath(jobId, `source${ext}`);
    fs.writeFileSync(videoFile, Buffer.from(await (file as File).arrayBuffer()));

    setStatus(jobId, { state: "queued", progress: 0, step: "เข้าคิว" });

    // Run in the background; client polls /api/status/<jobId>.
    getQueue()
      .enqueue(() =>
        transcribeJob(jobId, videoFile, (pct, step) =>
          setStatus(jobId, { state: "processing", progress: pct, step })
        )
      )
      .then((t) =>
        setStatus(jobId, {
          state: "done",
          progress: 100,
          step: "เสร็จแล้ว",
          result: { segments: t.segments.length },
        })
      )
      .catch((e) =>
        setStatus(jobId, {
          state: "error",
          step: "เกิดข้อผิดพลาด",
          error: String(e?.message ?? e),
        })
      );

    return NextResponse.json({ jobId });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "transcription failed" },
      { status: 500 }
    );
  }
}
