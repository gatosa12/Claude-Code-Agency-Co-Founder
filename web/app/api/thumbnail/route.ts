import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";
import { generateImage, imageGenAvailable } from "@/lib/images";
import { THUMB_SYSTEM, thumbUser } from "@/lib/prompts";

export const maxDuration = 60;

type Concept = {
  name: string;
  description: string;
  subject: string;
  background: string;
  textOverlay: string;
  colorPalette: string[];
  imagePrompt: string;
  imageUrl?: string;
  imageError?: string;
};

const MOCK = {
  concepts: [
    {
      name: "Shock + reveal",
      description:
        "Close-up of a person with wide-eyed surprised expression, holding up a contrast object that pays off the title's curiosity gap.",
      subject: "Person, mouth open, hands gesturing toward camera-left subject",
      background: "Saturated red-to-orange gradient with soft vignette",
      textOverlay: "I WAS WRONG",
      colorPalette: ["#ef4444", "#f97316", "#fef3c7"],
      imagePrompt:
        "Cinematic close-up portrait, 35mm lens, person with shocked expression, dramatic key light from left, vibrant red-orange gradient backdrop, ultra-sharp focus on eyes, photorealistic, 16:9, bold contrast",
    },
    {
      name: "Before / after split",
      description:
        "Vertical split composition. Left half: dim, neutral 'before'. Right half: bright, saturated 'after'. A bold arrow points from left to right.",
      subject: "Same subject mirrored on both sides, expressions flipped",
      background: "Hard split — left desaturated grey, right neon green",
      textOverlay: "30 DAYS",
      colorPalette: ["#6b7280", "#10b981", "#fbbf24"],
      imagePrompt:
        "Split-screen thumbnail, left side desaturated dim portrait, right side vibrant neon green saturated portrait, large arrow between, bold sans-serif text overlay, hyperreal, 16:9",
    },
    {
      name: "Numbered authority",
      description:
        "Person pointing confidently at large number '3' floating beside them. Clean studio look — establishes authority + curiosity (3 of what?).",
      subject: "Person, confident smirk, arm extended pointing at floating '3'",
      background: "Deep navy with subtle noise texture",
      textOverlay: "3 RULES",
      colorPalette: ["#0f172a", "#facc15", "#ffffff"],
      imagePrompt:
        "Studio thumbnail, confident creator pointing at oversized glowing yellow '3', deep navy background, soft rim light, magazine-style composition, 16:9, sharp typography",
    },
  ] as Concept[],
};

export async function POST(req: NextRequest) {
  try {
    const { title, niche = "", renderImages = false } = await req.json();
    if (!title?.trim()) {
      return NextResponse.json(
        { ok: false, error: "title is required" },
        { status: 400 }
      );
    }
    const data = await generateJSON<{ concepts: Concept[] }>({
      system: THUMB_SYSTEM,
      user: thumbUser(title, niche),
      maxTokens: 2500,
      mock: MOCK,
    });

    const wantImages = renderImages && imageGenAvailable();
    if (wantImages) {
      const enriched = await Promise.all(
        data.concepts.map(async (c) => {
          try {
            const img = await generateImage({
              prompt: `${c.imagePrompt}. Bold uppercase text overlay: "${c.textOverlay}". YouTube thumbnail, 16:9 aspect ratio.`,
              size: "1792x1024",
            });
            return { ...c, imageUrl: img?.url, imageError: undefined };
          } catch (err) {
            return {
              ...c,
              imageError: err instanceof Error ? err.message : "Image gen failed",
            };
          }
        })
      );
      return NextResponse.json({
        ok: true,
        data: { concepts: enriched },
        meta: { imagesRendered: true },
      });
    }

    return NextResponse.json({
      ok: true,
      data,
      meta: {
        imagesRendered: false,
        imagesAvailable: imageGenAvailable(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
