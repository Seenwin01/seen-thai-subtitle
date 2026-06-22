import type { Clip } from "./clips";

// ---------------------------------------------------------------------------
// Ranking of candidate viral clips.
//
// Two modes:
//   1. heuristic  — sort by the score already computed in lib/clips.ts
//   2. LLM        — ask an LLM to re-rank, re-score and re-title the clips
//                   (used automatically when an API key is configured)
//
// The network call is isolated in `callLLM`; the prompt building and response
// parsing are pure functions so they can be unit-tested without a network.
// ---------------------------------------------------------------------------

export type Ranker = "ai" | "heuristic";

export interface RankConfig {
  provider: "anthropic" | "openai" | "none";
  apiKey: string;
  model: string;
}

export function rankConfig(): RankConfig {
  const provider =
    (process.env.LLM_PROVIDER as RankConfig["provider"]) ||
    (process.env.ANTHROPIC_API_KEY
      ? "anthropic"
      : process.env.OPENAI_API_KEY
      ? "openai"
      : "none");
  const apiKey =
    provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY || ""
      : provider === "openai"
      ? process.env.OPENAI_API_KEY || ""
      : "";
  const model =
    process.env.LLM_MODEL ||
    (provider === "anthropic" ? "claude-haiku-4-5-20251001" : "gpt-4o-mini");
  return { provider, apiKey, model };
}

export function llmConfigured(): boolean {
  const c = rankConfig();
  return c.provider !== "none" && !!c.apiKey;
}

/** Assign 1-based ranks in place based on current array order. */
function withRanks(clips: Clip[]): Clip[] {
  return clips.map((c, i) => ({ ...c, rank: i + 1 }));
}

/** Heuristic ranking: highest score first, earlier clip wins ties. */
export function rankHeuristic(clips: Clip[]): Clip[] {
  const sorted = [...clips].sort(
    (a, b) => b.score - a.score || a.start - b.start
  );
  return withRanks(sorted);
}

/** Build the LLM prompt from candidate clips. */
export function buildRankPrompt(clips: Clip[]): string {
  const items = clips
    .map(
      (c) =>
        `- id: ${c.id}\n  ความยาว: ${c.duration} วินาที\n  เนื้อหา: ${(
          c.text ||
          c.title ||
          ""
        ).slice(0, 500)}`
    )
    .join("\n");

  return [
    "คุณเป็นผู้เชี่ยวชาญคอนเทนต์ไวรัลสำหรับ TikTok/Reels ภาษาไทย",
    "ด้านล่างคือช่วงคลิปที่ตัดมาจากวิดีโอยาว จงจัดอันดับว่าคลิปไหนมีโอกาสไวรัลมากที่สุด",
    "พิจารณาจาก: ฮุกเปิด, อารมณ์/ความอยากรู้, ประโยชน์ที่ผู้ชมได้, และความกระชับ",
    "",
    items,
    "",
    "ตอบกลับเป็น JSON array เท่านั้น (ห้ามมีข้อความอื่น) เรียงจากไวรัลมากไปน้อย:",
    '[{"id":"<id>","score":<0-100>,"title":"<พาดหัวสั้นน่าคลิก ไม่เกิน 60 ตัวอักษร>","reason":"<เหตุผลสั้นๆ>"}]',
  ].join("\n");
}

/**
 * Parse the LLM JSON response and merge it onto the original clips.
 * Robust to extra prose around the JSON. Clips the LLM omitted keep their
 * heuristic score and are appended after the ranked ones.
 */
export function parseRanking(text: string, clips: Clip[]): Clip[] {
  const byId = new Map(clips.map((c) => [c.id, c]));
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("no JSON array in LLM response");
  }

  let parsed: any[];
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("invalid JSON in LLM response");
  }

  const ordered: Clip[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    const base = byId.get(item?.id);
    if (!base || seen.has(base.id)) continue;
    seen.add(base.id);
    const score =
      typeof item.score === "number"
        ? Math.max(0, Math.min(100, Math.round(item.score)))
        : base.score;
    ordered.push({
      ...base,
      score,
      title: typeof item.title === "string" && item.title.trim()
        ? item.title.trim()
        : base.title,
      reasons:
        typeof item.reason === "string" && item.reason.trim()
          ? [item.reason.trim()]
          : base.reasons,
    });
  }

  // Append any clips the model didn't rank, sorted by their heuristic score.
  const rest = clips
    .filter((c) => !seen.has(c.id))
    .sort((a, b) => b.score - a.score);

  return withRanks([...ordered, ...rest]);
}

export async function callLLM(prompt: string, cfg: RankConfig): Promise<string> {
  if (cfg.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    return data?.content?.[0]?.text ?? "";
  }

  if (cfg.provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }

  throw new Error("no LLM provider configured");
}

/**
 * Rank clips with an LLM when configured, otherwise fall back to the
 * heuristic ranking. Always resolves (never throws) so the API stays robust.
 * Returns the ranked clips plus which ranker was actually used.
 */
export async function rankClips(
  clips: Clip[]
): Promise<{ clips: Clip[]; ranker: Ranker }> {
  if (!clips.length) return { clips, ranker: "heuristic" };
  const cfg = rankConfig();
  if (cfg.provider === "none" || !cfg.apiKey) {
    return { clips: rankHeuristic(clips), ranker: "heuristic" };
  }
  try {
    const text = await callLLM(buildRankPrompt(clips), cfg);
    return { clips: parseRanking(text, clips), ranker: "ai" };
  } catch {
    return { clips: rankHeuristic(clips), ranker: "heuristic" };
  }
}
