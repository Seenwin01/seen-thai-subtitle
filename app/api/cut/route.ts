import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { jobPath, newJobId, safeJobId } from "@/lib/storage";
import { run, cutClip, reframeAround, reframeCenter } from "@/lib/ffmpeg";
import { sliceTranscript } from "@/lib/clips";
import { setStatus } from "@/lib/jobstatus";
import { getQueue } from "@/lib/queue";
import type { Transcript } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600;

const PYTHON_BIN = process.env.PYTHON_BIN || "python3";

interface CutBody {
  jobId: string;
  start: number;
  end: number;
  vertical?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CutBody;
    const srcId = safeJobId(body.jobId);
    const srcJobPath = jobPath(srcId, "job.json");
    if (!fs.existsSync(srcJobPath)) {
      return NextResponse.json({ error: "job not found" }, { status: 404 });
    }
    const src: Transcript = JSON.parse(fs.readFileSync(srcJobPath, "utf-8"));
    const srcVideo = jobPath(srcId, src.videoFile);

    const start = Math.max(0, Number(body.start));
    const end = Math.max(start + 1, Number(body.end));
    const duration = +(end - start).toFixed(3);

    const newId = newJobId();
    setStatus(newId, { state: "queued", progress: 0, step: "เข้าคิว" });

    getQueue().enqueue(async () => {
      setStatus(newId, { state: "processing", progress: 20, step: "กำลังตัดคลิป" });
      const cutFile = jobPath(newId, "cut.mp4");
      await cutClip(srcVideo, start, duration, cutFile);

      let finalVideo = "cut.mp4";
      if (body.vertical) {
        setStatus(newId, { state: "processing", progress: 60, step: "กำลังรีเฟรมเป็นแนวตั้ง 9:16" });
        const vFile = jobPath(newId, "vertical.mp4");
        try {
          const out = await run(PYTHON_BIN, [
            path.join(process.cwd(), "scripts", "reframe.py"),
            cutFile,
          ]);
          const { center_x } = JSON.parse(out.trim());
          await reframeAround(cutFile, vFile, Number(center_x) || 0.5);
        } catch {
          await reframeCenter(cutFile, vFile);
        }
        finalVideo = "vertical.mp4";
      }

      setStatus(newId, { state: "processing", progress: 92, step: "กำลังจัดข้อมูลซับ" });
      const segments = sliceTranscript(src.segments, start, end);
      const job: Transcript = {
        jobId: newId, language: src.language, duration, videoFile: finalVideo, segments,
      };
      fs.writeFileSync(jobPath(newId, "job.json"), JSON.stringify(job));
    })
      .then(() =>
        setStatus(newId, { state: "done", progress: 100, step: "เสร็จแล้ว", result: { jobId: newId } })
      )
      .catch((e) =>
        setStatus(newId, { state: "error", step: "ตัดคลิปไม่สำเร็จ", error: String(e?.message ?? e) })
      );

    return NextResponse.json({ jobId: newId, accepted: true });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "cut failed", { status: 500 });
  }
}
