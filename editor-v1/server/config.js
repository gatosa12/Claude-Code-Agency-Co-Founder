// Server-side configuration. Everything secret is read from the environment here and
// nowhere else; nothing in this module is ever serialised to the browser except the
// booleans returned by publicCapabilities().
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function firstExisting(candidates) {
  return candidates.find((p) => p && existsSync(p));
}

const defaultPython = firstExisting([
  path.join(homedir(), '.engaging-carousel/venv/bin/python'),
  path.join(ROOT, '.venv/bin/python'),
]) || 'python3';

export const config = {
  root: ROOT,
  port: Number(process.env.PORT || 4317),
  host: process.env.HOST || '127.0.0.1',
  dataDir: path.resolve(process.env.EDITOR_DATA_DIR || path.join(ROOT, 'data')),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 2048) * 1024 * 1024,
  ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg',
  ffprobe: process.env.FFPROBE_PATH || 'ffprobe',
  python: process.env.WHISPER_PYTHON || defaultPython,
  whisperModel: process.env.WHISPER_MODEL || 'small.en',
  fontsDir: process.env.EDITOR_FONTS_DIR || firstExisting(['/usr/share/fonts/opentype/inter', '/usr/share/fonts']) || '',
  captionFont: process.env.EDITOR_CAPTION_FONT || 'Inter',
  // Secrets: server-side only.
  keys: {
    pexels: process.env.PEXELS_API_KEY || '',
    pixabay: process.env.PIXABAY_API_KEY || '',
  },
  userAgent: process.env.MEDIA_USER_AGENT || 'EditorV1/0.1 (self-hosted video editor; https://github.com/)',
};

/** What the UI may know: which providers are usable, never the keys themselves. */
export function publicCapabilities() {
  return {
    providers: {
      pexels: Boolean(config.keys.pexels),
      pixabay: Boolean(config.keys.pixabay),
      wikimedia: true,
    },
    whisperModel: config.whisperModel,
  };
}
