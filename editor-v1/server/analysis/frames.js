// Frame-by-frame visual analysis in one ffmpeg pass over a downscaled copy:
//   scene  – lavfi scene-change score per frame (0..1)
//   motion – YDIF, mean absolute luma difference to the previous frame
//   luma   – YAVG, mean luma (exposure)
//   sat    – SATAVG, mean saturation
// From these we derive hard cuts, high-motion stretches and exposure/saturation stats
// that drive transitions, SFX placement and auto colour correction.
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { ffmpeg, parseProgressTime } from '../lib/proc.js';

export function parseFrameMetadata(text) {
  const frames = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const fm = /^frame:(\d+)\s+pts:\S+\s+pts_time:([\d.]+)/.exec(line);
    if (fm) {
      cur = { t: Number(fm[2]), scene: 0, motion: 0, luma: 0, sat: 0 };
      frames.push(cur);
      continue;
    }
    if (!cur) continue;
    const kv = /^lavfi\.(scene_score|signalstats\.YDIF|signalstats\.YAVG|signalstats\.SATAVG)=([\d.eE+-]+)/.exec(line);
    if (!kv) continue;
    const v = Number(kv[2]);
    if (kv[1] === 'scene_score') cur.scene = v;
    else if (kv[1].endsWith('YDIF')) cur.motion = v;
    else if (kv[1].endsWith('YAVG')) cur.luma = v;
    else cur.sat = v;
  }
  return frames;
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const std = (a, m = mean(a)) => Math.sqrt(mean(a.map((x) => (x - m) ** 2)));

/** Hard cuts: frames whose scene score stands well above the clip's own baseline. */
export function detectCuts(frames, { minGap = 0.5 } = {}) {
  const scores = frames.map((f) => f.scene);
  const m = mean(scores);
  const thr = Math.max(0.28, m + 4 * std(scores, m));
  const cuts = [];
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i];
    if (f.scene < thr) continue;
    const last = cuts[cuts.length - 1];
    if (last && f.t - last.t < minGap) {
      if (f.scene > last.score) Object.assign(last, { t: f.t, score: f.scene });
      continue;
    }
    cuts.push({ t: round(f.t), score: round(f.scene, 3) });
  }
  return { cuts, threshold: round(thr, 3) };
}

/** Stretches where on-screen motion stays high (good homes for whooshes / energy). */
export function detectMotionPeaks(frames, fps, { window = 0.5 } = {}) {
  const motion = frames.map((f) => f.motion);
  const m = mean(motion);
  const s = std(motion, m);
  const thr = m + 1.5 * s;
  const w = Math.max(1, Math.round(window * fps));
  const peaks = [];
  for (let i = 0; i < frames.length; i++) {
    if (motion[i] < thr) continue;
    let isMax = true;
    for (let j = Math.max(0, i - w); j < Math.min(frames.length, i + w); j++) {
      if (motion[j] > motion[i]) { isMax = false; break; }
    }
    if (isMax) peaks.push({ t: round(frames[i].t), strength: round(s ? (motion[i] - m) / s : 0, 2) });
  }
  return peaks;
}

export function summarise(frames) {
  const luma = frames.map((f) => f.luma);
  const sat = frames.map((f) => f.sat);
  const motion = frames.map((f) => f.motion);
  return {
    frames: frames.length,
    lumaMean: round(mean(luma), 2),
    lumaStd: round(std(luma), 2),
    satMean: round(mean(sat), 2),
    motionMean: round(mean(motion), 3),
  };
}

/** Bucket per-frame series into ~n points for the timeline graph. */
export function downsampleSeries(frames, duration, n = 600) {
  const buckets = Array.from({ length: n }, () => ({ scene: 0, motion: 0, luma: 0, c: 0 }));
  for (const f of frames) {
    const i = Math.min(n - 1, Math.floor((f.t / Math.max(duration, 0.001)) * n));
    const b = buckets[i];
    b.scene = Math.max(b.scene, f.scene);
    b.motion += f.motion; b.luma += f.luma; b.c++;
  }
  return {
    n,
    scene: buckets.map((b) => round(b.scene, 3)),
    motion: buckets.map((b) => round(b.c ? b.motion / b.c : 0, 2)),
    luma: buckets.map((b) => round(b.c ? b.luma / b.c : 0, 1)),
  };
}

export async function analyseFrames(src, probeInfo, onProgress = () => {}) {
  const meta = [];
  await ffmpeg([
    '-i', src, '-an', '-sn',
    '-vf', "scale=192:-2,select='gte(scene\\,0)',signalstats,metadata=mode=print:file=-",
    '-f', 'null', '-',
  ], {
    onStdout: (d) => meta.push(d),
    onStderrLine: (line) => {
      const t = parseProgressTime(line);
      if (t !== null && probeInfo.duration) onProgress(t / probeInfo.duration);
    },
  });
  const frames = parseFrameMetadata(Buffer.concat(meta).toString());
  if (!frames.length) throw new Error('Frame analysis produced no frames');
  const { cuts, threshold } = detectCuts(frames);
  return {
    frames,
    cuts,
    cutThreshold: threshold,
    motionPeaks: detectMotionPeaks(frames, probeInfo.fps),
    stats: summarise(frames),
  };
}

/** Small thumbnails for the timeline film strip (about one per second, max 160). */
export async function makeThumbnails(src, dir, duration) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const step = Math.max(1, duration / 160);
  await ffmpeg(['-i', src, '-an', '-vf', `fps=1/${step.toFixed(3)},scale=-2:96`, '-q:v', '6', path.join(dir, '%04d.jpg')]);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.jpg')).sort();
  return { step: round(step, 3), files };
}

function round(x, d = 2) {
  const k = 10 ** d;
  return Math.round(x * k) / k;
}
