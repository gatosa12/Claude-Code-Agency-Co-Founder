import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/ai";
import { SCRIPT_SYSTEM, scriptUser } from "@/lib/prompts";

export async function POST(req: NextRequest) {
  try {
    const {
      topic,
      duration = 8,
      tone = "conversational, energetic",
      audience = "general YouTube viewers",
    } = await req.json();
    if (!topic?.trim()) {
      return NextResponse.json(
        { ok: false, error: "topic is required" },
        { status: 400 }
      );
    }
    const text = await generateText({
      system: SCRIPT_SYSTEM,
      user: scriptUser(topic, duration, tone, audience),
      maxTokens: Math.min(8000, Math.max(1500, duration * 350)),
      temperature: 0.75,
    });
    return NextResponse.json({ ok: true, data: { script: text } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
