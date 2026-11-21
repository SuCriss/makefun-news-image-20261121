import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const W = 1024;
const H = 1024;

function hex(v) {
  const s = v.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

const C = {
  bg: hex('#0A0F18'),
  panel: hex('#111A29'),
  panelAlt: hex('#162138'),
  deep: hex('#0D1624'),
  line: hex('#26344C'),
  soft: hex('#1B2739'),
  text: hex('#E9EFF8'),
  muted: hex('#8A9AB1'),
  faint: hex('#5C6D86'),
  gold: hex('#F1C558'),
  goldDim: hex('#9A7A32'),
  cyan: hex('#54C6E8'),
  cyanDim: hex('#2E7186'),
  red: hex('#E46156'),
  green: hex('#4AC08B'),
  violet: hex('#A98BE8'),
  land: hex('#2C4C6B'),
  landEdge: hex('#3C6688')
};

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8Array(w * h * 3);
  }
  px(x, y, c) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.d[i] = c[0];
    this.d[i + 1] = c[1];
    this.d[i + 2] = c[2];
  }
  rect(x, y, w, h, c) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w));
    const y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      const base = yy * this.w;
      for (let xx = x0; xx < x1; xx++) {
        const i = (base + xx) * 3;
        this.d[i] = c[0];
        this.d[i + 1] = c[1];
        this.d[i + 2] = c[2];
      }
    }
  }
  outline(x, y, w, h, c, t) {
    t = t || 1;
    this.rect(x, y, w, t, c);
    this.rect(x, y + h - t, w, t, c);
    this.rect(x, y, t, h, c);
    this.rect(x + w - t, y, t, h, c);
  }
  line(x0, y0, x1, y1, c, t) {
    t = t || 1;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    const steps = Math.max(dx, -dy) + 1;
    let err = dx + dy;
    const half = Math.floor(t / 2);
    for (let i = 0; i < steps; i++) {
      this.rect(x0 - half, y0 - half, t, t, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  disc(cx, cy, r, c) {
    const rr = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= rr) this.px(x, y, c);
      }
    }
  }
  poly(pts, c) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i][1] < minY) minY = pts[i][1];
      if (pts[i][1] > maxY) maxY = pts[i][1];
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const y1 = a[1];
        const y2 = b[1];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          xs.push(a[0] + ((y - y1) / (y2 - y1)) * (b[0] - a[0]));
        }
      }
      xs.sort((m, n) => m - n);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.ceil(xs[i]);
        const xb = Math.floor(xs[i + 1]);
        for (let x = xa; x <= xb; x++) this.px(x, y, c);
      }
    }
  }
}

const cv = new Canvas(W, H);

const F = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '#....', '####.', '....#', '....#', '####.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '%': ['##..#', '##.#.', '..#..', '..#..', '.#...', '.#.##', '#..##'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.']
};

function tw(s, sc) {
  return String(s).length * 6 * sc;
}

function txt(s, x, y, sc, c) {
  const str = String(s).toUpperCase();
  let cx = x;
  for (let i = 0; i < str.length; i++) {
    const g = F[str[i]] || F['?'];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === '#') cv.rect(cx + col * sc, y + r * sc, sc, sc, c);
      }
    }
    cx += 6 * sc;
  }
  return cx - x;
}

function txtR(s, xRight, y, sc, c) {
  txt(s, xRight - tw(s, sc), y, sc, c);
}

function wrap(s, maxW, sc) {
  const maxChars = Math.max(1, Math.floor(maxW / (6 * sc)));
  const words = String(s).toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.length > maxChars) {
      if (cur) {
        lines.push(cur);
        cur = '';
      }
      const chunks = Math.ceil(w.length / maxChars);
      for (let k = 0; k < chunks; k++) {
        const part = w.slice(k * maxChars, (k + 1) * maxChars);
        if (k === chunks - 1) cur = part;
        else lines.push(part);
      }
    } else if (!cur) {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function block(s, x, y, maxW, sc, gap, c) {
  const lines = wrap(s, maxW, sc);
  let yy = y;
  for (let i = 0; i < lines.length; i++) {
    txt(lines[i], x, yy, sc, c);
    yy += 7 * sc + gap;
  }
  return yy - y - gap;
}

function panel(x, y, w, h, accent) {
  cv.rect(x, y, w, h, C.panel);
  cv.outline(x, y, w, h, C.line, 1);
  if (accent) cv.rect(x, y, 3, h, accent);
}

function regionTag(label, x, y, c) {
  const w = tw(label, 1) + 14;
  cv.rect(x, y, w, 13, C.deep);
  cv.outline(x, y, w, 13, C.line, 1);
  cv.disc(x + 5, y + 6, 2, c);
  txt(label, x + 10, y + 3, 1, C.text);
}

function bars(x, y, w, h, vals, c) {
  const n = vals.length;
  const bw = Math.max(2, Math.floor((w - (n - 1) * 3) / n));
  for (let i = 0; i < n; i++) {
    const bh = Math.max(2, Math.floor((vals[i] / 100) * h));
    cv.rect(x + i * (bw + 3), y + h - bh, bw, bh, i > n - 4 ? c : C.cyanDim);
  }
  cv.line(x, y + h, x + w, y + h, C.line, 1);
}

function icon(kind, x, y, c) {
  if (kind === 'summit') {
    cv.line(x + 3, y + 10, x + 8, y + 5, c, 2);
    cv.line(x + 8, y + 5, x + 13, y + 10, c, 2);
    cv.disc(x + 3, y + 10, 2, c);
    cv.disc(x + 8, y + 5, 2, c);
    cv.disc(x + 13, y + 10, 2, c);
  } else if (kind === 'talks') {
    cv.rect(x + 2, y + 4, 7, 8, c);
    cv.rect(x + 7, y + 4, 7, 8, C.panel);
    cv.outline(x + 7, y + 4, 7, 8, c, 1);
  } else if (kind === 'ship') {
    cv.poly([[x + 1, y + 10], [x + 15, y + 10], [x + 12, y + 14], [x + 4, y + 14]], c);
    cv.line(x + 8, y + 3, x + 8, y + 10, c, 1);
    cv.line(x + 8, y + 4, x + 13, y + 8, c, 1);
  } else if (kind === 'strike') {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      cv.line(x + 8, y + 8, x + 8 + Math.cos(a) * 7, y + 8 + Math.sin(a) * 7, c, 1);
    }
    cv.disc(x + 8, y + 8, 2, c);
  } else if (kind === 'globe') {
    cv.line(x + 1, y + 8, x + 15, y + 8, c, 1);
    cv.line(x + 8, y + 1, x + 8, y + 15, c, 1);
    cv.poly([[x + 8, y + 1], [x + 13, y + 4], [x + 13, y + 12], [x + 8, y + 15], [x + 3, y + 12], [x + 3, y + 4]], C.panel);
    cv.line(x + 8, y + 1, x + 13, y + 4, c, 1);
    cv.line(x + 13, y + 4, x + 13, y + 12, c, 1);
    cv.line(x + 13, y + 12, x + 8, y + 15, c, 1);
    cv.line(x + 8, y + 15, x + 3, y + 12, c, 1);
    cv.line(x + 3, y + 12, x + 3, y + 4, c, 1);
    cv.line(x + 3, y + 4, x + 8, y + 1, c, 1);
  } else if (kind === 'trend') {
    cv.line(x + 2, y + 4, x + 6, y + 8, c, 2);
    cv.line(x + 6, y + 8, x + 10, y + 6, c, 2);
    cv.line(x + 10, y + 6, x + 14, y + 13, c, 2);
    cv.line(x + 10, y + 13, x + 14, y + 13, c, 2);
    cv.line(x + 14, y + 9, x + 14, y + 13, c, 2);
  } else if (kind === 'game') {
    cv.rect(x + 1, y + 4, 14, 9, c);
    cv.rect(x + 3, y + 6, 10, 5, C.panel);
    cv.line(x + 5, y + 6, x + 5, y + 11, c, 1);
    cv.line(x + 3, y + 8, x + 7, y + 8, c, 1);
    cv.disc(x + 10, y + 7, 1, c);
    cv.disc(x + 12, y + 9, 1, c);
  } else if (kind === 'chip') {
    cv.rect(x + 4, y + 4, 8, 8, c);
    cv.rect(x + 6, y + 6, 4, 4, C.panel);
    for (let i = 0; i < 3; i++) {
      const p = x + 5 + i * 3;
      cv.line(p, y + 1, p, y + 4, c, 1);
      cv.line(p, y + 12, p, y + 15, c, 1);
      cv.line(x + 1, p, x + 4, p, c, 1);
      cv.line(x + 12, p, x + 15, p, c, 1);
    }
  }
}

const LAND = [
  [[-168, 65], [-160, 70], [-140, 70], [-125, 69], [-115, 62], [-100, 68], [-85, 70], [-75, 68], [-60, 60], [-55, 52], [-65, 47], [-70, 42], [-75, 36], [-81, 31], [-80, 25], [-84, 22], [-90, 21], [-97, 18], [-105, 20], [-110, 24], [-115, 30], [-118, 34], [-124, 40], [-124, 48], [-130, 54], [-140, 58], [-150, 60], [-165, 60]],
  [[-81, 8], [-75, 11], [-65, 10], [-55, 8], [-50, 2], [-44, -2], [-35, -6], [-38, -13], [-42, -22], [-48, -28], [-53, -34], [-58, -40], [-65, -52], [-70, -55], [-73, -45], [-72, -35], [-71, -20], [-76, -14], [-79, -5], [-81, 2]],
  [[-10, 36], [-9, 43], [-2, 43], [0, 49], [5, 53], [10, 54], [14, 54], [20, 56], [25, 60], [30, 65], [38, 66], [45, 63], [40, 55], [35, 48], [30, 45], [24, 41], [18, 40], [14, 45], [8, 44], [3, 42], [-5, 37]],
  [[-17, 14], [-16, 21], [-10, 27], [-5, 31], [2, 36], [10, 37], [20, 32], [28, 31], [33, 31], [35, 25], [40, 18], [43, 12], [51, 12], [47, 5], [42, -2], [40, -10], [35, -20], [32, -26], [27, -33], [20, -34], [16, -28], [12, -18], [9, -6], [3, 2], [-5, 5], [-13, 9]],
  [[25, 40], [32, 42], [40, 42], [45, 38], [50, 30], [56, 26], [62, 25], [68, 24], [72, 18], [76, 8], [80, 8], [82, 16], [86, 21], [90, 22], [94, 18], [98, 10], [104, 10], [108, 16], [110, 22], [116, 22], [120, 25], [122, 31], [126, 35], [130, 39], [136, 44], [142, 48], [150, 55], [160, 60], [170, 62], [179, 65], [179, 70], [160, 72], [140, 73], [120, 74], [100, 76], [80, 76], [60, 74], [45, 70], [35, 65], [30, 58], [26, 50]],
  [[113, -22], [114, -30], [119, -35], [129, -38], [138, -38], [146, -36], [153, -29], [151, -22], [145, -15], [137, -12], [128, -14], [120, -19]],
  [[-52, 60], [-45, 60], [-30, 68], [-22, 72], [-25, 78], [-40, 82], [-55, 80], [-60, 72]],
  [[130, 32], [135, 34], [140, 36], [142, 40], [145, 44], [141, 45], [137, 40], [132, 35]],
  [[46, -13], [50, -15], [50, -22], [47, -25], [44, -20]],
  [[166, -35], [174, -37], [178, -40], [173, -44], [168, -42]]
];

function map(bx, by, bw, bh) {
  cv.rect(bx, by, bw, bh, C.deep);
  for (let gx = 0; gx <= bw; gx += 31) cv.rect(bx + gx, by, 1, bh, C.soft);
  for (let gy = 0; gy <= bh; gy += 21) cv.rect(bx, by + gy, bw, 1, C.soft);
  const px = (lon) => bx + ((lon + 180) / 360) * bw;
  const py = (lat) => by + ((90 - lat) / 180) * bh;
  for (let i = 0; i < LAND.length; i++) {
    const shape = LAND[i];
    const pts = [];
    for (let k = 0; k < shape.length; k++) pts.push([px(shape[k][0]), py(shape[k][1])]);
    const edge = [];
    for (let k = 0; k < pts.length; k++) edge.push([pts[k][0] + 1, pts[k][1] + 1]);
    cv.poly(edge, C.landEdge);
    cv.poly(pts, C.land);
  }
}

cv.rect(0, 0, W, H, C.bg);
cv.rect(0, 0, W, 5, C.gold);
cv.rect(0, H - 5, W, 5, C.panelAlt);

cv.rect(28, 22, 52, 52, C.panelAlt);
cv.outline(28, 22, 52, 52, C.goldDim, 1);
txt('MF', 38, 36, 4, C.gold);
txt('MAKEFUN WORLD DESK', 94, 26, 2, C.muted);
txt('THE GLOBAL NEWS BRIEF', 94, 48, 2, C.text);
txtR('SATURDAY 21 NOVEMBER 2026', 996, 26, 2, C.gold);
txtR('EDITION 2026.11.21 / GLOBAL', 996, 50, 1, C.faint);
cv.line(28, 88, 996, 88, C.line, 1);

panel(28, 104, 560, 140, C.gold);
txt('FRONT PAGE', 46, 118, 1, C.cyan);
txt('WORLD NEWS', 46, 138, 5, C.text);
txt('SATURDAY 21 NOVEMBER 2026', 46, 184, 2, C.gold);
txt('EIGHT STORIES / SIX REGIONS / ONE PAGE', 46, 208, 1, C.muted);
bars(390, 172, 172, 52, [30, 38, 46, 42, 55, 62, 58, 70, 76, 88], C.goldDim);

panel(600, 104, 396, 140, C.cyan);
txt('GLOBAL WATCH', 616, 116, 1, C.cyan);
map(614, 132, 368, 104);
regionTag('AMERICAS', 620, 136, C.green);
regionTag('EUROPE', 772, 136, C.cyan);
regionTag('ASIA', 904, 136, C.gold);
regionTag('AFRICA', 774, 178, C.violet);
regionTag('MIDDLE EAST', 818, 194, C.red);
regionTag('PACIFIC', 906, 218, C.cyan);

const stats = [
  { x: 28, lab: 'AI SELLOFF', val: '-10.8%', note: 'PHILADELPHIA CHIP INDEX', c: C.red, v: [82, 76, 88, 70, 64, 58, 49, 41, 33, 24] },
  { x: 356, lab: 'NVIDIA', val: '-14.0%', note: 'CHIP GIANT SLIDE', c: C.red, v: [88, 84, 79, 72, 66, 61, 52, 44, 36, 22] },
  { x: 684, lab: 'GTA VI', val: '$3.79B', note: 'FIRST-DAY RETAIL SALES', c: C.green, v: [12, 20, 28, 36, 44, 50, 58, 66, 74, 84] }
];
for (let i = 0; i < stats.length; i++) {
  const s = stats[i];
  panel(s.x, 256, 312, 70, s.c);
  txt(s.lab, s.x + 14, 266, 1, C.muted);
  txt(s.val, s.x + 14, 280, 3, s.c);
  txt(s.note, s.x + 14, 308, 1, C.faint);
  bars(s.x + 190, 270, 108, 40, s.v, s.c);
}

txt('TOP STORIES', 28, 336, 2, C.gold);
cv.line(142, 344, 996, 344, C.line, 1);

const stories = [
  { lab: 'TRILATERAL SUMMIT', desc: 'Trump hails first Xi-Trump-Putin meeting after APEC Shenzhen', kind: 'summit', c: C.gold, reg: 'ASIA' },
  { lab: 'IRAN TALKS', desc: 'Iran wants a deal but rejects US terms as envoys meet in Berlin', kind: 'talks', c: C.cyan, reg: 'MIDDLE EAST' },
  { lab: 'HORMUZ TANKER', desc: 'Tanker mine blast reported east of the strait', kind: 'ship', c: C.red, reg: 'MIDDLE EAST' },
  { lab: 'YEMEN AIRSTRIKES', desc: 'Saudi strikes kill 41; Houthis claim plant and port hits', kind: 'strike', c: C.red, reg: 'MIDDLE EAST' },
  { lab: 'UN SUCCESSION', desc: 'Ninth straw poll held for next UN chief', kind: 'globe', c: C.violet, reg: 'AMERICAS' },
  { lab: 'AI SELLOFF', desc: 'Chip index drops 11 percent; Nvidia falls 14 percent', kind: 'trend', c: C.red, reg: 'AMERICAS' },
  { lab: 'GTA VI LAUNCH', desc: 'Take-Two books 3.79 billion dollars on day one', kind: 'game', c: C.green, reg: 'AMERICAS' },
  { lab: 'SPACEX GPU', desc: 'Apollo and Goldman price 44 billion dollar GPU plan', kind: 'chip', c: C.cyan, reg: 'PACIFIC' }
];

for (let i = 0; i < stories.length; i++) {
  const s = stories[i];
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = col === 0 ? 28 : 522;
  const y = 356 + row * 108;
  panel(x, y, 474, 100, s.c);
  icon(s.kind, x + 14, y + 12, s.c);
  txt(s.lab, x + 40, y + 12, 2, C.text);
  const rw = tw(s.reg, 1) + 12;
  cv.rect(x + 462 - rw, y + 10, rw, 13, C.deep);
  cv.outline(x + 462 - rw, y + 10, rw, 13, C.line, 1);
  txt(s.reg, x + 468 - rw, y + 13, 1, s.c);
  block(s.desc, x + 16, y + 36, 442, 2, 3, C.muted);
  cv.line(x + 16, y + 88, x + 458, y + 88, C.soft, 1);
  txt('0' + (i + 1), x + 16, y + 78, 1, s.c);
}

panel(28, 798, 968, 76, null);
txt('IN BRIEF', 44, 808, 1, C.gold);
cv.line(100, 814, 980, 814, C.soft, 1);
const briefs = [
  { lab: 'EU UKRAINE AID', desc: 'Brussels adds 1 billion euros for Ukraine', x: 44, y: 824, c: C.cyan },
  { lab: 'CROWDSTRIKE ZSCALER', desc: 'Cybersecurity merger talks reported', x: 520, y: 824, c: C.violet },
  { lab: 'BEIJING BCI', desc: '2026 brain-computer interface conference opens', x: 44, y: 850, c: C.gold },
  { lab: 'HK BONDS', desc: 'China issues dollar sovereign bonds in Hong Kong', x: 520, y: 850, c: C.green }
];
for (let i = 0; i < briefs.length; i++) {
  const b = briefs[i];
  cv.disc(b.x + 3, b.y + 4, 2, b.c);
  txt(b.lab, b.x + 12, b.y, 1, b.c);
  txt(b.desc, b.x + 12, b.y + 14, 1, C.muted);
}

cv.line(28, 888, 996, 888, C.line, 1);
txt('MADE WITH MAKEFUN / DETERMINISTIC EDITORIAL / NO EXTERNAL DATA', 28, 902, 1, C.faint);
txtR('PAGE 01 / 01', 996, 902, 1, C.faint);
txt('WORLD NEWS - SATURDAY 21 NOVEMBER 2026', 28, 922, 1, C.goldDim);
txtR('IHDR / IDAT / IEND', 996, 922, 1, C.goldDim);
cv.rect(28, 944, 968, 2, C.goldDim);

const table = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  table[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const tb = Buffer.from(type, 'ascii');
  const lb = Buffer.alloc(4);
  lb.writeUInt32BE(data.length, 0);
  const cb = Buffer.alloc(4);
  cb.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([lb, tb, data, cb]);
}

const raw = Buffer.alloc(H * (1 + W * 3));
let rp = 0;
for (let y = 0; y < H; y++) {
  raw[rp++] = 0;
  const base = y * W * 3;
  for (let x = 0; x < W * 3; x++) raw[rp++] = cv.d[base + x];
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'entry.png'), png);
