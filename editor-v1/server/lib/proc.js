// Child-process helpers for ffmpeg, ffprobe and Python. Arguments are always passed as
// arrays (never through a shell), so file names and user text cannot inject commands.
import { spawn } from 'node:child_process';
import { config } from '../config.js';

export function run(cmd, args, { onStderrLine, onStdout, input, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [];
    let err = '';
    let partial = '';
    child.stdout.on('data', (d) => (onStdout ? onStdout(d) : out.push(d)));
    child.stderr.on('data', (d) => {
      const s = d.toString();
      err = (err + s).slice(-20000);
      if (!onStderrLine) return;
      partial += s;
      const lines = partial.split(/\r|\n/);
      partial = lines.pop();
      for (const line of lines) if (line) onStderrLine(line);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout: Buffer.concat(out), stderr: err });
      else reject(new Error(`${cmd} exited with ${code}: ${err.split('\n').slice(-8).join('\n')}`));
    });
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

export const ffmpeg = (args, opts) => run(config.ffmpeg, ['-hide_banner', '-nostdin', '-y', ...args], opts);

export async function probe(file) {
  const { stdout } = await run(config.ffprobe, [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file,
  ]);
  const info = JSON.parse(stdout.toString());
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  if (!v) throw new Error('No video stream found in this file.');
  const [num, den] = (v.avg_frame_rate || v.r_frame_rate || '30/1').split('/').map(Number);
  let fps = den ? num / den : 30;
  if (!Number.isFinite(fps) || fps <= 0 || fps > 240) fps = 30;
  // Phone footage stores portrait as landscape + rotation metadata.
  const rot = Math.abs(Number(v.tags?.rotate || v.side_data_list?.find((s) => s.rotation !== undefined)?.rotation || 0));
  const swap = rot === 90 || rot === 270;
  return {
    duration: Number(info.format.duration || v.duration || 0),
    width: swap ? v.height : v.width,
    height: swap ? v.width : v.height,
    fps: Math.round(fps * 1000) / 1000,
    hasAudio: Boolean(a),
    videoCodec: v.codec_name,
    audioCodec: a?.codec_name || null,
    sizeBytes: Number(info.format.size || 0),
  };
}

/** Parses ffmpeg's "time=00:00:12.34" progress lines into seconds. */
export function parseProgressTime(line) {
  const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(line);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}
