import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { ffmpeg, run } from '../lib/proc.js';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'transcribe.py');

export async function whisperAvailable() {
  try {
    await run(config.python, ['-c', 'import faster_whisper']);
    return true;
  } catch {
    return false;
  }
}

/** Returns { language, segments, words } or null when the clip has no audio / Whisper is missing. */
export async function transcribe(src, workDir, hasAudio, onProgress = () => {}) {
  if (!hasAudio) return null;
  if (!(await whisperAvailable())) return { unavailable: true, segments: [], words: [] };
  const wav = path.join(workDir, 'speech.wav');
  await ffmpeg(['-i', src, '-vn', '-ac', '1', '-ar', '16000', wav]);
  const out = path.join(workDir, 'transcript.json');
  await run(config.python, ['-I', SCRIPT, wav, config.whisperModel, out], {
    onStderrLine: (line) => {
      const m = /^PROGRESS ([\d.]+)/.exec(line);
      if (m) onProgress(Number(m[1]));
    },
  });
  return JSON.parse(await readFile(out, 'utf8'));
}
