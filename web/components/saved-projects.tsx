"use client";

import { useEffect, useState } from "react";
import { Trash2, Clock } from "lucide-react";
import { listProjects, deleteProject, type Project, type ProjectKind } from "@/lib/storage";
import { Button } from "@/components/ui/button";

const KIND_LABEL: Record<ProjectKind, string> = {
  idea: "Ideas",
  script: "Script",
  seo: "SEO Pack",
  thumbnail: "Thumbnails",
  channel: "Channel",
};

export function SavedProjects({
  kind,
  onSelect,
}: {
  kind?: ProjectKind;
  onSelect?: (p: Project) => void;
}) {
  const [items, setItems] = useState<Project[]>([]);

  function refresh() {
    setItems(listProjects(kind));
  }

  useEffect(() => {
    refresh();
  }, [kind]);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nothing saved yet. Your generations will appear here.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((p) => (
        <li
          key={p.id}
          className="group flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm transition-colors hover:border-zinc-700"
        >
          <button
            type="button"
            onClick={() => onSelect?.(p)}
            className="flex-1 text-left"
          >
            <p className="font-medium text-zinc-100">{p.title}</p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              <span className="rounded bg-zinc-800 px-1.5 py-0.5">
                {KIND_LABEL[p.kind]}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(p.createdAt).toLocaleString()}
              </span>
            </p>
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              deleteProject(p.id);
              refresh();
            }}
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
