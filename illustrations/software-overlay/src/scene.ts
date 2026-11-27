// Software overlay — how PeerGFS sits beside the NAS, not in the data path.
//
// Two platforms, 주 센터 and DR 센터, both Active. Each has a WAS, a NAS and a PeerGFS
// Agent server. Three kinds of path, told apart by line and colour:
//  - service path   WAS ↔ NAS (NFS, data path): a calm ink line on the floor
//  - replication    Agent ↔ Agent (Delta 전송): a bold orange line with arrowheads
//  - management     PMC · Broker ↔ each centre's WAS, through the WAN cloud: a blue dotted line
// The Agent hears about changes from the NAS by its Audit Event API — an orange link as
// bold as the replication line, and apart from the service path. That out-of-band link
// is the point of the picture.
//
// What moves: a write lands on one centre's NAS (WAS → NAS), the NAS tells its Agent,
// the Agent sends the delta across, and the other Agent applies it to its NAS. The
// direction alternates, so both centres are seen writing. A slow management heartbeat
// runs from PMC · Broker to both Agents.
//
// Sits on a dark navy section (#162538) with no background of its own. Devices and
// platforms keep their own colours; lines and text off the platforms are pale.
// It only animates while it is on screen.
import { el, pen, paint, run, f, pt, PAPER, type Vec } from './lib/ink.ts';
import { rnd, clamp, wobble } from './lib/motion.ts';

// ---------------------------------------------------------------- look
const INK = '#1c1c1c';
const BLUE = '#5a80ea', BLUE_SIDE = '#3f62c8', BLUE_TOP = '#7d9cf0', BLUE_LIT = '#b7c9fa';
const ACCENT = '#7ab0e0';          // light blue: out-of-band event link, management path
const ORANGE = '#e8693f';          // replication, Delta 전송, NAS Read/Write, Active
const WASH = '#eef2fb';
const LIGHT = '#c8d8f0';
const NAVY = '#162538';
const CLOUD_TOP = '#2a4266', CLOUD_SIDE = '#1e3150';
const PEN = 2.6, THIN = 1.5;
const FONT = "'DM Sans', 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', 'Segoe UI', sans-serif";

// ---------------------------------------------------------------- isometric floor
const C = 0.8660254, S = 0.5;
const PA = 640, PB = 460, TH = 18, GAP = 140;
const MAIN: Vec = [200, 700];   // leaves the lower-left corner to the legend
const DR: Vec = [MAIN[0] + (PB + GAP) * C, MAIN[1] - (PB + GAP) * S];   // the DR platform sits behind 주 센터 along b
const DRB = PB + GAP;   // DR 센터's b offset in 주 센터 coordinates
const iso = (o: Vec, a: number, b: number, h = 0): Vec => [o[0] + (a + b) * C, o[1] + (a - b) * S - h];
const on = (o: Vec, pts: readonly (readonly number[])[]): Vec[] => pts.map(([a, b, h = 0]) => iso(o, a, b, h));
const poly = (pts: Vec[], close = false): string => 'M' + pts.map(pt).join(' L') + (close ? ' Z' : '');
function rounded(pts: Vec[], r = 28): string {
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
const stage = (document.querySelector('#hw-overlay') ?? document.querySelector('#stage')) as HTMLElement;
const svg = el('svg', { viewBox: '0 0 1800 1090', role: 'img',
  'aria-label': '소프트웨어 오버레이 구조: 주 센터와 DR 센터의 WAS·NAS·PeerGFS Agent, NAS 감사 이벤트로 변경을 받아 Agent 간 Delta 전송, PMC·Broker 관리 경로' });
svg.setAttribute('style', 'display:block;width:100%;height:auto;user-select:none;touch-action:manipulation');
svg.style.color = INK;
stage.appendChild(svg);

const defs = el('defs', {}, svg);
const flt = el('filter', { id: 'ov-ink', x: '-1%', y: '-1%', width: '102%', height: '102%' }, defs);
el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.04', numOctaves: 2, seed: 5, result: 'n' }, flt);
el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 2.4, xChannelSelector: 'R', yChannelSelector: 'G' }, flt);
const hatch = el('pattern', { id: 'ov-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(58)' }, defs);
el('rect', { width: 6, height: 6, fill: PAPER }, hatch);
el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: INK, 'stroke-width': 0.9 }, hatch);
const HATCH = 'url(#ov-hatch)';
const hatchLight = el('pattern', { id: 'ov-hatch-light', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(58)' }, defs);
el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: LIGHT, 'stroke-width': 0.9, opacity: 0.55 }, hatchLight);
const HATCH_LIGHT = 'url(#ov-hatch-light)';

const layer = (filtered: boolean) => el('g', filtered ? { filter: 'url(#ov-ink)' } : {}, svg);
const Lfloor = layer(true);   // platforms, floor paths
const Lmove = layer(false);   // packets and ripples, under the devices
const Ldev = layer(true);     // devices
const Lglow = layer(false);   // status lights and flashes
const Lcloud = el('g', {}, svg);
const Lrep = layer(false);    // arrowheads and pulses on the replication line
const Llab = layer(false);    // labels
const Lroutes = el('g', { visibility: 'hidden' }, svg);

const stroke = (parent: Element, dd: string, w = PEN, colour = INK) => { const p = pen(parent, w); p.setAttribute('d', dd); if (colour !== INK) p.setAttribute('stroke', colour); return p; };
/** Outlined dots: an ink dotted line under a coloured one, so the dots read on the dark section and on the pale floor alike. */
function dotted(parent: Element, dd: string, colour = ACCENT, w = 3.6) {
  const under = stroke(parent, dd, w + 2.4); under.setAttribute('stroke-dasharray', '0.1 10');
  const over = stroke(parent, dd, w, colour); over.setAttribute('stroke-dasharray', '0.1 10');
}
/** The out-of-band link NAS → Agent: as bold as the replication line, in the same orange. */
function eventLink(parent: Element, dd: string) {
  stroke(parent, dd, 7, ORANGE).setAttribute('stroke-linecap', 'butt');
}
function headIso(o: Vec, tip: readonly number[], from: readonly number[], size: number, parent: Element, colour = INK) {
  const da = tip[0] - from[0], db = tip[1] - from[1], l = Math.hypot(da, db), ua = da / l, ub = db / l, w = size * 0.5;
  const pts = on(o, [tip, [tip[0] - ua * size - ub * w, tip[1] - ub * size + ua * w], [tip[0] - ua * size + ub * w, tip[1] - ub * size - ua * w]]);
  const n = paint(parent, colour, 1.2); n.setAttribute('d', poly(pts, true));
  if (colour !== INK) n.setAttribute('stroke', colour);
  return n;
}

// ---------------------------------------------------------------- platforms
function platform(o: Vec) {
  const g = el('g', {}, Lfloor);
  const c = (a: number, b: number, h = 0) => iso(o, a, b, h);
  const front = paint(g, HATCH_LIGHT, THIN); front.setAttribute('d', poly([c(0, 0), c(PA, 0), c(PA, 0, -TH), c(0, 0, -TH)], true));
  const side = paint(g, 'rgba(200,216,240,0.10)', THIN); side.setAttribute('d', poly([c(PA, 0), c(PA, PB), c(PA, PB, -TH), c(PA, 0, -TH)], true));
  const top = paint(g, WASH, PEN); top.setAttribute('d', poly([c(0, 0), c(PA, 0), c(PA, PB), c(0, PB)], true));
  for (const n of [front, side, top]) n.setAttribute('stroke', LIGHT);
  stroke(g, poly([c(20, 20), c(PA - 20, 20), c(PA - 20, PB - 20), c(20, PB - 20)], true), 0.8).setAttribute('stroke-dasharray', '1 7');
}

// ---------------------------------------------------------------- devices
interface Led { n: SVGCircleElement; on: number; next: number }
interface Dev { g: SVGGElement; leds: Led[]; flash: number; base: Vec; rx: number; ry: number; glow?: SVGPathElement; ledOn: string; ledOff: string }
function led(p: Vec, r = 3): Led {
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
function device(title: string): SVGGElement {
  const g = el('g', { style: 'cursor:pointer' }, Ldev);
  el('title', {}, g).textContent = title;
  return g;
}
const HALF = 34;
/** A tower server. The Agent server gets a blue lid so it reads as the PeerGFS piece. */
function tower(o: Vec, ca: number, cb: number, title: string, agent = false): Dev {
  const g = device(title);
  const a0 = ca - HALF, b0 = cb - HALF, h = agent ? 96 : 108;
  const { T } = box(g, o, a0, ca + HALF, b0, cb + HALF, 0, h, agent ? { top: BLUE } : {});
  const F = (u: number, v: number) => iso(o, a0 + u, b0, v);
  stroke(g, [h - 16, h - 26, h - 36].map((v) => `M${pt(F(10, v))} L${pt(F(40, v))}`).join(' '), THIN);
  stroke(g, [14, 21, 28, 35, 42].map((v) => `M${pt(F(10, v))} L${pt(F(30, v))}`).join(' '), 1.1);
  if (agent) {
    // the PeerGFS mark on the lid: two arrows passing each other, as on the Agent pill
    const P = (u: number, v: number) => iso(o, ca + u, cb + v, h);
    stroke(g, `M${pt(P(-16, 8))} L${pt(P(16, 8))} M${pt(P(10, 13))} L${pt(P(16, 8))} L${pt(P(10, 3))}`
      + ` M${pt(P(16, -8))} L${pt(P(-16, -8))} M${pt(P(-10, -3))} L${pt(P(-16, -8))} L${pt(P(-10, -13))}`, 3, PAPER);
  }
  const glow = el('path', { d: T.getAttribute('d')!, fill: agent ? BLUE_LIT : '#fff1c4', opacity: 0 }, Lglow);
  return { g, leds: [led(F(54, h - 16)), led(F(54, h - 27))], flash: 0, base: iso(o, ca, cb), rx: 66, ry: 38, glow, ledOn: BLUE, ledOff: PAPER };
}
function storage(o: Vec, ca: number, cb: number, title: string): Dev {
  const g = device(title);
  const r = 48, h = 96, [x, y] = iso(o, ca, cb), rx = r * 1.2247, ry = r * 0.7071;
  paint(g, PAPER).setAttribute('d', `M${f(x - rx)} ${f(y - h)} L${f(x - rx)} ${f(y)} A${f(rx)} ${f(ry)} 0 0 0 ${f(x + rx)} ${f(y)} L${f(x + rx)} ${f(y - h)} Z`);
  for (const k of [0.34, 0.67]) stroke(g, `M${f(x - rx)} ${f(y - h * k)} A${f(rx)} ${f(ry)} 0 0 0 ${f(x + rx)} ${f(y - h * k)}`, THIN);
  const lid = `M${f(x - rx)} ${f(y - h)} A${f(rx)} ${f(ry)} 0 1 1 ${f(x + rx)} ${f(y - h)} A${f(rx)} ${f(ry)} 0 1 1 ${f(x - rx)} ${f(y - h)} Z`;
  paint(g, PAPER).setAttribute('d', lid);
  const glow = el('path', { d: lid, fill: '#fff1c4', opacity: 0 }, Lglow);
  const leds: Led[] = [];
  for (const k of [0.17, 0.5]) for (const th of [0.42, 0.62]) leds.push(led([x + rx * Math.cos(th), y - h * k - 7 + ry * Math.sin(th)], 2.8));
  return { g, leds, flash: 0, base: [x, y], rx: rx + 8, ry: ry + 5, glow, ledOn: BLUE, ledOff: PAPER };
}

// ---------------------------------------------------------------- one centre
// Local floor coordinates (a: 0..PA toward the viewer's right, b: 0..PB away to the upper right).
const POS = { was: [150, 95], nas: [150, 360], agent: [500, 360] } as const;
interface Route { p: SVGPathElement; len: number }
const routeOf = (dd: string): Route => { const p = el('path', { d: dd, fill: 'none' }, Lroutes); return { p, len: p.getTotalLength() }; };
interface Centre { o: Vec; was: Dev; nas: Dev; agent: Dev; svc: Route; evt: Route }

function centre(o: Vec, name: string): Centre {
  platform(o);
  const svcPts = on(o, [POS.was, POS.nas]);
  const evtPts = on(o, [POS.nas, POS.agent]);
  stroke(Lfloor, poly(svcPts));                       // service path: calm ink
  eventLink(Lfloor, poly(evtPts));                    // Audit Event API: out of band
  // back to front
  const nas = storage(o, POS.nas[0], POS.nas[1], `${name} NAS`);
  const agent = tower(o, POS.agent[0], POS.agent[1], `${name} PeerGFS Agent`, true);
  const was = tower(o, POS.was[0], POS.was[1], `${name} WAS`);
  return { o, was, nas, agent, svc: routeOf(poly(svcPts)), evt: routeOf(poly(evtPts)) };
}

// ---------------------------------------------------------------- management: PMC · Broker, WAN cloud
// the cloud sits low in the gap (b = 470) so the DR branch runs a good way out before it turns
const MG_B = 470;
const PMC = [-380, MG_B], CLOUD = [-160, MG_B];
// from the cloud straight down (주 센터) or up (DR 센터) along a = -160, then in to each WAS
const MG_MAIN = [CLOUD, [-160, POS.was[1]], POS.was];
const MG_DR = [CLOUD, [-160, DRB + POS.was[1]], [POS.was[0], DRB + POS.was[1]]];
const dr = centre(DR, 'DR 센터');
const main = centre(MAIN, '주 센터');
// drawn after the platforms: the last stretch of each runs across a platform to its Agent
dotted(Lfloor, poly(on(MAIN, [PMC, CLOUD])));
dotted(Lfloor, rounded(on(MAIN, MG_MAIN), 30));
dotted(Lfloor, rounded(on(MAIN, MG_DR), 30));
const R_mgPmc = routeOf(poly(on(MAIN, [PMC, CLOUD])));
const R_mgMain = routeOf(rounded(on(MAIN, MG_MAIN), 30));
const R_mgDr = routeOf(rounded(on(MAIN, MG_DR), 30));

// PMC · Broker: a monitor standing on the floor
function monitor(o: Vec, a: number, b: number): Dev {
  const g = device('PMC · Broker');
  const [x, y] = iso(o, a, b);
  // stand
  box(g, o, a - 22, a + 22, b - 22, b + 22, 0, 8);
  box(g, o, a - 6, a + 6, b - 6, b + 6, 8, 34);
  // screen: a slab facing the viewer's lower left (its face is the a–height plane)
  const sw = 66, sh = 92, z0 = 40, d = 12;
  const c = (u: number, v: number, k: number) => iso(o, a + u, b - d / 2 + k, z0 + v);
  const back = paint(g, HATCH); back.setAttribute('d', poly([c(sw, 0, 0), c(sw, 0, d), c(sw, sh, d), c(sw, sh, 0)], true));
  const top = paint(g, PAPER); top.setAttribute('d', poly([c(-sw, sh, 0), c(sw, sh, 0), c(sw, sh, d), c(-sw, sh, d)], true));
  const face = paint(g, PAPER); face.setAttribute('d', poly([c(-sw, 0, 0), c(sw, 0, 0), c(sw, sh, 0), c(-sw, sh, 0)], true));
  const scr = paint(g, '#dfe8fb', THIN); scr.setAttribute('d', poly([c(-sw + 9, 9, 0), c(sw - 9, 9, 0), c(sw - 9, sh - 9, 0), c(-sw + 9, sh - 9, 0)], true));
  // a little console on the screen: three bars
  stroke(g, [62, 50, 38].map((v, i) => `M${pt(c(-sw + 22, v, 0))} L${pt(c(sw - 22 - i * 14, v, 0))}`).join(' '), 3, BLUE);
  const glow = el('path', { d: scr.getAttribute('d')!, fill: BLUE_LIT, opacity: 0 }, Lglow);
  return { g, leds: [], flash: 0, base: [x, y], rx: 70, ry: 40, glow, ledOn: BLUE, ledOff: PAPER };
}
const pmc = monitor(MAIN, PMC[0], PMC[1]);

// the WAN cloud lies flat between the platforms, as in the other drawings
const cloudMove = el('g', {}, Lcloud);
const cloudG = el('g', { filter: 'url(#ov-ink)' }, cloudMove);
el('title', {}, cloudG).textContent = 'WAN';
const CLOUD_D = 'M-74 0 L70 0 C94 0 96 -34 66 -34 C66 -64 26 -72 12 -52 C2 -82 -48 -78 -50 -44 C-80 -48 -92 -2 -74 0 Z';
const cloudHome = iso(MAIN, CLOUD[0], CLOUD[1], 0);
const FLAT = `matrix(${f(C)} ${f(-S)} ${f(C)} ${f(S)} 0 0) translate(0 41)`;
const layerAt = (k: number, attrs: Record<string, string | number>, d = CLOUD_D) =>
  el('path', { d, transform: `translate(0 ${f(-k)}) ${FLAT}`, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...attrs }, cloudG);
for (let k = 0; k < 30; k += 2) layerAt(k, { fill: 'none', stroke: LIGHT, 'stroke-width': PEN * 2 });
for (let k = 0; k < 30; k += 2) layerAt(k, { fill: CLOUD_SIDE });
layerAt(30, { fill: CLOUD_TOP, stroke: LIGHT, 'stroke-width': PEN });
layerAt(30, { fill: 'none', stroke: LIGHT, 'stroke-width': 1.1 }, 'M-40 -26 Q-30 -36 -18 -32 M24 -40 Q36 -42 42 -32');

// ---------------------------------------------------------------- replication: Agent ↔ Agent
// Out of each Agent toward the viewer, along the outside of both platforms, into the other Agent.
const AG_TIP = POS.agent[0] + HALF + 6;
const REP = [[AG_TIP, POS.agent[1]], [PA + 80, POS.agent[1]], [PA + 80, DRB + POS.agent[1]], [AG_TIP, DRB + POS.agent[1]]];
const repD = rounded(on(MAIN, REP), 40);
stroke(Lfloor, repD, 7, ORANGE).setAttribute('stroke-linecap', 'butt');
headIso(MAIN, REP[0], REP[1], 34, Lrep, ORANGE);
headIso(MAIN, REP[3], REP[2], 34, Lrep, ORANGE);
const R_rep = routeOf(repD);
const R_repBack = routeOf(rounded(on(MAIN, [...REP].reverse()), 40));

// ---------------------------------------------------------------- labels
interface Lab { g: SVGGElement; texts: SVGTextElement[]; rect?: SVGRectElement; size: number }
const labs: Lab[] = [];
/** Text lying on the floor along the a or b axis; several lines stack toward the viewer. */
function label(o: Vec, a: number, b: number, lines: string | string[], axis: 'a' | 'b',
  opt: { size?: number; weight?: number; pill?: string; ink?: string; edge?: string } = {}): Lab {
  const size = opt.size ?? 25, ls = Array.isArray(lines) ? lines : [lines], lh = size * 1.18;
  const [x, y] = iso(o, a, b);
  const m = axis === 'a' ? [C, S, -C, S] : [C, -S, C, S];
  const g = el('g', { transform: `matrix(${m.map(f).join(' ')} ${f(x)} ${f(y)})` }, Llab);
  let rect: SVGRectElement | undefined;
  if (opt.pill) rect = el('rect', { fill: opt.pill, stroke: opt.edge ?? 'none', 'stroke-width': 1.4 }, g);
  const texts = ls.map((t, i) => {
    const n = el('text', { y: f((i - (ls.length - 1) / 2) * lh), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': size,
      'font-weight': i === 0 ? opt.weight ?? 600 : 600, 'font-family': FONT, fill: opt.ink ?? INK, 'letter-spacing': '0.01em' }, g);
    n.textContent = t;
    return n;
  });
  const l = { g, texts, rect, size };
  labs.push(l);
  return l;
}
const sizePills = () => {
  for (const l of labs) if (l.rect) {
    const w = Math.max(...l.texts.map((t) => t.getComputedTextLength()));
    const h = l.size * 1.18 * (l.texts.length - 1) + l.size * 1.8, padX = l.size * 0.9;
    l.rect.setAttribute('x', f(-w / 2 - padX)); l.rect.setAttribute('width', f(w + padX * 2));
    l.rect.setAttribute('y', f(-h / 2)); l.rect.setAttribute('height', f(h));
    l.rect.setAttribute('rx', f(Math.min(h / 2, l.size * 1.1)));
  }
};

const lightPill = { pill: PAPER, edge: INK };
for (const [o, title] of [[MAIN, '주 센터'], [DR, 'DR 센터']] as const) {
  // Every label lies in front of the device it names (smaller b, or larger a), never behind
  // one: a tall box or cylinder hides the floor behind it, and a label there would sit on it.
  // NFS / Data Path: along the WAS–NAS line, on its upper side (-a), centred on it.
  // "Data Path" lies next to the line, "NFS" above it; b is kept clear of the floor the WAS box hides.
  // The free stretch there runs from where the WAS box stops hiding the floor (b ≈ 205)
  // to where the NAS starts (b ≈ 315); the text is centred in it.
  const svcMid = 248;
  label(o, POS.was[0] - 50, svcMid, 'NFS', 'b', { size: 24, weight: 700 });
  label(o, POS.was[0] - 25, svcMid, 'Data Path', 'b', { size: 24, weight: 600 });
  // NAS / Read/Write: a two-line pill sitting on the NAS → Agent link, halfway along it,
  // its far end held well short of the platform's back edge
  // close beside the cylinder (it names the NAS): its near edge a small step past the NAS rim
  const pillA = POS.nas[0] + 48 + 16 + 37;
  label(o, pillA, POS.nas[1] - 15, ['NAS', 'Read/Write'], 'b', { size: 25, weight: 700, pill: ORANGE, ink: PAPER });
  // WAS · Active: turned along b like the NAS pill, under the WAS box and in the same row,
  // to the NAS pill's left, its near end well clear of the platform's front edge
  // its upper edge (the -a side) lines up with the NAS pill's: pill depth = lines·1.18·size + 1.8·size
  const nasHalf = (25 * 1.18 * 1 + 25 * 1.8) / 2, wasHalf = (26 * 1.8) / 2;
  label(o, pillA - nasHalf + wasHalf, 130, 'WAS · Active', 'b', { ...lightPill, size: 26 });
  // PeerGFS Agent / Out-of-Band / 감지·전송: just to the Agent's left (its -b side),
  // ending a little short of the Agent's front face
  label(o, POS.agent[0], POS.agent[1] - HALF - 140, ['PeerGFS Agent', 'Out-of-Band', '감지·전송'], 'b', { size: 25, weight: 700, pill: BLUE, ink: PAPER });
  label(o, 790, 230, title, 'b', { size: 60, weight: 800, ink: LIGHT });
  label(o, 846, 230, 'Active', 'b', { size: 36, weight: 700, ink: ORANGE });
}
label(MAIN, PA + 80, DRB - GAP / 2, 'Delta 전송', 'b', { size: 30, weight: 800, pill: ORANGE, ink: PAPER });
label(MAIN, PMC[0], MG_B - 94, ['PMC · Broker', '중앙 관리 / 메시지 중계'], 'a', { size: 27, weight: 800, ink: LIGHT });

// legend: a pale card, so each sample is drawn exactly as the path it names
const LEG: Vec = [12, 878];
const leg = el('g', { transform: `translate(${LEG[0]} ${LEG[1]})` }, Llab);
el('rect', { width: 430, height: 196, rx: 14, fill: WASH, stroke: LIGHT, 'stroke-width': 1.4 }, leg);
const legText = (x: number, y: number, t: string, size: number, weight: number) => {
  const n = el('text', { x, y, 'font-size': size, 'font-weight': weight, 'font-family': FONT, fill: INK, 'dominant-baseline': 'central' }, leg);
  n.textContent = t;
};
legText(22, 34, '경로 구분', 26, 800);
const rows: Array<[string, (y: number) => void]> = [
  ['서비스 경로 (WAS ↔ NAS)', (y) => stroke(leg, `M22 ${y} L82 ${y}`, PEN)],
  ['복제 경로 (Agent ↔ Agent)', (y) => { stroke(leg, `M22 ${y} L72 ${y}`, 7, ORANGE).setAttribute('stroke-linecap', 'butt'); paint(leg, ORANGE, 1).setAttribute('d', `M70 ${y - 9} L86 ${y} L70 ${y + 9} Z`); }],
  ['관리 경로 (PMC · Broker)', (y) => dotted(leg, `M24 ${y} L84 ${y}`)],
];
rows.forEach(([t, draw], i) => { const y = 82 + i * 40; draw(y); legText(100, y, t, 24, 600); });

sizePills();
document.fonts?.ready.then(sizePills);

// ---------------------------------------------------------------- motion
let now = 0;
const timers: Array<[number, () => void]> = [];
const later = (s: number, fn: () => void) => { timers.push([now + s, fn]); };

type Kind = 'data' | 'event' | 'mgmt';
interface Packet { n: SVGCircleElement; route: Route; s: number; speed: number; rev: boolean; done?: () => void; alive: boolean }
const packets: Packet[] = [];
const LOOK: Record<Kind, { r: number; fill: string; stroke: string; speed: number }> = {
  data: { r: 6.4, fill: INK, stroke: PAPER, speed: 300 },
  event: { r: 6.4, fill: ACCENT, stroke: INK, speed: 260 },
  mgmt: { r: 5.4, fill: ACCENT, stroke: NAVY, speed: 210 },
};
function send(route: Route, kind: Kind, done?: () => void, rev = false) {
  let p = packets.find((q) => !q.alive);
  if (!p) { p = { n: el('circle', { 'stroke-width': 2.2 }, Lmove), route, s: 0, speed: 0, rev, alive: false }; packets.push(p); }
  const look = LOOK[kind];
  Object.assign(p, { route, s: 0, speed: look.speed, rev, done, alive: true });
  p.n.setAttribute('r', String(look.r)); p.n.setAttribute('fill', look.fill); p.n.setAttribute('stroke', look.stroke);
  p.n.style.display = '';
  movePacket(p);
}
function movePacket(p: Packet) {
  const q = p.route.p.getPointAtLength(p.rev ? p.route.len - p.s : p.s);
  p.n.setAttribute('cx', f(q.x)); p.n.setAttribute('cy', f(q.y));
}

// a pulse of light running along the orange replication line
interface Pulse { n: SVGPathElement; route: Route; s: number; done?: () => void; alive: boolean }
const pulses: Pulse[] = [];
const PULSE = 90, PULSE_SPEED = 520, P_FROM = 0, P_TAIL = 30;
function delta(route: Route, done?: () => void) {
  let p = pulses.find((q) => !q.alive);
  if (!p) { p = { n: el('path', { fill: 'none', stroke: PAPER, 'stroke-width': 3, 'stroke-linecap': 'round' }, Lrep), route, s: 0, alive: false }; pulses.push(p); }
  Object.assign(p, { route, s: P_FROM, done, alive: true });
  p.n.setAttribute('d', route.p.getAttribute('d')!);
  p.n.style.display = 'none';
}
function drawPulse(p: Pulse) {
  const end = p.route.len - P_TAIL;
  const a = Math.max(P_FROM, p.s - PULSE), b = Math.min(end, p.s);
  if (b - a < 1) { p.n.style.display = 'none'; return; }
  p.n.style.display = '';
  p.n.setAttribute('stroke-dasharray', `${f(b - a)} ${f(p.route.len * 2)}`);
  p.n.setAttribute('stroke-dashoffset', f(-a));
}

interface Ripple { n: SVGEllipseElement; dev: Dev; age: number; alive: boolean }
const ripples: Ripple[] = [];
function ripple(dev: Dev, colour = INK) {
  let r = ripples.find((q) => !q.alive);
  if (!r) { r = { n: el('ellipse', { fill: 'none', 'stroke-width': 2 }, Lmove), dev, age: 0, alive: false }; ripples.push(r); }
  Object.assign(r, { dev, age: 0, alive: true });
  r.n.setAttribute('cx', f(dev.base[0])); r.n.setAttribute('cy', f(dev.base[1]));
  r.n.setAttribute('stroke', colour);
  r.n.style.display = '';
  flash(dev);
}
const flash = (dev: Dev, s = 0.45) => { dev.flash = Math.max(dev.flash, s); };

// ---------------------------------------------------------------- the story, one direction at a time
/** 1) WAS writes to its NAS  2) the NAS raises an audit event to its Agent
 *  3) the Agent sends the delta across  4) the other Agent applies it to its NAS. */
function replicateWrite(src: Centre, dst: Centre) {
  flash(src.was);
  send(src.svc, 'data', () => {
    ripple(src.nas);
    later(0.15, () => send(src.evt, 'event', () => {
      flash(src.agent);
      delta(src === main ? R_rep : R_repBack, () => {
        flash(dst.agent);
        send(dst.evt, 'event', () => ripple(dst.nas, ORANGE), true);
      });
    }));
  });
}
function heartbeat() {
  flash(pmc, 0.3);
  send(R_mgPmc, 'mgmt', () => {
    send(R_mgMain, 'mgmt', () => flash(main.was, 0.25), false);
    send(R_mgDr, 'mgmt', () => flash(dr.was, 0.25), false);
  });
}

// clicks: a WAS writes from its side; the cloud or PMC sends a heartbeat
const onClick = (g: Element, fn: () => void) => g.addEventListener('pointerdown', (e) => { e.stopPropagation(); fn(); });
onClick(main.was.g, () => replicateWrite(main, dr));
onClick(dr.was.g, () => replicateWrite(dr, main));
onClick(pmc.g, heartbeat);
onClick(cloudG, heartbeat);

// ---------------------------------------------------------------- loop
let nextWrite = 0.6, nextBeat = 2.4, fromMain = true;
const allDevs = [main.was, main.nas, main.agent, dr.was, dr.nas, dr.agent, pmc];

function frame(_t: number, dt: number) {
  now += dt;
  const t = now;
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i][0] <= t) { const fn = timers[i][1]; timers.splice(i, 1); fn(); }

  // writes alternate between the centres, so the flow is seen both ways
  if ((nextWrite -= dt) <= 0) { nextWrite = rnd(2.6, 3.4); if (fromMain) replicateWrite(main, dr); else replicateWrite(dr, main); fromMain = !fromMain; }
  if ((nextBeat -= dt) <= 0) { nextBeat = rnd(5.5, 7); heartbeat(); }

  for (const p of packets) if (p.alive) {
    p.s += p.speed * dt;
    if (p.s >= p.route.len) { p.alive = false; p.n.style.display = 'none'; p.done?.(); }
    else movePacket(p);
  }
  for (const p of pulses) if (p.alive) {
    p.s += PULSE_SPEED * dt;
    const end = p.route.len - P_TAIL;
    if (p.s - PULSE >= end) { p.alive = false; p.n.style.display = 'none'; }
    else { drawPulse(p); if (p.done && p.s >= end) { const d = p.done; p.done = undefined; d(); } }
  }
  for (const r of ripples) if (r.alive) {
    r.age += dt;
    const v = r.age / 1.1;
    if (v >= 1) { r.alive = false; r.n.style.display = 'none'; continue; }
    const k = 1 + v * 0.7;
    r.n.setAttribute('rx', f(r.dev.rx * k)); r.n.setAttribute('ry', f(r.dev.ry * k));
    r.n.setAttribute('opacity', f((1 - v) * (1 - v)));
  }
  for (const d of allDevs) {
    d.flash = Math.max(0, d.flash - dt);
    for (const l of d.leds) {
      l.on = Math.max(0, l.on - dt);
      if ((l.next -= dt) <= 0) { l.next = rnd(0.8, 3.8); l.on = 0.12; }
      const lit = l.on > 0 || (d.flash > 0 && Math.floor(d.flash * 16) % 2 === 0);
      const fill = lit ? d.ledOn : d.ledOff;
      if (l.n.getAttribute('fill') !== fill) l.n.setAttribute('fill', fill);
    }
    if (d.glow) {
      const o = f(clamp(d.flash / 0.45, 0, 1) * 0.75);
      if (d.glow.getAttribute('opacity') !== o) d.glow.setAttribute('opacity', o);
    }
  }
  // the cloud drifts a little along its own line
  const drift = wobble(t * 0.35) * 3, dx = drift * C, dy = -drift * S;
  cloudMove.setAttribute('transform', `translate(${f(cloudHome[0] + dx)} ${f(cloudHome[1] + dy)})`);
}

// Animate only while the drawing is on screen. ?debug keeps run()'s manual stepping.
let stop: (() => void) | null = null;
const start = () => { if (!stop) stop = run(frame); };
const halt = () => { if (stop) { stop(); stop = null; } };
frame(0, 0);
if (new URLSearchParams(location.search).has('debug') || !('IntersectionObserver' in window)) start();
else new IntersectionObserver((entries) => { if (entries[entries.length - 1].isIntersecting) start(); else halt(); }, { threshold: 0.05 }).observe(svg);

declare global { interface Window { __overlay?: unknown } }
window.__overlay = { main, dr, replicateWrite, heartbeat };
