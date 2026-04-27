"use client";

import { useState } from "react";
import { FileText, Sparkles, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { SavedProjects } from "@/components/saved-projects";
import { saveProject } from "@/lib/storage";

export default function ScriptPage() {
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(8);
  const [tone, setTone] = useState("conversational, energetic");
  const [audience, setAudience] = useState("general YouTube viewers");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState<string | null>(null);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setScript(null);
    try {
      const res = await fetch("/api/script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, duration, tone, audience }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Generation failed");
      setScript(json.data.script);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
    if (!script) return;
    saveProject({
      kind: "script",
      title: topic.slice(0, 80),
      data: { topic, duration, tone, audience, script },
    });
  }

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-10">
      <header className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-950/60 text-brand-400">
          <FileText className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            Script Writer
          </h1>
          <p className="mt-1 text-muted">
            Retention-optimized long-form scripts with hooks, B-roll cues, and a natural CTA.
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
                <Textarea
                  placeholder="e.g. Why most beginner woodworkers waste $500 on the wrong tools — and the 3 you actually need"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                    Duration (min)
                  </label>
                  <Input
                    type="number"
                    min={3}
                    max={30}
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 8)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                    Tone
                  </label>
                  <Input
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="conversational, energetic"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                    Audience
                  </label>
                  <Input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="beginner woodworkers"
                  />
                </div>
              </div>
              <Button onClick={handleGenerate} disabled={loading || !topic.trim()}>
                <Sparkles className="h-4 w-4" />
                {loading ? "Writing..." : "Write script"}
              </Button>
            </div>
          </Card>

          {error && (
            <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {script && (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-zinc-100">Your script</h2>
                <div className="flex gap-2">
                  <CopyButton text={script} />
                  <Button variant="outline" size="sm" onClick={handleSave}>
                    <Save className="h-3.5 w-3.5" /> Save
                  </Button>
                </div>
              </div>
              <pre className="scrollbar-thin max-h-[600px] overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-4 text-sm text-zinc-200">
                {script}
              </pre>
            </Card>
          )}
        </div>

        <aside>
          <Card>
            <h3 className="mb-4 font-semibold text-zinc-100">Saved scripts</h3>
            <SavedProjects
              kind="script"
              onSelect={(p) => {
                const d = p.data as {
                  topic: string;
                  duration: number;
                  tone: string;
                  audience: string;
                  script: string;
                };
                setTopic(d.topic);
                setDuration(d.duration);
                setTone(d.tone);
                setAudience(d.audience);
                setScript(d.script);
              }}
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}
