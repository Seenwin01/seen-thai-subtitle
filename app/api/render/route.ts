import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { jobDir, jobPath, safeJobId } from "@/lib/storage";
import { probe, run, burnSubtitles, toAspect, scaleTo, renderTransparentSubs } from "@/lib/ffmpeg";
import { generateAss } from "@/lib/ass";
import { pickEmphasis } from "@/lib/keywords";
import { emojiForCue } from "@/lib/emoji";
import { getAspect } from "@/lib/aspect";
import { targetHeight } from "@/lib/export";
import { generateSrt } from "@/lib/srt";
import { setStatus } from "@/lib/jobstatus";
import { getQueue } from "@/lib/queue";
import { bandPct, parseFfmpegTimeSec } from "@/lib/progress";
import { getAccount, isValidUid, saveAccount } from "@/lib/accounts";
import { RENDER_COST, canAfford, charge, getPlan, withinLimit } from "@/lib/credits";
import type { RenderRequest, Transcript } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600;

const WATERMARK_TEXT = "ซับไทย AI";

// Auto-contrast: sample the average brightness (YAVG 0-255) of the subtitle band
// once per second, so generateAss can pick a readable text/outline colour per cue.
// Returns a lookup t(sec)->luma, or undefined (disabled / failed -> fixed colours).
async function sampleLuma(
  input: string,
  position: string
): Promise<((t: number) => number) | undefined> {
  const cropY = position === "top" ? "0" : position === "center" ? "ih/3" : "ih*2/3";
  try {
    const out = await run("ffmpeg", [
      "-hide_banner",
      "-i",
      input,
      "-vf",
      `crop=iw:ih/3:0:${cropY},fps=1,signalstats,metadata=print:file=-`,
      "-f",
      "null",
      "-",
    ]);
    const lumas: number[] = [];
    for (const mm of out.matchAll(/YAVG=([\d.]+)/g)) lumas.push(parseFloat(mm[1]));
    if (!lumas.length) return undefined;
    return (t: number) => lumas[Math.max(0, Math.min(lumas.length - 1, Math.floor(t)))];
  } catch {
    return undefined;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RenderRequest;
    const jobId = safeJobId(body.jobId);

    const jobJsonPath = jobPath(jobId, "job.json");
    if (!fs.existsSync(jobJsonPath)) {
      return NextResponse.json({ error: "job not found" }, { status: 404 });
    }
    const job: Transcript = JSON.parse(fs.readFileSync(jobJsonPath, "utf-8"));
    const input = path.join(jobDir(jobId), job.videoFile);
    const info = await probe(input);

    // ---- Credit & plan checks happen synchronously (instant 402) ----
    const uid = req.cookies.get("uid")?.value;
    const acc = uid && isValidUid(uid) ? getAccount(uid) : null;
    let watermark = true;
    if (acc) {
      const plan = getPlan(acc.planId);
      if (!withinLimit(acc, info.duration)) {
        return NextResponse.json(
          { error: `คลิปยาวเกินแผน ${plan.name} (สูงสุด ${plan.maxClipMinutes} นาที/ไฟล์)`, code: "limit" },
          { status: 402 }
        );
      }
      if (!canAfford(acc, RENDER_COST)) {
        return NextResponse.json(
          { error: "เครดิตไม่พอ — อัปเกรดแผนหรือรอรอบเครดิตถัดไป", code: "credits" },
          { status: 402 }
        );
      }
      watermark = plan.watermark;
    }

    setStatus(jobId, { state: "processing", progress: 5, step: "กำลังเตรียมซับ" });

    getQueue().enqueue(async () => {
      // auto-contrast on by default; set style.autoContrast=false to use fixed colours
      const autoContrast = (body.style as { autoContrast?: boolean }).autoContrast !== false;
      const lumaAt = autoContrast ? await sampleLuma(input, body.style.position) : undefined;

      const ass = generateAss(
        body.segments, body.style, info.width, info.height,
        watermark ? WATERMARK_TEXT : undefined,
        pickEmphasis,
        emojiForCue,
        lumaAt
      );
      fs.writeFileSync(jobPath(jobId, "subtitles.ass"), ass, "utf-8");
      fs.writeFileSync(jobPath(jobId, "subtitles.srt"), generateSrt(body.segments), "utf-8");

      const fontsDir = path.join(process.cwd(), "fonts");
      const useFonts = fs.existsSync(fontsDir);
      let outputName: string;

      if (body.transparent) {
        setStatus(jobId, { state: "processing", progress: 35, step: "กำลังเรนเดอร์ซับโปร่งใส (.mov)" });
        outputName = "overlay.mov";
        await renderTransparentSubs(
          jobPath(jobId, "subtitles.ass"),
          jobPath(jobId, outputName),
          info.width,
          info.height,
          info.duration,
          useFonts ? fontsDir : undefined
        );
      } else {
        await burnSubtitles(
          input,
          jobPath(jobId, "subtitles.ass"),
          jobPath(jobId, "burned.mp4"),
          useFonts ? fontsDir : undefined,
          (line) => {
            const t = parseFfmpegTimeSec(line);
            if (t !== null) {
              setStatus(jobId, {
                state: "processing",
                progress: bandPct(t, info.duration, 10, 90),
                step: "กำลังเบิร์นซับลงวิดีโอ",
              });
            }
          }
        );

        let current = jobPath(jobId, "burned.mp4");
        const aspect = getAspect(body.aspect);
        if (aspect) {
          setStatus(jobId, { state: "processing", progress: 93, step: `กำลังปรับอัตราส่วน ${aspect.id}` });
          await toAspect(current, jobPath(jobId, "aspect.mp4"), aspect.w, aspect.h);
          current = jobPath(jobId, "aspect.mp4");
        }

        const h = targetHeight(body.scale);
        if (h) {
          setStatus(jobId, { state: "processing", progress: 96, step: `กำลังปรับความละเอียด ${h}p` });
          await scaleTo(current, jobPath(jobId, "output.mp4"), h);
        } else {
          fs.renameSync(current, jobPath(jobId, "output.mp4"));
        }
        outputName = "output.mp4";
      }

      let credits: number | null = null;
      if (acc) {
        const charged = charge(acc, RENDER_COST);
        saveAccount(charged);
        credits = charged.credits;
      }
      setStatus(jobId, {
        state: "done", progress: 100, step: "เสร็จแล้ว",
        result: { output: outputName, credits },
      });
    }).catch((e) =>
      setStatus(jobId, { state: "error", step: "เรนเดอร์ไม่สำเร็จ", error: String(e?.message ?? e) })
    );

    return NextResponse.json({ jobId, accepted: true });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "render failed", { status: 500 });
  }
}
