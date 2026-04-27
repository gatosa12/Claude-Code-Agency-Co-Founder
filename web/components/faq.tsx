"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQ = [
  {
    q: "Do I need to know prompt engineering to use this?",
    a: "No. Each tool has a focused form — drop in a niche or a topic, and the prompts are pre-tuned by us. You write what you know, the model handles the rest.",
  },
  {
    q: "What does it actually generate?",
    a: "Idea Finder returns 10+ outlier video ideas with hooks. Script Writer produces a full retention-optimized script with B-roll cues. SEO Pack gives you 5 titles, a description, 25 tags, hashtags, and chapters. Thumbnail Concepts returns 3 distinct concepts with composition + image-gen prompts (and real preview images if you connect OpenAI). Channel Analyzer reverse-engineers any channel's title formula, hook style, and retention tactics.",
  },
  {
    q: "Do I bring my own API key?",
    a: "Yes — and that's a feature. You pay model cost only (~$0.01–0.05 per generation on Claude). No usage caps or markup. Add ANTHROPIC_API_KEY to your environment and you're set.",
  },
  {
    q: "What if I don't have an API key yet?",
    a: "The app boots in demo mode without one. Every tool returns a placeholder fixture so you can click through the flow and see exactly what you'd get. Add a key when you're ready.",
  },
  {
    q: "Will my videos look AI-generated?",
    a: "The script is the AI part. You film, edit, and upload like normal — the tool just removes the blank-page friction. Most creators rewrite ~20% in their voice. The packaging (titles, thumbnails, SEO) is what moves the needle.",
  },
  {
    q: "Can I deploy this myself?",
    a: "Yes. The repo is yours. Push to GitHub, import on Vercel, set your env vars. ~60 seconds. See DEPLOY.md.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {FAQ.map((item, i) => (
        <div
          key={i}
          className="rounded-xl border border-zinc-800 bg-card overflow-hidden"
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-zinc-900/40"
          >
            <span className="font-medium text-zinc-100">{item.q}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted transition-transform",
                open === i && "rotate-180"
              )}
            />
          </button>
          {open === i && (
            <div className="border-t border-zinc-800 p-5 pt-4 text-sm text-zinc-300">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
