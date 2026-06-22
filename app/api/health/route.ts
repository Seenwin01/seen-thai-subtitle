import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { run } from "@/lib/ffmpeg";
import { rankConfig } from "@/lib/rank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PYTHON_BIN = process.env.PYTHON_BIN || "python3";
const YTDLP_BIN = process.env.YTDLP_BIN || "yt-dlp";

interface Check {
  key: string;
  label: string;
  required: boolean;
  ok: boolean;
  detail: string;
}

async function checkCmd(cmd: string, args: string[]): Promise<string | null> {
  try {
    const out = await run(cmd, args);
    return out.trim().split("\n")[0] || "ok";
  } catch {
    return null;
  }
}

async function checkPyModule(mod: string): Promise<boolean> {
  try {
    await run(PYTHON_BIN, ["-c", `import ${mod}`]);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const checks: Check[] = [];

  const ffmpeg = await checkCmd("ffmpeg", ["-version"]);
  checks.push({
    key: "ffmpeg",
    label: "FFmpeg",
    required: true,
    ok: !!ffmpeg,
    detail: ffmpeg ?? "ไม่พบ ffmpeg ใน PATH",
  });

  const ffprobe = await checkCmd("ffprobe", ["-version"]);
  checks.push({
    key: "ffprobe",
    label: "ffprobe",
    required: true,
    ok: !!ffprobe,
    detail: ffprobe ?? "ไม่พบ ffprobe ใน PATH",
  });

  const py = await checkCmd(PYTHON_BIN, ["--version"]);
  checks.push({
    key: "python",
    label: "Python",
    required: true,
    ok: !!py,
    detail: py ?? `ไม่พบ ${PYTHON_BIN}`,
  });

  const whisper = py ? await checkPyModule("faster_whisper") : false;
  checks.push({
    key: "faster_whisper",
    label: "faster-whisper",
    required: true,
    ok: whisper,
    detail: whisper
      ? "พร้อมถอดเสียง"
      : "ยังไม่ติดตั้ง: pip install -r scripts/requirements.txt",
  });

  const cv2 = py ? await checkPyModule("cv2") : false;
  checks.push({
    key: "opencv",
    label: "OpenCV (ตรวจจับใบหน้า)",
    required: false,
    ok: cv2,
    detail: cv2
      ? "พร้อมรีเฟรม 9:16 ตามใบหน้า"
      : "ไม่บังคับ — ถ้าไม่มีจะ crop กลางภาพแทน",
  });

  const ytdlp = await checkCmd(YTDLP_BIN, ["--version"]);
  checks.push({
    key: "ytdlp",
    label: "yt-dlp (นำเข้า YouTube)",
    required: false,
    ok: !!ytdlp,
    detail: ytdlp ? `เวอร์ชัน ${ytdlp}` : "ไม่บังคับ — ใช้เฉพาะนำเข้าจากลิงก์",
  });

  let fontCount = 0;
  const fontsDir = path.join(process.cwd(), "fonts");
  try {
    fontCount = fs
      .readdirSync(fontsDir)
      .filter((f) => /\.(ttf|otf)$/i.test(f)).length;
  } catch {
    fontCount = 0;
  }
  checks.push({
    key: "fonts",
    label: "ฟอนต์ไทย",
    required: false,
    ok: fontCount > 0,
    detail:
      fontCount > 0
        ? `พบ ${fontCount} ฟอนต์ใน ./fonts`
        : "แนะนำวาง Sarabun/Noto Sans Thai ใน ./fonts เพื่อเบิร์นซับไทย",
  });

  const llm = rankConfig();
  const llmOn = llm.provider !== "none" && !!llm.apiKey;
  checks.push({
    key: "llm",
    label: "AI จัดอันดับคลิป",
    required: false,
    ok: llmOn,
    detail: llmOn
      ? `เปิดใช้งาน (${llm.provider} · ${llm.model})`
      : "ไม่บังคับ — ถ้าไม่ตั้ง API key จะจัดอันดับด้วยระบบให้คะแนนแทน",
  });

  const requiredOk = checks.filter((c) => c.required).every((c) => c.ok);
  return NextResponse.json({ ready: requiredOk, checks });
}
