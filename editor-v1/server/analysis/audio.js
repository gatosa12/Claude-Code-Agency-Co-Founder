// Audio analysis on 16 kHz mono PCM decoded by ffmpeg: a loudness envelope, onsets
// (sudden energy rises: claps, hits, emphatic syllables), silences (natural pauses where
// a transition or B-roll cut feels invisible) and waveform peaks for the timeline.
import { ffmpeg } from '../lib/proc.js';

const SR = 16000;
const HOP = 320; // 20 ms

export function envelope(samples) {
  const n = Math.floor(samples.length / HOP);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * HOP; j < (i + 1) * HOP; j++) s += samples[j] * samples[j];
    env[i] = Math.sqrt(s / HOP);
  }
  return env;
}

const toDb = (x) => 20 * Math.log10(Math.max(x, 1e-5));

export function detectSilences(env, { thresholdDb, minDur = 0.35 } = {}) {
  const hopS = HOP / SR;
  const db = Array.from(env, toDb);
  const sorted = [...db].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? -20;
  const thr = thresholdDb ?? Math.min(-35, p90 - 24);
  const out = [];
  let start = null;
  for (let i = 0; i <= db.length; i++) {
    const quiet = i < db.length && db[i] < thr;
    if (quiet && start === null) start = i;
    if (!quiet && start !== null) {
      const dur = (i - start) * hopS;
      if (dur >= minDur) out.push({ start: r(start * hopS), end: r(i * hopS) });
      start = null;
    }
  }
  return { silences: out, thresholdDb: r(thr, 1) };
}

export function detectOnsets(env, { minGap = 0.25 } = {}) {
  const hopS = HOP / SR;
  const flux = new Float32Array(env.length);
  for (let i = 1; i < env.length; i++) flux[i] = Math.max(0, env[i] - env[i - 1]);
  const w = 25; // 0.5 s adaptive window
  const out = [];
  for (let i = 1; i < env.length - 1; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - w); j < Math.min(env.length, i + w); j++) { s += flux[j]; c++; }
    const local = s / c;
    if (flux[i] > local * 3.2 && flux[i] > 0.01 && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]) {
      const t = i * hopS;
      const last = out[out.length - 1];
      if (last && t - last.t < minGap) {
        if (flux[i] > last.strength) Object.assign(last, { t: r(t), strength: r(flux[i], 4) });
      } else out.push({ t: r(t), strength: r(flux[i], 4) });
    }
  }
  return out;
}

export function peaks(env, n = 1200) {
  const out = new Array(n).fill(0);
  if (!env.length) return out;
  let max = 0;
  for (const v of env) max = Math.max(max, v);
  for (let i = 0; i < env.length; i++) {
    const k = Math.min(n - 1, Math.floor((i / env.length) * n));
    out[k] = Math.max(out[k], env[i]);
  }
  return out.map((v) => r(max ? v / max : 0, 3));
}

/** Loudness (RMS) of a time range relative to the clip's median loudness. */
export function relativeLoudness(env, start, end) {
  const hopS = HOP / SR;
  const a = Math.max(0, Math.floor(start / hopS));
  const b = Math.min(env.length, Math.max(a + 1, Math.ceil(end / hopS)));
  let s = 0;
  for (let i = a; i < b; i++) s += env[i];
  return s / Math.max(1, b - a);
}

export async function analyseAudio(src) {
  const { stdout } = await ffmpeg(['-i', src, '-vn', '-ac', '1', '-ar', String(SR), '-f', 's16le', '-acodec', 'pcm_s16le', '-']);
  const pcm = new Int16Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.length / 2));
  const samples = Float32Array.from(pcm, (v) => v / 32768);
  const env = envelope(samples);
  const sorted = Array.from(env).sort((x, y) => x - y);
  return {
    hop: HOP / SR,
    env: Array.from(env, (v) => r(v, 5)),
    median: r(sorted[Math.floor(sorted.length / 2)] || 0, 5),
    ...detectSilences(env),
    onsets: detectOnsets(env),
    peaks: peaks(env),
  };
}

function r(x, d = 2) {
  const k = 10 ** d;
  return Math.round(x * k) / k;
}
