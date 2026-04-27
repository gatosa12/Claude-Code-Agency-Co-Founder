import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-sonnet-4-6";

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

export function aiAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type GenerateOpts = {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
};

export async function generateText(opts: GenerateOpts): Promise<string> {
  const client = getClient();
  if (!client) {
    return mockResponse(opts.user);
  }

  const model = opts.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const res = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.8,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

export async function generateJSON<T = unknown>(
  opts: GenerateOpts & { mock?: T }
): Promise<T> {
  if (!aiAvailable() && opts.mock !== undefined) {
    return opts.mock;
  }
  const text = await generateText({
    ...opts,
    system: `${opts.system}\n\nRespond with ONLY valid JSON, no prose, no code fences.`,
  });
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(
      `Model did not return valid JSON. Got: ${cleaned.slice(0, 200)}...`
    );
  }
}

function mockResponse(prompt: string): string {
  return `[DEMO MODE — no ANTHROPIC_API_KEY set]

You asked: "${prompt.slice(0, 120)}${prompt.length > 120 ? "..." : ""}"

To get real AI generation:
1. Copy .env.example to .env.local
2. Add ANTHROPIC_API_KEY=sk-ant-...
3. Restart the dev server

Get a key at https://console.anthropic.com/`;
}
