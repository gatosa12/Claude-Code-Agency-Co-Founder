"use client";

import { useState } from "react";
import { Lightbulb, Sparkles, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { SavedProjects } from "@/components/saved-projects";
import { saveProject } from "@/lib/storage";

type Idea = {
  title: string;
  hook: string;
  angle: string;
  searchVolume: "low" | "medium" | "high";
  difficulty: "easy" | "medium" | "hard";
  format: string;
};

export default function IdeasPage() {
  const [niche, setNiche] = useState("");
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<Idea[] | null>(null);

  async function handleGenerate() {
    if (!niche.trim()) return;
    setLoading(true);
    setError(null);
    setIdeas(null);
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ niche, count }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Generation failed");
      setIdeas(json.data.ideas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
    if (!ideas) return;
    saveProject({
      kind: "idea",
      title: `Ideas — ${niche}`,
      data: { niche, count, ideas },
    });
  }

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-10">
      <header className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-950/60 text-brand-400">
          <Lightbulb className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            Idea Finder
          </h1>
          <p className="mt-1 text-muted">
            Drop your niche. Get outlier video ideas with hooks, angles, and difficulty.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Niche
                </label>
                <Input
                  placeholder="e.g. AI productivity for solopreneurs, beginner woodworking, NBA history..."
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  How many ideas?
                </label>
                <Input
                  type="number"
                  min={3}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 10)}
                  className="w-32"
                />
              </div>
              <Button onClick={handleGenerate} disabled={loading || !niche.trim()}>
                <Sparkles className="h-4 w-4" />
                {loading ? "Generating..." : "Generate ideas"}
              </Button>
            </div>
          </Card>

          {error && (
            <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {ideas && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-100">
                  {ideas.length} ideas for "{niche}"
                </h2>
                <Button variant="outline" size="sm" onClick={handleSave}>
                  <Save className="h-3.5 w-3.5" /> Save all
                </Button>
              </div>
              {ideas.map((idea, i) => (
                <Card key={i}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-zinc-100">{idea.title}</h3>
                    <CopyButton text={idea.title} />
                  </div>
                  <p className="mb-3 text-sm text-zinc-300">
                    <span className="text-muted">Hook: </span>
                    {idea.hook}
                  </p>
                  <p className="mb-4 text-sm text-zinc-400">
                    <span className="text-muted">Why it works: </span>
                    {idea.angle}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="brand">{idea.format}</Badge>
                    <Badge
                      tone={
                        idea.searchVolume === "high"
                          ? "success"
                          : idea.searchVolume === "medium"
                            ? "warning"
                            : "default"
                      }
                    >
                      search: {idea.searchVolume}
                    </Badge>
                    <Badge
                      tone={
                        idea.difficulty === "easy"
                          ? "success"
                          : idea.difficulty === "medium"
                            ? "warning"
                            : "danger"
                      }
                    >
                      effort: {idea.difficulty}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <aside>
          <Card>
            <h3 className="mb-4 font-semibold text-zinc-100">Saved ideas</h3>
            <SavedProjects
              kind="idea"
              onSelect={(p) => {
                const d = p.data as { niche: string; count: number; ideas: Idea[] };
                setNiche(d.niche);
                setCount(d.count);
                setIdeas(d.ideas);
              }}
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}
