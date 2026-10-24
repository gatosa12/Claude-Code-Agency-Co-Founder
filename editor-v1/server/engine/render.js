// Turns an EDL into one ffmpeg filter graph and renders it:
//   base footage → cover-crop to the output format → colour grade → camera moves (zoompan)
//   → transitions (flash / whip blur / zoom reveal) → B-roll overlays with motion and
//   entrance animation → ASS captions & titles; audio = source + positioned SFX, limited.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { ffmpeg, parseProgressTime } from '../lib/proc.js';
import { buildAss } from './captions.js';
import { gradeFilter } from './grading.js';
import { ensureSfxKit, sfxFile } from './sfx.js';

export const FORMATS = {
  '9:16': [1080, 1920],
  '4:5': [1080, 1350],
  '1:1': [1080, 1080],
  '16:9': [1920, 1080],
};

const even = (x) => Math.max(2, Math.round(x / 2) * 2);
const n3 = (x) => Number(Number(x).toFixed(3));

export function outputSize(format, probe, quality = 'final') {
  let [w, h] = FORMATS[format] || [probe.width, probe.height];
  const cap = quality === 'preview' ? 960 : 1920;
  const k = Math.min(1, cap / Math.max(w, h));
  return [even(w * k), even(h * k)];
}

/** Escapes a path for use as a filter option value inside a filtergraph. */
export function escFilterPath(p) {
  return p.replace(/\\/g, '/').replace(/([:'\[\],;])/g, '\\$1');
}

/** zoompan zoom expression summing every active camera move at input time `it`. */
export function zoomExpression(zooms, transitions) {
  const terms = [];
  for (const z of zooms) {
    const s = n3(z.start), e = n3(z.end), a = n3((z.scale || 1.12) - 1);
    if (e <= s) continue;
    if (z.kind === 'jump') terms.push(`between(it,${s},${e})*${a}`);
    else if (z.kind === 'push') terms.push(`between(it,${s},${e})*${a}*(it-${s})/${n3(e - s)}`);
    else terms.push(`between(it,${s},${e})*${a}*min(1,(it-${s})/0.12)*min(1,(${e}-it)/0.15)`);
  }
  for (const t of transitions) {
    if (t.kind !== 'zoom') continue;
    const s = n3(t.t), d = n3(Math.max(0.15, t.duration || 0.3));
    terms.push(`between(it,${s},${n3(s + d)})*0.18*(1-(it-${s})/${d})`);
  }
  return terms.length ? `1+${terms.join('+')}` : '1';
}

export function buildRenderPlan({ project, edl, quality = 'final', workDir }) {
  const probe = project.source.probe;
  const [W, H] = outputSize(project.settings.format, probe, quality);
  const fps = Math.min(60, Math.round(probe.fps) || 30);
  const duration = probe.duration;
  const stats = project.analysis?.stats;
  const on = (type) => edl.events.filter((e) => e.type === type && e.enabled !== false);

  const inputs = [['-i', path.join(path.dirname(workDir), project.source.file)]];
  const graph = [];
  let idx = 1;

  // Base footage.
  const zooms = on('zoom');
  const transitions = on('transition');
  const base = [
    `fps=${fps}`,
    `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${W}:${H}`,
    'setsar=1',
    'format=yuv420p',
    gradeFilter(edl.grade.preset, edl.grade.strength, stats),
  ];
  const zexpr = zoomExpression(zooms, transitions);
  if (zexpr !== '1') {
    base.push(`zoompan=z='${zexpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${fps}`);
  }
  for (const t of transitions) {
    const s = n3(t.t);
    if (t.kind === 'whip') base.push(`gblur=sigma=28:sigmaV=0.01:steps=2:enable='between(t,${n3(s - 0.09)},${n3(s + 0.09)})'`);
    if (t.kind === 'flash') {
      base.push(`drawbox=x=0:y=0:w=iw:h=ih:color=white@0.85:t=fill:enable='between(t,${n3(s - 0.02)},${n3(s + 0.05)})'`);
      base.push(`drawbox=x=0:y=0:w=iw:h=ih:color=white@0.35:t=fill:enable='between(t,${n3(s + 0.05)},${n3(s + 0.12)})'`);
    }
  }
  graph.push(`[0:v]${base.join(',')}[v0]`);
  let last = 'v0';

  // B-roll overlays.
  const broll = on('broll').filter((b) => b.assetId && project.media?.[b.assetId]);
  broll.forEach((b, k) => {
    const asset = project.media[b.assetId];
    const dur = n3(b.end - b.start);
    const file = path.join(path.dirname(workDir), asset.file);
    if (asset.kind === 'video') inputs.push(['-stream_loop', '-1', '-t', String(dur + 0.1), '-i', file]);
    else inputs.push(['-loop', '1', '-framerate', String(fps), '-t', String(dur + 0.1), '-i', file]);
    const i = idx++;
    const card = b.transitionIn === 'pop';
    const cw = card ? even(W * 0.8) : W;
    const ch = card ? even(H * (W > H ? 0.8 : 0.62)) : H;
    const frames = Math.max(1, Math.round(dur * fps));
    const zx = 'iw/2-(iw/zoom/2)', zy = 'ih/2-(ih/zoom/2)';
    const motion = {
      'push-in': [`1+0.12*on/${frames}`, zx, zy],
      'pull-out': [`1.12-0.12*on/${frames}`, zx, zy],
      'pan-right': ['1.12', `(iw-iw/zoom)*on/${frames}`, zy],
      'pan-left': ['1.12', `(iw-iw/zoom)*(1-on/${frames})`, zy],
    }[b.motion] || ['1', zx, zy];
    const chain = [
      `fps=${fps}`,
      `scale=${even(cw * 1.25)}:${even(ch * 1.25)}:force_original_aspect_ratio=increase`,
      `crop=${even(cw * 1.25)}:${even(ch * 1.25)}`,
      'setsar=1',
      'format=yuv420p',
      gradeFilter(edl.grade.preset, edl.grade.strength, null, { forOverlay: true }),
      `zoompan=z='${motion[0]}':x='${motion[1]}':y='${motion[2]}':d=1:s=${cw}x${ch}:fps=${fps}`,
    ];
    if (card) {
      const bw = Math.max(6, Math.round(Math.min(W, H) * 0.014));
      chain.push(`pad=${cw + bw * 2}:${ch + bw * 2}:${bw}:${bw}:white`, 'format=rgba', `rotate=a=${k % 2 ? 0.035 : -0.035}:fillcolor=none:ow=rotw(iw):oh=roth(ih)`);
    } else {
      chain.push('format=rgba');
    }
    const fadeIn = b.transitionIn === 'fade' ? 0.25 : 0.06;
    chain.push(`fade=t=in:st=0:d=${fadeIn}:alpha=1`, `fade=t=out:st=${n3(Math.max(0, dur - 0.1))}:d=0.1:alpha=1`);
    chain.push(`setpts=PTS-STARTPTS+${n3(b.start)}/TB`);
    graph.push(`[${i}:v]${chain.join(',')}[b${k}]`);
    let x = '(W-w)/2';
    if (b.transitionIn === 'slide') x = `if(lt(t-${n3(b.start)},0.2),(W-w)/2+W*pow(1-(t-${n3(b.start)})/0.2,3),(W-w)/2)`;
    graph.push(`[${last}][b${k}]overlay=x='${x}':y='(H-h)/2':eof_action=pass:enable='between(t,${n3(b.start)},${n3(b.end)})'[o${k}]`);
    last = `o${k}`;
    if (b.transitionIn === 'flash') {
      graph.push(`[${last}]drawbox=x=0:y=0:w=iw:h=ih:color=white@0.8:t=fill:enable='between(t,${n3(b.start)},${n3(b.start + 0.05)})'[f${k}]`);
      last = `f${k}`;
    }
  });

  // Captions + titles.
  const titles = on('title');
  const assFile = path.join(workDir, 'overlay.ass');
  const ass = buildAss({ width: W, height: H, captions: edl.captions, titles, font: config.captionFont });
  const hasText = (edl.captions?.enabled && edl.captions.words?.length) || titles.length;
  if (hasText) {
    const fontsdir = config.fontsDir ? `:fontsdir=${escFilterPath(config.fontsDir)}` : '';
    graph.push(`[${last}]ass=${escFilterPath(assFile)}${fontsdir}[vtxt]`);
    last = 'vtxt';
  }
  graph.push(`[${last}]format=yuv420p[vout]`);

  // Audio.
  const sfx = on('sfx');
  let aBase;
  if (probe.hasAudio) {
    graph.push('[0:a]aresample=48000,aformat=channel_layouts=stereo[a0]');
    aBase = 'a0';
  } else {
    inputs.push(['-f', 'lavfi', '-t', String(duration), '-i', 'anullsrc=r=48000:cl=stereo']);
    aBase = `${idx++}:a`;
  }
  const byKind = new Map();
  for (const s of sfx) byKind.set(s.kind, [...(byKind.get(s.kind) || []), s]);
  const mixIn = [`[${aBase}]`];
  for (const [kind, list] of byKind) {
    inputs.push(['-i', sfxFile(kind)]);
    const i = idx++;
    const labels = list.map((_, j) => `${kind}${j}`);
    graph.push(`[${i}:a]aformat=channel_layouts=stereo,asplit=${list.length}${labels.map((l) => `[${l}s]`).join('')}`);
    list.forEach((s, j) => {
      const ms = Math.max(0, Math.round(s.t * 1000));
      graph.push(`[${labels[j]}s]adelay=${ms}|${ms},volume=${n3((s.gain ?? 1) * 0.8)}[${labels[j]}]`);
      mixIn.push(`[${labels[j]}]`);
    });
  }
  if (mixIn.length > 1) graph.push(`${mixIn.join('')}amix=inputs=${mixIn.length}:duration=first:normalize=0,alimiter=limit=0.95[aout]`);
  else graph.push(`[${aBase}]alimiter=limit=0.95[aout]`);

  return { W, H, fps, duration, inputs, graph, assFile, ass, hasText };
}

export async function renderEdl({ project, edl, quality, workDir, outFile, onProgress = () => {} }) {
  await ensureSfxKit();
  const plan = buildRenderPlan({ project, edl, quality, workDir });
  if (plan.hasText) await writeFile(plan.assFile, plan.ass);
  const graphFile = path.join(workDir, 'graph.txt');
  await writeFile(graphFile, plan.graph.join(';\n'));
  const enc = quality === 'preview'
    ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28']
    : ['-c:v', 'libx264', '-preset', 'medium', '-crf', '19'];
  await ffmpeg([
    ...plan.inputs.flat(),
    '-filter_complex_script', graphFile,
    '-map', '[vout]', '-map', '[aout]',
    ...enc, '-pix_fmt', 'yuv420p', '-r', String(plan.fps),
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
    '-t', String(plan.duration),
    outFile,
  ], {
    onStderrLine: (line) => {
      const t = parseProgressTime(line);
      if (t !== null) onProgress(t / plan.duration);
    },
  });
  return { width: plan.W, height: plan.H, fps: plan.fps };
}
