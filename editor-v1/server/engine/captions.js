// Builds an Advanced SubStation (ASS) script for libass: word-by-word captions with pop-in
// animation, accent-coloured emphasis words, and big animated keyword titles. Rendering
// through the ffmpeg `ass` filter keeps the animation frame-accurate in the export.

const ACCENT = '&H003C3CFF&'; // ASS colours are &HAABBGGRR → #FF3C3C red
const CYAN = '&H00FFF200&';   // #00F2FF

export function assTime(t) {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}

/** Strips ASS override/control characters from user or transcript text. */
export function escapeAss(text) {
  return String(text).replace(/[{}\\]/g, '').replace(/\r?\n/g, ' ').slice(0, 200);
}

/** Groups words into on-screen chunks. */
export function chunkWords(words, style) {
  const max = style === 'pop' ? 3 : style === 'karaoke' ? 6 : 7;
  const chunks = [];
  let cur = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    if (cur.length && (cur.length >= max || w.start - prev.end > 0.6 || /[.?!,]$/.test(prev.word))) {
      chunks.push(cur); cur = [];
    }
    cur.push(w);
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

export function buildAss({ width, height, captions, titles, font }) {
  const base = Math.round(Math.min(width, height) * 0.075);
  const marginV = Math.round(height * (height > width ? 0.24 : 0.1));
  const lines = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${width}`, `PlayResY: ${height}`, 'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Caption,${font} Black,${base},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${Math.max(2, Math.round(base * 0.09))},${Math.round(base * 0.06)},2,60,60,${marginV},1`,
    `Style: Title,${font} Black,${Math.round(base * 2.3)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,${Math.round(base * 0.12)},0,5,40,40,40,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  if (captions?.enabled && captions.words?.length) {
    const chunks = chunkWords(captions.words, captions.style);
    chunks.forEach((chunk, c) => {
      // Hold briefly after the last word, but never into the next chunk (no stacked lines).
      const next = chunks[c + 1]?.[0].start ?? Infinity;
      const end = Math.min(chunk[chunk.length - 1].end + 0.25, next);
      if (captions.style === 'minimal') {
        lines.push(`Dialogue: 1,${assTime(chunk[0].start)},${assTime(end)},Caption,,0,0,0,,{\\fad(80,60)}${chunk.map((w) => escapeAss(w.word)).join(' ')}`);
        return;
      }
      // One event per word-onset: words already spoken are white, the live word pops in
      // (scale 70% → 108% → 100%) and emphasis words take the accent colour.
      chunk.forEach((w, k) => {
        const s = w.start;
        const e = k < chunk.length - 1 ? chunk[k + 1].start : end;
        if (e <= s) return;
        const text = chunk.map((x, j) => {
          const t = escapeAss(x.word);
          if (j > k) return captions.style === 'karaoke' ? `{\\alpha&H99&}${t}{\\alpha&H00&}` : '';
          const color = x.emphasis ? `{\\c${ACCENT}}` : '';
          const reset = x.emphasis ? '{\\c&H00FFFFFF&}' : '';
          if (j === k) return `${color}{\\fscx70\\fscy70\\t(0,70,\\fscx108\\fscy108)\\t(70,130,\\fscx100\\fscy100)}${t}{\\fscx100\\fscy100}${reset}`;
          return `${color}${t}${reset}`;
        }).filter(Boolean).join(' ');
        lines.push(`Dialogue: 1,${assTime(s)},${assTime(e)},Caption,,0,0,0,,${text}`);
      });
    });
  }

  for (const t of titles || []) {
    const text = escapeAss(t.text);
    const anim = t.style === 'slam'
      ? `{\\fscx180\\fscy180\\alpha&HFF&\\t(0,90,\\fscx100\\fscy100\\alpha&H00&)\\c${ACCENT}\\fad(0,120)}`
      : `{\\fscx40\\fscy40\\t(0,110,\\fscx112\\fscy112)\\t(110,180,\\fscx100\\fscy100)\\3c${CYAN}\\fad(0,140)}`;
    lines.push(`Dialogue: 2,${assTime(t.start)},${assTime(t.end)},Title,,0,0,0,,${anim}${text}`);
  }
  return lines.join('\n') + '\n';
}
