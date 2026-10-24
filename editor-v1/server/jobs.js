// In-memory job runner with progress broadcast over Server-Sent Events.
// One job per project at a time; the UI subscribes to /api/jobs/:id/events.
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

const jobs = new Map();
const activeByProject = new Map();

export function getJob(id) {
  return jobs.get(id);
}

export function activeJob(projectId) {
  const id = activeByProject.get(projectId);
  return id ? jobs.get(id) : null;
}

function publicJob(job) {
  const { emitter, ...rest } = job;
  return rest;
}

export function startJob(projectId, kind, work) {
  const running = activeJob(projectId);
  if (running && running.state === 'running') {
    throw Object.assign(new Error(`A ${running.kind} job is already running for this project`), { status: 409 });
  }
  const job = {
    id: randomUUID(), projectId, kind, state: 'running', stage: 'queued', progress: 0,
    message: '', error: null, result: null, startedAt: Date.now(), log: [],
    emitter: new EventEmitter(),
  };
  jobs.set(job.id, job);
  activeByProject.set(projectId, job.id);

  const report = (stage, progress, message = '') => {
    job.stage = stage;
    job.progress = Math.max(0, Math.min(1, progress));
    job.message = message;
    if (message) job.log.push({ t: Date.now(), stage, message });
    job.emitter.emit('update', publicJob(job));
  };

  Promise.resolve()
    .then(() => work(report))
    .then((result) => {
      job.state = 'done'; job.progress = 1; job.result = result ?? null; job.stage = 'done';
    })
    .catch((err) => {
      job.state = 'error'; job.error = err.message || String(err);
      console.error(`[job ${kind}]`, err);
    })
    .finally(() => {
      job.finishedAt = Date.now();
      job.emitter.emit('update', publicJob(job));
      // Keep finished jobs around briefly for late subscribers.
      setTimeout(() => jobs.delete(job.id), 30 * 60 * 1000).unref();
    });

  return publicJob(job);
}

export function streamJob(job, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const send = (j) => res.write(`data: ${JSON.stringify(j)}\n\n`);
  send(publicJob(job));
  if (job.state !== 'running') return res.end();
  const onUpdate = (j) => {
    send(j);
    if (j.state !== 'running') { cleanup(); res.end(); }
  };
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  const cleanup = () => { clearInterval(ping); job.emitter.off('update', onUpdate); };
  job.emitter.on('update', onUpdate);
  res.on('close', cleanup);
}

export { publicJob };
