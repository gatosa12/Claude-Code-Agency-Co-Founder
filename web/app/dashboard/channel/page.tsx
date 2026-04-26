"use client";

import { useState } from "react";
import { Search, Sparkles, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { SavedProjects } from "@/components/saved-projects";
import { saveProject } from "@/lib/storage";

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

export default function ChannelPage() {
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  async function handleGenerate() {
    if (!info.trim()) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch("/api/channel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channelInfo: info }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Generation failed");
      setAnalysis(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
    if (!analysis) return;
    saveProject({
      kind: "channel",
      title: `Analysis — ${info.slice(0, 60)}`,
      data: { info, analysis },
    });
  }

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-10">
      <header className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-950/60 text-brand-400">
          <Search className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            Channel Analyzer
          </h1>
          <p className="mt-1 text-muted">
            Reverse-engineer any channel's title formulas, hooks, and retention tactics.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Channel info
                </label>
                <Textarea
                  rows={4}
                  placeholder="Paste a channel name, URL, or describe what they do. e.g. 'Veritasium — science education channel, 15M subs, 10-20 min videos on counterintuitive science topics, dark hooky thumbnails with text'"
                  value={info}
                  onChange={(e) => setInfo(e.target.value)}
                />
                <p className="mt-1.5 text-xs text-muted">
                  The more detail you give (recent video titles, thumbnail style, audience), the better the analysis.
                </p>
              </div>
              <Button onClick={handleGenerate} disabled={loading || !info.trim()}>
                <Sparkles className="h-4 w-4" />
                {loading ? "Analyzing..." : "Analyze channel"}
              </Button>
            </div>
          </Card>

          {error && (
            <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {analysis && (
            <>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleSave}>
                  <Save className="h-3.5 w-3.5" /> Save analysis
                </Button>
              </div>

              <Card>
                <h2 className="mb-2 font-semibold text-zinc-100">Summary</h2>
                <p className="text-zinc-300">{analysis.summary}</p>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <h2 className="mb-3 font-semibold text-zinc-100">Content pillars</h2>
                  <ul className="space-y-2">
                    {analysis.contentPillars.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                        <Badge tone="brand">{i + 1}</Badge>
                        {p}
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card>
                  <h2 className="mb-3 font-semibold text-zinc-100">
                    Retention tactics
                  </h2>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    {analysis.retentionTactics.map((t, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-brand-400">→</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-zinc-100">Title formula</h2>
                  <CopyButton text={analysis.titleFormula} />
                </div>
                <pre className="whitespace-pre-wrap rounded-lg bg-zinc-950 p-4 text-sm text-zinc-200">
                  {analysis.titleFormula}
                </pre>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <h2 className="mb-2 font-semibold text-zinc-100">Thumbnail pattern</h2>
                  <p className="text-sm text-zinc-300">{analysis.thumbnailPattern}</p>
                </Card>
                <Card>
                  <h2 className="mb-2 font-semibold text-zinc-100">Hook style</h2>
                  <p className="text-sm text-zinc-300">{analysis.hookStyle}</p>
                </Card>
              </div>

              <Card>
                <h2 className="mb-3 font-semibold text-zinc-100">
                  What you should copy
                </h2>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-300">
                  {analysis.actionableLessons.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ol>
              </Card>

              <Card>
                <h2 className="mb-3 font-semibold text-zinc-100">
                  Video ideas in their style
                </h2>
                <ul className="space-y-2">
                  {analysis.videoIdeas.map((idea, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-100"
                    >
                      <span>{idea}</span>
                      <CopyButton text={idea} />
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>

        <aside>
          <Card>
            <h3 className="mb-4 font-semibold text-zinc-100">Saved analyses</h3>
            <SavedProjects
              kind="channel"
              onSelect={(p) => {
                const d = p.data as { info: string; analysis: Analysis };
                setInfo(d.info);
                setAnalysis(d.analysis);
              }}
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}
