import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";
import { IDEA_SYSTEM, ideaUser } from "@/lib/prompts";

type Idea = {
  title: string;
  hook: string;
  angle: string;
  searchVolume: "low" | "medium" | "high";
  difficulty: "easy" | "medium" | "hard";
  format: string;
};

const MOCK = {
  ideas: [
    {
      title: "I tried [X niche trick] for 30 days — here's what happened",
      hook: "Everyone says [common belief]. I spent 30 days proving them wrong.",
      angle: "Time-bound experiment with clear before/after — searchable + retentive.",
      searchVolume: "medium" as const,
      difficulty: "medium" as const,
      format: "story",
    },
    {
      title: "The 3-minute [niche] system that beats every paid tool",
      hook: "I cancelled my $200/month [tool] subscription. Here's what I use instead.",
      angle: "Money-saving angle + specific time + comparison hook.",
      searchVolume: "high" as const,
      difficulty: "easy" as const,
      format: "tutorial",
    },
    {
      title: "Why [authority] is wrong about [topic] (and what actually works)",
      hook: "If [authority] told you [common advice], you've been lied to.",
      angle: "Contrarian takedown with proof — high CTR, polarizing.",
      searchVolume: "medium" as const,
      difficulty: "hard" as const,
      format: "explainer",
    },
  ] as Idea[],
};

export async function POST(req: NextRequest) {
  try {
    const { niche, count = 10 } = await req.json();
    if (!niche?.trim()) {
      return NextResponse.json(
        { ok: false, error: "niche is required" },
        { status: 400 }
      );
    }
    const data = await generateJSON<{ ideas: Idea[] }>({
      system: IDEA_SYSTEM,
      user: ideaUser(niche, count),
      maxTokens: 3000,
      mock: MOCK,
    });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
