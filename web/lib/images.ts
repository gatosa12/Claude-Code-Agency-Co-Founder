export type GenerateImageOpts = {
  prompt: string;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  model?: string;
};

export function imageGenAvailable() {
  return Boolean(process.env.OPENAI_API_KEY);
}

const DEFAULT_MODEL = "gpt-image-1";

export async function generateImage(
  opts: GenerateImageOpts
): Promise<{ url?: string; b64?: string } | null> {
  if (!imageGenAvailable()) return null;

  const model = opts.model || process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL;
  const size = opts.size || "1792x1024";

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      prompt: opts.prompt,
      n: 1,
      size,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image gen failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    data?: { url?: string; b64_json?: string }[];
  };
  const item = json.data?.[0];
  if (!item) return null;
  return { url: item.url, b64: item.b64_json };
}
