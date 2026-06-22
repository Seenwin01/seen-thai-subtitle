import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { jobDir, jobPath, newJobId } from "@/lib/storage";
import { run } from "@/lib/ffmpeg";
import { transcribeJob } from "@/lib/pipeline";
import { setStatus } from "@/lib/jobstatus";
import { getQueue } from "@/lib/queue";

export const runtime = "nodejs";
export const maxDuration = 600;

const YTDLP_BIN = process.env.YTDLP_BIN || "yt-dlp";

function isHttpUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url || !isHttpUrl(url)) {
      return NextResponse.json({ error: "invalid url" }, { status: 400 });
    }

    const jobId = newJobId();
    const dir = jobDir(jobId);
    setStatus(jobId, { state: "queued", progress: 0, step: "เข้าคิว" });

    getQueue().enqueue(async () => {
      setStatus(jobId, { state: "processing", progress: 3, step: "กำลังดาวน์โหลดจากลิงก์" });
      await run(YTDLP_BIN, [
        "-f", "mp4/bestvideo[ext=mp4]+bestaudio/best",
        "--merge-output-format", "mp4",
        "-o", `${dir}/source.%(ext)s`,
        url,
      ]);
      const downloaded = fs.readdirSync(dir).find((f) => f.startsWith("source."));
      if (!downloaded) throw new Error("download failed");
      await transcribeJob(jobId, jobPath(jobId, downloaded), (pct, step) =>
        setStatus(jobId, { state: "processing", progress: pct, step })
      );
    })
      .then(() =>
        setStatus(jobId, { state: "done", progress: 100, step: "เสร็จแล้ว", result: {} })
      )
      .catch((e) =>
        setStatus(jobId, {
          state: "error",
          step: "นำเข้าไม่สำเร็จ (ต้องติดตั้ง yt-dlp)",
          error: String(e?.message ?? e),
        })
      );

    return NextResponse.json({ jobId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "import failed" }, { status: 500 });
  }
}
