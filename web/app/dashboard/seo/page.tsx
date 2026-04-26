"use client";

import { useState } from "react";
import { Tags, Sparkles, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { SavedProjects } from "@/components/saved-projects";
import { saveProject } from "@/lib/storage";

type SeoPack = {
  titles: string[];
  description: string;
  tags: string[];
  hashtags: string[];
  thumbnailText: string[];
  chapters: { time: string; title: string }[];
};

export default function SeoPage() {
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pack, setPack] = useState<SeoPack | null>(null);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setPack(null);
    try {
      const res = await fetch("/api/seo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, niche }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Generation failed");
      setPack(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
    if (!pack) return;
    saveProject({
      kind: "seo",
      title: topic.slice(0, 80),
      data: { topic, niche, pack },
    });
  }

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-10">
      <header className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-950/60 text-brand-400">
          <Tags className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">SEO Pack</h1>
          <p className="mt-1 text-muted">
            5 title variants, optimized description, 25 tags, hashtags, chapters, thumbnail text.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Video topic
                </label>
                <Input
                  placeholder="e.g. How I edit YouTube videos in 30 minutes"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Niche (optional)
                </label>
                <Input
                  placeholder="e.g. content creator productivity"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                />
              </div>
              <Button onClick={handleGenerate} disabled={loading || !topic.trim()}>
                <Sparkles className="h-4 w-4" />
                {loading ? "Generating..." : "Generate SEO pack"}
              </Button>
            </div>
          </Card>

          {error && (
            <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {pack && (
            <>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleSave}>
                  <Save className="h-3.5 w-3.5" /> Save pack
                </Button>
              </div>

              <Card>
                <h2 className="mb-3 font-semibold text-zinc-100">Title variants</h2>
                <ul className="space-y-2">
                  {pack.titles.map((t, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm"
                    >
                      <span className="text-zinc-100">
                        <span className="mr-2 font-mono text-xs text-muted">
                          {i + 1}.
                        </span>
                        {t}
                      </span>
                      <CopyButton text={t} />
                    </li>
                  ))}
                </ul>
              </Card>

              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-zinc-100">Description</h2>
                  <CopyButton text={pack.description} />
                </div>
                <pre className="whitespace-pre-wrap rounded-lg bg-zinc-950 p-4 text-sm text-zinc-200">
                  {pack.description}
                </pre>
              </Card>

              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-zinc-100">Tags</h2>
                  <CopyButton text={pack.tags.join(", ")} label="Copy all" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {pack.tags.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold text-zinc-100">Hashtags</h2>
                    <CopyButton text={pack.hashtags.join(" ")} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pack.hashtags.map((h) => (
                      <Badge key={h} tone="brand">
                        {h}
                      </Badge>
                    ))}
                  </div>
                </Card>

                <Card>
                  <h2 className="mb-3 font-semibold text-zinc-100">
                    Thumbnail text ideas
                  </h2>
                  <ul className="space-y-2">
                    {pack.thumbnailText.map((t, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-center font-bold uppercase tracking-wide text-zinc-100"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-zinc-100">Chapters</h2>
                  <CopyButton
                    text={pack.chapters.map((c) => `${c.time} ${c.title}`).join("\n")}
                    label="Copy chapters"
                  />
                </div>
                <ul className="space-y-1.5 font-mono text-sm">
                  {pack.chapters.map((c, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="text-brand-400">{c.time}</span>
                      <span className="text-zinc-300">{c.title}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>

        <aside>
          <Card>
            <h3 className="mb-4 font-semibold text-zinc-100">Saved packs</h3>
            <SavedProjects
              kind="seo"
              onSelect={(p) => {
                const d = p.data as { topic: string; niche: string; pack: SeoPack };
                setTopic(d.topic);
                setNiche(d.niche);
                setPack(d.pack);
              }}
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}
