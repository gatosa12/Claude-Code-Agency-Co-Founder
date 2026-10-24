// End to end on synthetic footage (no network, no Whisper needed): upload → frame/audio
// analysis → plan → preview render, plus the API's secret-handling and path guards.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const dataDir = await mkdtemp(path.join(tmpdir(), 'editor-v1-test-'));
process.env.EDITOR_DATA_DIR = dataDir;
process.env.PEXELS_API_KEY = 'sk-test-secret-should-never-leak';
process.env.WHISPER_PYTHON = '/nonexistent/python'; // force the no-speech path

const { createApp } = await import('../server/index.js');
const { ffmpeg, probe } = await import('../server/lib/proc.js');

let server;
let base;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.close();
  await rm(dataDir, { recursive: true, force: true });
});

async function waitJob(id) {
  for (let i = 0; i < 600; i++) {
    const j = await (await fetch(`${base}/api/jobs/${id}`)).json();
    if (j.state === 'done') return j;
    if (j.state === 'error') throw new Error(j.error);
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('job timeout');
}

test('capabilities never expose API keys', async () => {
  const text = await (await fetch(`${base}/api/capabilities`)).text();
  assert.ok(!text.includes('sk-test-secret'), 'key leaked');
  assert.equal(JSON.parse(text).providers.pexels, true);
});

test('security headers are set', async () => {
  const res = await fetch(`${base}/`);
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('full pipeline on synthetic footage renders a video', { timeout: 240000 }, async () => {
  // 6 s: three hard colour cuts with motion, and a tone with a gap.
  const clip = path.join(dataDir, 'synthetic.mp4');
  await ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=2',
    '-f', 'lavfi', '-i', 'mandelbrot=size=640x360:rate=30,trim=duration=2',
    '-f', 'lavfi', '-i', 'smptebars=size=640x360:rate=30:duration=2',
    '-f', 'lavfi', '-i', "aevalsrc='0.4*sin(2*PI*440*t)*gt(mod(t,2),0.6)':d=6:s=48000",
    '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0,format=yuv420p[v]',
    '-map', '[v]', '-map', '3:a', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', clip,
  ]);

  const fd = new FormData();
  fd.append('video', new Blob([await (await import('node:fs/promises')).readFile(clip)]), 'synthetic.mp4');
  const up = await fetch(`${base}/api/projects`, { method: 'POST', body: fd });
  assert.equal(up.status, 201);
  const project = await up.json();

  const s = await fetch(`${base}/api/projects/${project.id}/settings`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ format: '9:16', intensity: 'hype' }),
  });
  assert.equal((await s.json()).settings.format, '9:16');

  const job = await (await fetch(`${base}/api/projects/${project.id}/auto-edit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json();
  await waitJob(job.id);

  const analysis = await (await fetch(`${base}/api/projects/${project.id}/analysis`)).json();
  assert.ok(analysis.frames.stats.frames >= 170, 'every frame scanned');
  assert.ok(analysis.frames.cuts.length >= 2, `cuts: ${JSON.stringify(analysis.frames.cuts)}`);
  assert.ok(analysis.audio.silences.length >= 1);
  assert.equal(analysis.whisperMissing, true);

  const p = await (await fetch(`${base}/api/projects/${project.id}`)).json();
  const types = new Set(p.edl.events.map((e) => e.type));
  assert.ok(types.has('transition') && types.has('sfx') && types.has('zoom'), [...types].join());

  // Add a title via the EDL endpoint, then render.
  p.edl.events.push({ id: 'title-test', type: 'title', start: 1, end: 2, text: 'HELLO', style: 'pop' });
  const put = await fetch(`${base}/api/projects/${project.id}/edl`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p.edl) });
  assert.equal(put.status, 200);

  const rj = await (await fetch(`${base}/api/projects/${project.id}/render`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"quality":"preview"}' })).json();
  const done = await waitJob(rj.id);
  const out = path.join(dataDir, 'projects', project.id, done.result.file);
  const info = await probe(out);
  assert.equal(info.width, 540);
  assert.equal(info.height, 960);
  assert.ok(Math.abs(info.duration - 6) < 0.2, `duration ${info.duration}`);
  assert.ok(info.hasAudio);

  const dl = await fetch(`${base}/api/projects/${project.id}/files/${done.result.file}`);
  assert.equal(dl.status, 200);

  // Guards
  assert.equal((await fetch(`${base}/api/projects/${project.id}/files/project.json`)).status, 404);
  assert.equal((await fetch(`${base}/api/projects/${project.id}/files/media/..%2F..%2Fproject.json`)).status, 404);
  assert.equal((await fetch(`${base}/api/projects/not-a-uuid`)).status, 400);
  const bogus = await fetch(`${base}/api/projects/${project.id}/media/fetch`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"resultId":"https://evil.example/x"}' });
  assert.equal(bogus.status, 410);
});
