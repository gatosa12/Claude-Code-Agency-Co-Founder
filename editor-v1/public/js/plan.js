// Client-side mirror of the render maths, so the "Live plan" view previews the EDL in real
// time (zoom curve, active B-roll, captions, titles) without waiting for ffmpeg.

export const startOf = (e) => (e.start ?? e.t);

export function zoomAt(t, events) {
  let z = 1;
  for (const e of events) {
    if (e.enabled === false) continue;
    if (e.type === 'zoom' && t >= e.start && t <= e.end) {
      const a = (e.scale || 1.12) - 1;
      if (e.kind === 'jump') z += a;
      else if (e.kind === 'push') z += a * (t - e.start) / Math.max(0.01, e.end - e.start);
      else z += a * Math.min(1, (t - e.start) / 0.12) * Math.min(1, (e.end - t) / 0.15);
    }
    if (e.type === 'transition' && e.kind === 'zoom' && t >= e.t && t <= e.t + (e.duration || 0.3)) {
      z += 0.18 * (1 - (t - e.t) / (e.duration || 0.3));
    }
  }
  return z;
}

export function activeAt(t, events, type) {
  return events.filter((e) => e.type === type && e.enabled !== false && t >= e.start && t < e.end);
}

export function flashAt(t, events) {
  let a = 0;
  for (const e of events) {
    if (e.enabled === false) continue;
    if (e.type === 'transition' && e.kind === 'flash') {
      if (t >= e.t - 0.02 && t < e.t + 0.05) a = Math.max(a, 0.85);
      else if (t >= e.t + 0.05 && t < e.t + 0.12) a = Math.max(a, 0.35);
    }
    if (e.type === 'broll' && e.transitionIn === 'flash' && t >= e.start && t < e.start + 0.05) a = Math.max(a, 0.8);
  }
  return a;
}

export function whipAt(t, events) {
  return events.some((e) => e.enabled !== false && e.type === 'transition' && e.kind === 'whip' && Math.abs(t - e.t) < 0.09);
}

/** Same chunking rule as server/engine/captions.js. */
export function chunkWords(words, style) {
  const max = style === 'pop' ? 3 : style === 'karaoke' ? 6 : 7;
  const chunks = [];
  let cur = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    if (cur.length && (cur.length >= max || w.start - prev.end > 0.6 || /[.?!,]$/.test(prev.word))) { chunks.push(cur); cur = []; }
    cur.push(w);
  }
  if (cur.length) chunks.push(cur);
  return chunks.map((c, i, all) => ({ words: c, start: c[0].start, end: Math.min(c[c.length - 1].end + 0.25, all[i + 1]?.[0].start ?? Infinity) }));
}

export function fmtTime(t) {
  if (!Number.isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}
