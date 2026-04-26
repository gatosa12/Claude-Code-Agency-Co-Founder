import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";
import { SEO_SYSTEM, seoUser } from "@/lib/prompts";

type SeoPack = {
  titles: string[];
  description: string;
  tags: string[];
  hashtags: string[];
  thumbnailText: string[];
  chapters: { time: string; title: string }[];
};

const MOCK: SeoPack = {
  titles: [
    "I Tried [X] for 30 Days — The Results Shocked Me",
    "Why Everyone is Wrong About [X] (Proof Inside)",
    "The 3-Minute [X] System That Changed Everything",
    "[X] Mistakes That Are Costing You Thousands",
    "How I [Achieved Y] Without [Common Friction]",
  ],
  description:
    "In this video I break down [topic] step by step — the same system I used to [outcome]. You'll learn the exact [framework] I follow, the tools I rely on, and the mistakes that cost me months when I started. If you want to [audience goal], save this video and follow along.\n\nResources mentioned:\n- [Link 1]\n- [Link 2]\n\n00:00 Intro\n00:45 The problem with [common approach]\n02:10 My 3-step system\n05:30 Live demo\n08:15 Mistakes to avoid\n10:00 Action steps\n\n#youtubegrowth #contentcreator #tutorial",
  tags: [
    "youtube growth",
    "content creator",
    "youtube tutorial",
    "how to",
    "step by step",
    "beginners guide",
    "2026 strategy",
    "tips and tricks",
    "[niche keyword 1]",
    "[niche keyword 2]",
  ],
  hashtags: ["#youtubegrowth", "#contentcreator", "#tutorial"],
  thumbnailText: ["I TRIED IT", "30 DAYS", "PROOF"],
  chapters: [
    { time: "0:00", title: "Hook" },
    { time: "0:45", title: "The problem" },
    { time: "2:10", title: "My 3-step system" },
    { time: "5:30", title: "Live demo" },
    { time: "8:15", title: "Mistakes to avoid" },
    { time: "10:00", title: "Action steps" },
  ],
};

export async function POST(req: NextRequest) {
  try {
    const { topic, niche = "" } = await req.json();
    if (!topic?.trim()) {
      return NextResponse.json(
        { ok: false, error: "topic is required" },
        { status: 400 }
      );
    }
    const data = await generateJSON<SeoPack>({
      system: SEO_SYSTEM,
      user: seoUser(topic, niche),
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
