// Right-hand panel: per-event inspector (with server-side stock search for B-roll),
// analysis read-out and render history. All user/transcript text goes in via textContent.
import { api } from './api.js';
import { fmtTime } from './plan.js';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}

const select = (value, options, onchange) => h('select', { onchange: (e) => onchange(e.target.value) },
  options.map(([v, label]) => { const o = h('option', { value: v }, label); if (v === value) o.selected = true; return o; }));
const numberInput = (value, step, onchange, min = 0, max = 9999) => h('input', { type: 'number', value, step, min, max, onchange: (e) => onchange(Number(e.target.value)) });
const field = (label, input) => h('div', {}, h('label', {}, label), input);

const TYPE_LABEL = { broll: 'B-roll', zoom: 'Camera move', transition: 'Transition', title: 'Animated title', sfx: 'Sound effect' };
const TYPE_COLOR = { broll: 'var(--magenta)', zoom: 'var(--cyan)', transition: 'var(--lime)', title: 'var(--red)', sfx: 'var(--amber)' };

export function renderInspector(root, state, ev, { onChange, onDelete, onSeek, toast, caps }) {
  root.innerHTML = '';
  if (!ev) {
    root.append(h('p', { class: 'muted' }, state.project?.edl
      ? 'Select anything on the timeline to inspect and tweak it. Drag blocks to move them, drag their edges to trim. Delete key disables / enables.'
      : 'Run Auto-Edit to generate an edit plan.'));
    return;
  }
  const change = (patch) => { Object.assign(ev, patch); onChange(ev); };
  const timing = ev.t !== undefined
    ? h('div', { class: 'row' }, field('Time (s)', numberInput(ev.t, 0.01, (v) => change({ t: v }))), h('div'))
    : h('div', { class: 'row' }, field('Start (s)', numberInput(ev.start, 0.01, (v) => change({ start: v }))), field('End (s)', numberInput(ev.end, 0.01, (v) => change({ end: v }))));

  root.append(
    h('h3', {}, h('span', { class: 'dot', style: `background:${TYPE_COLOR[ev.type]};box-shadow:0 0 10px ${TYPE_COLOR[ev.type]}` }), TYPE_LABEL[ev.type] || ev.type),
    h('p', { class: 'sub mono' }, `${fmtTime(ev.start ?? ev.t)}${ev.end ? ` → ${fmtTime(ev.end)}` : ''} · ${ev.id}`),
    timing,
  );

  if (ev.type === 'broll') renderBroll(root, state, ev, { change, toast });
  if (ev.type === 'zoom') {
    root.append(h('div', { class: 'row' },
      field('Move', select(ev.kind, [['punch', 'Punch-in (eased)'], ['jump', 'Jump zoom (cut)'], ['push', 'Slow push']], (v) => change({ kind: v }))),
      field('Scale', numberInput(ev.scale, 0.01, (v) => change({ scale: v }), 1, 1.6))));
    if (ev.word) root.append(h('p', { class: 'muted' }, `Emphasis on “${ev.word}”`));
  }
  if (ev.type === 'transition') {
    root.append(h('div', { class: 'stack' }, field('Style', select(ev.kind, [['flash', 'Light flash'], ['whip', 'Whip blur'], ['zoom', 'Zoom reveal']], (v) => change({ kind: v })))));
  }
  if (ev.type === 'title') {
    root.append(h('div', { class: 'row' },
      field('Text', h('input', { type: 'text', value: ev.text, maxlength: 60, onchange: (e) => change({ text: e.target.value }) })),
      field('Animation', select(ev.style, [['pop', 'Pop (cyan glow)'], ['slam', 'Slam (red)']], (v) => change({ style: v })))));
  }
  if (ev.type === 'sfx') {
    const audio = new Audio();
    root.append(h('div', { class: 'row' },
      field('Sound', select(ev.kind, caps.sfx.map((s) => [s.id, s.label]), (v) => change({ kind: v }))),
      field('Gain', numberInput(ev.gain ?? 1, 0.05, (v) => change({ gain: v }), 0, 2))),
    h('button', { class: 'btn tiny', onclick: () => { audio.src = `/api/sfx/${ev.kind}.wav`; audio.volume = Math.min(1, ev.gain ?? 1); audio.play(); } }, '▶ Audition'));
  }

  root.append(h('div', { class: 'actions' },
    h('button', { class: 'btn tiny', onclick: () => onSeek(Math.max(0, (ev.start ?? ev.t) - 0.5)) }, 'Jump to'),
    h('button', { class: 'btn tiny', onclick: () => change({ enabled: ev.enabled === false }) }, ev.enabled === false ? 'Enable' : 'Disable'),
    h('button', { class: 'btn tiny danger', onclick: () => onDelete(ev) }, 'Delete'),
  ));
}

function renderBroll(root, state, ev, { change, toast }) {
  const asset = state.project.media?.[ev.assetId];
  const pid = state.project.id;
  if (asset) {
    const src = api.file(pid, asset.file);
    root.append(asset.kind === 'video'
      ? h('video', { class: 'asset-preview', src, muted: true, autoplay: true, loop: true, playsinline: true })
      : h('img', { class: 'asset-preview', src, alt: ev.query }));
    const credit = h('p', { class: 'asset-credit' }, `${asset.credit}${asset.license ? ` · ${asset.license}` : ''} `);
    if (/^https:\/\//.test(asset.sourcePage)) credit.append(h('a', { href: asset.sourcePage, target: '_blank', rel: 'noopener noreferrer' }, 'source'));
    root.append(credit);
  } else {
    root.append(h('div', { class: 'warn' }, ev.fetchError ? `No media yet: ${ev.fetchError}` : 'No media assigned yet: search below or upload your own.'));
  }
  if (ev.phrase) root.append(h('p', { class: 'muted' }, h('b', {}, 'Context: '), `“${ev.phrase}”`));

  root.append(h('div', { class: 'row' },
    field('Entrance', select(ev.transitionIn, [['flash', 'Flash cut'], ['pop', 'Pop card'], ['slide', 'Slide in'], ['fade', 'Fade'], ['cut', 'Hard cut']], (v) => change({ transitionIn: v }))),
    field('Motion', select(ev.motion, [['push-in', 'Push in'], ['pull-out', 'Pull out'], ['pan-right', 'Pan right'], ['pan-left', 'Pan left'], ['none', 'Static']], (v) => change({ motion: v })))));

  const q = h('input', { type: 'text', value: ev.query, placeholder: 'Search stock media…' });
  const kind = select('image', [['image', 'Photos'], ['video', 'Clips']], () => {});
  kind.style.width = '92px';
  const grid = h('div', { class: 'results' });
  const status = h('p', { class: 'muted' });

  const showResults = (results) => {
    grid.innerHTML = '';
    for (const r of results) {
      const btn = h('button', { title: `${r.credit || r.provider}` }, h('img', { src: r.thumb, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }), h('span', { class: 'badge' }, r.kind === 'video' ? `▶ ${r.provider}` : r.provider));
      btn.addEventListener('click', async () => {
        btn.classList.add('busy');
        status.textContent = 'Downloading to the project…';
        try {
          const out = await api.fetchMedia(pid, r.id, ev.id, q.value);
          state.project.media[out.assetId] = out.asset;
          change({ assetId: out.assetId, query: q.value });
          toast('B-roll swapped');
        } catch (err) {
          status.textContent = err.message;
          btn.classList.remove('busy');
        }
      });
      grid.append(btn);
    }
  };

  const doSearch = async () => {
    status.textContent = 'Searching…';
    grid.innerHTML = '';
    try {
      const { results, errors } = await api.search(pid, q.value, kind.value);
      showResults(results);
      status.textContent = results.length ? `${results.length} results` : `No results${errors.length ? ` (${errors.map((e) => e.provider).join(', ')} failed)` : ''}`;
    } catch (err) {
      status.textContent = err.message;
    }
  };
  q.addEventListener('keydown', (e) => e.key === 'Enter' && doSearch());

  const upload = h('input', { type: 'file', accept: 'image/*,video/mp4,video/quicktime,video/webm', hidden: true });
  upload.addEventListener('change', async () => {
    const file = upload.files[0];
    if (!file) return;
    status.textContent = 'Uploading…';
    try {
      const out = await api.upload(`/api/projects/${pid}/media/upload`, 'file', file, { eventId: ev.id });
      state.project.media[out.assetId] = out.asset;
      change({ assetId: out.assetId });
      toast('Your media is in');
    } catch (err) {
      status.textContent = err.message;
    }
  });

  root.append(
    h('div', { class: 'search' }, q, kind, h('button', { class: 'btn tiny', onclick: doSearch }, 'Search')),
    status, grid,
    h('div', { class: 'actions' }, h('button', { class: 'btn tiny', onclick: () => upload.click() }, 'Upload your own'), upload),
  );
  if (ev.candidates?.length) {
    status.textContent = 'Other matches the engine found:';
    showResults(ev.candidates);
  }
}

export function renderAnalysis(root, state, onSeek) {
  root.innerHTML = '';
  const a = state.analysis;
  const p = state.project;
  if (!a || !p) { root.append(h('p', { class: 'muted' }, 'Run Auto-Edit to scan the footage.')); return; }
  const probe = p.source.probe;
  const st = a.frames.stats;
  const count = (type) => p.edl?.events.filter((e) => e.type === type).length || 0;
  root.append(
    h('h3', {}, 'Frame scan'),
    h('p', { class: 'sub' }, `${probe.width}×${probe.height} · ${probe.fps} fps · ${fmtTime(probe.duration)}`),
    h('div', { class: 'stat-grid' },
      stat(st.frames, 'frames analysed'), stat(a.frames.cuts.length, 'hard cuts'),
      stat(a.frames.motionPeaks.length, 'motion peaks'), stat(a.audio?.onsets?.length ?? 0, 'audio hits'),
      stat(Math.round(st.lumaMean), 'mean luma'), stat(Math.round(st.satMean), 'mean saturation'),
      stat(a.transcript?.words?.length ?? 0, 'words heard'), stat(a.audio?.silences?.length ?? 0, 'pauses')),
  );
  if (a.whisperMissing) root.append(h('div', { class: 'warn' }, 'Speech recognition (faster-whisper) is not installed on the server, so B-roll, captions and emphasis were skipped. See README.'));
  if (p.edl) {
    root.append(h('h3', {}, 'Edit plan'), h('div', { class: 'stat-grid' },
      stat(count('broll'), 'B-roll inserts'), stat(count('sfx'), 'sound effects'),
      stat(count('zoom'), 'camera moves'), stat(count('transition'), 'transitions'),
      stat(count('title'), 'animated titles'), stat(p.edl.grade.preset, 'grade')));
  }
  const phrases = p.edl?.context?.phrases || [];
  if (phrases.length) {
    root.append(h('h3', {}, 'Contextual read'), h('p', { class: 'sub' }, 'What was said, and the visual query the engine pulled from it.'));
    root.append(h('ul', { class: 'phrases' }, phrases.map((ph) => h('li', { onclick: () => onSeek(ph.start) },
      h('span', { class: 't' }, fmtTime(ph.start)), ph.query ? h('span', { class: 'q' }, `#${ph.query}`) : null, h('div', {}, ph.text)))));
  }
}

function stat(v, label) {
  return h('div', { class: 'stat' }, h('b', {}, String(v)), h('span', {}, label));
}

export function renderRenders(root, state, onPlay) {
  root.innerHTML = '';
  const list = state.project?.renders || [];
  if (!list.length) { root.append(h('p', { class: 'muted' }, 'Renders appear here. “Preview render” is fast and low-res; “Render final” is full quality.')); return; }
  root.append(h('ul', { class: 'renders' }, list.map((r) => {
    const url = api.file(state.project.id, r.file);
    return h('li', {},
      h('div', {}, h('b', {}, r.quality === 'preview' ? 'Preview' : 'Final cut'), ' ', h('span', { class: 'meta' }, `${r.width}×${r.height} · ${new Date(r.createdAt).toLocaleString()}`)),
      h('div', { class: 'actions' },
        h('button', { class: 'btn tiny', onclick: () => onPlay(url) }, '▶ Watch'),
        h('a', { class: 'btn tiny', href: `${url}?download=1` }, 'Download')),
      r.credits?.length ? h('ul', { class: 'credits' }, r.credits.map((c) => h('li', {}, c))) : null);
  })));
}
