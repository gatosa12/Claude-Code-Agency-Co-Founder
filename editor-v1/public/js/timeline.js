// Glass timeline: ruler, frame-scan graph, film strip, editable tracks for B-roll, camera
// moves + transitions, titles, SFX, caption words and the audio waveform.
import { api } from './api.js';
import { fmtTime } from './plan.js';

const $ = (id) => document.getElementById(id);

export function createTimeline(state, { onSeek, onSelect, onChange }) {
  const scroll = $('tlScroll');
  const content = $('tlContent');
  const zoomInput = $('tlZoom');
  let pps = Number(zoomInput.value);

  const dur = () => state.project?.source?.probe?.duration || 0;
  const x = (t) => t * pps;

  function fitZoom() {
    const d = dur();
    if (!d) return;
    pps = Math.max(20, Math.min(400, (scroll.clientWidth - 20) / d));
    zoomInput.value = String(Math.round(pps));
  }

  zoomInput.addEventListener('input', () => {
    const center = (scroll.scrollLeft + scroll.clientWidth / 2) / pps;
    pps = Number(zoomInput.value);
    render();
    scroll.scrollLeft = center * pps - scroll.clientWidth / 2;
  });

  // Seek by clicking the ruler or empty track space.
  content.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.ev, .mk')) return;
    const rect = content.getBoundingClientRect();
    const seek = (ev) => onSeek(Math.max(0, Math.min(dur(), (ev.clientX - rect.left) / pps)));
    seek(e);
    if (!e.target.closest('.ruler')) { onSelect(null); return; }
    const move = (ev) => seek(ev);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  function renderRuler() {
    const ruler = $('ruler');
    ruler.innerHTML = '';
    const d = dur();
    const step = pps > 160 ? 0.5 : pps > 60 ? 1 : pps > 30 ? 2 : 5;
    for (let t = 0; t <= d + 0.001; t += step) {
      const el = document.createElement('div');
      const major = Math.abs(t / (step * 2) - Math.round(t / (step * 2))) < 1e-6 || step >= 2;
      el.className = `tick${major ? '' : ' minor'}`;
      el.style.left = `${x(t)}px`;
      if (major) el.textContent = fmtTime(t).replace(/^00:/, '');
      ruler.appendChild(el);
    }
  }

  function renderFilm() {
    const film = $('film');
    film.innerHTML = '';
    const th = state.analysis?.thumbs;
    if (!th) return;
    const w = th.step * pps;
    for (const f of th.files) {
      const img = document.createElement('img');
      img.src = api.file(state.project.id, `thumbs/${f}`);
      img.style.width = `${w}px`;
      img.loading = 'lazy';
      img.alt = '';
      film.appendChild(img);
    }
  }

  function sizeCanvas(c) {
    const r = c.getBoundingClientRect();
    // Browsers cap canvas width (~32k px); lower the backing resolution on long, zoomed-in clips.
    const dpr = Math.min(window.devicePixelRatio || 1, 30000 / Math.max(1, r.width));
    c.width = Math.max(1, Math.round(r.width * dpr));
    c.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [ctx, r.width, r.height];
  }

  function drawScan() {
    const c = $('scanCanvas');
    const [ctx, w, h] = sizeCanvas(c);
    ctx.clearRect(0, 0, w, h);
    const fr = state.analysis?.frames;
    if (!fr) return;
    const s = fr.series;
    const bw = x(dur()) / s.n;
    // scene-change score bars
    for (let i = 0; i < s.n; i++) {
      const v = s.scene[i];
      if (v < 0.02) continue;
      ctx.fillStyle = v >= fr.cutThreshold ? 'rgba(255,43,214,0.95)' : 'rgba(255,43,214,0.35)';
      ctx.fillRect(i * bw, h - v * h, Math.max(1, bw - 0.5), v * h);
    }
    // motion line
    const maxM = Math.max(1, ...s.motion);
    ctx.beginPath();
    s.motion.forEach((m, i) => {
      const yy = h - 3 - (m / maxM) * (h - 6);
      if (i) ctx.lineTo(i * bw + bw / 2, yy); else ctx.moveTo(0, yy);
    });
    ctx.strokeStyle = 'rgba(0,242,255,0.85)';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = '#00f2ff';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // cut markers
    ctx.fillStyle = '#ff2bd6';
    for (const cut of fr.cuts) ctx.fillRect(x(cut.t) - 1, 0, 2, 5);
  }

  function drawWave() {
    const c = $('waveCanvas');
    const [ctx, w, h] = sizeCanvas(c);
    ctx.clearRect(0, 0, w, h);
    const a = state.analysis?.audio;
    if (!a) {
      ctx.fillStyle = 'rgba(125,138,168,0.5)';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(state.project?.source?.probe?.hasAudio === false ? 'no audio track' : '', 8, h / 2);
      return;
    }
    for (const s of a.silences || []) {
      ctx.fillStyle = 'rgba(139,92,255,0.12)';
      ctx.fillRect(x(s.start), 0, x(s.end) - x(s.start), h);
    }
    const p = a.peaks;
    const bw = x(dur()) / p.length;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(0,242,255,0.9)');
    grad.addColorStop(0.5, 'rgba(139,92,255,0.8)');
    grad.addColorStop(1, 'rgba(0,242,255,0.9)');
    ctx.fillStyle = grad;
    p.forEach((v, i) => {
      const hh = Math.max(1, v * (h - 6));
      ctx.fillRect(i * bw, (h - hh) / 2, Math.max(1, bw - 0.3), hh);
    });
    ctx.fillStyle = 'rgba(182,255,59,0.9)';
    for (const o of a.onsets || []) ctx.fillRect(x(o.t), h - 4, 2, 4);
  }

  function makeDraggable(el, ev, kind) {
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const handle = e.target.classList.contains('handle') ? (e.target.classList.contains('l') ? 'l' : 'r') : null;
      const x0 = e.clientX;
      const orig = { start: ev.start, end: ev.end, t: ev.t };
      let moved = false;
      el.setPointerCapture(e.pointerId);
      const D = dur();
      const move = (m) => {
        const dt = (m.clientX - x0) / pps;
        if (Math.abs(m.clientX - x0) > 3) moved = true;
        if (!moved) return;
        if (kind === 'marker') {
          ev.t = round(clamp(orig.t + dt, 0, D));
          el.style.left = `${x(ev.t)}px`;
        } else if (handle === 'l') {
          ev.start = round(clamp(orig.start + dt, 0, ev.end - 0.2));
          place(el, ev);
        } else if (handle === 'r') {
          ev.end = round(clamp(orig.end + dt, ev.start + 0.2, D));
          place(el, ev);
        } else {
          const len = orig.end - orig.start;
          ev.start = round(clamp(orig.start + dt, 0, D - len));
          ev.end = round(ev.start + len);
          place(el, ev);
        }
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        if (moved) onChange(ev);
        else onSelect(ev.id);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    });
  }

  function place(el, ev) {
    el.style.left = `${x(ev.start)}px`;
    el.style.width = `${Math.max(6, x(ev.end) - x(ev.start))}px`;
  }

  function block(ev, label, extraClass = '') {
    const el = document.createElement('div');
    el.className = `ev ${ev.type} ${extraClass}${ev.enabled === false ? ' off' : ''}${state.selected === ev.id ? ' sel' : ''}`;
    el.dataset.id = ev.id;
    place(el, ev);
    el.innerHTML = '<span class="handle l"></span><span class="handle r"></span>';
    if (label instanceof Node) el.appendChild(label);
    else el.appendChild(document.createTextNode(label));
    el.title = typeof label === 'string' ? label : ev.query || '';
    makeDraggable(el, ev, 'span');
    return el;
  }

  function marker(ev, cls, label) {
    const el = document.createElement('div');
    el.className = `mk ${cls}${ev.enabled === false ? ' off' : ''}${state.selected === ev.id ? ' sel' : ''}`;
    el.style.left = `${x(ev.t)}px`;
    el.dataset.id = ev.id;
    el.title = label;
    const lab = document.createElement('span');
    lab.className = 'lab';
    lab.textContent = label;
    el.appendChild(lab);
    makeDraggable(el, ev, 'marker');
    return el;
  }

  function renderTracks() {
    const tracks = { broll: $('trk-broll'), camera: $('trk-camera'), title: $('trk-title'), sfx: $('trk-sfx'), captions: $('trk-captions') };
    Object.values(tracks).forEach((t) => (t.innerHTML = ''));
    const edl = state.project?.edl;
    if (!edl) return;
    for (const ev of edl.events) {
      if (ev.type === 'broll') {
        const asset = state.project.media?.[ev.assetId];
        const frag = document.createDocumentFragment();
        if (asset && asset.kind === 'image') {
          const img = document.createElement('img');
          img.src = api.file(state.project.id, asset.file);
          img.alt = '';
          frag.appendChild(img);
        }
        frag.appendChild(document.createTextNode(ev.query || 'B-roll'));
        tracks.broll.appendChild(block(ev, frag, asset ? '' : 'missing'));
      } else if (ev.type === 'zoom') {
        tracks.camera.appendChild(block(ev, `${ev.kind} ×${ev.scale}`));
      } else if (ev.type === 'transition') {
        tracks.camera.appendChild(marker(ev, 'transition', ev.kind));
      } else if (ev.type === 'title') {
        tracks.title.appendChild(block(ev, ev.text));
      } else if (ev.type === 'sfx') {
        tracks.sfx.appendChild(marker(ev, 'sfx', ev.kind));
      }
    }
    if (edl.captions?.enabled) {
      for (const w of edl.captions.words) {
        const el = document.createElement('div');
        el.className = `wd${w.emphasis ? ' emph' : ''}`;
        el.style.left = `${x(w.start)}px`;
        el.style.width = `${Math.max(2, x(w.end) - x(w.start))}px`;
        el.textContent = w.word;
        tracks.captions.appendChild(el);
      }
    }
  }

  function render() {
    content.style.width = `${Math.max(scroll.clientWidth, x(dur()) + 40)}px`;
    renderRuler();
    renderFilm();
    renderTracks();
    requestAnimationFrame(() => { drawScan(); drawWave(); });
  }

  function setPlayhead(t, follow) {
    $('playhead').style.left = `${x(t)}px`;
    if (follow) {
      const px = x(t);
      if (px < scroll.scrollLeft || px > scroll.scrollLeft + scroll.clientWidth - 40) scroll.scrollLeft = px - 60;
    }
  }

  window.addEventListener('resize', () => requestAnimationFrame(() => { drawScan(); drawWave(); }));
  return { render, renderTracks, setPlayhead, fitZoom };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round = (v) => Math.round(v * 100) / 100;
