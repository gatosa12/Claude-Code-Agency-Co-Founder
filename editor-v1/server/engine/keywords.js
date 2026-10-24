// Contextual analysis of the spoken content. Turns word timings into phrases, finds the
// most visual, specific words in each (what a stock search can actually show), and picks
// emphasis words that deserve a punch-in, an impact hit or an animated title.

export const STOPWORDS = new Set(`a about above after again against all also am an and any are aren't as at be because been
before being below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during
each few for from further get gets got gonna had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers
herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself just let's like me more most
mustn't my myself no nor not now of off on once only or other ought our ours ourselves out over own really right same say
said shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there
there's these they they'd they'll they're they've thing things think this those through to too under until up us very want
was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's
will with won't would wouldn't yeah yes you you'd you'll you're you've your yours yourself yourselves okay ok um uh erm hmm
actually basically literally kind sort going know mean well maybe even still back much many lot lots way one two make made
come came look see take put give gave go went new good great time day today something anything everything someone people
year years really pretty quite every might may shall need needs got getting gotta wanna tell told ask asked call happy sure`.split(/\s+/));

// Words a stock search can't show well: still usable, but ranked well below concrete nouns.
const ABSTRACT = new Set(`question questions answer answers idea ideas problem problems reason reasons help way ways part
point points fact facts case level stuff matter issue issues thing value process system result results chance option
options experience information service services support reality truth future past moment situation difference sense`.split(/\s+/));

const EMPHASIS_LEXICON = new Set(`never always every biggest best worst first last only free secret huge massive million
billion thousand hundred double triple zero instantly guaranteed proven stop must exactly crazy insane impossible
everyone nobody nothing everything fastest cheapest richest broke fired viral record`.split(/\s+/));

export const clean = (w) => w.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');

export function isContent(word) {
  const c = clean(word);
  return c.length >= 3 && !STOPWORDS.has(c) && !/^\d+$/.test(c);
}

/** Groups words into phrases on sentence punctuation, long pauses, or length. */
export function buildPhrases(words, { gap = 0.55, maxWords = 14 } = {}) {
  const phrases = [];
  let cur = [];
  const flush = () => {
    if (cur.length) phrases.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur, idx: cur[0].i });
    cur = [];
  };
  words.forEach((w, i) => {
    const prev = cur[cur.length - 1];
    if (prev && (w.start - prev.end > gap || cur.length >= maxWords)) flush();
    cur.push({ ...w, i });
    if (/[.?!]$/.test(w.word)) flush();
  });
  flush();
  return phrases.map((p) => ({ ...p, text: p.words.map((w) => w.word).join(' ') }));
}

// Figures of speech whose literal words would fetch the wrong picture ("ring" → jewellery).
export const IDIOMS = [
  [/\b(give|gimme) (us|me|them|him|her) a (ring|call|bell|buzz)\b/i, 'phone call'],
  [/\b(get in touch|reach out|drop (us|me) a line)\b/i, 'phone call'],
  [/\btime is money\b/i, 'clock money'],
  [/\bbreak the bank\b/i, 'piggy bank'],
  [/\b(on fire|blowing up|went viral)\b/i, 'crowd cheering'],
  [/\bpiece of cake\b/i, 'easy success'],
  [/\b(through the roof|skyrocket(ed|ing)?)\b/i, 'rocket launch'],
  [/\bhit the ground running\b/i, 'runner sprint'],
];

function idiomMatch(p) {
  for (const [re, query] of IDIOMS) {
    const m = re.exec(p.text);
    if (!m) continue;
    // Anchor on the word where the idiom starts.
    let chars = 0;
    const k = p.words.findIndex((w) => (chars += w.word.length + 1) > m.index);
    const w = p.words[Math.max(0, k)];
    return { query, anchor: { start: w.start, end: w.end, word: w.word } };
  }
  return null;
}

/** Scores each phrase's content words (specificity × visual-ness) and builds a stock query. */
export function scorePhrases(phrases) {
  const df = new Map();
  for (const p of phrases) {
    for (const c of new Set(p.words.filter((w) => isContent(w.word)).map((w) => clean(w.word)))) {
      df.set(c, (df.get(c) || 0) + 1);
    }
  }
  const N = Math.max(1, phrases.length);
  return phrases.map((p) => {
    const scored = p.words
      .map((w, k) => {
        if (!isContent(w.word)) return null;
        const c = clean(w.word);
        const idf = Math.log(1 + N / (df.get(c) || 1));
        const proper = k > 0 && /^[A-Z]/.test(w.word.replace(/^[^A-Za-z]+/, '')) ? 1.6 : 1;
        const len = Math.min(1.4, 0.7 + c.length / 12);
        const verbish = /(ing|ed|ly)$/.test(c) ? 0.75 : 1;
        const abstract = ABSTRACT.has(c) ? 0.35 : 1;
        return { word: w, k, c, score: idf * proper * len * verbish * abstract };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    const idiom = idiomMatch(p);
    if (idiom) return { ...p, ...idiom, keywords: [idiom.query, ...scored.slice(0, 3).map((s) => s.c)], score: 1.5 };
    if (!scored.length) return { ...p, query: '', keywords: [], score: 0, anchor: null };
    const best = scored[0];
    // Keep an adjacent content word as a bigram ("playing cards", "dental clinic").
    const neighbours = [p.words[best.k - 1], p.words[best.k + 1]].filter((w) => w && isContent(w.word));
    let query = best.c;
    if (neighbours.length) {
      const n = neighbours[0];
      query = n.start < best.word.start ? `${clean(n.word)} ${best.c}` : `${best.c} ${clean(n.word)}`;
    }
    return {
      ...p,
      query,
      keywords: scored.slice(0, 4).map((s) => s.c),
      score: Math.round(best.score * 100) / 100,
      anchor: { start: best.word.start, end: best.word.end, word: best.word.word },
    };
  });
}

/**
 * Emphasis: loud-relative-to-neighbours words, lexicon hits, numbers and superlatives.
 * loudnessOf(start, end) → relative loudness (1 = clip median); optional.
 */
export function findEmphasis(words, loudnessOf) {
  const out = [];
  words.forEach((w, i) => {
    const c = clean(w.word);
    if (!c || STOPWORDS.has(c)) return;
    let score = 0;
    if (EMPHASIS_LEXICON.has(c)) score += 1.2;
    if (/^\$?\d[\d,.]*(%|k|m|x)?$/.test(c) || /\d/.test(c)) score += 1.0;
    if (/est$/.test(c) && c.length > 5) score += 0.6;
    if (/!$/.test(w.word)) score += 0.8;
    if (w.word.length > 2 && w.word === w.word.toUpperCase() && /[A-Z]/.test(w.word)) score += 0.8;
    if (loudnessOf) {
      const here = loudnessOf(w.start, w.end);
      const ctx = loudnessOf(Math.max(0, w.start - 1.5), w.end + 1.5);
      if (ctx > 0 && here / ctx > 1.35) score += Math.min(1.2, (here / ctx - 1) * 1.5);
    }
    if (isContent(w.word)) score += 0.2;
    if (score >= 1) out.push({ i, t: w.start, end: w.end, word: w.word.replace(/[^\w$%'-]/g, ''), score: Math.round(score * 100) / 100 });
  });
  return out;
}
