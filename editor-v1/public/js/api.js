// Thin client for the Editor V1 server. The browser never holds API keys: stock searches,
// downloads and renders are all requests to our own /api.

async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data;
}

export const api = {
  capabilities: () => req('GET', '/api/capabilities'),
  projects: () => req('GET', '/api/projects'),
  project: (id) => req('GET', `/api/projects/${id}`),
  deleteProject: (id) => req('DELETE', `/api/projects/${id}`),
  settings: (id, patch) => req('PATCH', `/api/projects/${id}/settings`, patch),
  analysis: (id) => req('GET', `/api/projects/${id}/analysis`),
  saveEdl: (id, edl) => req('PUT', `/api/projects/${id}/edl`, edl),
  autoEdit: (id, force) => req('POST', `/api/projects/${id}/auto-edit`, { force }),
  render: (id, quality) => req('POST', `/api/projects/${id}/render`, { quality }),
  search: (id, query, kind) => req('POST', `/api/projects/${id}/media/search`, { query, kind }),
  fetchMedia: (id, resultId, eventId, query) => req('POST', `/api/projects/${id}/media/fetch`, { resultId, eventId, query }),
  file: (id, rel) => `/api/projects/${id}/files/${rel}`,

  upload(url, field, file, extra = {}, onProgress = () => {}) {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(extra)) fd.append(k, v);
      fd.append(field, file);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText); } catch { /* empty */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || `Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(fd);
    });
  },

  /** Follows a job over SSE; resolves with the final job, rejects on job error. */
  watchJob(jobId, onUpdate) {
    return new Promise((resolve, reject) => {
      const es = new EventSource(`/api/jobs/${jobId}/events`);
      es.onmessage = (m) => {
        const job = JSON.parse(m.data);
        onUpdate(job);
        if (job.state === 'done') { es.close(); resolve(job); }
        if (job.state === 'error') { es.close(); reject(new Error(job.error)); }
      };
      es.onerror = () => {
        es.close();
        // Fall back to one poll so a dropped stream doesn't hang the UI.
        fetch(`/api/jobs/${jobId}`).then((r) => r.json()).then((job) => {
          onUpdate(job);
          if (job.state === 'done') resolve(job);
          else if (job.state === 'error') reject(new Error(job.error));
          else setTimeout(() => this.watchJob(jobId, onUpdate).then(resolve, reject), 1000);
        }).catch(reject);
      };
    });
  },
};
