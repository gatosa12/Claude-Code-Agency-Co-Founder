import { api } from './api.js';
import { h, renderAnalysis, renderInspector, renderRenders } from './inspector.js';
import { activeAt, chunkWords, flashAt, fmtTime, startOf, whipAt, zoomAt } from './plan.js';
import { createTimeline } from './timeline.js';

const $ = (id) => document.getElementById(id);
const state = { caps: null, project: null, analysis: null, selected: null, view: 'plan', busy: false };

const video = $('video');
const renderVideo = $('renderVideo');
let chunks = [];

// ---------- toast ----------
let toastTimer;
function toast(msg, err = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast show${err ? ' err' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), err ? 5000 : 2200);
}

// ---------- timeline ----------
const timeline = createTimeline(state, {
  onSeek: (t) => seek(t),
  onSelect: (id) => select(id),
  onChange: (ev) => { normalise(ev); markDirty(); timeline.renderTracks(); if (state.selected === ev.id) refreshInspector(); },
});

function normalise(ev) {
  const d = state.project.source.probe.duration;
  if (ev.start !== undefined) {
    ev.start = Math.max(0, Math.min(d - 0.1, ev.start));
    ev.end = Math.max(ev.start + 0.1, Math.min(d, ev.end));
  }
  if (ev.t !== undefined) ev.t = Math.max(0, Math.min(d, ev.t));
  state.project.edl.events.sort((a, b) => startOf(a) - startOf(b));
}

// ---------- saving ----------
let saveTimer;
function markDirty() {
  const s = $('saveState');
  s.textContent = '● unsaved';
  s.className = 'save dirty';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveEdl, 600);
}
async function saveEdl() {
  if (!state.project?.edl) return;
  try {
    state.project.edl = await api.saveEdl(state.project.id, state.project.edl);
    $('saveState').textContent = '✓ saved';
    $('saveState').className = 'save';
    rebuildChunks();
  } catch (err) {
    toast(`Save failed: ${err.message}`, true);
  }
}

// ---------- selection / inspector ----------
function select(id) {
  state.selected = id;
  timeline.renderTracks();
  switchTab('inspect');
  refreshInspector();
}
function refreshInspector() {
  const ev = state.project?.edl?.events.find((e) => e.id === state.selected) || null;
  renderInspector($('tab-inspect'), state, ev, {
    caps: state.caps,
    toast,
    onSeek: seek,
    onChange: (e) => { normalise(e); markDirty(); timeline.renderTracks(); refreshInspector(); },
    onDelete: (e) => {
      state.project.edl.events = state.project.edl.events.filter((x) => x !== e);
      state.selected = null;
      markDirty(); timeline.renderTracks(); refreshInspector();
    },
  });
}
function switchTab(t) {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
  for (const k of ['inspect', 'analysis', 'renders']) $(`tab-${k}`).hidden = k !== t;
  if (t === 'analysis') renderAnalysis($('tab-analysis'), state, seek);
  if (t === 'renders') renderRenders($('tab-renders'), state, playRender);
}
$('tabs').addEventListener('click', (e) => e.target.dataset.t && switchTab(e.target.dataset.t));

// ---------- projects ----------
async function refreshProjects() {
  const list = await api.projects();
  const ul = $('projects');
  ul.innerHTML = '';
  for (const p of list) {
    const li = h('li', { class: p.id === state.project?.id ? 'on' : '' },
      h('span', { class: 'pname' }, p.name),
      h('span', { class: 'pmeta' }, fmtTime(p.duration)),
      h('button', { class: 'del', title: 'Delete project', 'aria-label': 'Delete project' }, '✕'));
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('del')) {
        if (confirm(`Delete “${p.name}” and all its renders?`)) api.deleteProject(p.id).then(() => { if (state.project?.id === p.id) location.hash = ''; refreshProjects(); });
        return;
      }
      openProject(p.id);
    });
    ul.append(li);
  }
}

async function openProject(id) {
  try {
    state.project = await api.project(id);
  } catch (err) {
    toast(err.message, true);
    return;
  }
  location.hash = id;
  state.selected = null;
  state.analysis = await api.analysis(id).catch(() => null);
  $('projectName').value = state.project.name;
  $('projectName').disabled = false;
  $('emptyStage').hidden = true;
  video.src = api.file(id, state.project.source.file);
  setStageAspect();
  applySettingsUI();
  rebuildChunks();
  timeline.fitZoom();
  timeline.render();
  refreshInspector();
  updateButtons();
  refreshProjects();
  switchTab(state.project.edl ? 'inspect' : 'analysis');
  if (state.project.job) followJob(state.project.job.id, state.project.job.kind);
  setPill();
}

function setStageAspect() {
  const p = state.project;
  const f = p.settings.format;
  const ratio = f === 'source' ? `${p.source.probe.width} / ${p.source.probe.height}` : f.replace(':', ' / ');
  $('stage').style.aspectRatio = ratio;
  const [w, hgt] = ratio.split(' / ').map(Number);
  $('captionLayer').classList.toggle('portrait', hgt > w);
}

function setPill() {
  const pill = $('statusPill');
  if (state.busy) { pill.textContent = 'working'; pill.className = 'pill busy'; return; }
  pill.textContent = state.project ? state.project.status : 'online';
  pill.className = 'pill live';
}

function updateButtons() {
  const has = Boolean(state.project);
  $('btnAuto').disabled = !has || state.busy;
  $('btnRender').disabled = !state.project?.edl || state.busy;
  $('btnPreviewRender').disabled = !state.project?.edl || state.busy;
}

// ---------- upload ----------
const drop = $('drop');
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => e.dataTransfer.files[0] && uploadVideo(e.dataTransfer.files[0]));
$('fileInput').addEventListener('change', (e) => e.target.files[0] && uploadVideo(e.target.files[0]));

async function uploadVideo(file) {
  const bar = $('uploadBar');
  bar.hidden = false;
  try {
    const p = await api.upload('/api/projects', 'video', file, {}, (f) => (bar.firstElementChild.style.width = `${f * 100}%`));
    toast('Footage ingested. Running the engine…');
    await openProject(p.id);
    runAutoEdit();
  } catch (err) {
    toast(err.message, true);
  } finally {
    bar.hidden = true;
    bar.firstElementChild.style.width = '0';
    $('fileInput').value = '';
  }
}

// ---------- settings ----------
function applySettingsUI() {
  const s = state.project.settings;
  document.querySelectorAll('#intensity button').forEach((b) => b.classList.toggle('on', b.dataset.v === s.intensity));
  document.querySelectorAll('#modules input').forEach((i) => (i.checked = s.modules[i.dataset.m]));
  $('format').value = s.format;
  $('captionStyle').value = s.captionStyle;
  $('gradeStrength').value = s.gradeStrength;
  $('gradeStrengthOut').value = Math.round(s.gradeStrength * 100);
  document.querySelectorAll('.grade').forEach((g) => g.classList.toggle('on', g.dataset.v === s.grade));
  $('gradeHint').textContent = s.grade === 'auto' && state.project.edl ? `→ ${state.project.edl.grade.preset}` : '';
  applyGradePreview();
}

async function patchSettings(patch, { regrade = false } = {}) {
  if (!state.project) return;
  try {
    state.project = { ...state.project, ...(await api.settings(state.project.id, patch)) };
    if (regrade && state.project.edl) {
      const g = state.project.settings.grade;
      state.project.edl.grade = { preset: g === 'auto' ? state.project.edl.grade.preset : g, strength: state.project.settings.gradeStrength };
      markDirty();
    }
    if (patch.captionStyle && state.project.edl) { state.project.edl.captions.style = patch.captionStyle; rebuildChunks(); markDirty(); }
    if (patch.modules?.captions !== undefined && state.project.edl) { state.project.edl.captions.enabled = patch.modules.captions && state.project.edl.captions.words.length > 0; markDirty(); timeline.renderTracks(); }
    applySettingsUI();
    setStageAspect();
  } catch (err) {
    toast(err.message, true);
  }
}

$('intensity').addEventListener('click', (e) => e.target.dataset.v && patchSettings({ intensity: e.target.dataset.v }));
$('modules').addEventListener('change', (e) => patchSettings({ modules: { [e.target.dataset.m]: e.target.checked } }));
$('format').addEventListener('change', (e) => patchSettings({ format: e.target.value }));
$('captionStyle').addEventListener('change', (e) => patchSettings({ captionStyle: e.target.value }));
$('gradeStrength').addEventListener('input', (e) => ($('gradeStrengthOut').value = Math.round(e.target.value * 100)));
$('gradeStrength').addEventListener('change', (e) => patchSettings({ gradeStrength: Number(e.target.value) }, { regrade: true }));
$('projectName').addEventListener('change', (e) => patchSettings({ name: e.target.value }).then(refreshProjects));

function buildGrades() {
  const g = $('grades');
  const swatch = { auto: 'conic-gradient(from 90deg, #00f2ff, #ff2bd6, #b6ff3b, #00f2ff)' };
  const presets = [{ id: 'auto', label: 'Auto', css: '' }, ...state.caps.presets];
  for (const p of presets) {
    const b = h('button', { class: 'grade', 'data-v': p.id, title: p.desc || 'Pick a look from the footage' }, h('span', {}, p.label));
    if (swatch[p.id]) b.style.background = swatch[p.id];
    else b.style.filter = p.css;
    b.addEventListener('click', () => patchSettings({ grade: p.id }, { regrade: true }));
    g.append(b);
  }
  $('format').append(...state.caps.formats.map((f) => h('option', { value: f }, f === 'source' ? 'Source' : f)));
  const pv = state.caps.providers;
  $('providers').append('Stock: ', ...Object.entries(pv).flatMap(([k, ok], i) => [i ? ' · ' : '', h('b', { class: ok ? 'ok' : 'no', title: ok ? 'enabled' : 'add a key in .env' }, k)]));
}

function applyGradePreview() {
  const preset = state.project?.edl?.grade?.preset || (state.project?.settings.grade !== 'auto' ? state.project?.settings.grade : 'teal-orange');
  const css = state.caps.presets.find((p) => p.id === preset)?.css || '';
  const on = state.view === 'plan' && (state.project?.settings.gradeStrength ?? 1) > 0.05;
  $('cam').style.filter = on ? css : '';
  $('brollLayer').style.filter = on ? css : '';
}

// ---------- jobs ----------
async function runAutoEdit() {
  if (!state.project) return;
  try {
    await saveEdl();
    const job = await api.autoEdit(state.project.id, $('forceAnalyse').checked);
    $('forceAnalyse').checked = false;
    await followJob(job.id, 'auto-edit');
  } catch (err) {
    toast(err.message, true);
  }
}

async function runRender(quality) {
  try {
    clearTimeout(saveTimer);
    await saveEdl();
    const job = await api.render(state.project.id, quality);
    await followJob(job.id, 'render');
  } catch (err) {
    toast(err.message, true);
  }
}

async function followJob(jobId, kind) {
  state.busy = true;
  updateButtons(); setPill();
  $('job').hidden = false;
  const pid = state.project.id;
  try {
    await api.watchJob(jobId, (j) => {
      $('jobStage').textContent = j.stage;
      $('jobBar').style.width = `${Math.round(j.progress * 100)}%`;
      if (j.message) $('jobMsg').textContent = j.message;
    });
    if (state.project?.id !== pid) return;
    state.project = await api.project(pid);
    if (kind === 'auto-edit') {
      state.analysis = await api.analysis(pid).catch(() => null);
      rebuildChunks();
      timeline.render();
      applySettingsUI();
      switchTab('analysis');
      toast(`Edit plan ready: ${state.project.edl.events.length} decisions. Press play.`);
    } else {
      switchTab('renders');
      toast('Render complete');
      playRender(api.file(pid, state.project.renders[0].file));
    }
  } catch (err) {
    toast(err.message, true);
  } finally {
    state.busy = false;
    $('job').hidden = true;
    updateButtons(); setPill();
  }
}

$('btnAuto').addEventListener('click', runAutoEdit);
$('btnRender').addEventListener('click', () => runRender('final'));
$('btnPreviewRender').addEventListener('click', () => runRender('preview'));

// ---------- add events ----------
document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
  const edl = state.project?.edl;
  if (!edl) return toast('Run Auto-Edit first', true);
  const t = Math.round(video.currentTime * 100) / 100;
  const d = state.project.source.probe.duration;
  const id = `${b.dataset.add}-u${Date.now().toString(36)}`;
  const span = { start: t, end: Math.min(d, t + 1.5) };
  const ev = {
    broll: { id, type: 'broll', enabled: true, ...span, query: '', keywords: [], phrase: '', transitionIn: 'flash', motion: 'push-in', assetId: null },
    zoom: { id, type: 'zoom', enabled: true, ...span, kind: 'punch', scale: 1.15 },
    title: { id, type: 'title', enabled: true, start: t, end: Math.min(d, t + 1.1), text: 'WOW', style: 'pop' },
    sfx: { id, type: 'sfx', enabled: true, t, kind: 'whoosh', gain: 1 },
  }[b.dataset.add];
  edl.events.push(ev);
  normalise(ev);
  markDirty();
  select(id);
}));

// ---------- preview ----------
$('viewMode').addEventListener('click', (e) => {
  const v = e.target.dataset.v;
  if (!v) return;
  if (v === 'render') {
    const r = state.project?.renders?.[0];
    if (!r) return toast('No render yet', true);
    playRender(api.file(state.project.id, r.file));
    return;
  }
  setView(v);
});
function setView(v) {
  state.view = v;
  document.querySelectorAll('#viewMode button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  renderVideo.hidden = v !== 'render';
  if (v !== 'render') renderVideo.pause();
  applyGradePreview();
}
function playRender(url) {
  setView('render');
  video.pause();
  renderVideo.src = url;
  renderVideo.play().catch(() => {});
}

function rebuildChunks() {
  const c = state.project?.edl?.captions;
  chunks = c?.enabled ? chunkWords(c.words, c.style) : [];
}

const brollCache = new Map();
let shownBroll = '';
let shownTitle = '';
let shownCaption = '';
function drawOverlays(t) {
  const edl = state.project?.edl;
  const plan = state.view === 'plan' && edl;
  const events = plan ? edl.events : [];

  $('cam').style.transform = plan ? `scale(${zoomAt(t, events).toFixed(4)})` : '';
  $('flash').style.opacity = plan ? flashAt(t, events) : 0;
  video.style.filter = plan && whipAt(t, events) ? 'blur(6px)' : '';

  // B-roll
  const b = plan ? activeAt(t, events, 'broll').find((e) => state.project.media?.[e.assetId]) : null;
  const key = b ? `${b.id}:${b.assetId}:${b.transitionIn}` : '';
  if (key !== shownBroll) {
    shownBroll = key;
    const layer = $('brollLayer');
    layer.innerHTML = '';
    if (b) {
      const asset = state.project.media[b.assetId];
      const src = api.file(state.project.id, asset.file);
      let el = brollCache.get(src);
      if (!el) {
        el = asset.kind === 'video' ? h('video', { src, muted: true, loop: true, playsinline: true }) : h('img', { src, alt: '' });
        brollCache.set(src, el);
      }
      el.className = b.transitionIn === 'pop' ? 'card' : b.transitionIn === 'slide' ? 'slide' : b.transitionIn === 'fade' ? 'fade' : '';
      layer.append(el);
      if (el.tagName === 'VIDEO') { el.currentTime = 0; el.play().catch(() => {}); }
    }
  }
  // Ken Burns-ish motion on the active B-roll.
  if (b) {
    const el = $('brollLayer').firstElementChild;
    const p = (t - b.start) / Math.max(0.01, b.end - b.start);
    const m = { 'push-in': `scale(${1 + 0.12 * p})`, 'pull-out': `scale(${1.12 - 0.12 * p})`, 'pan-right': `scale(1.12) translateX(${(0.5 - p) * 10}%)`, 'pan-left': `scale(1.12) translateX(${(p - 0.5) * 10}%)` }[b.motion] || '';
    if (el && el.className !== 'card') el.style.transform = m;
  }

  // Titles
  const title = plan ? activeAt(t, events, 'title')[0] : null;
  const tkey = title ? `${title.id}:${title.text}:${title.style}` : '';
  if (tkey !== shownTitle) {
    shownTitle = tkey;
    $('titleLayer').innerHTML = '';
    if (title) $('titleLayer').append(h('div', { class: `title ${title.style}` }, title.text));
  }

  // Captions
  let ckey = '';
  let capEl = null;
  if (plan && chunks.length) {
    const c = chunks.find((x) => t >= x.start && t < x.end);
    if (c) {
      const style = edl.captions.style;
      const k = c.words.filter((w) => w.start <= t).length - 1;
      ckey = `${c.start}:${k}:${style}`;
      if (ckey !== shownCaption) {
        capEl = h('div', { class: `cap ${style}` }, c.words.map((w, j) => {
          if (style === 'minimal') return h('span', { class: 'w' }, w.word);
          if (j > k && style === 'pop') return null;
          return h('span', { class: `w${j === k ? ' live' : ''}${w.emphasis ? ' emph' : ''}${j > k ? ' ghost' : ''}` }, w.word);
        }));
      }
    }
  }
  if (ckey !== shownCaption) {
    shownCaption = ckey;
    $('captionLayer').innerHTML = '';
    if (capEl) $('captionLayer').append(capEl);
  }

  // live chips
  const chips = $('liveChips');
  const live = plan ? events.filter((e) => e.enabled !== false && (e.t !== undefined ? Math.abs(t - e.t) < 0.25 : t >= e.start && t < e.end)) : [];
  const sig = live.map((e) => e.id).join();
  if (chips.dataset.sig !== sig) {
    chips.dataset.sig = sig;
    chips.innerHTML = '';
    const color = { broll: '#ff2bd6', zoom: '#00f2ff', transition: '#b6ff3b', title: '#ff3c3c', sfx: '#ffb020' };
    for (const e of live) chips.append(h('span', { class: 'chip', style: `color:${color[e.type]};border-color:${color[e.type]}` }, e.type === 'sfx' ? `♪ ${e.kind}` : e.type === 'broll' ? `◧ ${e.query}` : e.kind || e.text || e.type));
  }
}

// SFX audition during playback via Web Audio.
let actx = null;
const buffers = new Map();
async function sfxBuffer(kind) {
  if (!buffers.has(kind)) {
    buffers.set(kind, fetch(`/api/sfx/${kind}.wav`).then((r) => r.arrayBuffer()).then((ab) => actx.decodeAudioData(ab)));
  }
  return buffers.get(kind);
}
let lastT = 0;
function triggerSfx(t) {
  const edl = state.project?.edl;
  if (!edl || state.view !== 'plan' || video.paused || !$('sfxPreview').checked) { lastT = t; return; }
  if (t < lastT || t - lastT > 0.5) { lastT = t; return; }
  for (const e of edl.events) {
    if (e.type !== 'sfx' || e.enabled === false || !(e.t > lastT && e.t <= t)) continue;
    actx ||= new AudioContext();
    sfxBuffer(e.kind).then((buf) => {
      const src = actx.createBufferSource();
      const g = actx.createGain();
      g.gain.value = (e.gain ?? 1) * 0.8;
      src.buffer = buf;
      src.connect(g).connect(actx.destination);
      src.start();
    }).catch(() => {});
  }
  lastT = t;
}

function tick() {
  const t = video.currentTime || 0;
  const fps = state.project?.source?.probe?.fps || 30;
  $('readout').textContent = `${fmtTime(t)} · F ${Math.floor(t * fps)}`;
  timeline.setPlayhead(t, !video.paused);
  drawOverlays(t);
  triggerSfx(t);
  requestAnimationFrame(tick);
}

function seek(t) {
  if (state.view === 'render') setView('plan');
  video.currentTime = t;
}
function frameStep(dir) {
  const fps = state.project?.source?.probe?.fps || 30;
  video.pause();
  seek(Math.max(0, video.currentTime + dir / fps));
}
function togglePlay() {
  if (!state.project) return;
  if (state.view === 'render') return renderVideo.paused ? renderVideo.play() : renderVideo.pause();
  if (video.paused) { actx ||= new AudioContext(); actx.resume(); video.play(); } else video.pause();
}
$('btnPlay').addEventListener('click', togglePlay);
$('btnBack').addEventListener('click', () => frameStep(-1));
$('btnFwd').addEventListener('click', () => frameStep(1));
video.addEventListener('play', () => ($('btnPlay').textContent = '❚❚'));
video.addEventListener('pause', () => ($('btnPlay').textContent = '▶'));

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.key === ',') frameStep(-1);
  if (e.key === '.') frameStep(1);
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected) {
    const ev = state.project.edl.events.find((x) => x.id === state.selected);
    if (ev) { ev.enabled = ev.enabled === false; markDirty(); timeline.renderTracks(); refreshInspector(); }
  }
  if (e.key === 'Escape') select(null);
});

// ---------- boot ----------
(async function boot() {
  try {
    state.caps = await api.capabilities();
    buildGrades();
    setPill();
    await refreshProjects();
    const id = location.hash.slice(1);
    if (/^[0-9a-f-]{36}$/.test(id)) await openProject(id);
  } catch (err) {
    toast(`Server unreachable: ${err.message}`, true);
  }
  requestAnimationFrame(tick);
})();
