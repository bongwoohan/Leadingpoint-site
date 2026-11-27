// Event detection — snapshot replication vs event-based replication on one time axis.
//
// Redrawn from VH's sketch (2026-11-27). One dotted time axis, read twice:
//  - above it, snapshot replication (기존 NAS DR): a copy at fixed points, a cycle arrow between them
//  - below it, event-based replication (PeerGFS): every file change is copied right away
// File changes are pale dots on the axis; each gets an orange dot (its copy) right after it.
// A failure near the right end: the changes after the last snapshot are lost (변경 유실),
// while every change already has its event copy.
//
// What moves: a faint "now" line sweeps left to right. As it passes, file changes appear and
// are copied at once below the axis; snapshot points copy only when the sweep reaches them.
// At the failure the red marker drops and 변경 유실 shows. Hold, fade, repeat.
// Still (?t=…, reduced motion) shows the finished picture.
//
// Sits on the dark navy section (#162538) with no background of its own.
import { el, run, f } from './lib/ink.ts';
import { clamp, ease } from './lib/motion.ts';

// ---------------------------------------------------------------- look
const LIGHT = '#c8d8f0';
const TITLE = '#eaf4ff';
const MUTED = 'rgba(200,216,240,0.62)';
const ACCENT = '#7ab0e0';   // snapshot copies and the cycle arrows
const ORANGE = '#e8693f';   // event copies
const RED = '#ff4a4a';      // loss and failure
const NAVY = '#162538';
const FONT = "'Pretendard', 'Noto Sans KR', 'Malgun Gothic', 'DM Sans', 'Segoe UI', sans-serif";

const W = 1800, H = 560;
const AXIS_Y = 300;
const X0 = 30, X_FAIL = 1725, X1 = 1780;
const SNAPS = [226, 680, 1133, 1586];
const CHANGES = [150, 322, 392, 540, 632, 822, 1040, 1190, 1376, 1452, 1645];
const COPY_DX = 20;          // the orange copy sits just right of its change
const ARROW_Y = 245;

// ---------------------------------------------------------------- timing (one loop)
const SWEEP = 10.5;                       // seconds from X0 to the failure
const HOLD = 3.4, FADE = 0.8;
const LOOP = SWEEP + HOLD + FADE;
const speed = (X_FAIL - X0) / SWEEP;
const at = (x: number) => (x - X0) / speed;   // when the sweep reaches x
const COPY_LAG = 0.28;                        // event copy follows its change this quickly

// ---------------------------------------------------------------- svg
const stage = (document.querySelector('#hw-event') ?? document.querySelector('#stage')) as HTMLElement;
const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img',
  'aria-label': '스냅샷 기반 복제와 이벤트 기반 복제의 차이: 스냅샷 복제는 복제 주기마다 복제해 장애 직전 변경이 유실되고, 이벤트 기반 복제는 파일이 바뀔 때마다 즉시 복제한다' });
svg.setAttribute('style', 'display:block;width:100%;height:auto;user-select:none');
stage.appendChild(svg);

const defs = el('defs', {}, svg);
const flt = el('filter', { id: 'ev-ink', x: '-1%', y: '-5%', width: '102%', height: '110%' }, defs);
el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.05', numOctaves: 2, seed: 3, result: 'n' }, flt);
el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 1.8, xChannelSelector: 'R', yChannelSelector: 'G' }, flt);

const root = el('g', {}, svg);
const Lline = el('g', { filter: 'url(#ev-ink)' }, root);
const Lmark = el('g', {}, root);
const Llab = el('g', {}, root);

function text(parent: Element, x: number, y: number, s: string, o: { size?: number; weight?: number; fill?: string; anchor?: string } = {}) {
  const n = el('text', { x: f(x), y: f(y), 'font-size': o.size ?? 26, 'font-weight': o.weight ?? 500, 'font-family': FONT,
    fill: o.fill ?? LIGHT, 'text-anchor': o.anchor ?? 'middle', 'dominant-baseline': 'central' }, parent);
  n.textContent = s;
  return n;
}
function line(parent: Element, x1: number, y1: number, x2: number, y2: number, colour: string, w: number, extra: Record<string, string | number> = {}) {
  return el('line', { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), stroke: colour, 'stroke-width': w, 'stroke-linecap': 'round', ...extra }, parent);
}
function head(parent: Element, x: number, y: number, dir: 1 | -1, colour: string) {
  const s = 13;
  return el('path', { d: `M${f(x)} ${f(y)} L${f(x - dir * s)} ${f(y - s * 0.55)} L${f(x - dir * s)} ${f(y + s * 0.55)} Z`, fill: colour }, parent);
}
/** A group that pops in: scale from its anchor point, opacity 0 → 1. */
function popper(parent: Element, cx: number, cy: number) {
  const g = el('g', {}, parent);
  const set = (u: number) => {
    const k = clamp(u, 0, 1), s = 0.4 + 0.6 * ease(k) + Math.sin(k * Math.PI) * 0.18;
    g.setAttribute('opacity', f(k));
    g.setAttribute('transform', k >= 1 ? '' : `translate(${f(cx)} ${f(cy)}) scale(${f(s)}) translate(${f(-cx)} ${f(-cy)})`);
  };
  return { g, set };
}
const fade = (n: Element, u: number) => n.setAttribute('opacity', f(clamp(u, 0, 1)));

// ---------------------------------------------------------------- static parts
// track labels
text(Llab, 20, 62, '스냅샷 기반 복제 (기존 NAS DR)', { size: 28, weight: 700, fill: TITLE, anchor: 'start' });
text(Llab, 20, 520, '이벤트 기반 복제 (PeerGFS)', { size: 28, weight: 700, fill: TITLE, anchor: 'start' });

// legend (top right)
const leg = el('g', {}, Llab);
el('circle', { cx: 1310, cy: 62, r: 9, fill: TITLE }, leg); text(leg, 1328, 62, '파일 변경', { size: 23, anchor: 'start', fill: MUTED });
el('circle', { cx: 1470, cy: 62, r: 9, fill: ORANGE }, leg); text(leg, 1488, 62, '즉시 복제', { size: 23, anchor: 'start', fill: MUTED });
el('circle', { cx: 1630, cy: 62, r: 9, fill: NAVY, stroke: ACCENT, 'stroke-width': 3 }, leg); text(leg, 1648, 62, '주기 복제', { size: 23, anchor: 'start', fill: MUTED });

// the time axis, drawn as the sweep goes
const axisFull = line(Lline, X0, AXIS_Y, X1, AXIS_Y, 'rgba(200,216,240,0.18)', 3, { 'stroke-dasharray': '0.1 9' });
const axis = line(Lline, X0, AXIS_Y, X0, AXIS_Y, LIGHT, 3.4, { 'stroke-dasharray': '0.1 9' });
void axisFull;

// "now" sweep
const now = el('g', {}, Lmark);
line(now, 0, AXIS_Y - 70, 0, AXIS_Y + 70, 'rgba(200,216,240,0.30)', 2);

// ---------------------------------------------------------------- snapshot copies (above)
interface Snap { at: number; ring: ReturnType<typeof popper>; label: SVGTextElement; arrow?: SVGGElement; x0: number; x1: number; arrowLine?: SVGLineElement; cycle?: SVGTextElement }
const snaps: Snap[] = SNAPS.map((x, i) => {
  const ring = popper(Lmark, x, AXIS_Y);
  el('circle', { cx: x, cy: AXIS_Y, r: 13, fill: NAVY, stroke: ACCENT, 'stroke-width': 3.4 }, ring.g);
  line(ring.g, x, AXIS_Y - 15, x, 196, 'rgba(122,176,224,0.45)', 1.6);
  const label = text(Llab, x, 172, '복제', { size: 26, weight: 600, fill: ACCENT });
  const s: Snap = { at: at(x), ring, label, x0: SNAPS[i - 1] ?? x, x1: x };
  if (i > 0) {
    const g = el('g', {}, Lline);
    const a = SNAPS[i - 1] + 18, b = x - 18;
    s.arrowLine = line(g, a, ARROW_Y, a, ARROW_Y, ACCENT, 2.6);
    head(g, a, ARROW_Y, -1, ACCENT);
    const hb = head(g, b, ARROW_Y, 1, ACCENT);
    hb.setAttribute('data-end', '1');
    s.arrow = g;
    if (i === 1) s.cycle = text(Llab, (SNAPS[0] + x) / 2, ARROW_Y - 28, '복제 주기', { size: 24, fill: MUTED });
  }
  return s;
});

// ---------------------------------------------------------------- file changes + event copies (below)
interface Change { at: number; dot: ReturnType<typeof popper>; copy: ReturnType<typeof popper>; tick: SVGLineElement; label: SVGTextElement; x: number }
const changes: Change[] = CHANGES.map((x, i) => {
  const dot = popper(Lmark, x, AXIS_Y);
  el('circle', { cx: x, cy: AXIS_Y, r: 10, fill: TITLE }, dot.g);
  const cx = x + COPY_DX;
  const copy = popper(Lmark, cx, AXIS_Y);
  el('circle', { cx, cy: AXIS_Y, r: 10, fill: ORANGE }, copy.g);
  const tick = line(Lline, cx, AXIS_Y + 16, cx, AXIS_Y + 16, ORANGE, 2.4);
  const label = text(Llab, cx, 418, i === 0 ? '변경 즉시 복제' : '복제', { size: 25, weight: i === 0 ? 700 : 500, fill: i === 0 ? ORANGE : LIGHT });
  return { at: at(x), dot, copy, tick, label, x };
});

// ---------------------------------------------------------------- loss + failure
const lossX0 = SNAPS[SNAPS.length - 1] + 14, lossX1 = X_FAIL - 4;
const loss = el('g', {}, Lmark);
el('rect', { x: f(lossX0), y: ARROW_Y - 24, width: f(lossX1 - lossX0), height: 48, rx: 4, fill: RED }, loss);
text(loss, (lossX0 + lossX1) / 2, ARROW_Y + 1, '변경 유실', { size: 26, weight: 700, fill: '#ffffff' });
const lossShade = el('rect', { x: f(lossX0), y: AXIS_Y - 22, width: f(lossX1 - lossX0), height: 44, fill: 'rgba(255,74,74,0.16)' }, Lline);

const fail = el('g', {}, Lmark);
const failLine = line(fail, X_FAIL, AXIS_Y, X_FAIL, AXIS_Y, RED, 3);
el('circle', { cx: X_FAIL, cy: AXIS_Y, r: 19, fill: RED, stroke: '#ffd0d0', 'stroke-width': 2.4 }, fail);
const failRing = el('circle', { cx: X_FAIL, cy: AXIS_Y, r: 19, fill: 'none', stroke: RED, 'stroke-width': 3 }, fail);
const failLabel = text(fail, X_FAIL + 40, 468, '장애 발생', { size: 27, weight: 700, fill: TITLE, anchor: 'end' });

// ---------------------------------------------------------------- frame
function frame(t: number) {
  const still = q.has('t') || reduced;
  const lt = still ? SWEEP + HOLD * 0.6 : t % LOOP;
  const T = lt;                            // reveals keep finishing after the sweep stops
  const xNow = X0 + Math.min(lt, SWEEP) * speed;
  const out = lt > SWEEP + HOLD ? 1 - (lt - SWEEP - HOLD) / FADE : 1;
  root.setAttribute('opacity', f(clamp(out, 0, 1)));

  axis.setAttribute('x2', f(Math.min(X1, lt >= SWEEP ? X1 : xNow)));
  now.setAttribute('transform', `translate(${f(xNow)} 0)`);
  now.setAttribute('opacity', f(lt < SWEEP ? 1 : clamp(1 - (lt - SWEEP) / 0.4, 0, 1)));

  for (const s of snaps) {
    const u = (T - s.at) / 0.35;
    s.ring.set(u);
    fade(s.label, u);
    if (s.arrowLine && s.arrow) {
      const a = s.x0 + 18, b = s.x1 - 18;
      const k = clamp((xNow - a) / (b - a), 0, 1);   // the cycle arrow follows the sweep
      s.arrowLine.setAttribute('x2', f(a + (b - a) * k));
      s.arrow.setAttribute('opacity', f(xNow > a ? 1 : 0));
      const end = s.arrow.querySelector('[data-end]');
      if (end) end.setAttribute('opacity', f(k >= 1 ? 1 : 0));
      if (s.cycle) fade(s.cycle, (xNow - a) / 120);
    }
  }

  for (const c of changes) {
    c.dot.set((T - c.at) / 0.25);
    const u = (T - c.at - COPY_LAG) / 0.25;
    c.copy.set(u);
    const k = ease(clamp(u, 0, 1));
    c.tick.setAttribute('y2', f(AXIS_Y + 16 + (392 - AXIS_Y - 16) * k));
    fade(c.label, (T - c.at - COPY_LAG - 0.1) / 0.3);
  }

  // failure: drop the line, ring outwards once, then show the loss
  const fu = lt - SWEEP;
  const showFail = fu >= 0;
  fail.setAttribute('opacity', showFail ? '1' : '0');
  const dk = ease(clamp(fu / 0.4, 0, 1));
  failLine.setAttribute('y2', f(AXIS_Y + (446 - AXIS_Y) * dk));
  fade(failLabel, (fu - 0.2) / 0.3);
  const rk = clamp(fu / 0.9, 0, 1);
  failRing.setAttribute('r', f(19 + rk * 34));
  failRing.setAttribute('opacity', f(still ? 0 : (1 - rk) * (showFail ? 1 : 0)));
  const lk = clamp((fu - 0.45) / 0.4, 0, 1);
  fade(loss, lk);
  fade(lossShade, lk);

  if (!still) follow(lt, xNow);
}

// ---------------------------------------------------------------- narrow screens
// On a phone the card is wider than the screen and sits in a sideways scroller. Keep the
// sweep in view: once the "now" line nears the right edge, slide the picture left with it,
// hold on the end (failure, 변경 유실), and glide back to the start while the loop fades.
// A touch or wheel by the viewer hands the scroller to them for a few seconds.
const scroller = stage.closest('.hw-figure-scroll') as HTMLElement | null;
let userUntil = 0;
if (scroller) for (const ev of ['pointerdown', 'touchstart', 'wheel']) scroller.addEventListener(ev, () => { userUntil = performance.now() + 4000; }, { passive: true });
function follow(lt: number, xNow: number) {
  if (!scroller || performance.now() < userUntil) return;
  const view = scroller.clientWidth, full = scroller.scrollWidth;
  if (full <= view + 4) return;
  const px = (xNow / W) * svg.getBoundingClientRect().width;
  let target = clamp(px - view * 0.72, 0, full - view);
  if (lt > SWEEP + HOLD) target *= 1 - ease(clamp((lt - SWEEP - HOLD) / FADE, 0, 1));
  scroller.scrollLeft = target;
}

// Animate only while the drawing is on screen. ?debug keeps run()'s manual stepping.
const q = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let stop: (() => void) | null = null;
const start = () => { if (!stop) stop = run(frame); };
const halt = () => { if (stop) { stop(); stop = null; } };
if (q.has('debug') || q.has('t') || reduced || !('IntersectionObserver' in window)) start();
else new IntersectionObserver((entries) => { if (entries[entries.length - 1].isIntersecting) start(); else halt(); }, { threshold: 0.05 }).observe(svg);
