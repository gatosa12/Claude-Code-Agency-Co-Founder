import {
  Lightbulb,
  FileText,
  Tags,
  Image as ImageIcon,
  Search,
  Zap,
} from "lucide-react";

const FEATURES = [
  {
    icon: Lightbulb,
    title: "Idea Finder",
    desc: "Generate 10+ outlier video ideas matched to your niche, with hooks and difficulty estimates.",
  },
  {
    icon: FileText,
    title: "Script Writer",
    desc: "Retention-optimized long-form scripts with timestamps, B-roll cues, and natural CTAs.",
  },
  {
    icon: Tags,
    title: "SEO Pack",
    desc: "5 title variants, optimized description, 25 tags, hashtags, chapters — instantly.",
  },
  {
    icon: ImageIcon,
    title: "Thumbnail Concepts",
    desc: "3 distinct concepts per video with composition notes and image-gen prompts ready to use.",
  },
  {
    icon: Search,
    title: "Channel Analyzer",
    desc: "Reverse-engineer any channel's title formulas, hooks, and retention tactics.",
  },
  {
    icon: Zap,
    title: "Save & iterate",
    desc: "Every generation saves to your dashboard. Build a library, refine, regenerate.",
  },
];

export function LandingFeatures() {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f) => (
        <div
          key={f.title}
          className="group rounded-xl border border-zinc-800 bg-card p-6 transition-colors hover:border-zinc-700"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-950/60 text-brand-400 transition-colors group-hover:bg-brand-900/60">
            <f.icon className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-zinc-100">{f.title}</h3>
          <p className="mt-2 text-sm text-muted">{f.desc}</p>
        </div>
      ))}
    </div>
  );
}
