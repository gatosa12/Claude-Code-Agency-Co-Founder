// Editor V1 HTTP server: REST API + static UI. API keys stay in this process.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { config, publicCapabilities } from './config.js';
import { presetList } from './engine/grading.js';
import { sanitiseEdl } from './engine/edl.js';
import { FORMATS } from './engine/render.js';
import { ensureSfxKit, SFX_KINDS, sfxFile } from './engine/sfx.js';
import { activeJob, getJob, startJob, streamJob } from './jobs.js';
import { probe } from './lib/proc.js';
import { downloadResult, searchMedia } from './media/providers.js';
import { assetRecord, autoEdit, orientationFor, readAnalysis, render } from './pipeline.js';
import {
  DEFAULT_SETTINGS, createProject, deleteProject, listProjects, loadProject, projectPath, updateProject,
} from './store.js';

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;
const MEDIA_EXT = /\.(mp4|mov|webm|jpe?g|png|webp)$/i;

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '));
    next();
  });
  app.use(express.json({ limit: '8mb' }));

  const upload = multer({
    storage: multer.diskStorage({
      destination: async (req, file, cb) => {
        const dir = path.join(config.dataDir, 'incoming');
        await mkdir(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase().slice(0, 6)}`),
    }),
    limits: { fileSize: config.maxUploadBytes, files: 1 },
  });

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  app.get('/api/capabilities', (req, res) => res.json({
    ...publicCapabilities(),
    formats: ['source', ...Object.keys(FORMATS)],
    presets: presetList(),
    sfx: Object.entries(SFX_KINDS).map(([id, s]) => ({ id, label: s.label })),
    defaults: DEFAULT_SETTINGS,
  }));

  app.get('/api/sfx/:kind', wrap(async (req, res) => {
    const kind = req.params.kind.replace(/\.wav$/, '');
    if (!SFX_KINDS[kind]) return res.status(404).end();
    await ensureSfxKit();
    res.sendFile(sfxFile(kind));
  }));

  app.get('/api/projects', wrap(async (req, res) => res.json(await listProjects())));

  app.post('/api/projects', upload.single('video'), wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Attach a video file as "video"' });
    if (!VIDEO_EXT.test(req.file.originalname)) {
      await rm(req.file.path, { force: true });
      return res.status(400).json({ error: 'Unsupported video type' });
    }
    let info;
    try {
      info = await probe(req.file.path);
    } catch (err) {
      await rm(req.file.path, { force: true });
      return res.status(400).json({ error: `Could not read that video: ${err.message.split('\n')[0]}` });
    }
    const name = (req.body.name || req.file.originalname.replace(/\.[^.]+$/, '')).slice(0, 120);
    const project = await createProject(name);
    const file = `source${path.extname(req.file.path)}`;
    await rename(req.file.path, projectPath(project.id, file));
    const saved = await updateProject(project.id, (p) => {
      p.source = { file, originalName: req.file.originalname.slice(0, 200), probe: info };
      p.status = 'uploaded';
    });
    res.status(201).json(saved);
  }));

  app.get('/api/projects/:id', wrap(async (req, res) => {
    const p = await loadProject(req.params.id);
    const job = activeJob(p.id);
    res.json({ ...p, job: job && job.state === 'running' ? { id: job.id, kind: job.kind } : null });
  }));

  app.delete('/api/projects/:id', wrap(async (req, res) => {
    await loadProject(req.params.id);
    await deleteProject(req.params.id);
    res.status(204).end();
  }));

  app.patch('/api/projects/:id/settings', wrap(async (req, res) => {
    const b = req.body || {};
    const p = await updateProject(req.params.id, (p) => {
      const s = p.settings;
      if (typeof b.name === 'string') p.name = b.name.slice(0, 120);
      if (['source', ...Object.keys(FORMATS)].includes(b.format)) s.format = b.format;
      if (b.grade === 'auto' || presetList().some((x) => x.id === b.grade)) s.grade = b.grade;
      if (Number.isFinite(Number(b.gradeStrength))) s.gradeStrength = Math.max(0, Math.min(1, Number(b.gradeStrength)));
      if (['subtle', 'balanced', 'hype'].includes(b.intensity)) s.intensity = b.intensity;
      if (['pop', 'karaoke', 'minimal'].includes(b.captionStyle)) s.captionStyle = b.captionStyle;
      if (b.modules && typeof b.modules === 'object') {
        for (const k of Object.keys(DEFAULT_SETTINGS.modules)) if (typeof b.modules[k] === 'boolean') s.modules[k] = b.modules[k];
      }
      if (Array.isArray(b.providers)) s.providers = b.providers.filter((x) => DEFAULT_SETTINGS.providers.includes(x));
    });
    res.json(p);
  }));

  app.get('/api/projects/:id/analysis', wrap(async (req, res) => {
    const a = await readAnalysis(req.params.id);
    if (!a) return res.status(404).json({ error: 'Not analysed yet' });
    const { env, ...audio } = a.audio || {};
    res.json({ ...a, audio: a.audio ? audio : null });
  }));

  app.put('/api/projects/:id/edl', wrap(async (req, res) => {
    const p = await updateProject(req.params.id, (p) => {
      if (!p.source) throw Object.assign(new Error('No source video'), { status: 400 });
      p.edl = sanitiseEdl(req.body, p.source.probe.duration, p.media);
    });
    res.json(p.edl);
  }));

  app.post('/api/projects/:id/auto-edit', wrap(async (req, res) => {
    await loadProject(req.params.id);
    const job = startJob(req.params.id, 'auto-edit', (report) => autoEdit(req.params.id, { force: Boolean(req.body?.force) }, report));
    res.status(202).json(job);
  }));

  app.post('/api/projects/:id/render', wrap(async (req, res) => {
    await loadProject(req.params.id);
    const quality = req.body?.quality === 'preview' ? 'preview' : 'final';
    const job = startJob(req.params.id, 'render', (report) => render(req.params.id, { quality }, report));
    res.status(202).json(job);
  }));

  app.post('/api/projects/:id/media/search', wrap(async (req, res) => {
    const p = await loadProject(req.params.id);
    const kind = req.body?.kind === 'video' ? 'video' : 'image';
    const out = await searchMedia(req.body?.query, { kind, orientation: orientationFor(p), perPage: 10, order: p.settings.providers });
    res.json({
      results: out.results.map(({ id, kind: k, thumb, width, height, duration, credit, license, provider, sourcePage }) => ({ id, kind: k, thumb, width, height, duration, credit, license, provider, sourcePage })),
      errors: out.errors,
    });
  }));

  app.post('/api/projects/:id/media/fetch', wrap(async (req, res) => {
    const id = req.params.id;
    await loadProject(id);
    const assetId = randomUUID();
    const { file, result } = await downloadResult(String(req.body?.resultId || ''), projectPath(id, 'media', assetId));
    const p = await updateProject(id, (p) => {
      p.media[assetId] = assetRecord(id, file, result, req.body?.query);
      const ev = p.edl?.events.find((e) => e.id === req.body?.eventId && e.type === 'broll');
      if (ev) { ev.assetId = assetId; delete ev.fetchError; }
    });
    res.json({ assetId, asset: p.media[assetId], edl: p.edl });
  }));

  app.post('/api/projects/:id/media/upload', upload.single('file'), wrap(async (req, res) => {
    const id = req.params.id;
    if (!req.file) return res.status(400).json({ error: 'Attach a file as "file"' });
    if (!MEDIA_EXT.test(req.file.originalname)) {
      await rm(req.file.path, { force: true });
      return res.status(400).json({ error: 'Images (jpg/png/webp) or videos (mp4/mov/webm) only' });
    }
    try {
      await loadProject(id);
    } catch (err) {
      await rm(req.file.path, { force: true });
      throw err;
    }
    const assetId = randomUUID();
    const isVideo = /\.(mp4|mov|webm)$/i.test(req.file.originalname);
    const dest = projectPath(id, 'media', assetId + path.extname(req.file.path));
    await rename(req.file.path, dest);
    const p = await updateProject(id, (p) => {
      p.media[assetId] = assetRecord(id, dest, { kind: isVideo ? 'video' : 'image', provider: 'upload', credit: 'Your upload' }, req.file.originalname.slice(0, 100));
      const ev = p.edl?.events.find((e) => e.id === req.body?.eventId && e.type === 'broll');
      if (ev) { ev.assetId = assetId; delete ev.fetchError; }
    });
    res.json({ assetId, asset: p.media[assetId], edl: p.edl });
  }));

  // Project files: only these sub-folders are served, never project.json or work files.
  app.get(/^\/api\/projects\/([0-9a-f-]{36})\/files\/(source\.[a-z0-9]+|thumbs\/[\w.-]+|media\/[\w.-]+|renders\/[\w.-]+)$/, wrap(async (req, res) => {
    const file = projectPath(req.params[0], req.params[1]);
    if (!existsSync(file)) return res.status(404).end();
    if (req.query.download) res.attachment(path.basename(file));
    res.sendFile(file);
  }));

  app.get('/api/jobs/:id', (req, res) => {
    const job = getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const { emitter, ...rest } = job;
    res.json(rest);
  });
  app.get('/api/jobs/:id/events', (req, res) => {
    const job = getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    streamJob(job, res);
  });

  app.use(express.static(path.join(config.root, 'public'), { index: 'index.html', maxAge: '1h' }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Internal error: see server log' : err.message });
  });
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await mkdir(config.dataDir, { recursive: true });
  ensureSfxKit().catch((err) => console.warn('SFX kit:', err.message));
  createApp().listen(config.port, config.host, () => {
    const caps = publicCapabilities().providers;
    console.log(`Editor V1 → http://${config.host}:${config.port}`);
    console.log(`Stock providers: ${Object.entries(caps).map(([k, v]) => `${k} ${v ? '✓' : '✗ (no key)'}`).join(', ')}`);
  });
}
