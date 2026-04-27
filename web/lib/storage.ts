"use client";

const KEY = "tubeforge:v1";

export type ProjectKind = "idea" | "script" | "seo" | "thumbnail" | "channel";

export type Project = {
  id: string;
  kind: ProjectKind;
  title: string;
  createdAt: number;
  data: unknown;
};

type Store = { projects: Project[] };

function read(): Store {
  if (typeof window === "undefined") return { projects: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { projects: [] };
    return JSON.parse(raw) as Store;
  } catch {
    return { projects: [] };
  }
}

function write(s: Store) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function listProjects(kind?: ProjectKind): Project[] {
  const s = read();
  const all = [...s.projects].sort((a, b) => b.createdAt - a.createdAt);
  return kind ? all.filter((p) => p.kind === kind) : all;
}

export function saveProject(p: Omit<Project, "id" | "createdAt">): Project {
  const s = read();
  const project: Project = {
    ...p,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  s.projects.unshift(project);
  if (s.projects.length > 200) s.projects.length = 200;
  write(s);
  return project;
}

export function deleteProject(id: string) {
  const s = read();
  s.projects = s.projects.filter((p) => p.id !== id);
  write(s);
}

export function getProject(id: string): Project | undefined {
  return read().projects.find((p) => p.id === id);
}
