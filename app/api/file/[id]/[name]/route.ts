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

// Parse a single "bytes=" Range header against the file size.
// Returns null when absent/invalid/unsatisfiable (caller serves full 200).
export function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const s = m[1];
  const e = m[2];
  if (s === "" && e === "") return null;
  let start: number;
  let end: number;
  if (s === "") {
    const n = parseInt(e, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    start = Math.max(size - n, 0);
    end = size - 1;
  } else {
    start = parseInt(s, 10);
    end = e === "" ? size - 1 : parseInt(e, 10);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

// Serves source video, rendered output, and subtitle files for a job.
// NOW supports HTTP Range so <video> can stream/seek — without it Chrome
// stalls at readyState 0 (the "video won't play / styles don't show" bug).
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

    const headers: Record<string, string> = {
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    };
    if (download) {
      headers["Content-Disposition"] = `attachment; filename="${name}"`;
    }

    const range = parseRange(req.headers.get("range"), stat.size);
    if (range) {
      const { start, end } = range;
      const stream = fs.createReadStream(file, { start, end }) as unknown as ReadableStream;
      return new Response(stream, {
        status: 206, // Partial Content — what <video> needs to play/seek
        headers: {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }

    const stream = fs.createReadStream(file) as unknown as ReadableStream;
    return new Response(stream, { headers: { ...headers, "Content-Length": String(stat.size) } });
  } catch (e: any) {
    return new Response(e?.message ?? "error", { status: 400 });
  }
}
