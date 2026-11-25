// System Diagram AS-IS 1 — Main Center(Active) / DR Center(Passive), one ink line on paper.
//
// What moves, and why:
//  - Requests come in over the WAN (active line) to the Main Center switch, go to a
//    Web / WAS / DB server, and the answer goes back out.
//  - A write lands on NAS (NFS) or SAN; each write is then carried to the DR Center
//    along the red replication line, and the DR storage acknowledges it with a ripple.
//  - The passive line to the DR Center stays still: nothing runs on it.
//  - Clicking a device makes it act (send traffic, replicate). Pointer movement drifts the cloud.
//
// Sits on a dark navy section (#162538) with no background of its own: devices, the
// platform floors and everything on them keep their colours; what lies outside the
// platforms (WAN lines, cloud, titles, platform rims) is drawn in a pale ink (LIGHT).
// It only animates while it is on screen.
import { el, pen, paint, run, f, pt, PAPER, type Vec } from './lib/ink.ts';
import { pointerWind, rnd, clamp, wobble } from './lib/motion.ts';

// ---------------------------------------------------------------- look
const INK = '#1c1c1c';
const BLUE = '#5a80ea', BLUE_SIDE = '#3f62c8', BLUE_TOP = '#7d9cf0', BLUE_LIT = '#b7c9fa';
const RED = '#c4473a';
const WASH = '#eef2fb';
const LIGHT = '#c8d8f0';                               // ink for everything off the platforms
const NAVY = '#162538';                                // the section behind the drawing
const CLOUD_TOP = '#2a4266', CLOUD_SIDE = '#1e3150';   // the cloud, as solid navy tints of that section
const PEN = 2.4, THIN = 1.4;
const FONT = "'DM Sans', 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', 'Segoe UI', sans-serif";

// ---------------------------------------------------------------- isometric floor
// a runs down-right, b runs up-right, h is height above the floor (screen px).
const C = 0.8660254, S = 0.5;
const MAIN: Vec = [0, 600];
const DR: Vec = [610, 270];
const iso = (o: Vec, a: number, b: number, h = 0): Vec => [o[0] + (a + b) * C, o[1] + (a - b) * S - h];
const on = (o: Vec, pts: number[][]): Vec[] => pts.map(([a, b, h = 0]) => iso(o, a, b, h));

const poly = (pts: Vec[], close = false): string => 'M' + pts.map(pt).join(' L') + (close ? ' Z' : '');
/** Polyline with soft, rounded corners — no ruler-sharp joints. */
function rounded(pts: Vec[], r = 26): string {
  let s = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], p = pts[i], b = pts[i + 1];
    const la = Math.hypot(p[0] - a[0], p[1] - a[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ra = Math.min(r, la / 2), rb = Math.min(r, lb / 2);
    const p1: Vec = [p[0] + ((a[0] - p[0]) * ra) / la, p[1] + ((a[1] - p[1]) * ra) / la];
    const p2: Vec = [p[0] + ((b[0] - p[0]) * rb) / lb, p[1] + ((b[1] - p[1]) * rb) / lb];
    s += ` L${pt(p1)} Q${pt(p)} ${pt(p2)}`;
  }
  return s + ` L${pt(pts[pts.length - 1])}`;
}

// ---------------------------------------------------------------- svg + layers
const stage = document.querySelector('#as-is-1') ?? document.querySelector('#stage');
const svg = el('svg', { viewBox: '-30 -40 1800 1090', role: 'img', 'aria-label': 'System Diagram AS-IS 1: 주 센터와 DR 센터 간 NAS·DB 복제 구성도' });
svg.style.color = INK;
stage!.appendChild(svg);

const defs = el('defs', {}, svg);
const flt = el('filter', { id: 'ink', x: '-1%', y: '-1%', width: '102%', height: '102%' }, defs);
el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.04', numOctaves: 2, seed: 5, result: 'n' }, flt);
el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 2.4, xChannelSelector: 'R', yChannelSelector: 'G' }, flt);
const hatch = el('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(58)' }, defs);
el('rect', { width: 6, height: 6, fill: PAPER }, hatch);
el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: INK, 'stroke-width': 0.9 }, hatch);
const HATCH = 'url(#hatch)';
const hatchLight = el('pattern', { id: 'hatch-light', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(58)' }, defs);
el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: LIGHT, 'stroke-width': 0.9, opacity: 0.55 }, hatchLight);
const HATCH_LIGHT = 'url(#hatch-light)';

const layer = (filtered: boolean) => el('g', filtered ? { filter: 'url(#ink)' } : {}, svg);
const Lfloor = layer(true);   // platforms, floor wiring, WAN lines
const Lmove = layer(false);   // packets and ripples travel under the devices
const Ldev = layer(true);     // devices (static once drawn, so the ink filter never re-runs)
const Lglow = layer(false);   // status lights and flashes on the devices change every frame: keep them unfiltered
const Lcloud = el('g', {}, svg); // the cloud drifts: its own small filtered group
const Lrep = layer(true);     // replication lines float over everything
const Lflow = layer(false);   // pulses on the replication lines
const Llab = layer(false);    // labels (unfiltered so the type stays crisp)
const Lroutes = el('g', { visibility: 'hidden' }, svg);

const fillOf = (n: SVGElement, c: string) => { n.classList.remove('pp'); n.setAttribute('fill', c); };
const stroke = (parent: Element, dd: string, w = PEN, colour = INK) => { const p = pen(parent, w); p.setAttribute('d', dd); if (colour !== INK) p.setAttribute('stroke', colour); return p; };

// ---------------------------------------------------------------- platforms
const PA = 790, PB = 522, TH = 16;
function platform(o: Vec) {
  const g = el('g', {}, Lfloor);
  const c = (a: number, b: number, h = 0) => iso(o, a, b, h);
  const front = paint(g, HATCH_LIGHT, THIN); front.setAttribute('d', poly([c(0, 0), c(PA, 0), c(PA, 0, -TH), c(0, 0, -TH)], true));
  const side = paint(g, 'rgba(200,216,240,0.10)', THIN); side.setAttribute('d', poly([c(PA, 0), c(PA, PB), c(PA, PB, -TH), c(PA, 0, -TH)], true));
  const top = paint(g, WASH, PEN); top.setAttribute('d', poly([c(0, 0), c(PA, 0), c(PA, PB), c(0, PB)], true));
  for (const n of [front, side, top]) n.setAttribute('stroke', LIGHT);
  // a faint inner border, like a ruled margin
  stroke(g, poly([c(18, 18), c(PA - 18, 18), c(PA - 18, PB - 18), c(18, PB - 18)], true), 0.8).setAttribute('stroke-dasharray', '1 7');
}

// ---------------------------------------------------------------- devices
interface Led { n: SVGCircleElement; on: number; next: number }
interface Dev { g: SVGGElement; leds: Led[]; flash: number; base: Vec; rx: number; ry: number; glow?: SVGPathElement; ledOn: string; ledOff: string; standby?: boolean }

function led(p: Vec, r = 2.7): Led {
  const n = el('circle', { cx: f(p[0]), cy: f(p[1]), r, fill: PAPER, stroke: INK, 'stroke-width': 1.1 }, Lglow);
  return { n, on: 0, next: rnd(0.5, 5) };
}

function box(g: Element, o: Vec, a0: number, a1: number, b0: number, b1: number, z: number, h: number,
  colours: { left?: string; right?: string; top?: string } = {}) {
  const c = (a: number, b: number, hh: number) => iso(o, a, b, hh);
  const L = paint(g, colours.left ?? PAPER); L.setAttribute('d', poly([c(a0, b0, z), c(a1, b0, z), c(a1, b0, z + h), c(a0, b0, z + h)], true));
  const R = paint(g, colours.right ?? HATCH); R.setAttribute('d', poly([c(a1, b0, z), c(a1, b1, z), c(a1, b1, z + h), c(a1, b0, z + h)], true));
  const T = paint(g, colours.top ?? PAPER); T.setAttribute('d', poly([c(a0, b0, z + h), c(a1, b0, z + h), c(a1, b1, z + h), c(a0, b1, z + h)], true));
  return { L, R, T };
}

function device(o: Vec, title: string): SVGGElement {
  const g = el('g', { style: 'cursor:pointer' }, Ldev);
  el('title', {}, g).textContent = title;
  return g;
}

function tower(o: Vec, ca: number, cb: number, title: string): Dev {
  const g = device(o, title);
  const a0 = ca - 26, b0 = cb - 26, h = 80;
  box(g, o, a0, ca + 26, b0, cb + 26, 0, h);
  const F = (u: number, v: number) => iso(o, a0 + u, b0, v);
  stroke(g, [h - 13, h - 21, h - 29].map((v) => `M${pt(F(8, v))} L${pt(F(30, v))}`).join(' '), THIN);
  stroke(g, [12, 17, 22, 27, 32].map((v) => `M${pt(F(8, v))} L${pt(F(22, v))}`).join(' '), 1);
  const leds = [led(F(41, h - 13)), led(F(41, h - 22))];
  const base = iso(o, ca, cb);
  return { g, leds, flash: 0, base, rx: 52, ry: 30, ledOn: BLUE, ledOff: PAPER };
}

function dbServer(o: Vec, ca: number, cb: number, title: string): Dev {
  const g = device(o, title);
  const a0 = ca - 30, b0 = cb - 26, h = 34;
  const leds: Led[] = [];
  for (const z of [0, h + 3]) {
    box(g, o, a0, ca + 30, b0, cb + 26, z, h);
    const F = (u: number, v: number) => iso(o, a0 + u, b0, z + v);
    leds.push(led(F(8, h / 2 + 4)), led(F(15, h / 2 + 4)));
    stroke(g, `M${pt(F(24, h / 2 + 5))} L${pt(F(50, h / 2 + 5))} M${pt(F(24, h / 2 - 3))} L${pt(F(44, h / 2 - 3))}`, THIN);
  }
  return { g, leds, flash: 0, base: iso(o, ca, cb), rx: 58, ry: 33, ledOn: BLUE, ledOff: PAPER };
}

function storage(o: Vec, ca: number, cb: number, title: string, blue: boolean): Dev {
  const g = device(o, title);
  const r = 36, h = 74, [x, y] = iso(o, ca, cb), rx = r * 1.2247, ry = r * 0.7071;
  const body = blue ? BLUE : PAPER, top = blue ? BLUE_TOP : PAPER;
  paint(g, body).setAttribute('d', `M${f(x - rx)} ${f(y - h)} L${f(x - rx)} ${f(y)} A${f(rx)} ${f(ry)} 0 0 0 ${f(x + rx)} ${f(y)} L${f(x + rx)} ${f(y - h)} Z`);
  for (const k of [0.36, 0.68]) stroke(g, `M${f(x - rx)} ${f(y - h * k)} A${f(rx)} ${f(ry)} 0 0 0 ${f(x + rx)} ${f(y - h * k)}`, THIN);
  const lid = `M${f(x - rx)} ${f(y - h)} A${f(rx)} ${f(ry)} 0 1 1 ${f(x + rx)} ${f(y - h)} A${f(rx)} ${f(ry)} 0 1 1 ${f(x - rx)} ${f(y - h)} Z`;
  paint(g, top).setAttribute('d', lid);
  const glow = el('path', { d: lid, fill: blue ? BLUE_LIT : '#fff1c4', opacity: 0 }, Lglow);
  // two status dots on the front, riding the curve of each band
  const leds: Led[] = [];
  for (const k of [0.18, 0.52]) for (const th of [0.42, 0.62]) leds.push(led([x + rx * Math.cos(th), y - h * k - 6 + ry * Math.sin(th)], 2.4));
  return { g, leds, flash: 0, base: [x, y], rx: rx + 6, ry: ry + 4, glow, ledOn: blue ? PAPER : BLUE, ledOff: blue ? BLUE_SIDE : PAPER };
}

function switchBox(o: Vec, ca: number, cb: number, title: string): Dev {
  const g = device(o, title);
  const s = 40, h = 26;
  const { T } = box(g, o, ca - s, ca + s, cb - s, cb + s, 0, h, { left: BLUE, right: BLUE_SIDE, top: BLUE });
  // glyph on the lid: two arrows passing each other — traffic both ways
  const P = (u: number, v: number) => iso(o, ca + u, cb + v, h);
  const glyph = `M${pt(P(-20, 10))} L${pt(P(20, 10))} M${pt(P(12, 17))} L${pt(P(20, 10))} L${pt(P(12, 3))}`
    + ` M${pt(P(20, -10))} L${pt(P(-20, -10))} M${pt(P(-12, -3))} L${pt(P(-20, -10))} L${pt(P(-12, -17))}`;
  stroke(g, glyph, 3.2, PAPER);
  const glow = el('path', { d: T.getAttribute('d')!, fill: BLUE_LIT, opacity: 0 }, Lglow);
  return { g, leds: [], flash: 0, base: iso(o, ca, cb), rx: 70, ry: 40, glow, ledOn: BLUE, ledOff: PAPER };
}

// ---------------------------------------------------------------- one data center
const POS = { sw: [100, 290], web: [340, 180], was: [500, 180], db: [670, 190], nas: [500, 370], san: [670, 360] } as const;
type Key = keyof typeof POS;
interface Route { p: SVGPathElement; len: number }
interface Center { o: Vec; dev: Record<Key, Dev>; r: Record<string, Route> }

function routeOf(dd: string): Route {
  const p = el('path', { d: dd, fill: 'none' }, Lroutes);
  return { p, len: p.getTotalLength() };
}

function center(o: Vec, name: string): Center {
  platform(o);
  const local: Record<string, number[][]> = {
    web: [POS.sw.slice(), [100, 90], [340, 90], POS.web.slice()],
    was: [POS.sw.slice(), [100, 90], [500, 90], POS.was.slice()],
    db: [POS.sw.slice(), [100, 90], [670, 90], POS.db.slice()],
    webNas: [POS.web.slice(), [340, 370], POS.nas.slice()],
    wasNas: [POS.was.slice(), POS.nas.slice()],
    dbSan: [POS.db.slice(), POS.san.slice()],
  };
  const g = el('g', {}, Lfloor);
  stroke(g, rounded(on(o, local.db)));
  stroke(g, rounded(on(o, [[260, 90], [340, 90], POS.web.slice()])));
  stroke(g, rounded(on(o, [[420, 90], [500, 90], POS.was.slice()])));
  for (const k of ['webNas', 'wasNas', 'dbSan']) stroke(g, rounded(on(o, local[k])));
  const r: Record<string, Route> = {};
  for (const k in local) r[k] = routeOf(rounded(on(o, local[k])));

  // back to front so nearer devices overlap farther ones
  const dev = {} as Record<Key, Dev>;
  dev.sw = switchBox(o, POS.sw[0], POS.sw[1], `${name} Switch`);
  dev.nas = storage(o, POS.nas[0], POS.nas[1], `${name} NAS`, false);
  dev.web = tower(o, POS.web[0], POS.web[1], `${name} Web Server`);
  dev.san = storage(o, POS.san[0], POS.san[1], `${name} SAN`, true);
  dev.was = tower(o, POS.was[0], POS.was[1], `${name} WAS`);
  dev.db = dbServer(o, POS.db[0], POS.db[1], `${name} DB Server`);
  return { o, dev, r };
}

const dr = center(DR, 'DR 센터');
const main = center(MAIN, '주 센터');

// ---------------------------------------------------------------- WAN, cloud, active/passive
// both lines run on into the cloud's footprint, so the cloud covers their ends
const wanActive = on(MAIN, [[-190, 602], [-190, 290], POS.sw.slice()]);
const wanPassive = on(MAIN, [[-190, 602], [-190, 972], [122, 972]]);
for (const w of [wanActive, wanPassive]) {
  const p = stroke(Lfloor, rounded(w, 30), 3.2, RED);
  p.setAttribute('stroke-dasharray', '0.1 7');
}
const R_wan = routeOf(rounded(wanActive, 30));

/** Arrowhead lying flat on the floor: built in floor coordinates (a, b), then projected. */
function headIso(o: Vec, tip: readonly number[], from: readonly number[], size: number, parent: Element, colour = INK) {
  const da = tip[0] - from[0], db = tip[1] - from[1], l = Math.hypot(da, db), ua = da / l, ub = db / l, w = size * 0.48;
  const pts = on(o, [tip.slice(), [tip[0] - ua * size - ub * w, tip[1] - ub * size + ua * w], [tip[0] - ua * size + ub * w, tip[1] - ub * size - ua * w]]);
  const n = paint(parent, colour, 1.2); n.setAttribute('d', poly(pts, true));
  if (colour !== INK) n.setAttribute('stroke', colour);
  return n;
}

// the "Active" double arrow beside the live line
const ACT = [[-214, 480], [-214, 266], [-40, 266]];
stroke(Lfloor, rounded(on(MAIN, ACT), 30), 1.8, LIGHT);
headIso(MAIN, ACT[0], ACT[1], 16, Lfloor, LIGHT);
headIso(MAIN, ACT[2], ACT[1], 16, Lfloor, LIGHT);

// The WAN cloud lies flat on the floor, between the two platforms (b = 602), its long
// side along the WAN line (b axis), and rises as a slab. The body is the outline
// stacked upward in small steps: a thick stroke under every copy, covered by every
// copy's fill, leaves exactly the outline of the solid; the top face goes on last.
const cloudMove = el('g', {}, Lcloud);
const cloudG = el('g', { style: 'cursor:pointer', filter: 'url(#ink)' }, cloudMove);
el('title', {}, cloudG).textContent = 'WAN / Dedicated Line';
const CLOUD = 'M-74 0 L70 0 C94 0 96 -34 66 -34 C66 -64 26 -72 12 -52 C2 -82 -48 -78 -50 -44 C-80 -48 -92 -2 -74 0 Z';
const CLOUD_B = 602, THICK = 30, STEP = 2;
const cloudHome = iso(MAIN, -190, CLOUD_B, 0);
// outline x runs along +b, outline y along +a (bumps toward the far side), centred on the line
const FLAT = `matrix(${f(C)} ${f(-S)} ${f(C)} ${f(S)} 0 0) translate(0 41)`;
const layerAt = (k: number, attrs: Record<string, string | number>, d = CLOUD) =>
  el('path', { d, transform: `translate(0 ${f(-k)}) ${FLAT}`, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...attrs }, cloudG);
for (let k = 0; k < THICK; k += STEP) layerAt(k, { fill: 'none', stroke: LIGHT, 'stroke-width': PEN * 2 });
for (let k = 0; k < THICK; k += STEP) layerAt(k, { fill: CLOUD_SIDE });
layerAt(THICK, { fill: CLOUD_TOP, stroke: LIGHT, 'stroke-width': PEN });
layerAt(THICK, { fill: 'none', stroke: LIGHT, 'stroke-width': 1.1 }, 'M-40 -26 Q-30 -36 -18 -32 M24 -40 Q36 -42 42 -32');

// ---------------------------------------------------------------- replication lines (Main -> DR)
// The lines lie on the floor layer, so each storage covers its own start: no gap at the
// source. NAS replication leaves the NAS on the same line as the WAS NFS link (a = 500),
// turns in the gap between the platforms (clear of the NAS lid and both edges), runs left of the DR web server, loops outside the DR platform's back edge and comes
// down onto the DR NAS. DB replication runs well outside the right edges of both platforms.
const NAS_REP = [POS.nas.slice(), [500, 556], [270, 556], [270, 1270], [522, 1270], [522, 1103]];
const DB_REP = [POS.san.slice(), [884, 360], [884, 1042], [728, 1042]];
interface RepLine { route: Route; from: number; to: number }
function repLine(pts: number[][], exit: number, r = 34): RepLine {
  stroke(Lfloor, rounded(on(MAIN, pts), r), 4.4, RED);
  headIso(MAIN, pts[pts.length - 1], pts[pts.length - 2], 30, Lrep, RED);
  const route = routeOf(rounded(on(MAIN, pts), r));
  // pulses show only between where the line leaves the storage and the arrowhead
  return { route, from: exit, to: route.len - 22 };
}
const R_nasRep = repLine(NAS_REP, 52, 22);
const R_dbRep = repLine(DB_REP, 38);

// ---------------------------------------------------------------- labels on the floor
interface Lab { text: SVGTextElement; rect?: SVGRectElement; size: number }
const labs: Lab[] = [];
function label(o: Vec, a: number, b: number, txt: string, axis: 'a' | 'b',
  opt: { size?: number; weight?: number; pill?: string; ink?: string; edge?: string } = {}) {
  const size = opt.size ?? 19;
  const [x, y] = iso(o, a, b);
  const m = axis === 'a' ? [C, S, -C, S] : [C, -S, C, S];
  const g = el('g', { transform: `matrix(${m.map(f).join(' ')} ${f(x)} ${f(y)})` }, Llab);
  let rect: SVGRectElement | undefined;
  if (opt.pill) rect = el('rect', { fill: opt.pill, stroke: opt.edge ?? 'none', 'stroke-width': 1.3, rx: size * 0.95 }, g);
  const text = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': size, 'font-weight': opt.weight ?? 600,
    'font-family': FONT, fill: opt.ink ?? INK, 'letter-spacing': '0.02em' }, g);
  text.textContent = txt;
  labs.push({ text, rect, size });
}
const sizePills = () => {
  for (const l of labs) if (l.rect) {
    const w = l.text.getComputedTextLength(), h = l.size * 1.9, padX = l.size * 0.9;
    l.rect.setAttribute('x', f(-w / 2 - padX)); l.rect.setAttribute('width', f(w + padX * 2));
    l.rect.setAttribute('y', f(-h / 2)); l.rect.setAttribute('height', f(h));
  }
};

for (const [o, title] of [[MAIN, '주 센터'], [DR, 'DR 센터']] as const) {
  const light = { pill: PAPER, edge: INK };
  label(o, 100, 212, 'Switch', 'a', light);
  // each pill sits on the line feeding its server, centred over it
  label(o, POS.web[0], 124, 'Web Server', 'a', light);
  label(o, POS.was[0], 124, 'WAS', 'a', light);
  label(o, POS.db[0], 128, 'DB Server', 'a', light);
  label(o, 318, 296, 'NFS', 'b', { size: 17 });
  label(o, 478, 292, 'NFS', 'b', { size: 17 });
  label(o, 556, 330, 'NAS', 'b', { pill: RED, ink: PAPER, weight: 700 });
  label(o, 728, 300, 'SAN', 'b', { pill: BLUE, ink: PAPER, weight: 700 });
  label(o, 936, o === MAIN ? 225 : 236, title, 'b', { size: 54, weight: 800, ink: LIGHT });
}
// the two replication labels stand side by side at the same b, parallel
const REP_B = 668;
label(MAIN, NAS_REP[2][0], REP_B, 'NAS Replication', 'b', { size: 17, pill: RED, ink: PAPER, weight: 700 });
label(MAIN, DB_REP[1][0], REP_B, 'DB Replication', 'b', { size: 17, pill: RED, ink: PAPER, weight: 700 });
label(MAIN, -246, 372, 'Active', 'b', { size: 30, weight: 700, ink: LIGHT });
label(MAIN, -84, 612, 'WAN/Dedicated Line', 'b', { size: 30, weight: 700, ink: LIGHT });
label(MAIN, -224, 905, 'Passive', 'b', { size: 30, weight: 700, ink: LIGHT });
sizePills();
document.fonts?.ready.then(sizePills);

// ---------------------------------------------------------------- motion: packets, pulses, ripples
let now = 0;
const timers: Array<[number, () => void]> = [];
const later = (s: number, fn: () => void) => { timers.push([now + s, fn]); };

interface Packet { n: SVGCircleElement; route: Route; s: number; speed: number; rev: boolean; done?: () => void; alive: boolean }
const packets: Packet[] = [];
function send(route: Route, done?: () => void, rev = false) {
  let p = packets.find((q) => !q.alive);
  if (!p) {
    const n = el('circle', { r: 5.6, fill: INK, stroke: PAPER, 'stroke-width': 2.2 }, Lmove);
    p = { n, route, s: 0, speed: 0, rev, alive: false };
    packets.push(p);
  }
  Object.assign(p, { route, s: 0, speed: 330, rev, done, alive: true });
  const offFloor = route === R_wan;   // the WAN line runs over the navy section, not a platform
  p.n.setAttribute('fill', offFloor ? LIGHT : INK);
  p.n.setAttribute('stroke', offFloor ? NAVY : PAPER);
  p.n.style.display = '';
  movePacket(p);
}
function movePacket(p: Packet) {
  const q = p.route.p.getPointAtLength(p.rev ? p.route.len - p.s : p.s);
  p.n.setAttribute('cx', f(q.x)); p.n.setAttribute('cy', f(q.y));
}

// a pulse of light running along a red replication line
interface Pulse { n: SVGPathElement; line: RepLine; s: number; done?: () => void; alive: boolean }
const pulses: Pulse[] = [];
const PULSE = 80, PULSE_SPEED = 560;
function replicate(line: RepLine, done?: () => void) {
  let p = pulses.find((q) => !q.alive && q.line === line);
  if (!p) {
    const n = el('path', { d: line.route.p.getAttribute('d')!, fill: 'none', stroke: PAPER, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, Lflow);
    p = { n, line, s: line.from, done, alive: false };
    pulses.push(p);
  }
  Object.assign(p, { s: line.from, done, alive: true });
  p.n.style.display = 'none';
}
/** The lit stretch is [s - PULSE, s], clipped to where the line is visible. */
function drawPulse(p: Pulse) {
  const a = Math.max(p.line.from, p.s - PULSE), b = Math.min(p.line.to, p.s);
  if (b - a < 1) { p.n.style.display = 'none'; return; }
  p.n.style.display = '';
  p.n.setAttribute('stroke-dasharray', `${f(b - a)} ${f(p.line.route.len * 2)}`);
  p.n.setAttribute('stroke-dashoffset', f(-a));
}

interface Ripple { n: SVGEllipseElement; dev: Dev; age: number; alive: boolean }
const ripples: Ripple[] = [];
function ripple(dev: Dev, colour = INK) {
  let r = ripples.find((q) => !q.alive);
  if (!r) { r = { n: el('ellipse', { fill: 'none', 'stroke-width': 1.6 }, Lmove), dev, age: 0, alive: false }; ripples.push(r); }
  Object.assign(r, { dev, age: 0, alive: true });
  r.n.setAttribute('cx', f(dev.base[0])); r.n.setAttribute('cy', f(dev.base[1]));
  r.n.setAttribute('stroke', colour);
  r.n.style.display = '';
  flash(dev);
}
const flash = (dev: Dev, s = 0.45) => { dev.flash = Math.max(dev.flash, s); };

// ---------------------------------------------------------------- what happens to a request
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
function writeNas(from: 'webNas' | 'wasNas') {
  send(main.r[from], () => {
    ripple(main.dev.nas);
    later(0.2, () => replicate(R_nasRep, () => ripple(dr.dev.nas, RED)));
  });
}
function writeSan() {
  send(main.r.dbSan, () => {
    ripple(main.dev.san);
    later(0.2, () => replicate(R_dbRep, () => ripple(dr.dev.san, RED)));
  });
}
function serve(k: 'web' | 'was' | 'db') {
  flash(main.dev[k]);
  if (k === 'db') writeSan();
  else if (Math.random() < 0.85) writeNas(k === 'web' ? 'webNas' : 'wasNas');
  // the answer goes back out the way it came
  later(0.35, () => send(main.r[k], () => { flash(main.dev.sw, 0.25); send(R_wan, undefined, true); }, true));
}
function request() {
  send(R_wan, () => {
    flash(main.dev.sw, 0.3);
    const k = pick(['web', 'was', 'db'] as const);
    send(main.r[k], () => serve(k));
  });
}

// ---------------------------------------------------------------- clicks: the device acts
const onClick = (g: Element, fn: () => void) => g.addEventListener('pointerdown', (e) => { e.stopPropagation(); fn(); });
onClick(cloudG, () => { request(); later(0.25, request); later(0.5, request); });
onClick(main.dev.sw.g, () => { flash(main.dev.sw); for (const k of ['web', 'was', 'db'] as const) send(main.r[k], () => serve(k)); });
for (const k of ['web', 'was', 'db'] as const) onClick(main.dev[k].g, () => serve(k));
onClick(main.dev.nas.g, () => { ripple(main.dev.nas); replicate(R_nasRep, () => ripple(dr.dev.nas, RED)); });
onClick(main.dev.san.g, () => { ripple(main.dev.san); replicate(R_dbRep, () => ripple(dr.dev.san, RED)); });
// the DR side is passive: a click only wakes its status lights
for (const k of Object.keys(dr.dev) as Key[]) onClick(dr.dev[k].g, () => flash(dr.dev[k]));

// ---------------------------------------------------------------- loop
const wind = pointerWind(svg, 0);
let nextReq = 0.3, nextLog = 0.8, nextFile = 1.6;
later(1.1, request);
later(2.0, () => replicate(R_dbRep, () => ripple(dr.dev.san, RED)));

for (const d of Object.values(dr.dev)) d.standby = true;
const allDevs = [...Object.values(main.dev), ...Object.values(dr.dev)];
function frame(_t: number, dt: number) {
  // keep our own clock from dt, so pausing off screen and resuming carries on where it stopped
  now += dt;
  const t = now;
  wind.step(t);
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i][0] <= t) { const fn = timers[i][1]; timers.splice(i, 1); fn(); }

  if ((nextReq -= dt) <= 0) { nextReq = rnd(0.9, 2.1); request(); }
  // the database keeps writing its log to SAN between requests, and each write is replicated
  if ((nextLog -= dt) <= 0) { nextLog = rnd(1.6, 3.0); flash(main.dev.db, 0.25); writeSan(); }
  // and the application servers save files to NAS the same way, so both lines stay about equally busy
  if ((nextFile -= dt) <= 0) { nextFile = rnd(1.8, 3.4); const k = pick(['web', 'was'] as const); flash(main.dev[k], 0.25); writeNas(k === 'web' ? 'webNas' : 'wasNas'); }

  for (const p of packets) if (p.alive) {
    p.s += p.speed * dt;
    if (p.s >= p.route.len) { p.alive = false; p.n.style.display = 'none'; p.done?.(); }
    else movePacket(p);
  }
  for (const p of pulses) if (p.alive) {
    p.s += PULSE_SPEED * dt;
    if (p.s - PULSE >= p.line.to) { p.alive = false; p.n.style.display = 'none'; }
    else {
      drawPulse(p);
      if (p.done && p.s >= p.line.to) { const d = p.done; p.done = undefined; d(); }
    }
  }
  for (const r of ripples) if (r.alive) {
    r.age += dt;
    const u = r.age / 1.1;
    if (u >= 1) { r.alive = false; r.n.style.display = 'none'; continue; }
    const k = 1 + u * 0.7;
    r.n.setAttribute('rx', f(r.dev.rx * k)); r.n.setAttribute('ry', f(r.dev.ry * k));
    r.n.setAttribute('opacity', f((1 - u) * (1 - u)));
  }
  for (const d of allDevs) {
    d.flash = Math.max(0, d.flash - dt);
    for (const l of d.leds) {
      l.on = Math.max(0, l.on - dt);
      if ((l.next -= dt) <= 0) { l.next = d.standby ? rnd(2.5, 7) : rnd(0.6, 3.5); l.on = 0.12; }
      const lit = l.on > 0 || (d.flash > 0 && Math.floor(d.flash * 16) % 2 === 0);
      const fill = lit ? d.ledOn : d.ledOff;
      if (l.n.getAttribute('fill') !== fill) l.n.setAttribute('fill', fill);
    }
    if (d.glow) {
      const o = f(clamp(d.flash / 0.45, 0, 1) * 0.75);
      if (d.glow.getAttribute('opacity') !== o) d.glow.setAttribute('opacity', o);
    }
  }
  // it drifts a little along its own line, never off the wires
  const drift = wind.value * 6 + wobble(t * 0.35) * 3, dx = drift * C, dy = -drift * S;
  cloudMove.setAttribute('transform', `translate(${f(cloudHome[0] + dx)} ${f(cloudHome[1] + dy)})`);
}

// Animate only while the drawing is on screen. ?debug keeps run()'s manual stepping.
let stop: (() => void) | null = null;
const start = () => { if (!stop) stop = run(frame); };
const halt = () => { if (stop) { stop(); stop = null; } };
if (new URLSearchParams(location.search).has('debug') || !('IntersectionObserver' in window)) start();
else {
  frame(0, 0); // draw the first state right away so nothing is missing before it scrolls in
  new IntersectionObserver((entries) => { if (entries[entries.length - 1].isIntersecting) start(); else halt(); }, { threshold: 0.05 }).observe(svg);
}

declare global { interface Window { __diagram?: unknown } }
window.__diagram = { main, dr, request, replicate: () => replicate(R_nasRep) };
