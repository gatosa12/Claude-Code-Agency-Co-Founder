"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Sparkles, Save, Wand2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { SavedProjects } from "@/components/saved-projects";
import { saveProject } from "@/lib/storage";

type Concept = {
  name: string;
  description: string;
  subject: string;
  background: string;
  textOverlay: string;
  colorPalette: string[];
  imagePrompt: string;
  imageUrl?: string;
  imageError?: string;
};

export default function ThumbnailPage() {
  const [title, setTitle] = useState("");
  const [niche, setNiche] = useState("");
  const [renderImages, setRenderImages] = useState(true);
  const [imagesAvailable, setImagesAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<Concept[] | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => setImagesAvailable(Boolean(c.imageGenAvailable)))
      .catch(() => {});
  }, []);

  async function handleGenerate() {
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    setConcepts(null);
    try {
      const res = await fetch("/api/thumbnail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          niche,
          renderImages: renderImages && imagesAvailable,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Generation failed");
      setConcepts(json.data.concepts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
    if (!concepts) return;
    saveProject({
      kind: "thumbnail",
      title: title.slice(0, 80),
      data: { title, niche, concepts },
    });
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-10">
      <header className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-950/60 text-brand-400">
          <ImageIcon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
            Thumbnail Concepts
          </h1>
          <p className="mt-1 text-sm text-muted md:text-base">
            3 concepts with composition notes, color palettes, image-gen prompts —
            and real previews when OpenAI is configured.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Video title
                </label>
                <Input
                  placeholder="e.g. I Tried the $5 vs $500 Camera"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Niche (optional)
                </label>
                <Input
                  placeholder="e.g. tech reviews"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                />
              </div>

              <label
                className={`flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
                  imagesAvailable
                    ? "cursor-pointer border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                    : "cursor-not-allowed border-zinc-900 bg-zinc-950/50 opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={renderImages && imagesAvailable}
                  onChange={(e) => setRenderImages(e.target.checked)}
                  disabled={!imagesAvailable}
                  className="mt-0.5 h-4 w-4 accent-brand-600"
                />
                <div>
                  <div className="flex items-center gap-2 font-medium text-zinc-100">
                    <Wand2 className="h-3.5 w-3.5 text-brand-400" />
                    Render real images
                    {!imagesAvailable && (
                      <span className="rounded bg-amber-900/30 px-2 py-0.5 text-xs text-amber-300">
                        OPENAI_API_KEY missing
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    Generates a preview image per concept via OpenAI. ~10–20s per
                    image, costs ~$0.50 per generation.
                  </p>
                </div>
              </label>

              <Button onClick={handleGenerate} disabled={loading || !title.trim()}>
                <Sparkles className="h-4 w-4" />
                {loading
                  ? renderImages && imagesAvailable
                    ? "Designing + rendering..."
                    : "Designing..."
                  : "Generate 3 concepts"}
              </Button>
            </div>
          </Card>

          {error && (
            <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {concepts && (
            <>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleSave}>
                  <Save className="h-3.5 w-3.5" /> Save concepts
                </Button>
              </div>

              {concepts.map((c, i) => (
                <Card key={i}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-brand-400">
                        Concept {i + 1}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-zinc-100">
                        {c.name}
                      </h3>
                    </div>
                    <div className="flex gap-1">
                      {c.colorPalette.map((color) => (
                        <span
                          key={color}
                          className="h-7 w-7 rounded border border-zinc-700"
                          style={{ background: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  {c.imageUrl ? (
                    <div className="group relative mb-4 overflow-hidden rounded-lg border border-zinc-800">
                      <img
                        src={c.imageUrl}
                        alt={c.name}
                        className="aspect-video w-full object-cover"
                      />
                      <a
                        href={c.imageUrl}
                        download={`thumbnail-${i + 1}.png`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2.5 py-1.5 text-xs text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                      >
                        <Download className="h-3 w-3" /> Download
                      </a>
                    </div>
                  ) : (
                    <div
                      className="mb-4 flex aspect-video items-center justify-center rounded-lg border border-zinc-800 p-6 text-center"
                      style={{
                        background: `linear-gradient(135deg, ${c.colorPalette[0]} 0%, ${c.colorPalette[1] || c.colorPalette[0]} 100%)`,
                      }}
                    >
                      <span className="text-2xl font-black uppercase tracking-tight text-white drop-shadow-lg md:text-5xl">
                        {c.textOverlay}
                      </span>
                    </div>
                  )}

                  {c.imageError && (
                    <p className="mb-3 rounded border border-amber-900/50 bg-amber-950/20 p-2 text-xs text-amber-300">
                      Image render skipped: {c.imageError}
                    </p>
                  )}

                  <p className="mb-3 text-sm text-zinc-300">{c.description}</p>
                  <dl className="mb-4 grid gap-2 text-sm md:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted">Subject</dt>
                      <dd className="text-zinc-200">{c.subject}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Background</dt>
                      <dd className="text-zinc-200">{c.background}</dd>
                    </div>
                  </dl>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider text-muted">
                        Image-gen prompt
                      </span>
                      <CopyButton text={c.imagePrompt} label="Copy prompt" />
                    </div>
                    <pre className="scrollbar-thin max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-3 text-xs text-zinc-300">
                      {c.imagePrompt}
                    </pre>
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>

        <aside>
          <Card>
            <h3 className="mb-4 font-semibold text-zinc-100">Saved concepts</h3>
            <SavedProjects
              kind="thumbnail"
              onSelect={(p) => {
                const d = p.data as {
                  title: string;
                  niche: string;
                  concepts: Concept[];
                };
                setTitle(d.title);
                setNiche(d.niche);
                setConcepts(d.concepts);
              }}
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}
