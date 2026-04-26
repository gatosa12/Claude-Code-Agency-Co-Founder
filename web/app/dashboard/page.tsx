import Link from "next/link";
import {
  Lightbulb,
  FileText,
  Tags,
  Image as ImageIcon,
  Search,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { aiAvailable } from "@/lib/ai";

const TOOLS = [
  {
    href: "/dashboard/ideas",
    title: "Idea Finder",
    desc: "Drop a niche, get 10 outlier ideas.",
    icon: Lightbulb,
  },
  {
    href: "/dashboard/script",
    title: "Script Writer",
    desc: "Long-form, retention-optimized.",
    icon: FileText,
  },
  {
    href: "/dashboard/seo",
    title: "SEO Pack",
    desc: "Titles, description, tags, chapters.",
    icon: Tags,
  },
  {
    href: "/dashboard/thumbnail",
    title: "Thumbnails",
    desc: "3 concepts + image-gen prompts.",
    icon: ImageIcon,
  },
  {
    href: "/dashboard/channel",
    title: "Channel Analyzer",
    desc: "Reverse-engineer any channel.",
    icon: Search,
  },
];

export default function DashboardHome() {
  const ai = aiAvailable();

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Welcome back
        </h1>
        <p className="mt-2 text-muted">
          Pick a tool to start. Every generation saves to your dashboard.
        </p>
      </div>

      {!ai && (
        <div className="mb-8 rounded-xl border border-amber-800/50 bg-amber-950/20 p-4 text-sm text-amber-200">
          <p className="font-semibold">Demo mode</p>
          <p className="mt-1 text-amber-200/80">
            No <code className="rounded bg-black/30 px-1">ANTHROPIC_API_KEY</code>{" "}
            detected — tools will return placeholder text. Add your key to{" "}
            <code className="rounded bg-black/30 px-1">.env.local</code> and
            restart the dev server.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="group">
            <Card className="h-full transition-colors hover:border-zinc-700">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-950/60 text-brand-400">
                  <t.icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-brand-400" />
              </div>
              <h3 className="mt-4 font-semibold text-zinc-100">{t.title}</h3>
              <p className="mt-1 text-sm text-muted">{t.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
