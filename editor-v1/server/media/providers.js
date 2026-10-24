// Stock media search. All provider calls happen here, on the server, with keys read from
// the environment; the browser only ever sees normalised results (thumbnail, size, credit)
// and an opaque result id. Downloads go by that id, never by a URL the client supplies,
// so the endpoint can't be abused to fetch arbitrary hosts (SSRF) or leak a keyed URL.
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from '../config.js';

const RESULT_TTL = 60 * 60 * 1000;
const results = new Map(); // id → { result, downloadUrl, expires }
const ALLOWED_DOWNLOAD_HOSTS = [/\.pexels\.com$/, /\.pixabay\.com$/, /^pixabay\.com$/, /^(upload|thumb)\.wikimedia\.org$/, /\.vimeocdn\.com$/];
const MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;

function remember(result, downloadUrl) {
  const id = randomUUID();
  results.set(id, { result: { ...result, id }, downloadUrl, expires: Date.now() + RESULT_TTL });
  return { ...result, id };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of results) if (v.expires < now) results.delete(k);
}, 10 * 60 * 1000).unref();

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': config.userAgent, ...headers }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${new URL(url).hostname} responded ${res.status}`);
  return res.json();
}

function pickVideoFile(files, orientation) {
  const usable = files.filter((f) => /mp4/.test(f.file_type || 'video/mp4') && f.width && f.height);
  const target = orientation === 'portrait' ? 1080 : 1920;
  usable.sort((a, b) => Math.abs(Math.max(a.width, a.height) - target) - Math.abs(Math.max(b.width, b.height) - target));
  return usable[0];
}

const providers = {
  async pexels(query, { kind, orientation, perPage }) {
    if (!config.keys.pexels) return [];
    const headers = { Authorization: config.keys.pexels };
    const q = new URLSearchParams({ query, per_page: String(perPage), orientation });
    if (kind === 'video') {
      const data = await getJson(`https://api.pexels.com/videos/search?${q}`, headers);
      return data.videos.map((v) => {
        const file = pickVideoFile(v.video_files || [], orientation);
        if (!file) return null;
        return remember({
          provider: 'pexels', kind: 'video', thumb: v.image, width: file.width, height: file.height, duration: v.duration,
          credit: `${v.user?.name || 'Pexels'} / Pexels`, license: 'Pexels License', sourcePage: v.url,
        }, file.link);
      }).filter(Boolean);
    }
    const data = await getJson(`https://api.pexels.com/v1/search?${q}`, headers);
    return data.photos.map((p) => remember({
      provider: 'pexels', kind: 'image', thumb: p.src.medium, width: p.width, height: p.height,
      credit: `${p.photographer} / Pexels`, license: 'Pexels License', sourcePage: p.url,
    }, p.src.large2x || p.src.original));
  },

  async pixabay(query, { kind, orientation, perPage }) {
    if (!config.keys.pixabay) return [];
    const q = new URLSearchParams({ key: config.keys.pixabay, q: query, per_page: String(Math.max(3, perPage)), safesearch: 'true' });
    if (kind === 'video') {
      const data = await getJson(`https://pixabay.com/api/videos/?${q}`);
      return data.hits.map((h) => {
        const v = h.videos.large?.url ? h.videos.large : h.videos.medium;
        if (!v?.url) return null;
        return remember({
          provider: 'pixabay', kind: 'video', thumb: v.thumbnail || h.videos.tiny?.thumbnail || '', width: v.width, height: v.height, duration: h.duration,
          credit: `${h.user} / Pixabay`, license: 'Pixabay Content License', sourcePage: h.pageURL,
        }, v.url);
      }).filter(Boolean);
    }
    q.set('image_type', 'photo');
    if (orientation !== 'square') q.set('orientation', orientation === 'portrait' ? 'vertical' : 'horizontal');
    const data = await getJson(`https://pixabay.com/api/?${q}`);
    return data.hits.map((h) => remember({
      provider: 'pixabay', kind: 'image', thumb: h.webformatURL, width: h.imageWidth, height: h.imageHeight,
      credit: `${h.user} / Pixabay`, license: 'Pixabay Content License', sourcePage: h.pageURL,
    }, h.largeImageURL));
  },

  async wikimedia(query, { kind, perPage }) {
    if (kind === 'video') return [];
    const q = new URLSearchParams({
      action: 'query', format: 'json', generator: 'search', gsrsearch: `filetype:bitmap filemime:image/jpeg ${query}`, gsrnamespace: '6',
      gsrlimit: String(perPage), prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1600', origin: '*',
    });
    const data = await getJson(`https://commons.wikimedia.org/w/api.php?${q}`);
    const pages = Object.values(data.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    return pages.map((p) => {
      const ii = p.imageinfo?.[0];
      // Photos only: PNGs on Commons are mostly diagrams, logos and text graphics.
      if (!ii || ii.mime !== 'image/jpeg' || ii.width < 800) return null;
      const meta = ii.extmetadata || {};
      const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').trim().slice(0, 120);
      return remember({
        provider: 'wikimedia', kind: 'image', thumb: (ii.thumburl || ii.url).replace(/\/\d+px-/, '/500px-'), width: ii.width, height: ii.height,
        credit: `${strip(meta.Artist?.value) || 'Wikimedia Commons'} / Wikimedia Commons`,
        license: strip(meta.LicenseShortName?.value) || 'see source', sourcePage: ii.descriptionurl,
      }, ii.thumburl || ii.url);
    }).filter(Boolean);
  },
};

export const PROVIDER_NAMES = Object.keys(providers);

/** Searches the enabled providers in order and returns merged, normalised results. */
export async function searchMedia(query, { kind = 'image', orientation = 'landscape', perPage = 8, order = PROVIDER_NAMES } = {}) {
  const q = String(query || '').trim().slice(0, 100);
  if (!q) return { results: [], errors: [] };
  const errors = [];
  const settled = await Promise.all(order.filter((p) => providers[p]).map(async (name) => {
    try {
      return await providers[name](q, { kind, orientation, perPage });
    } catch (err) {
      errors.push({ provider: name, error: err.message });
      return [];
    }
  }));
  return { results: settled.flat(), errors };
}

export function getResult(id) {
  const r = results.get(id);
  return r && r.expires > Date.now() ? r : null;
}

/** Downloads a remembered search result into `destBase` (+ extension). Returns the file path. */
export async function downloadResult(id, destBase) {
  const entry = getResult(id);
  if (!entry) throw Object.assign(new Error('Search result expired, search again'), { status: 410 });
  const url = new URL(entry.downloadUrl);
  if (url.protocol !== 'https:' || !ALLOWED_DOWNLOAD_HOSTS.some((re) => re.test(url.hostname))) {
    throw Object.assign(new Error('Download host not allowed'), { status: 400 });
  }
  const res = await fetch(url, { headers: { 'User-Agent': config.userAgent }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const type = res.headers.get('content-type') || '';
  const ext = entry.result.kind === 'video' ? '.mp4' : /png/.test(type) ? '.png' : /webp/.test(type) ? '.webp' : '.jpg';
  const tmp = `${destBase}.part`;
  let bytes = 0;
  const guard = new TransformStream({
    transform(chunk, ctl) {
      bytes += chunk.byteLength;
      if (bytes > MAX_DOWNLOAD_BYTES) ctl.error(new Error('File too large'));
      else ctl.enqueue(chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(res.body.pipeThrough(guard)), createWriteStream(tmp));
    await rename(tmp, destBase + ext);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
  return { file: destBase + ext, result: entry.result };
}

/** Test hook: lets tests register a fake result without a network call. */
export function _rememberForTest(result, downloadUrl) {
  return remember(result, downloadUrl);
}
