// ---------------------------------------------------------------------------
// Tiny LLM helper shared by ai-correct.ts and translate.ts.
// Supports Anthropic (Claude) and OpenAI chat endpoints. No SDK dependency —
// just fetch — so it works in the Next.js node runtime without adding packages.
// ---------------------------------------------------------------------------

export type LlmProvider = "anthropic" | "openai" | "gemini";

export interface LlmOptions {
  provider?: LlmProvider;
  model?: string;
  /** 0 = deterministic. Correction/translation want low temperature. */
  temperature?: number;
  maxTokens?: number;
}

function resolveProvider(opts: LlmOptions): LlmProvider {
  if (opts.provider) return opts.provider;
  if (process.env.LLM_PROVIDER) return process.env.LLM_PROVIDER as LlmProvider;
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  throw new Error(
    "No LLM key set (GEMINI_API_KEY, ANTHROPIC_API_KEY or OPENAI_API_KEY)"
  );
}

/**
 * Single-shot completion. Returns the assistant's raw text.
 */
export async function llmComplete(
  system: string,
  user: string,
  opts: LlmOptions = {}
): Promise<string> {
  const provider = resolveProvider(opts);
  const temperature = opts.temperature ?? 0;
  const maxTokens = opts.maxTokens ?? 4096;

  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model || "claude-3-5-haiku-latest",
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const d = await res.text().catch(() => "");
      throw new Error(`Anthropic error ${res.status}: ${d}`);
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    return (data.content || [])
      .map((b) => (b.type === "text" ? b.text || "" : ""))
      .join("")
      .trim();
  }

  if (provider === "gemini") {
    // Free API key from Google AI Studio (https://aistudio.google.com/apikey).
    // This is the API tier — separate from the Gemini app / Ultra subscription.
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    const model = opts.model || "gemini-2.5-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature, maxOutputTokens: maxTokens },
        }),
      }
    );
    if (!res.ok) {
      const d = await res.text().catch(() => "");
      throw new Error(`Gemini error ${res.status}: ${d}`);
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("")
      .trim();
  }

  // openai
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model || "gpt-4o-mini",
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const d = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${d}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return (data.choices?.[0]?.message?.content || "").trim();
}

/**
 * Parse a JSON array of strings out of an LLM response. Tolerates markdown code
 * fences (```json ... ```) and leading/trailing prose by extracting the first
 * bracketed [...] block. Returns null if no valid string array can be parsed —
 * callers treat null as "keep originals".
 */
export function parseStringArray(raw: string): string[] | null {
  if (!raw) return null;
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  if (s[0] !== "[") {
    const start = s.indexOf("[");
    const end = s.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) return null;
    s = s.slice(start, end + 1);
  }
  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((x) => (typeof x === "string" ? x : String(x)));
  } catch {
    return null;
  }
}
