// Active-Passive vs Active-Active NAS DR with PeerGFS — one scene, two states.
//
// Same floor, platforms and devices as system-diagram-as-is-1. A toggle above the
// drawing switches between:
//  - Active-Passive: users reach only 주 센터. DR 센터's switch has a dotted "대기" line,
//    its Web Server / WAS reach the NAS only by a dashed "Not Mounted" line, and the
//    data goes one way, 주 센터 → DR 센터 ("단방향 복제").
//  - Active-Active: users reach both centres, DR 센터's NAS links become solid NFS,
//    data goes both ways ("실시간 동기화"), and both centres are Active.
// The switch itself is animated: the dotted line gives way to the users' arrow, the
// dashed links are inked in from server to NAS, the second arrowhead grows, labels
// cross-fade. Then traffic starts on the newly active side.
//
// Sits on a light sky-blue section (#eef4fa) with no background of its own: everything,
// on the platforms or off them, is drawn in the same dark ink. The platform tops are a
// touch brighter than the section and edged in ink so they stand out from it.
// It only animates while it is on screen.
import { el, pen, paint, run, f, pt, PAPER,          } from './lib/ink.js';
import { rnd, clamp, smooth, lerp } from './lib/motion.js';

// ---------------------------------------------------------------- look
const INK = '#1c1c1c';
const BLUE = '#5a80ea', BLUE_SIDE = '#3f62c8', BLUE_TOP = '#7d9cf0', BLUE_LIT = '#b7c9fa';
const RED = '#c4473a';
const BG = '#eef4fa';                     // the section the drawing sits on
const DECK = '#fbfdff';                   // platform tops: a touch brighter than BG
const DECK_SIDE = '#dde7f2';              // platform right-hand edge: a touch darker than BG
const NAVY = '#042c53', NAVY_HOVER = '#185fa5';   // toggle
const PEN = 2.4, THIN = 1.4;
const FONT = "'DM Sans', 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', 'Segoe UI', sans-serif";

// ---------------------------------------------------------------- isometric floor
const C = 0.8660254, S = 0.5;
const MAIN      = [0, 600];
const DR      = [610, 270];
const iso = (o     , a        , b        , h = 0)      => [o[0] + (a + b) * C, o[1] + (a - b) * S - h];
const on = (o     , pts                                )        => pts.map(([a, b, h = 0]) => iso(o, a, b, h));
const poly = (pts       , close = false)         => 'M' + pts.map(pt).join(' L') + (close ? ' Z' : '');
function rounded(pts       , r = 26)         {
  let s = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], p = pts[i], b = pts[i + 1];
    const la = Math.hypot(p[0] - a[0], p[1] - a[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ra = Math.min(r, la / 2), rb = Math.min(r, lb / 2);
    const p1      = [p[0] + ((a[0] - p[0]) * ra) / la, p[1] + ((a[1] - p[1]) * ra) / la];
    const p2      = [p[0] + ((b[0] - p[0]) * rb) / lb, p[1] + ((b[1] - p[1]) * rb) / lb];
    s += ` L${pt(p1)} Q${pt(p)} ${pt(p2)}`;
  }
  return s + ` L${pt(pts[pts.length - 1])}`;
}

// ---------------------------------------------------------------- mount: toggle + svg
const stage = (document.querySelector('#ap-aa') ?? document.querySelector('#stage'))               ;
const css = document.createElement('style');
css.textContent = `
.apaa-toggle { display: flex; width: max-content; margin: 0 auto 1.4rem; padding: 4px; gap: 2px; border-radius: 999px;
  border: 1px solid rgba(4,44,83,0.22); background: rgba(255,255,255,0.55); }
.apaa-toggle button { appearance: none; border: 0; background: transparent; cursor: pointer; border-radius: 999px;
  padding: 0.6rem 1.25rem; font-family: ${FONT}; font-size: 0.85rem; font-weight: 600; letter-spacing: 0.02em; line-height: 1;
  color: ${NAVY}; transition: background-color .35s ease, color .35s ease; }
.apaa-toggle button:hover { color: ${NAVY_HOVER}; }
.apaa-toggle button[aria-pressed="true"] { background: ${NAVY}; color: #fff; }
.apaa-toggle button[aria-pressed="true"]:hover { color: #fff; }
.apaa-toggle button:focus-visible { outline: 2px solid ${NAVY_HOVER}; outline-offset: 2px; }
.apaa-svg { display: block; width: 100%; height: auto; user-select: none; touch-action: manipulation; }
`;
document.head.appendChild(css);
const bar = document.createElement('div');
bar.className = 'apaa-toggle';
bar.setAttribute('role', 'group');
bar.setAttribute('aria-label', 'DR 구성 방식 전환');
const btn = (label        ) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; bar.appendChild(b); return b; };
const btnAP = btn('Active-Passive'), btnAA = btn('Active-Active');
stage.appendChild(bar);

const svg = el('svg', { viewBox: '-30 -40 1800 1090', class: 'apaa-svg', role: 'img', 'aria-label': 'Active-Passive와 Active-Active NAS DR 구성 비교' });
svg.style.color = INK;
stage.appendChild(svg);

const defs = el('defs', {}, svg);
const flt = el('filter', { id: 'apaa-ink', x: '-1%', y: '-1%', width: '102%', height: '102%' }, defs);
el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.04', numOctaves: 2, seed: 5, result: 'n' }, flt);
el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 2.4, xChannelSelector: 'R', yChannelSelector: 'G' }, flt);
const hatch = el('pattern', { id: 'apaa-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(58)' }, defs);
el('rect', { width: 6, height: 6, fill: PAPER }, hatch);
el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: INK, 'stroke-width': 0.9 }, hatch);
const HATCH = 'url(#apaa-hatch)';

const layer = (filtered         ) => el('g', filtered ? { filter: 'url(#apaa-ink)' } : {}, svg);
const Lfloor = layer(true);   // platforms and fixed wiring
const Lswap = layer(true);    // what changes between the two states (still between switches)
const Lmove = layer(false);   // packets and ripples, under the devices
const Ldev = layer(true);     // devices
const Lglow = layer(false);   // status lights and flashes
const Lrep = layer(false);    // the replication arrow and its pulses
const Llab = layer(false);    // labels
const Lroutes = el('g', { visibility: 'hidden' }, svg);

const stroke = (parent         , dd        , w = PEN, colour = INK) => { const p = pen(parent, w); p.setAttribute('d', dd); if (colour !== INK) p.setAttribute('stroke', colour); return p; };
function headIso(o     , tip                   , from                   , size        , parent         , colour = INK) {
  const da = tip[0] - from[0], db = tip[1] - from[1], l = Math.hypot(da, db), ua = da / l, ub = db / l, w = size * 0.48;
  const pts = on(o, [tip, [tip[0] - ua * size - ub * w, tip[1] - ub * size + ua * w], [tip[0] - ua * size + ub * w, tip[1] - ub * size - ua * w]]);
  const n = paint(parent, colour, 1.2); n.setAttribute('d', poly(pts, true));
  if (colour !== INK) n.setAttribute('stroke', colour);
  return n;
}

// ---------------------------------------------------------------- platforms
const PA = 790, PB = 522, TH = 16;
function platform(o     ) {
  const g = el('g', {}, Lfloor);
  const c = (a        , b        , h = 0) => iso(o, a, b, h);
  const front = paint(g, HATCH, THIN); front.setAttribute('d', poly([c(0, 0), c(PA, 0), c(PA, 0, -TH), c(0, 0, -TH)], true));
  const side = paint(g, DECK_SIDE, THIN); side.setAttribute('d', poly([c(PA, 0), c(PA, PB), c(PA, PB, -TH), c(PA, 0, -TH)], true));
  const top = paint(g, DECK, PEN); top.setAttribute('d', poly([c(0, 0), c(PA, 0), c(PA, PB), c(0, PB)], true));
  stroke(g, poly([c(18, 18), c(PA - 18, 18), c(PA - 18, PB - 18), c(18, PB - 18)], true), 0.8).setAttribute('stroke-dasharray', '1 7');
}

// ---------------------------------------------------------------- devices
                                                               
                                                                                                                                                                       
function led(p     , r = 2.7)      {
  const n = el('circle', { cx: f(p[0]), cy: f(p[1]), r, fill: PAPER, stroke: INK, 'stroke-width': 1.1 }, Lglow);
  return { n, on: 0, next: rnd(0.5, 5) };
}
function box(g         , o     , a0        , a1        , b0        , b1        , z        , h        ,
  colours                                                  = {}) {
  const c = (a        , b        , hh        ) => iso(o, a, b, hh);
  const L = paint(g, colours.left ?? PAPER); L.setAttribute('d', poly([c(a0, b0, z), c(a1, b0, z), c(a1, b0, z + h), c(a0, b0, z + h)], true));
  const R = paint(g, colours.right ?? HATCH); R.setAttribute('d', poly([c(a1, b0, z), c(a1, b1, z), c(a1, b1, z + h), c(a1, b0, z + h)], true));
  const T = paint(g, colours.top ?? PAPER); T.setAttribute('d', poly([c(a0, b0, z + h), c(a1, b0, z + h), c(a1, b1, z + h), c(a0, b1, z + h)], true));
  return { L, R, T };
}
function device(title        )              {
  const g = el('g', { style: 'cursor:pointer' }, Ldev);
  el('title', {}, g).textContent = title;
  return g;
}
function tower(o     , ca        , cb        , title        )      {
  const g = device(title);
  const a0 = ca - 26, b0 = cb - 26, h = 80;
  box(g, o, a0, ca + 26, b0, cb + 26, 0, h);
  const F = (u        , v        ) => iso(o, a0 + u, b0, v);
  stroke(g, [h - 13, h - 21, h - 29].map((v) => `M${pt(F(8, v))} L${pt(F(30, v))}`).join(' '), THIN);
  stroke(g, [12, 17, 22, 27, 32].map((v) => `M${pt(F(8, v))} L${pt(F(22, v))}`).join(' '), 1);
  return { g, leds: [led(F(41, h - 13)), led(F(41, h - 22))], flash: 0, base: iso(o, ca, cb), rx: 52, ry: 30, ledOn: BLUE, ledOff: PAPER, standby: false };
}
function dbServer(o     , ca        , cb        , title        )      {
  const g = device(title);
  const a0 = ca - 30, b0 = cb - 26, h = 34;
  const leds        = [];
  for (const z of [0, h + 3]) {
    box(g, o, a0, ca + 30, b0, cb + 26, z, h);
    const F = (u        , v        ) => iso(o, a0 + u, b0, z + v);
    leds.push(led(F(8, h / 2 + 4)), led(F(15, h / 2 + 4)));
    stroke(g, `M${pt(F(24, h / 2 + 5))} L${pt(F(50, h / 2 + 5))} M${pt(F(24, h / 2 - 3))} L${pt(F(44, h / 2 - 3))}`, THIN);
  }
  return { g, leds, flash: 0, base: iso(o, ca, cb), rx: 58, ry: 33, ledOn: BLUE, ledOff: PAPER, standby: false };
}
function storage(o     , ca        , cb        , title        , blue         )      {
  const g = device(title);
  const r = 36, h = 74, [x, y] = iso(o, ca, cb), rx = r * 1.2247, ry = r * 0.7071;
  paint(g, blue ? BLUE : PAPER).setAttribute('d', `M${f(x - rx)} ${f(y - h)} L${f(x - rx)} ${f(y)} A${f(rx)} ${f(ry)} 0 0 0 ${f(x + rx)} ${f(y)} L${f(x + rx)} ${f(y - h)} Z`);
  for (const k of [0.36, 0.68]) stroke(g, `M${f(x - rx)} ${f(y - h * k)} A${f(rx)} ${f(ry)} 0 0 0 ${f(x + rx)} ${f(y - h * k)}`, THIN);
  const lid = `M${f(x - rx)} ${f(y - h)} A${f(rx)} ${f(ry)} 0 1 1 ${f(x + rx)} ${f(y - h)} A${f(rx)} ${f(ry)} 0 1 1 ${f(x - rx)} ${f(y - h)} Z`;
  paint(g, blue ? BLUE_TOP : PAPER).setAttribute('d', lid);
  const glow = el('path', { d: lid, fill: blue ? BLUE_LIT : '#fff1c4', opacity: 0 }, Lglow);
  const leds        = [];
  for (const k of [0.18, 0.52]) for (const th of [0.42, 0.62]) leds.push(led([x + rx * Math.cos(th), y - h * k - 6 + ry * Math.sin(th)], 2.4));
  return { g, leds, flash: 0, base: [x, y], rx: rx + 6, ry: ry + 4, glow, ledOn: blue ? PAPER : BLUE, ledOff: blue ? BLUE_SIDE : PAPER, standby: false };
}
function switchBox(o     , ca        , cb        , title        )      {
  const g = device(title);
  const s = 40, h = 26;
  const { T } = box(g, o, ca - s, ca + s, cb - s, cb + s, 0, h, { left: BLUE, right: BLUE_SIDE, top: BLUE });
  const P = (u        , v        ) => iso(o, ca + u, cb + v, h);
  stroke(g, `M${pt(P(-20, 10))} L${pt(P(20, 10))} M${pt(P(12, 17))} L${pt(P(20, 10))} L${pt(P(12, 3))}`
    + ` M${pt(P(20, -10))} L${pt(P(-20, -10))} M${pt(P(-12, -3))} L${pt(P(-20, -10))} L${pt(P(-12, -17))}`, 3.2, PAPER);
  const glow = el('path', { d: T.getAttribute('d') , fill: BLUE_LIT, opacity: 0 }, Lglow);
  return { g, leds: [], flash: 0, base: iso(o, ca, cb), rx: 70, ry: 40, glow, ledOn: BLUE, ledOff: PAPER, standby: false };
}

/** A small group of people, drawn as three faceless busts in pale ink, standing at a floor point. */
function people(o     , a        , b        )              {
  const [x, y] = iso(o, a, b);
  const outer = el('g', { transform: `translate(${f(x)} ${f(y)})` }, Lswap);
  const g = el('g', {}, outer);
  const bust = (dx        , dy        , s        ) => {
    const t = el('g', { transform: `translate(${f(dx)} ${f(dy)}) scale(${f(s)})` }, g);
    el('path', { d: 'M-21 0 Q-21 -26 0 -26 Q21 -26 21 0 Z', fill: PAPER, stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, t);
    el('ellipse', { cx: 0, cy: -37, rx: 11, ry: 12, fill: PAPER, stroke: INK, 'stroke-width': 2.2 }, t);
  };
  bust(-17, -12, 0.82); bust(17, -12, 0.82); bust(0, 0, 1);
  return outer;
}

// ---------------------------------------------------------------- one data center
const POS = { sw: [100, 290], web: [340, 180], was: [500, 180], db: [670, 190], nas: [500, 370], san: [670, 360] }         ;
                            
                                                  
                  
                                                          
                                                     
                                                                         
 
const routeOf = (dd        )        => { const p = el('path', { d: dd, fill: 'none' }, Lroutes); return { p, len: p.getTotalLength() }; };

const USERS                   = [-196, 300];
// the arrow stops short of the switch's far side, which the box hides
const LINK = [[-100, 300], [10, 300]];

function center(o     , name        , swappable         )         {
  platform(o);
  const local                             = {
    user: [LINK[0], [100, 300]],
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
  stroke(g, rounded(on(o, local.dbSan)));
  // the NAS links: fixed and solid at 주 센터; at DR 센터 a dashed line with a solid one inked over it on switching
  const nfs                   = [], nfsDashed                   = [];
  for (const k of ['webNas', 'wasNas']) {
    const dd = rounded(on(o, local[k]));
    if (!swappable) { stroke(g, dd); continue; }
    const dashed = stroke(Lswap, dd); dashed.setAttribute('stroke-dasharray', '7 8'); dashed.setAttribute('stroke-linecap', 'butt');
    const solid = stroke(Lswap, dd);
    nfsDashed.push(dashed); nfs.push(solid);
  }
  const r                        = {};
  for (const k in local) r[k] = routeOf(rounded(on(o, local[k])));

  // users and their two-way link to the switch (red dotted, off the platform)
  const users = people(o, USERS[0], USERS[1]);
  const userLink = el('g', {}, Lswap);
  const ln = stroke(userLink, poly(on(o, LINK)), 2.6, RED); ln.setAttribute('stroke-dasharray', '0.1 6.5');
  headIso(o, LINK[1], LINK[0], 15, userLink, RED);
  headIso(o, LINK[0], LINK[1], 15, userLink, RED);
  // the standby line: pale dotted, from the switch out to "대기"
  const standbyLink = stroke(Lswap, poly(on(o, [[52, 300], [-112, 300]])), 2.6);
  standbyLink.setAttribute('stroke-dasharray', '0.1 7');

  const dev = {}                    ;
  dev.sw = switchBox(o, POS.sw[0], POS.sw[1], `${name} Switch`);
  dev.nas = storage(o, POS.nas[0], POS.nas[1], `${name} NAS`, false);
  dev.web = tower(o, POS.web[0], POS.web[1], `${name} Web Server`);
  dev.san = storage(o, POS.san[0], POS.san[1], `${name} SAN`, true);
  dev.was = tower(o, POS.was[0], POS.was[1], `${name} WAS`);
  dev.db = dbServer(o, POS.db[0], POS.db[1], `${name} DB Server`);
  return { o, dev, r, nfs, nfsDashed, users, userLink, standbyLink };
}

const dr = center(DR, 'DR 센터', true);
const main = center(MAIN, '주 센터', false);
main.standbyLink.remove();   // 주 센터 is always in service

// ---------------------------------------------------------------- the replication arrow between the centres
// In the gap between the platforms, as in the originals: an arrow along b (주 → DR), with a
// second head at the 주 센터 end that grows in for Active-Active, and the big red label.
const ARROW = [[404, 546], [404, 668]];
const arrowLine = stroke(Lrep, poly(on(MAIN, ARROW)), 6, RED);
arrowLine.setAttribute('stroke-linecap', 'butt');
const headDR = headIso(MAIN, ARROW[1], ARROW[0], 30, Lrep, RED);
const headMainG = el('g', {}, Lrep);
headIso(MAIN, ARROW[0], ARROW[1], 30, headMainG, RED);
const tipMain = iso(MAIN, ARROW[0][0], ARROW[0][1]);
void headDR;
const R_fwd = routeOf(poly(on(MAIN, ARROW)));
const R_back = routeOf(poly(on(MAIN, [ARROW[1], ARROW[0]])));

// ---------------------------------------------------------------- labels on the floor
                                                                                           
const labs        = [];
function label(o     , a        , b        , txt        , axis           ,
  opt                                                                                 = {})      {
  const size = opt.size ?? 19;
  const [x, y] = iso(o, a, b);
  const m = axis === 'a' ? [C, S, -C, S] : [C, -S, C, S];
  const g = el('g', { transform: `matrix(${m.map(f).join(' ')} ${f(x)} ${f(y)})` }, Llab);
  let rect                            ;
  if (opt.pill) rect = el('rect', { fill: opt.pill, stroke: opt.edge ?? 'none', 'stroke-width': 1.3, rx: size * 0.95 }, g);
  const text = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': size, 'font-weight': opt.weight ?? 600,
    'font-family': FONT, fill: opt.ink ?? INK, 'letter-spacing': '0.02em' }, g);
  text.textContent = txt;
  const l = { g, text, rect, size };
  labs.push(l);
  return l;
}
const sizePill = (l     , w = l.text.getComputedTextLength()) => {
  if (!l.rect) return;
  const h = l.size * 1.9, padX = l.size * 0.9;
  l.rect.setAttribute('x', f(-w / 2 - padX)); l.rect.setAttribute('width', f(w + padX * 2));
  l.rect.setAttribute('y', f(-h / 2)); l.rect.setAttribute('height', f(h));
};

const light = { pill: PAPER, edge: INK };
// centre titles; the Active / Passive tag sits under each, centred on it (one step further along +a)
const TITLE_A = 936, TAG_A = TITLE_A + 50;
const titleB = (o     ) => (o === MAIN ? 225 : 236);
for (const [o, title] of [[MAIN, '주 센터'], [DR, 'DR 센터']]         ) {
  label(o, 100, 212, 'Switch', 'a', light);
  label(o, POS.web[0], 124, 'Web Server', 'a', light);
  label(o, POS.was[0], 124, 'WAS', 'a', light);
  label(o, POS.db[0], 128, 'DB Server', 'a', light);
  label(o, 556, 330, 'NAS', 'b', { pill: RED, ink: PAPER, weight: 700 });
  label(o, 728, 300, 'SAN', 'b', { pill: BLUE, ink: PAPER, weight: 700 });
  label(o, TITLE_A, titleB(o), title, 'b', { size: 54, weight: 800 });
}
label(MAIN, 318, 296, 'NFS', 'b', { size: 17 });
label(MAIN, 478, 292, 'NFS', 'b', { size: 17 });
label(MAIN, -150, USERS[1], '사용자', 'b', { size: 26, weight: 700 });
label(MAIN, TAG_A, titleB(MAIN), 'Active', 'b', { size: 34, weight: 700, ink: RED });

// what swaps at DR 센터
const drNfs = [label(DR, 318, 296, 'NFS', 'b', { size: 17 }), label(DR, 478, 292, 'NFS', 'b', { size: 17 })];
// "Not" / "Mounted" on either side of each dashed link, past the server so nothing overlaps it
const NM = { size: 17, weight: 700, ink: RED }         , NM_B = 290, NM_GAP = 15;
const drNotMounted = [POS.web[0], POS.was[0]].flatMap((a) => [label(DR, a - NM_GAP, NM_B, 'Not', 'b', NM), label(DR, a + NM_GAP, NM_B, 'Mounted', 'b', NM)]);
const drUsersText = label(DR, -150, USERS[1], '사용자', 'b', { size: 26, weight: 700 });
const drStandbyText = label(DR, -150, USERS[1], '대기', 'b', { size: 26, weight: 700 });
const drPassive = label(DR, TAG_A, titleB(DR), 'Passive', 'b', { size: 34, weight: 700, ink: RED });
const drActive = label(DR, TAG_A, titleB(DR), 'Active', 'b', { size: 34, weight: 700, ink: RED });

// the big red label: one pill whose width eases between the two phrases
const repOne = label(MAIN, 470, 604, '단방향 복제', 'b', { size: 34, weight: 800, pill: RED, ink: PAPER });
const repTwo = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 34, 'font-weight': 800,
  'font-family': FONT, fill: PAPER, 'letter-spacing': '0.02em' }, repOne.g);
repTwo.textContent = '실시간 동기화';
let repW                   = [0, 0];
const sizeAll = () => {
  for (const l of labs) if (l !== repOne) sizePill(l);
  repW = [repOne.text.getComputedTextLength(), repTwo.getComputedTextLength()];
};
sizeAll();
document.fonts?.ready.then(() => { sizeAll(); drawState(mode); });

// ---------------------------------------------------------------- state and the switch between them
// mode: 0 = Active-Passive, 1 = Active-Active; it eases toward `target` over SWITCH seconds,
// and every changing part follows its own stretch of that progress, so the switch reads in order:
// DR's users arrive → its NAS links are inked in → the second arrowhead grows and the label changes.
const SWITCH = 2.6;
let mode = 0, target = 0;
const u = (a        , b        ) => smooth(a, b, mode);
const show = (n         , o        ) => { const v = f(clamp(o, 0, 1)); if (n.getAttribute('opacity') !== v) n.setAttribute('opacity', v); };
const nfsLen = dr.nfs.map((p) => p.getTotalLength());
function drawState(m        ) {
  mode = m;
  // 1. DR 센터 comes into service
  show(drPassive.g, 1 - u(0, 0.3)); show(drActive.g, u(0, 0.3));
  // 2. the standby line goes; the users rise into place and their arrow draws toward the switch
  show(dr.standbyLink, 1 - u(0.05, 0.3)); show(drStandbyText.g, 1 - u(0.05, 0.3));
  const up = u(0.12, 0.5);
  show(dr.users, up); dr.users.firstElementChild .setAttribute('transform', `translate(0 ${f((1 - up) * 18)})`);
  show(drUsersText.g, u(0.2, 0.45));
  show(dr.userLink, u(0.25, 0.5));
  // 3. the dashed NAS links are inked in, server → NAS
  dr.nfs.forEach((p, i) => {
    const k = u(0.4 + i * 0.08, 0.72 + i * 0.08), L = nfsLen[i];
    p.setAttribute('stroke-dasharray', `${f(L * k)} ${f(L + 1)}`);
    show(p, k > 0.001 ? 1 : 0);
    show(dr.nfsDashed[i], 1 - smooth(0.7, 1, k));
  });
  drNotMounted.forEach((l) => show(l.g, 1 - u(0.4, 0.6)));
  drNfs.forEach((l) => show(l.g, u(0.66, 0.86)));
  // 4. replication becomes two-way: the second head grows, the label changes
  const h = u(0.7, 0.95);
  headMainG.setAttribute('transform', `translate(${f(tipMain[0])} ${f(tipMain[1])}) scale(${f(Math.max(0.001, h))}) translate(${f(-tipMain[0])} ${f(-tipMain[1])})`);
  const tw = u(0.72, 1);
  show(repOne.text, 1 - smooth(0, 0.5, tw)); show(repTwo, smooth(0.5, 1, tw));
  if (repW[0]) sizePill(repOne, lerp(repW[0], repW[1], tw));
  for (const d of Object.values(dr.dev)) d.standby = m < 0.5;
}

function setTarget(t        ) {
  target = t;
  btnAP.setAttribute('aria-pressed', String(t === 0));
  btnAA.setAttribute('aria-pressed', String(t === 1));
  if (!stop) frame(0, 0);   // off screen or still: jump straight to the new state
}
btnAP.addEventListener('click', () => setTarget(0));
btnAA.addEventListener('click', () => setTarget(1));

// ---------------------------------------------------------------- motion: packets, pulses, ripples
let now = 0;
const timers                              = [];
const later = (s        , fn            ) => { timers.push([now + s, fn]); };

                                                                                                                  
const packets           = [];
const offFloor = new Set       ([main.r.user, dr.r.user]);
function send(route       , done             , rev = false) {
  let p = packets.find((q) => !q.alive);
  if (!p) { p = { n: el('circle', { r: 5.6, 'stroke-width': 2.2 }, Lmove), route, s: 0, rev, alive: false }; packets.push(p); }
  Object.assign(p, { route, s: 0, rev, done, alive: true });
  const off = offFloor.has(route);
  p.n.setAttribute('fill', INK); p.n.setAttribute('stroke', off ? BG : PAPER);
  p.n.style.display = '';
  movePacket(p);
}
function movePacket(p        ) {
  const q = p.route.p.getPointAtLength(p.rev ? p.route.len - p.s : p.s);
  p.n.setAttribute('cx', f(q.x)); p.n.setAttribute('cy', f(q.y));
}

// a pulse of light along the red arrow
                                                                                                 
const pulses          = [];
const PULSE = 44, PULSE_SPEED = 260;
function sync(route       , done             ) {
  let p = pulses.find((q) => !q.alive);
  if (!p) { p = { n: el('path', { fill: 'none', stroke: PAPER, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, Lrep), route, s: 0, alive: false }; pulses.push(p); }
  Object.assign(p, { route, s: 0, done, alive: true });
  p.n.setAttribute('d', route.p.getAttribute('d') );
  p.n.style.display = 'none';
}
function drawPulse(p       ) {
  const end = p.route.len - 22;   // stop short of the head
  const a = Math.max(0, p.s - PULSE), b = Math.min(end, p.s);
  if (b - a < 1) { p.n.style.display = 'none'; return; }
  p.n.style.display = '';
  p.n.setAttribute('stroke-dasharray', `${f(b - a)} ${f(p.route.len * 2)}`);
  p.n.setAttribute('stroke-dashoffset', f(-a));
}

                                                                                
const ripples           = [];
function ripple(dev     , colour = INK) {
  let r = ripples.find((q) => !q.alive);
  if (!r) { r = { n: el('ellipse', { fill: 'none', 'stroke-width': 1.6 }, Lmove), dev, age: 0, alive: false }; ripples.push(r); }
  Object.assign(r, { dev, age: 0, alive: true });
  r.n.setAttribute('cx', f(dev.base[0])); r.n.setAttribute('cy', f(dev.base[1]));
  r.n.setAttribute('stroke', colour);
  r.n.style.display = '';
  flash(dev);
}
const flash = (dev     , s = 0.45) => { dev.flash = Math.max(dev.flash, s); };

// ---------------------------------------------------------------- what happens to a request
const pick =     (xs              )    => xs[Math.floor(Math.random() * xs.length)];
const isActive = (c        ) => c === main || mode >= 0.999;
/** A write on one centre's NAS is carried across: one way in Active-Passive, both ways in Active-Active. */
function replicateFrom(c        ) {
  if (c === main) sync(R_fwd, () => ripple(dr.dev.nas, RED));
  // DR 센터 writes go back only while it is fully Active: in-flight work left over after
  // switching to Active-Passive stays at DR (its NAS is no longer the source)
  else if (target === 1 && mode >= 0.999) sync(R_back, () => ripple(main.dev.nas, RED));
}
function writeNas(c        , k               ) {
  send(c.r[k === 'web' ? 'webNas' : 'wasNas'], () => { ripple(c.dev.nas); later(0.15, () => replicateFrom(c)); });
}
function serve(c        , k                      ) {
  flash(c.dev[k]);
  if (k === 'db') send(c.r.dbSan, () => ripple(c.dev.san));
  else if (Math.random() < 0.8) writeNas(c, k);
  later(0.35, () => send(c.r[k], () => { flash(c.dev.sw, 0.25); send(c.r.user, undefined, true); }, true));
}
function request(c        ) {
  if (!isActive(c)) return;
  send(c.r.user, () => {
    flash(c.dev.sw, 0.3);
    const k = pick(['web', 'was', 'db']         );
    send(c.r[k], () => serve(c, k));
  });
}

// clicks: an active centre's device acts; a standby one only blinks
const onClick = (g         , fn            ) => g.addEventListener('pointerdown', (e) => { e.stopPropagation(); fn(); });
for (const c of [main, dr]) {
  for (const k of ['web', 'was', 'db']         ) onClick(c.dev[k].g, () => (isActive(c) ? serve(c, k) : flash(c.dev[k])));
  onClick(c.dev.sw.g, () => (isActive(c) ? request(c) : flash(c.dev.sw)));
  onClick(c.dev.nas.g, () => { ripple(c.dev.nas); if (isActive(c)) replicateFrom(c); });
  onClick(c.dev.san.g, () => ripple(c.dev.san));
}

// ---------------------------------------------------------------- loop
const timersOf = (c        ) => ({ c, req: c === main ? 0.4 : 0.9, file: c === main ? 1.4 : 2.2 });
const clocks = [timersOf(main), timersOf(dr)];
const allDevs = [...Object.values(main.dev), ...Object.values(dr.dev)];
let wasAA = false;

function frame(_t        , dt        ) {
  now += dt;
  const t = now;
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i][0] <= t) { const fn = timers[i][1]; timers.splice(i, 1); fn(); }

  // ease toward the chosen state; `dt === 0` (a jump while off screen) lands on it directly
  const m = dt === 0 ? target : clamp(mode + Math.sign(target - mode) * (dt / SWITCH), Math.min(mode, target), Math.max(mode, target));
  if (m !== mode || dt === 0) drawState(m);
  // the moment DR 센터 is fully live, its NAS is mounted: first file I/O on the new links
  const aa = mode >= 0.999;
  if (aa && !wasAA && dt > 0) { send(dr.r.webNas, () => ripple(dr.dev.nas)); later(0.3, () => send(dr.r.wasNas, () => ripple(dr.dev.nas))); }
  wasAA = aa;

  for (const k of clocks) {
    if (!isActive(k.c)) continue;
    if ((k.req -= dt) <= 0) { k.req = rnd(1.0, 2.2); request(k.c); }
    if ((k.file -= dt) <= 0) { k.file = rnd(1.8, 3.4); const s = pick(['web', 'was']         ); flash(k.c.dev[s], 0.25); writeNas(k.c, s); }
  }

  for (const p of packets) if (p.alive) {
    p.s += 330 * dt;
    if (p.s >= p.route.len) { p.alive = false; p.n.style.display = 'none'; p.done?.(); }
    else movePacket(p);
  }
  for (const p of pulses) if (p.alive) {
    p.s += PULSE_SPEED * dt;
    const end = p.route.len - 22;
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
}

// Animate only while the drawing is on screen. ?debug keeps run()'s manual stepping.
let stop                      = null;
const start = () => { if (!stop) stop = run(frame); };
const halt = () => { if (stop) { stop(); stop = null; } };
setTarget(0);   // Active-Passive first; also draws the first state
if (new URLSearchParams(location.search).has('debug') || !('IntersectionObserver' in window)) start();
else new IntersectionObserver((entries) => { if (entries[entries.length - 1].isIntersecting) start(); else halt(); }, { threshold: 0.05 }).observe(svg);

                                                        
window.__apaa = { main, dr, setTarget, state: () => ({ mode, target }) };
