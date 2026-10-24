// Job bodies: the autonomous auto-edit pass and the render pass.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { analyseAudio } from './analysis/audio.js';
import { analyseFrames, downsampleSeries, makeThumbnails } from './analysis/frames.js';
import { transcribe } from './analysis/transcribe.js';
import { planEdit } from './engine/planner.js';
import { FORMATS, renderEdl } from './engine/render.js';
import { downloadResult, searchMedia } from './media/providers.js';
import { loadProject, projectPath, updateProject } from './store.js';

export function orientationFor(project) {
  const [w, h] = FORMATS[project.settings.format] || [project.source.probe.width, project.source.probe.height];
  return w > h * 1.1 ? 'landscape' : h > w * 1.1 ? 'portrait' : 'square';
}

export async function readAnalysis(id) {
  const raw = await readFile(projectPath(id, 'work', 'analysis.json'), 'utf8').catch(() => null);
  return raw ? JSON.parse(raw) : null;
}

/** Analyse (frame-by-frame + audio + speech) → plan → fetch B-roll. */
export async function autoEdit(id, { force = false } = {}, report) {
  let project = await loadProject(id);
  if (!project.source) throw new Error('Upload a video first');
  const src = projectPath(id, project.source.file);
  const work = projectPath(id, 'work');
  await mkdir(work, { recursive: true });
  const probe = project.source.probe;

  let full = force ? null : await readAnalysis(id);
  if (!full) {
    report('thumbnails', 0.02, 'Building the film strip');
    const thumbs = await makeThumbnails(src, projectPath(id, 'thumbs'), probe.duration);

    report('frames', 0.05, `Scanning ${Math.round(probe.duration * probe.fps)} frames`);
    const frames = await analyseFrames(src, probe, (p) => report('frames', 0.05 + p * 0.33));
    report('frames', 0.38, `${frames.cuts.length} cuts, ${frames.motionPeaks.length} motion peaks`);

    report('audio', 0.4, 'Listening for pauses and hits');
    const audio = probe.hasAudio ? await analyseAudio(src) : null;

    report('speech', 0.45, 'Transcribing speech word by word');
    const transcript = await transcribe(src, work, probe.hasAudio, (p) => report('speech', 0.45 + p * 0.28));
    if (transcript?.unavailable) report('speech', 0.73, 'Whisper not installed: skipping speech-driven edits');
    else report('speech', 0.73, `${transcript?.words?.length || 0} words transcribed`);

    full = {
      thumbs,
      frames: { cuts: frames.cuts, cutThreshold: frames.cutThreshold, motionPeaks: frames.motionPeaks, stats: frames.stats, series: downsampleSeries(frames.frames, probe.duration) },
      audio: audio && { hop: audio.hop, env: audio.env, median: audio.median, silences: audio.silences, onsets: audio.onsets, peaks: audio.peaks, thresholdDb: audio.thresholdDb },
      transcript: transcript && !transcript.unavailable ? transcript : null,
      whisperMissing: Boolean(transcript?.unavailable),
    };
    await writeFile(path.join(work, 'analysis.json'), JSON.stringify(full));
  }

  report('plan', 0.75, 'Planning the edit');
  project = await loadProject(id);
  const edl = planEdit({
    probe,
    analysis: full.frames,
    audio: full.audio,
    transcript: full.transcript,
    settings: project.settings,
  });

  // Contextual B-roll: search each slot's query server-side, take the best match.
  const slots = edl.events.filter((e) => e.type === 'broll');
  const media = {};
  for (let k = 0; k < slots.length; k++) {
    const ev = slots[k];
    report('broll', 0.78 + (k / Math.max(1, slots.length)) * 0.2, `Finding B-roll for “${ev.query}”`);
    try {
      const { results, errors } = await searchMedia(ev.query, { kind: 'image', orientation: orientationFor(project), perPage: 6, order: project.settings.providers });
      ev.candidates = results.slice(0, 6).map(({ id: rid, thumb, provider, credit, kind }) => ({ id: rid, thumb, provider, credit, kind }));
      if (!results.length) { ev.fetchError = errors.map((e) => `${e.provider}: ${e.error}`).join('; ') || 'No results'; continue; }
      const assetId = randomUUID();
      const { file, result } = await downloadResult(results[0].id, projectPath(id, 'media', assetId));
      media[assetId] = assetRecord(id, file, result, ev.query);
      ev.assetId = assetId;
    } catch (err) {
      ev.fetchError = err.message;
    }
  }

  await updateProject(id, (p) => {
    p.analysis = { stats: full.frames.stats, cuts: full.frames.cuts.length, words: full.transcript?.words?.length || 0, whisperMissing: full.whisperMissing };
    p.media = { ...p.media, ...media };
    p.edl = edl;
    p.status = 'planned';
  });
  report('done', 1, `Plan ready: ${edl.events.length} edit decisions`);
  return { events: edl.events.length };
}

export function assetRecord(id, file, result, query) {
  return {
    file: path.relative(projectPath(id), file),
    kind: result.kind,
    provider: result.provider,
    credit: result.credit || '',
    license: result.license || '',
    sourcePage: result.sourcePage || '',
    query: query || '',
  };
}

export async function render(id, { quality = 'final' } = {}, report) {
  const project = await loadProject(id);
  if (!project.edl) throw new Error('Run Auto-Edit first');
  const work = projectPath(id, 'work');
  await mkdir(work, { recursive: true });
  const name = `${quality}-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
  const out = projectPath(id, 'renders', name);
  report('render', 0.01, quality === 'preview' ? 'Rendering a fast preview' : 'Rendering the final cut');
  const info = await renderEdl({ project, edl: project.edl, quality, workDir: work, outFile: out, onProgress: (p) => report('render', p * 0.99) });
  const credits = Object.values(project.media)
    .filter((m) => project.edl.events.some((e) => e.type === 'broll' && e.enabled !== false && project.media[e.assetId] === m))
    .map((m) => `${m.credit} (${m.license}) ${m.sourcePage}`.trim());
  await updateProject(id, (p) => {
    p.renders.unshift({ file: `renders/${name}`, quality, createdAt: new Date().toISOString(), ...info, credits });
    p.renders = p.renders.slice(0, 20);
    p.status = 'rendered';
  });
  return { file: `renders/${name}`, credits };
}
