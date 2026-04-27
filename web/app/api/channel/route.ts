import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";
import { CHANNEL_SYSTEM, channelUser } from "@/lib/prompts";

type Analysis = {
  summary: string;
  contentPillars: string[];
  titleFormula: string;
  thumbnailPattern: string;
  hookStyle: string;
  retentionTactics: string[];
  actionableLessons: string[];
  videoIdeas: string[];
};

const MOCK: Analysis = {
  summary:
    "Demo analysis. With your API key, this returns a real reverse-engineering of the channel's positioning and tactics.",
  contentPillars: [
    "Pillar 1 — broad evergreen content",
    "Pillar 2 — trending reaction takes",
    "Pillar 3 — deep-dive case studies",
  ],
  titleFormula:
    "[Number] + [Specific outcome] + [Time frame or contrast hook]",
  thumbnailPattern:
    "Tight face crop, 2-3 word block text in saturated yellow/red, high-contrast background",
  hookStyle:
    "Open with a polarizing statement, immediate visual proof, then 5-second tease of payoff",
  retentionTactics: [
    "Open loops every 60s (\"...we'll get to that in a minute\")",
    "Pattern interrupts via cuts every 4-7s",
    "Mid-roll teaser referencing the climax",
  ],
  actionableLessons: [
    "Adopt their 3-pillar content matrix",
    "Steal their title formula and run A/B variants",
    "Use their hook structure verbatim for your next 3 videos",
    "Match their thumbnail color palette",
    "Replicate their pacing — cut anything > 7s without a beat",
  ],
  videoIdeas: [
    "[Counter-take] on their most-viewed topic",
    "Behind-the-scenes of replicating their workflow",
    "Side-by-side comparison: their approach vs yours",
    "30-day challenge applying their system",
    "What they got wrong (and what you'd change)",
  ],
};

export async function POST(req: NextRequest) {
  try {
    const { channelInfo } = await req.json();
    if (!channelInfo?.trim()) {
      return NextResponse.json(
        { ok: false, error: "channelInfo is required" },
        { status: 400 }
      );
    }
    const data = await generateJSON<Analysis>({
      system: CHANNEL_SYSTEM,
      user: channelUser(channelInfo),
      maxTokens: 2500,
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
