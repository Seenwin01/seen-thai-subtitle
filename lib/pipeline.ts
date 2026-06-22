import path from "path";
import fs from "fs";
import { jobPath } from "./storage";
import { run, runStream } from "./ffmpeg";
import { bandPct, parseWhisperPct } from "./progress";
import type { Transcript } from "./types";

const PYTHON_BIN = process.env.PYTHON_BIN || "python3";
const WHISPER_MODEL = process.env.WHISPER_MODEL || "small";

/**
 * Shared transcription pipeline: extract 16kHz mono audio, run local Whisper
 * (Thai, word timestamps), and persist job.json. Reports coarse progress via
 * the optional onProgress(pct, step) callback.
 */
export async function transcribeJob(
  jobId: string,
  videoFile: string,
  onProgress?: (pct: number, step: string) => void
): Promise<Transcript> {
  onProgress?.(5, "กำลังแยกเสียง");
  const audioFile = jobPath(jobId, "audio.wav");
  await run("ffmpeg", [
    "-y", "-i", videoFile, "-vn", "-ac", "1", "-ar", "16000", audioFile,
  ]);

  onProgress?.(10, "AI กำลังถอดเสียงภาษาไทย");
  const scriptPath = path.join(process.cwd(), "scripts", "transcribe.py");
  const transcriptJson = jobPath(jobId, "transcript.json");
  await runStream(
    PYTHON_BIN,
    [scriptPath, audioFile, transcriptJson, WHISPER_MODEL, "th"],
    (line) => {
      const pct = parseWhisperPct(line);
      // map whisper's 0..100 onto the 10..90 band
      if (pct !== null) onProgress?.(bandPct(pct, 100, 10, 90), "AI กำลังถอดเสียงภาษาไทย");
    }
  );

  onProgress?.(95, "กำลังจัดรูปแบบซับ");
  const raw = JSON.parse(fs.readFileSync(transcriptJson, "utf-8"));
  const transcript: Transcript = {
    jobId,
    language: raw.language ?? "th",
    duration: raw.duration ?? 0,
    videoFile: path.basename(videoFile),
    segments: raw.segments ?? [],
  };
  fs.writeFileSync(jobPath(jobId, "job.json"), JSON.stringify(transcript));
  return transcript;
}
