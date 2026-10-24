// Projects live on disk: data/projects/<id>/project.json plus the source, fetched media,
// generated assets and renders in the same folder. IDs are random UUIDs and every path
// handed back from here is resolved inside the project folder.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

const PROJECTS = path.join(config.dataDir, 'projects');
const ID_RE = /^[0-9a-f-]{36}$/;

export function isProjectId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

export function projectDir(id) {
  if (!isProjectId(id)) throw Object.assign(new Error('Bad project id'), { status: 400 });
  return path.join(PROJECTS, id);
}

/** Resolves a relative path inside a project, refusing anything that escapes it. */
export function projectPath(id, ...parts) {
  const base = projectDir(id);
  const p = path.resolve(base, ...parts);
  if (p !== base && !p.startsWith(base + path.sep)) {
    throw Object.assign(new Error('Path escapes project'), { status: 400 });
  }
  return p;
}

export const DEFAULT_SETTINGS = {
  format: 'source', // source | 9:16 | 4:5 | 1:1 | 16:9
  grade: 'auto', // auto | natural | teal-orange | noir | amber | bleach | neon
  gradeStrength: 0.8,
  intensity: 'balanced', // subtle | balanced | hype
  modules: { sfx: true, transitions: true, broll: true, zooms: true, titles: true, captions: true },
  captionStyle: 'pop', // pop | karaoke | minimal
  providers: ['pexels', 'pixabay', 'wikimedia'],
};

export async function createProject(name) {
  const id = randomUUID();
  await mkdir(projectPath(id, 'media'), { recursive: true });
  await mkdir(projectPath(id, 'renders'), { recursive: true });
  const project = {
    id,
    name: String(name || 'Untitled').slice(0, 120),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'new',
    source: null,
    analysis: null,
    transcript: null,
    edl: null,
    settings: structuredClone(DEFAULT_SETTINGS),
    media: {},
    renders: [],
  };
  await saveProject(project);
  return project;
}

export async function loadProject(id) {
  const raw = await readFile(projectPath(id, 'project.json'), 'utf8').catch(() => null);
  if (!raw) throw Object.assign(new Error('Project not found'), { status: 404 });
  return JSON.parse(raw);
}

export async function saveProject(project) {
  project.updatedAt = new Date().toISOString();
  const file = projectPath(project.id, 'project.json');
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(project, null, 2));
  await rename(tmp, file);
  return project;
}

/** Load → mutate → save, serialised per project so concurrent jobs don't clobber each other. */
const locks = new Map();
export function updateProject(id, fn) {
  const prev = locks.get(id) || Promise.resolve();
  const next = prev.then(async () => {
    const p = await loadProject(id);
    const r = await fn(p);
    await saveProject(p);
    return r === undefined ? p : r;
  });
  locks.set(id, next.catch(() => {}));
  return next;
}

export async function listProjects() {
  await mkdir(PROJECTS, { recursive: true });
  const ids = (await readdir(PROJECTS)).filter(isProjectId);
  const out = [];
  for (const id of ids) {
    try {
      const p = await loadProject(id);
      out.push({ id, name: p.name, status: p.status, updatedAt: p.updatedAt, duration: p.source?.probe?.duration || 0 });
    } catch { /* skip broken */ }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteProject(id) {
  await rm(projectDir(id), { recursive: true, force: true });
}
