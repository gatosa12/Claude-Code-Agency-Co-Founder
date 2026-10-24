// Automated colour grading. Two stages, both plain ffmpeg filters:
//   1. correction – normalise exposure and saturation toward a neutral target using the
//      frame analysis (so dark phone footage and washed-out webcams start level);
//   2. look – a cinematic preset (teal/orange split, noir, amber, bleach bypass, neon),
//      scaled by `strength` so 0 = corrected only and 1 = the full look.

export const PRESETS = {
  natural: {
    label: 'Natural', desc: 'Exposure and colour correction only',
    balance: [0, 0, 0, 0, 0, 0, 0, 0, 0], contrast: 1.02, saturation: 1.04, gamma: 1, vignette: 0, grain: 0, mono: false,
    css: 'contrast(1.02) saturate(1.04)',
  },
  'teal-orange': {
    label: 'Teal & Orange', desc: 'Blockbuster split: teal shadows, warm skin',
    // colorbalance rs gs bs rm gm bm rh gh bh
    balance: [-0.08, -0.02, 0.12, 0.05, 0, -0.05, 0.1, 0.03, -0.1], contrast: 1.1, saturation: 1.12, gamma: 0.97, vignette: 0.35, grain: 4, mono: false,
    curve: '0/0 0.25/0.21 0.5/0.5 0.75/0.79 1/1',
    css: 'contrast(1.1) saturate(1.12) sepia(0.12) hue-rotate(-8deg)',
  },
  noir: {
    label: 'Hard Noir', desc: 'High-contrast black & white',
    balance: [0, 0, 0, 0, 0, 0, 0, 0, 0], contrast: 1.3, saturation: 0, gamma: 0.95, vignette: 0.5, grain: 9, mono: true,
    curve: '0/0 0.2/0.12 0.5/0.5 0.8/0.9 1/1',
    css: 'grayscale(1) contrast(1.3)',
  },
  amber: {
    label: 'Amber Archive', desc: 'Warm, faded, documentary',
    balance: [0.06, 0.02, -0.08, 0.08, 0.03, -0.1, 0.06, 0.02, -0.08], contrast: 1.04, saturation: 0.72, gamma: 1.02, vignette: 0.4, grain: 7, mono: false,
    curve: '0/0.06 0.5/0.52 1/0.94',
    css: 'sepia(0.45) saturate(0.8) contrast(1.04)',
  },
  bleach: {
    label: 'Bleach Bypass', desc: 'Desaturated, gritty, silver',
    balance: [0, 0, 0.02, 0, 0, 0, 0, 0, 0], contrast: 1.22, saturation: 0.55, gamma: 0.96, vignette: 0.3, grain: 6, mono: false,
    curve: '0/0 0.3/0.24 0.7/0.78 1/1',
    css: 'saturate(0.55) contrast(1.22)',
  },
  neon: {
    label: 'Neon Noir', desc: 'Cyan/magenta sci-fi',
    balance: [0.06, -0.06, 0.14, -0.04, -0.04, 0.1, 0.08, -0.02, 0.06], contrast: 1.15, saturation: 1.25, gamma: 0.95, vignette: 0.45, grain: 3, mono: false,
    curve: '0/0 0.25/0.18 0.5/0.48 0.75/0.8 1/1',
    css: 'contrast(1.15) saturate(1.25) hue-rotate(12deg)',
  },
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const f = (x) => Number(x.toFixed(3));

/** Picks a look from the footage itself when the user leaves the grade on Auto. */
export function autoPreset(stats) {
  if (!stats) return 'teal-orange';
  if (stats.satMean < 6) return 'noir'; // already near-monochrome: lean in
  if (stats.lumaMean < 70) return 'neon'; // dark, night-time footage
  return 'teal-orange';
}

/** Exposure/saturation correction toward neutral targets (8-bit YAVG ≈ 110, SATAVG ≈ 38). */
export function correction(stats) {
  if (!stats || !stats.frames) return { brightness: 0, gamma: 1, saturation: 1 };
  const brightness = clamp((110 - stats.lumaMean) / 255 * 0.6, -0.1, 0.12);
  const gamma = clamp(1 + (110 - stats.lumaMean) / 400, 0.85, 1.25);
  const saturation = stats.satMean > 1 ? clamp(38 / stats.satMean, 0.8, 1.35) : 1;
  return { brightness: f(brightness), gamma: f(gamma), saturation: f(saturation) };
}

/**
 * Returns an ffmpeg filter chain (string, comma-joined) for one video stream.
 * `forOverlay` skips grain/vignette so stacked B-roll doesn't double them.
 */
export function gradeFilter(presetName, strength = 0.8, stats = null, { forOverlay = false } = {}) {
  const p = PRESETS[presetName] || PRESETS.natural;
  const s = clamp(Number(strength) || 0, 0, 1);
  const c = correction(stats);
  const chain = [];
  chain.push(`eq=brightness=${c.brightness}:gamma=${f(c.gamma * lerp(1, p.gamma, s))}:contrast=${f(lerp(1, p.contrast, s))}:saturation=${f(c.saturation * lerp(1, p.saturation, s))}`);
  if (s > 0 && p.balance.some((v) => v !== 0)) {
    const [rs, gs, bs, rm, gm, bm, rh, gh, bh] = p.balance.map((v) => f(v * s));
    chain.push(`colorbalance=rs=${rs}:gs=${gs}:bs=${bs}:rm=${rm}:gm=${gm}:bm=${bm}:rh=${rh}:gh=${gh}:bh=${bh}`);
  }
  if (p.curve && s > 0) chain.push(`curves=all='${blendCurve(p.curve, s)}'`);
  if (p.mono && s > 0.5) chain.push('hue=s=0');
  if (!forOverlay) {
    if (p.vignette * s > 0.02) chain.push(`vignette=angle=${f(0.2 + p.vignette * s * 0.6)}`);
    if (p.grain * s >= 1) chain.push(`noise=alls=${Math.round(p.grain * s)}:allf=t`);
  }
  return chain.join(',');
}

/** Moves each curve point toward the identity line by (1 - strength). */
function blendCurve(curve, s) {
  return curve.split(' ').map((pt) => {
    const [x, y] = pt.split('/').map(Number);
    return `${f(x)}/${f(lerp(x, y, s))}`;
  }).join(' ');
}

export function presetList() {
  return Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label, desc: p.desc, css: p.css }));
}
