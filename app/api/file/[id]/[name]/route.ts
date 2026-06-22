import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { jobDir, safeJobId } from "@/lib/storage";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".srt": "text/plain; charset=utf-8",
  ".ass": "text/plain; charset=utf-8",
  ".wav": "audio/wav",
};

// Serves source video, rendered output, and subtitle files for a job.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; name: string } }
) {
  try {
    const id = safeJobId(params.id);
    const name = path.basename(params.name); // prevent traversal
    const file = path.join(jobDir(id), name);
    if (!fs.existsSync(file)) {
      return new Response("not found", { status: 404 });
    }

    const stat = fs.statSync(file);
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const download = req.nextUrl.searchParams.get("download");

    const stream = fs.createReadStream(file) as unknown as ReadableStream;
    const headers: Record<string, string> = {
      "Content-Type": type,
      "Content-Length": String(stat.size),
      "Cache-Control": "no-store",
    };
    if (download) {
      headers["Content-Disposition"] = `attachment; filename="${name}"`;
    }
    return new Response(stream, { headers });
  } catch (e: any) {
    return new Response(e?.message ?? "error", { status: 400 });
  }
}
