/* Salt & Steel art: every picture is drawn here as vector shapes and cached at screen resolution. One light (top left), one ink outline. */
(function (root) {
'use strict';
var ART = {};
var S = 40, HEXW = Math.sqrt(3) * S, ROW = 1.5 * S;
var SS = (root.devicePixelRatio || 1) >= 1.5 ? 3 : 2;
var PAL = {
  ink: '#1b1611', paper: '#e4d5b0', paper2: '#d5c193', sepia: '#6f5231', sea: '#17647d', sea2: '#0f4860', deep: '#0a2a3a',
  foam: '#eef7f3', shallow: '#62cfc6', sand: '#eedcab', grass: '#8dbd58', neutral: '#cfc6b0', danger: '#e5402f', gold: '#f3c552',
  a: '#c98f55', c: '#f5c542', f: '#e58a3a', s: '#9cc8f0', wood: '#6b4a2f', wood2: '#3a271a', mast: '#33241a', sail: '#f4ecd8', stone: '#b9b2a3', stone2: '#8a8375', wall: '#f0e4c9'
};
var GROUND = { wood: '#527c48', hill: '#96946e', cane: '#9daa5a', grass: '#86a65a' };

function cv(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function hex2rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
function mix(a, b, t) { var x = hex2rgb(a), y = hex2rgb(b); return '#' + [0, 1, 2].map(function (i) { var v = Math.round(x[i] + (y[i] - x[i]) * t); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
function rgba(h, a) { var c = hex2rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
function hash2(x, y, s) { var n = Math.imul((x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 1442695041 | 0, 1274126177); n ^= n >>> 13; n = Math.imul(n, 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) { var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); var a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; }
function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---- hex geometry (pointy top) ---- */
function hexXY(h) { return { x: HEXW * (h.q + h.r / 2), y: ROW * h.r }; }
var CORNER = []; for (var ci = 0; ci < 6; ci++) { var ca = (60 * ci - 30) * Math.PI / 180; CORNER.push([Math.cos(ca) * S, Math.sin(ca) * S]); }
/* For neighbour direction d (same order as HX.DIRS), the two corners of the shared edge, clockwise. */
var EDGE_C = [[0, 1], [5, 0], [4, 5], [3, 4], [2, 3], [1, 2]];
function hexPath(p, x, y, k) { k = k || 1; p.moveTo(x + CORNER[0][0] * k, y + CORNER[0][1] * k); for (var i = 1; i < 6; i++) p.lineTo(x + CORNER[i][0] * k, y + CORNER[i][1] * k); p.closePath(); }
function edgePath(p, x, y, d) { var e = EDGE_C[d]; p.moveTo(x + CORNER[e[0]][0], y + CORNER[e[0]][1]); p.lineTo(x + CORNER[e[1]][0], y + CORNER[e[1]][1]); }

/* ---- sprite plumbing ---- */
var cache = {};
function outlined(src, t, col) {
  var c = cv(src.width + t * 2, src.height + t * 2), x = c.getContext('2d');
  for (var a = 0; a < 12; a++) x.drawImage(src, t + Math.cos(a * Math.PI / 6) * t, t + Math.sin(a * Math.PI / 6) * t);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'source-over'; x.drawImage(src, t, t);
  return c;
}
/* w,h and the anchor are in world units; draw() works in world units with the origin at the anchor. */
function mk(id, w, h, ax, ay, draw, noLine) {
  if (cache[id]) return cache[id];
  var c = cv(w * SS, h * SS), x = c.getContext('2d');
  x.scale(SS, SS); x.translate(ax, ay); x.lineJoin = 'round'; x.lineCap = 'round';
  draw(x);
  var t = noLine ? 0 : Math.round(SS * 0.75), o = noLine ? c : outlined(c, t, PAL.ink);
  o.ax = ax * SS + t; o.ay = ay * SS + t; o.ss = SS;
  cache[id] = o; return o;
}
function put(ctx, sp, x, y, k, flip) {
  var s = (k || 1) / sp.ss;
  if (flip) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(sp, -sp.ax * s, -sp.ay * s, sp.width * s, sp.height * s); ctx.restore(); }
  else ctx.drawImage(sp, x - sp.ax * s, y - sp.ay * s, sp.width * s, sp.height * s);
}
function poly(x, pts, fill) { x.beginPath(); x.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); } }
function line(x, x0, y0, x1, y1, col, w) { x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.strokeStyle = col; x.lineWidth = w; x.stroke(); }
function disc(x, cx, cy, r, fill) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = fill; x.fill(); }

/* ---- ships: side view, bow to the right. One rig per faction, one hull per class. ---- */
var SHIP = {
  sloop: { L: 30, hh: 0.15, st: 0.20, bw: 0.19, masts: [[0.02, 0.92, 1]], ports: 0, rows: 0 },
  brig: { L: 36, hh: 0.15, st: 0.22, bw: 0.19, masts: [[-0.2, 0.80, 2], [0.16, 0.90, 2]], ports: 3, rows: 1 },
  frigate: { L: 43, hh: 0.16, st: 0.24, bw: 0.20, masts: [[-0.30, 0.66, 2], [-0.02, 0.84, 2], [0.26, 0.72, 2]], ports: 5, rows: 1 },
  galleon: { L: 49, hh: 0.19, st: 0.37, bw: 0.27, masts: [[-0.30, 0.64, 2], [-0.02, 0.82, 3], [0.27, 0.68, 2]], ports: 6, rows: 1 },
  manowar: { L: 57, hh: 0.21, st: 0.35, bw: 0.26, masts: [[-0.31, 0.70, 3], [-0.03, 0.85, 3], [0.26, 0.74, 3]], ports: 8, rows: 2 }
};
function drawShip(x, cls, style, col) {
  var d = SHIP[cls], L = d.L, hh = d.hh * L, x0 = -L / 2, x1 = L / 2, i;
  function sheer(px) { var u = px / (L / 2); return -hh - (u < 0 ? (d.st * L - hh) * u * u : (d.bw * L - hh) * u * u); }
  function sheerLine(off, a, b) { x.beginPath(); for (var n = 0; n <= 14; n++) { var px = a + (b - a) * n / 14; if (n) x.lineTo(px, sheer(px) + off); else x.moveTo(px, sheer(px) + off); } }
  var dark = style === 'ragged', canvas = dark ? '#3c3540' : style === 'claw' ? mix(PAL.sail, col, 0.5) : mix(PAL.sail, col, 0.1);
  var tall = 0; d.masts.forEach(function (m) { tall = Math.max(tall, m[1] * L); });
  // masts
  d.masts.forEach(function (m) { var mx = m[0] * L; line(x, mx, sheer(mx) + 1, mx, -m[1] * L - L * 0.03, PAL.mast, Math.max(0.9, L * 0.024)); });
  line(x, x1 - L * 0.04, sheer(x1) + 0.5, x1 + L * 0.2, sheer(x1) - L * 0.1, PAL.mast, Math.max(0.8, L * 0.02));
  // sails
  var wBase = d.masts.length === 1 ? 0.6 * L : d.masts.length === 2 ? 0.4 * L : 0.31 * L;
  function shade(a, b) { var g = x.createLinearGradient(a, 0, b, 0); g.addColorStop(0, mix(canvas, '#000000', dark ? 0.3 : 0.2)); g.addColorStop(0.7, canvas); g.addColorStop(1, mix(canvas, '#ffffff', dark ? 0.12 : 0.3)); return g; }
  if (style === 'square' || style === 'tall' || style === 'ragged') {
    var fm = d.masts[d.masts.length - 1], fx = fm[0] * L;
    x.beginPath(); x.moveTo(x1 + L * 0.18, sheer(x1) - L * 0.09); x.lineTo(fx + L * 0.02, -fm[1] * L * 0.88); x.quadraticCurveTo(fx + L * 0.12, sheer(fx) * 2.2, fx + L * 0.06, sheer(fx) - L * 0.09); x.closePath();
    x.fillStyle = mix(canvas, dark ? '#000000' : '#ffffff', 0.25); x.fill();
  }
  d.masts.forEach(function (m, mi) {
    var mx = m[0] * L, H = m[1] * L, top = -H + L * 0.03, bot = sheer(mx) - L * 0.07, n = m[2], gap = L * 0.018, w, t, b;
    if (style === 'lateen') {
      w = wBase * 1.2; t = top - L * 0.04; b = bot;
      var A = [mx - w * 0.72, b - (b - t) * 0.08], B = [mx + w * 0.34, t], C = [mx + w * 0.62, b];
      x.beginPath(); x.moveTo(A[0], A[1]); x.lineTo(B[0], B[1]); x.quadraticCurveTo(mx + w * 0.86, (t + b) / 2, C[0], C[1]); x.quadraticCurveTo(mx, b + L * 0.03, A[0], A[1]); x.closePath();
      x.fillStyle = shade(A[0], C[0]); x.fill();
      x.save(); x.clip(); line(x, A[0] + w * 0.24, A[1] + (b - t) * 0.26, B[0] + w * 0.24, B[1] + (b - t) * 0.26, col, (b - t) * 0.17); x.restore();
      line(x, A[0] - w * 0.06, A[1] + (b - t) * 0.06, B[0] + w * 0.05, B[1] - (b - t) * 0.05, PAL.mast, Math.max(0.8, L * 0.022));
    } else if (style === 'claw') {
      w = wBase * 1.25; t = top - L * 0.02; b = bot + L * 0.03;
      var P0 = [mx - w * 0.1, b], P1 = [mx - w * 0.5, t + (b - t) * 0.04], P2 = [mx + w * 0.74, t + (b - t) * 0.26];
      x.beginPath(); x.moveTo(P0[0], P0[1]); x.quadraticCurveTo(mx - w * 0.52, (t + b) / 2, P1[0], P1[1]); x.quadraticCurveTo(mx + w * 0.08, t + (b - t) * 0.52, P2[0], P2[1]); x.quadraticCurveTo(mx + w * 0.42, b - (b - t) * 0.04, P0[0], P0[1]); x.closePath();
      x.fillStyle = shade(P1[0], P2[0]); x.fill();
      x.save(); x.clip(); for (i = 0; i < 4; i++) line(x, P0[0], P0[1], P1[0] + (P2[0] - P1[0]) * (0.18 + i * 0.22), t + (b - t) * 0.3, mix(col, '#000000', 0.25), 0.7); x.restore();
      x.beginPath(); x.moveTo(P0[0], P0[1]); x.quadraticCurveTo(mx - w * 0.52, (t + b) / 2, P1[0], P1[1]); x.strokeStyle = PAL.mast; x.lineWidth = Math.max(0.8, L * 0.022); x.stroke();
      x.beginPath(); x.moveTo(P0[0], P0[1]); x.quadraticCurveTo(mx + w * 0.42, b - (b - t) * 0.04, P2[0], P2[1]); x.stroke();
    } else {
      var hs = (bot - top - gap * (n - 1)) / n;
      for (var j = 0; j < n; j++) {
        b = bot - j * (hs + gap); t = b - hs; w = wBase * (1 - 0.15 * j);
        var lx = mx - w * 0.42, rx = mx + w * 0.5;
        x.beginPath(); x.moveTo(lx, t); x.lineTo(rx, t); x.quadraticCurveTo(mx + w * 0.8, (t + b) / 2, rx, b);
        if (dark) { for (i = 1; i <= 5; i++) x.lineTo(rx + (lx - rx) * i / 5, i % 2 ? b - hs * 0.16 : b); } else x.lineTo(lx, b);
        x.quadraticCurveTo(mx - w * 0.2, (t + b) / 2, lx, t); x.closePath();
        x.fillStyle = shade(lx, mx + w * 0.7); x.fill();
        x.save(); x.clip(); x.fillStyle = col;
        if (style === 'tall') { x.fillRect(mx - w * 0.2, t, w * 0.17, hs); x.fillRect(mx + w * 0.22, t, w * 0.17, hs); }
        else if (j === 0 || !dark) x.fillRect(lx - 2, t + hs * 0.36, w * 1.4, hs * 0.28);
        x.restore();
        line(x, lx - w * 0.04, t, rx + w * 0.04, t, PAL.mast, Math.max(0.7, L * 0.018));
      }
    }
    if (m[1] * L === tall) { var fy = -H - L * 0.03; poly(x, [mx, fy, mx + L * 0.17, fy + L * 0.035, mx, fy + L * 0.075], col); }
  });
  // hull
  function hull() { sheerLine(0, x0, x1); x.quadraticCurveTo(x1 - L * 0.02, -hh * 0.35, x1 - L * 0.13, 0); x.lineTo(x0 + L * 0.07, 0); x.quadraticCurveTo(x0 - L * 0.015, sheer(x0) * 0.4, x0, sheer(x0)); x.closePath(); }
  var g = x.createLinearGradient(0, -d.st * L, 0, 0); g.addColorStop(0, '#80583a'); g.addColorStop(0.55, PAL.wood); g.addColorStop(1, PAL.wood2);
  hull(); x.fillStyle = g; x.fill();
  x.save(); hull(); x.clip();
  var rows = d.rows || 1, bw = hh * (rows === 2 ? 0.24 : 0.3);
  for (var rr = 0; rr < rows; rr++) {
    var off = hh * (rows === 2 ? 0.26 + rr * 0.36 : 0.4);
    sheerLine(off, x0 - 2, x1 + 2); x.strokeStyle = rr ? mix(col, '#ffffff', 0.25) : col; x.lineWidth = bw; x.lineCap = 'butt'; x.stroke(); x.lineCap = 'round';
    var np = d.ports - rr; x.fillStyle = '#1d1510';
    for (i = 0; i < np; i++) { var px = x0 + L * (0.16 + 0.62 * (i + 0.5) / np + rr * 0.02), ps = bw * 0.62; x.fillRect(px - ps / 2, sheer(px) + off - ps / 2, ps, ps); }
  }
  x.restore();
  sheerLine(0, x0, x1); x.strokeStyle = '#b08458'; x.lineWidth = Math.max(0.7, L * 0.018); x.stroke();
  if (cls === 'galleon' || cls === 'manowar') { disc(x, x0 + 0.4, sheer(x0) - 1.4, 1.1, PAL.gold); poly(x, [x0 + 1, sheer(x0) - 3, x0 + 1, sheer(x0) - 10, x0 + 8, sheer(x0) - 8.2, x0 + 1, sheer(x0) - 6.4], col); line(x, x0 + 1, sheer(x0), x0 + 1, sheer(x0) - 10, PAL.mast, 0.7); }
}
function ship(fkey, cls, colOverride) {
  var F = root.HX.FACTIONS[fkey], col = colOverride || (F ? F.col : PAL.neutral), style = F && !colOverride ? F.style : 'ragged';
  var d = SHIP[cls], L = d.L, tall = 0; d.masts.forEach(function (m) { tall = Math.max(tall, m[1] * L); });
  var top = tall + L * 0.12 + 2;
  return mk('sh' + fkey + cls + col, L * 1.34 + 4, top + 3, L * 0.57 + 2, top, function (x) { drawShip(x, cls, style, col); });
}

/* ---- buildings ---- */
function house(x, cx, by, w, h, roof, wall) {
  x.fillStyle = wall || PAL.wall; x.fillRect(cx - w / 2, by - h, w, h);
  x.fillStyle = 'rgba(60,40,20,0.22)'; x.fillRect(cx, by - h, w / 2, h);
  var rh = w * 0.52; poly(x, [cx - w / 2 - 0.8, by - h, cx, by - h - rh, cx + w / 2 + 0.8, by - h], roof);
  poly(x, [cx, by - h - rh, cx + w / 2 + 0.8, by - h, cx, by - h], mix(roof, '#000000', 0.25));
  x.fillStyle = '#5a3e28'; x.fillRect(cx - w * 0.11, by - h * 0.55, w * 0.22, h * 0.55);
}
function tower(x, cx, by, w, h, col) {
  x.fillStyle = PAL.stone; x.fillRect(cx - w / 2, by - h, w, h); x.fillStyle = 'rgba(40,35,30,0.25)'; x.fillRect(cx, by - h, w / 2, h);
  var n = Math.max(2, Math.round(w / 2.2)), cw = (w + 1.6) / (n * 2 - 1); x.fillStyle = PAL.stone;
  for (var i = 0; i < n; i++) x.fillRect(cx - w / 2 - 0.8 + i * cw * 2, by - h - 1.8, cw, 2);
  x.fillStyle = '#2a211a'; x.fillRect(cx - 0.6, by - h * 0.62, 1.2, 2.4);
  if (col) pennant(x, cx, by - h - 1.8, 7, col);
}
function pennant(x, px, py, len, col) { line(x, px, py, px, py - len, PAL.mast, 0.8); poly(x, [px + 0.3, py - len, px + len * 0.9, py - len + len * 0.22, px + 0.3, py - len + len * 0.46], col); }
function town(col, tr, cap, fort, yard, ghost) {
  var id = 'tn' + col + tr + (cap ? 'c' : '') + fort + yard + (ghost ? 'g' : '');
  return mk(id, 52, 44, 26, 36, function (x) {
    var roof = ghost ? '#8f8777' : col, wall = ghost ? '#bdb39c' : PAL.wall;
    if (fort) {
      x.fillStyle = PAL.stone2; x.fillRect(-19, -11, 38, 8); x.fillStyle = PAL.stone; x.fillRect(-19, -11, 38, 3);
      for (var c = 0; c < 9; c++) x.fillRect(-19 + c * 4.4, -12.6, 2.4, 1.8);
      tower(x, -19, -2, 6, 13 + fort, null); tower(x, 19, -2, 6, 13 + fort, null);
      if (fort >= 2) { x.fillStyle = '#2a211a'; x.fillRect(-12, -8, 2.4, 1.4); x.fillRect(9.6, -8, 2.4, 1.4); }
      if (fort >= 3) tower(x, -8, -9, 5, 9, null);
    }
    if (cap) tower(x, 1, -6, 9, 15, ghost ? null : col);
    if (tr >= 2) house(x, -9, -5, 8, 6.5, roof, wall);
    if (tr >= 3) { house(x, 11, -5.5, 7.5, 6, roof, wall); x.fillStyle = wall; x.fillRect(-15.5, -13, 4, 12); poly(x, [-16.3, -13, -13.5, -19, -10.7, -13], roof); }
    house(x, -6, 1, 9, 6.5, roof, wall);
    house(x, 5.5, 0, 8, 6, roof, wall);
    if (tr >= 2) house(x, -15, 2.5, 7, 5.5, roof, wall);
    if (tr >= 3) house(x, 14.5, 3, 7, 5.5, roof, wall);
    if (!cap && !ghost) pennant(x, 0.5, -6.2, 9, col);
    if (yard) {
      // slipway with a hull in frame
      poly(x, [8, 3.5, 24, 5, 24, 7, 8, 5.5], '#a57c4f');
      x.beginPath(); x.moveTo(11, 3.6); x.quadraticCurveTo(17, 5.6, 23, 2.4); x.strokeStyle = PAL.wood; x.lineWidth = 1.3; x.stroke();
      for (var r = 0; r < 4; r++) line(x, 12.5 + r * 3, 3.6 + r * 0.1, 12.5 + r * 3, 0.2 - yard * 0.5, PAL.wood, 0.9);
      if (yard >= 2) { line(x, 21, 4, 21, -7, PAL.mast, 1); line(x, 21, -7, 16, -4.5, PAL.mast, 0.8); }
      if (yard >= 3) { line(x, 10, 3.8, 10, -5, PAL.mast, 1); line(x, 10, -5, 14, -3, PAL.mast, 0.8); }
    }
  });
}
function freeport(col) {
  return mk('fp' + col, 46, 46, 23, 38, function (x) {
    // lighthouse
    poly(x, [-13, 1, -11.6, -19, -6.4, -19, -5, 1], '#f3ecdc');
    poly(x, [-9, 1, -9, -19, -6.4, -19, -5, 1], 'rgba(60,40,20,0.2)');
    x.fillStyle = col; x.fillRect(-12.4, -7.5, 6.8, 3.4); x.fillRect(-11.9, -15.5, 5.8, 3);
    x.fillStyle = '#2a211a'; x.fillRect(-12.6, -20.5, 7.2, 1.6);
    x.fillStyle = PAL.gold; x.fillRect(-11, -24.5, 4, 4); poly(x, [-12, -24.5, -9, -28, -6, -24.5], '#7a2f22');
    // tavern and awnings
    house(x, 5, 0, 12, 7.5, col);
    x.fillStyle = PAL.wall; x.fillRect(12, -4, 8, 6);
    for (var i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#f3ecdc' : col; x.fillRect(11.4 + i * 2.3, -6.4, 2.3, 2.6); }
    disc(x, -1.5, 2.6, 1.7, '#8a5f33'); disc(x, 2, 3.2, 1.7, '#8a5f33');
  });
}
function plot(id, lvl) {
  return mk('pl' + id + lvl, 38, 36, 19, 28, function (x) {
    var i;
    if (id === 'sawmill') {
      // open shed with a saw blade, logs stacked beside it
      line(x, -11, 1, -11, -6, PAL.mast, 1.1); line(x, 0, 1, 0, -6, PAL.mast, 1.1);
      poly(x, [-13.5, -6, -5.5, -11.5, 2.5, -6], '#b98f4c'); poly(x, [-5.5, -11.5, 2.5, -6, -5.5, -6], '#8d6a35');
      disc(x, -5.5, -1.6, 3, '#c9ced0'); disc(x, -5.5, -1.6, 0.9, '#5d6468');
      x.fillStyle = '#8a5f33'; x.fillRect(-12, 0.2, 13, 1.4);
      var logs = [[5, 0], [9, 0], [13, 0], [7, -3.5], [11, -3.5], [9, -7]], n = lvl === 1 ? 3 : lvl === 2 ? 5 : 6;
      for (i = 0; i < n; i++) { disc(x, logs[i][0], logs[i][1], 2.1, '#d2a467'); disc(x, logs[i][0], logs[i][1], 1, '#a87a45'); }
      if (lvl >= 3) house(x, -6, -9.5, 7, 4, '#8d6a35');
    } else if (id === 'mine') {
      // adit in a rock face, ore cart on rails
      poly(x, [-14, 2, -10, -9, -3, -14, 5, -11, 12, -4, 14, 2], PAL.stone2); poly(x, [-3, -14, 5, -11, 12, -4, 14, 2, 3, 2], '#6f695d');
      x.beginPath(); x.moveTo(-6, 2); x.lineTo(-6, -4); x.quadraticCurveTo(-2.5, -8, 1, -4); x.lineTo(1, 2); x.closePath(); x.fillStyle = '#1e1712'; x.fill();
      line(x, -6.6, 2, -6.6, -4.4, '#9a6d3c', 1.3); line(x, 1.6, 2, 1.6, -4.4, '#9a6d3c', 1.3); line(x, -7.4, -4.8, 2.4, -4.8, '#9a6d3c', 1.3);
      line(x, -2, 3.2, 14, 3.2, '#4a3a2c', 0.8);
      x.fillStyle = '#5a4634'; x.fillRect(6, -1.4, 6.4, 4); disc(x, 7.4, 3.4, 1, '#2a211a'); disc(x, 11, 3.4, 1, '#2a211a');
      for (i = 0; i < 2 + lvl * 2; i++) disc(x, 6.8 + (i % 4) * 1.6, -2 - Math.floor(i / 4) * 1.5, 1.05, PAL.gold);
      if (lvl >= 3) { line(x, -12, -9, -9, -18, PAL.mast, 1); line(x, -6, -12, -9, -18, PAL.mast, 1); disc(x, -9, -18, 1.8, '#9a6d3c'); }
    } else if (id === 'still') {
      // still house with its chimney, copper pot and casks
      x.fillStyle = '#8f8a80'; x.fillRect(-12.5, -15, 3, 14);
      disc(x, -10.5, -18, 2.2, 'rgba(255,255,255,0.85)'); disc(x, -8, -21, 1.6, 'rgba(255,255,255,0.7)');
      house(x, -6, 1, 11, 7, '#a5543a');
      disc(x, 5.5, -2.6, 3.6, '#d17f43'); x.fillStyle = '#d17f43'; x.fillRect(4.7, -8.6, 1.6, 3.4); line(x, 5.5, -8.4, 10, -6.6, '#a85f2c', 1);
      disc(x, 4.4, -3.6, 1.1, '#f0b07c');
      for (i = 0; i < lvl + 1; i++) { var bx = 11 + (i % 2) * 4 - Math.floor(i / 2) * 2, by = 1.6 - Math.floor(i / 2) * 3.6; x.fillStyle = '#8a5f33'; x.fillRect(bx - 1.8, by - 3.4, 3.6, 3.6); x.fillStyle = '#3a2a1c'; x.fillRect(bx - 1.8, by - 2.8, 3.6, 0.6); x.fillRect(bx - 1.8, by - 0.9, 3.6, 0.6); }
    } else {
      // observatory: a tower under a verdigris dome, glass to the sky
      var hgt = 9 + lvl * 2;
      x.fillStyle = PAL.wall; x.fillRect(-5, 1 - hgt, 10, hgt); x.fillStyle = 'rgba(60,40,20,0.22)'; x.fillRect(0, 1 - hgt, 5, hgt);
      x.beginPath(); x.arc(0, 1 - hgt, 5.8, Math.PI, 0); x.closePath(); x.fillStyle = '#5ea79c'; x.fill();
      x.beginPath(); x.arc(0, 1 - hgt, 5.8, -Math.PI / 2, 0); x.lineTo(0, 1 - hgt); x.closePath(); x.fillStyle = '#3f7f77'; x.fill();
      line(x, 1, -2 - hgt, 7.5, -8 - hgt, '#c9a24a', 1.6);
      x.fillStyle = '#5a3e28'; x.fillRect(-1.2, -3, 2.4, 4);
      if (lvl >= 2) { house(x, 9.5, 1, 7, 4.5, '#5ea79c'); }
      if (lvl >= 3) { x.beginPath(); x.arc(-10, -4, 3.4, 0, Math.PI * 2); x.strokeStyle = PAL.gold; x.lineWidth = 1; x.stroke(); x.beginPath(); x.ellipse(-10, -4, 3.4, 1.3, 0.5, 0, Math.PI * 2); x.stroke(); line(x, -10, -0.4, -10, 1.4, PAL.mast, 1); }
    }
  });
}
function scaffold() {
  return mk('scaf', 30, 28, 15, 22, function (x) {
    var w = '#c79a5e';
    line(x, -8, 1, -8, -12, w, 1.2); line(x, 0, 1, 0, -12, w, 1.2); line(x, 8, 1, 8, -12, w, 1.2);
    line(x, -9, -5, 9, -5, w, 1.2); line(x, -9, -12, 9, -12, w, 1.2);
    line(x, -8, 1, 0, -5, w, 0.9); line(x, 0, -5, 8, -12, w, 0.9); line(x, 8, 1, 0, -5, w, 0.9);
    x.fillStyle = '#d9b77c'; x.fillRect(-11, 1.4, 9, 1.6); x.fillRect(-9, -0.2, 8, 1.6);
  });
}
function wreck() {
  return mk('wreck', 44, 34, 22, 22, function (x) {
    x.save(); x.rotate(-0.22);
    x.beginPath(); x.moveTo(-14, 0); x.quadraticCurveTo(-13, -8, -4, -9); x.lineTo(9, -6); x.quadraticCurveTo(15, -4, 14, 2); x.closePath(); x.fillStyle = '#5b4330'; x.fill();
    for (var i = 0; i < 5; i++) line(x, -9 + i * 4.6, 1, -8 + i * 4.6, -7.6 + i * 0.5, '#3a2a1c', 1);
    line(x, 1, -7, 9, -22, PAL.mast, 1.4); line(x, 3, -15, 12, -13, PAL.mast, 1);
    poly(x, [6.5, -18, 13, -15.5, 11, -10, 5, -12.5], '#cfc7b3');
    x.restore();
  });
}
function reef(v) {
  return mk('reef' + (v % 3), 70, 60, 35, 30, function (x) {
    var r = rng(77 + (v % 3) * 13), rocks = [];
    for (var i = 0; i < 7; i++) rocks.push([(r() - 0.5) * 44, (r() - 0.5) * 30, 4 + r() * 5]);
    rocks.sort(function (a, b) { return a[1] - b[1]; });
    rocks.forEach(function (k) { x.beginPath(); x.ellipse(k[0], k[1] + k[2] * 0.5, k[2] * 1.9, k[2] * 0.8, 0, 0, Math.PI * 2); x.strokeStyle = 'rgba(238,247,243,0.75)'; x.lineWidth = 1.3; x.stroke(); x.fillStyle = 'rgba(98,207,198,0.35)'; x.fill(); });
    rocks.forEach(function (k) {
      var s = k[2]; poly(x, [k[0] - s, k[1] + s * 0.5, k[0] - s * 0.5, k[1] - s * 0.7, k[0] + s * 0.1, k[1] - s, k[0] + s * 0.8, k[1] - s * 0.2, k[0] + s, k[1] + s * 0.5], '#4f4b44');
      poly(x, [k[0] - s * 0.5, k[1] - s * 0.7, k[0] + s * 0.1, k[1] - s, k[0] + s * 0.1, k[1] + s * 0.2, k[0] - s * 0.8, k[1] + s * 0.3], '#7d776b');
      x.strokeStyle = PAL.ink; x.lineWidth = 0.8; poly(x, [k[0] - s, k[1] + s * 0.5, k[0] - s * 0.5, k[1] - s * 0.7, k[0] + s * 0.1, k[1] - s, k[0] + s * 0.8, k[1] - s * 0.2, k[0] + s, k[1] + s * 0.5]); x.stroke();
    });
  }, true);
}
function fogPuff(v) {
  return mk('fog' + (v % 3), 110, 90, 55, 45, function (x) {
    var r = rng(31 + (v % 3) * 7);
    for (var i = 0; i < 11; i++) { var px = (r() - 0.5) * 52, py = (r() - 0.5) * 44, rad = 14 + r() * 14, g = x.createRadialGradient(0, 0, 0, 0, 0, rad); g.addColorStop(0, 'rgba(232,240,240,0.36)'); g.addColorStop(0.55, 'rgba(222,232,234,0.2)'); g.addColorStop(1, 'rgba(222,232,234,0)'); x.save(); x.translate(px, py); x.scale(1.5, 0.62); x.fillStyle = g; x.fillRect(-rad, -rad, rad * 2, rad * 2); x.restore(); }
  }, true);
}
function compass() {
  return mk('rose', 130, 130, 65, 65, function (x) {
    x.strokeStyle = rgba(PAL.sepia, 0.55); x.fillStyle = rgba(PAL.sepia, 0.4); x.lineWidth = 0.8;
    x.beginPath(); x.arc(0, 0, 40, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(0, 0, 36, 0, Math.PI * 2); x.stroke();
    for (var i = 0; i < 16; i++) { var a = i * Math.PI / 8, len = i % 4 === 0 ? 58 : i % 2 === 0 ? 40 : 26, w = i % 4 === 0 ? 7 : 5; x.beginPath(); x.moveTo(Math.cos(a) * len, Math.sin(a) * len); x.lineTo(Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w); x.lineTo(0, 0); x.closePath(); x.fill(); x.beginPath(); x.moveTo(Math.cos(a) * len, Math.sin(a) * len); x.lineTo(Math.cos(a - Math.PI / 2) * w, Math.sin(a - Math.PI / 2) * w); x.lineTo(0, 0); x.closePath(); x.stroke(); }
  }, true);
}

/* ---- island: a coastline traced round its hexes, then sand, ground and growth ---- */
function coast(G, isl) {
  var segs = {}, set = {}, n = 0;
  isl.land.forEach(function (k) { set[k] = 1; });
  isl.land.forEach(function (k) {
    var h = G.hexes[k], p = hexXY(h), nb = root.HX.nbrs(k);
    for (var d = 0; d < 6; d++) { if (set[nb[d]]) continue; var e = EDGE_C[d], a = [p.x + CORNER[e[0]][0], p.y + CORNER[e[0]][1]], b = [p.x + CORNER[e[1]][0], p.y + CORNER[e[1]][1]]; segs[Math.round(a[0]) + ',' + Math.round(a[1])] = { a: a, b: b }; n++; }
  });
  var loops = [];
  for (var guard = 0; n > 0 && guard < 8; guard++) {
    var start = Object.keys(segs)[0], cur = start, pts = [];
    while (segs[cur]) { var s = segs[cur]; delete segs[cur]; n--; pts.push(s); cur = Math.round(s.b[0]) + ',' + Math.round(s.b[1]); }
    loops.push(pts);
  }
  // three points along each edge, pulled inward by a wobble: corners round off by themselves
  return loops.map(function (lp) {
    var out = [];
    lp.forEach(function (s) {
      var dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], len = Math.sqrt(dx * dx + dy * dy), nx = -dy / len, ny = dx / len;
      [0.22, 0.5, 0.78].forEach(function (t) { var px = s.a[0] + dx * t, py = s.a[1] + dy * t, w = 4 + vnoise(px * 0.045, py * 0.045, isl.id * 7 + 3) * 11 - (t === 0.5 ? 2 : 0); out.push([px + nx * w, py + ny * w]); });
    });
    return out;
  });
}
function smoothPath(p, pts, ox, oy) {
  var n = pts.length, mx = (pts[n - 1][0] + pts[0][0]) / 2 - ox, my = (pts[n - 1][1] + pts[0][1]) / 2 - oy;
  p.moveTo(mx, my);
  for (var i = 0; i < n; i++) { var a = pts[i], b = pts[(i + 1) % n]; p.quadraticCurveTo(a[0] - ox, a[1] - oy, (a[0] + b[0]) / 2 - ox, (a[1] + b[1]) / 2 - oy); }
  p.closePath();
}
/* Growth and relief are painted, not outlined: soft cast shadows to the south-east, light from the north-west, earth colours. */
function shadow(x, cx, cy, rx, ry, a) { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fillStyle = 'rgba(18,34,28,' + a + ')'; x.fill(); }
function tree(x, cx, cy, r, tone, rnd) {
  shadow(x, cx + r * 0.55, cy + r * 0.62, r * 1.05, r * 0.55, 0.3);
  var lobes = [[0, 0, 1], [-0.55, 0.2, 0.7], [0.5, 0.25, 0.68], [0.05, -0.5, 0.66]], k;
  lobes.forEach(function (l) { disc(x, cx + l[0] * r, cy + l[1] * r, r * l[2], mix(tone, '#0c2418', 0.28)); });
  lobes.forEach(function (l) { disc(x, cx + l[0] * r - r * 0.1, cy + l[1] * r - r * 0.12, r * l[2] * 0.82, tone); });
  for (k = 0; k < 3; k++) { var l = lobes[k === 2 ? 3 : k]; disc(x, cx + l[0] * r - r * 0.26, cy + l[1] * r - r * 0.3, r * l[2] * 0.42, mix(tone, '#d9e3a0', 0.26 + rnd() * 0.12)); }
}
function palm(x, cx, cy, s) {
  shadow(x, cx + s * 0.5, cy + s * 0.08, s * 0.5, s * 0.16, 0.24);
  x.beginPath(); x.moveTo(cx, cy); x.quadraticCurveTo(cx + s * 0.04, cy - s * 0.6, cx + s * 0.26, cy - s); x.strokeStyle = '#6a5136'; x.lineWidth = 1.5; x.stroke();
  x.strokeStyle = '#8a6c48'; x.lineWidth = 0.6; x.stroke();
  var tx = cx + s * 0.26, ty = cy - s;
  for (var i = 0; i < 7; i++) {
    var a = -Math.PI * 1.02 + i * Math.PI * 0.34, ex = tx + Math.cos(a) * s * 0.66, ey = ty + Math.sin(a) * s * 0.3 + s * 0.24, mx = tx + Math.cos(a) * s * 0.4, my = ty - s * 0.2;
    x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(mx, my, ex, ey); x.quadraticCurveTo(mx, my + s * 0.2, tx, ty); x.fillStyle = i % 2 ? '#35603d' : '#467548'; x.fill();
  }
  disc(x, tx, ty, s * 0.09, '#2b4a30');
}
function mound(x, cx, cy, w, h, rnd) {
  var px = cx - w * 0.06, py = cy - h, L = cx - w / 2, R = cx + w / 2;
  shadow(x, cx + w * 0.16, cy + h * 0.06, w * 0.6, h * 0.24, 0.26);
  function outline() { x.beginPath(); x.moveTo(L, cy); x.quadraticCurveTo(L + w * 0.18, cy - h * 0.5, px - w * 0.1, py + h * 0.14); x.quadraticCurveTo(px - w * 0.03, py - h * 0.03, px + w * 0.05, py + h * 0.1); x.quadraticCurveTo(R - w * 0.22, cy - h * 0.5, R, cy); x.quadraticCurveTo(cx, cy + h * 0.16, L, cy); x.closePath(); }
  var g = x.createLinearGradient(L, py, R, cy); g.addColorStop(0, '#c8bea3'); g.addColorStop(0.45, '#a39a80'); g.addColorStop(1, '#6d6858');
  outline(); x.fillStyle = g; x.fill();
  x.save(); outline(); x.clip();
  // shaded east face, falling from the ridge
  x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + w * 0.1, cy - h * 0.45, px + w * 0.02, cy + h * 0.2); x.lineTo(R + 2, cy + h * 0.2); x.lineTo(R + 2, py); x.closePath(); x.fillStyle = 'rgba(52,50,46,0.34)'; x.fill();
  x.strokeStyle = 'rgba(52,50,46,0.3)'; x.lineWidth = 0.7;
  for (var i = 0; i < 4; i++) { var t = 0.2 + i * 0.2 + rnd() * 0.06, sx = px + (i % 2 ? 1 : -1) * w * (0.08 + i * 0.05), sy = py + h * t; x.beginPath(); x.moveTo(sx, sy); x.quadraticCurveTo(sx + (i % 2 ? 1 : -1) * w * 0.05, sy + h * 0.14, sx + (i % 2 ? 1 : -1) * w * 0.02, sy + h * 0.3); x.stroke(); }
  // scrub creeping up the foot
  var gg = x.createLinearGradient(0, cy - h * 0.42, 0, cy + h * 0.1); gg.addColorStop(0, 'rgba(96,124,70,0)'); gg.addColorStop(1, 'rgba(96,124,70,0.75)'); x.fillStyle = gg; x.fillRect(L - 2, cy - h * 0.42, w + 4, h * 0.6);
  x.restore();
  outline(); x.strokeStyle = 'rgba(40,40,34,0.45)'; x.lineWidth = 0.7; x.stroke();
  x.beginPath(); x.moveTo(L + w * 0.16, cy - h * 0.42); x.quadraticCurveTo(px - w * 0.12, py + h * 0.12, px, py + h * 0.02); x.strokeStyle = 'rgba(255,248,225,0.45)'; x.lineWidth = 0.9; x.stroke();
}
function caneField(x, cx, cy, w, h, sk, rnd) {
  x.save(); x.translate(cx, cy); x.transform(1, 0, sk, 1, 0, 0);
  x.fillStyle = 'rgba(18,34,28,0.2)'; x.fillRect(-w / 2 + 1, -h / 2 + 1.2, w, h);
  var tone = rnd() > 0.5 ? '#a9ae62' : '#b8b46a';
  x.fillStyle = tone; x.fillRect(-w / 2, -h / 2, w, h);
  for (var i = 0; i < w / 1.9; i++) { x.fillStyle = i % 2 ? 'rgba(74,96,44,0.34)' : 'rgba(238,232,170,0.2)'; x.fillRect(-w / 2 + i * 1.9, -h / 2, 0.95, h); }
  x.strokeStyle = 'rgba(60,78,40,0.7)'; x.lineWidth = 0.9; x.strokeRect(-w / 2, -h / 2, w, h);
  x.restore();
}
function island(G, isl) {
  var id = 'isl' + G.seed + '_' + isl.id; if (cache[id]) return cache[id];
  var loops = coast(G, isl), minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, M = 34;
  loops.forEach(function (lp) { lp.forEach(function (p) { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); }); });
  var ox = minX - M, oy = minY - M, W = maxX - minX + M * 2, H = maxY - minY + M * 2, c = cv(W * SS, H * SS), x = c.getContext('2d');
  x.scale(SS, SS); x.lineJoin = 'round'; x.lineCap = 'round';
  var path = new Path2D(); loops.forEach(function (lp) { smoothPath(path, lp, ox, oy); });
  var sd = isl.id * 31 + (G.seed & 1023), i;
  // water shoaling toward the beach: many thin washes make a soft gradient, then a reef-green lip
  for (i = 0; i < 9; i++) { x.strokeStyle = rgba(i < 5 ? '#4fb4b4' : '#7fd6c8', 0.055 + i * 0.012); x.lineWidth = 58 - i * 6.2; x.stroke(path); }
  x.strokeStyle = 'rgba(190,236,222,0.5)'; x.lineWidth = 7; x.stroke(path);
  // surf: one soft continuous line and a brighter broken one
  x.strokeStyle = 'rgba(244,250,246,0.55)'; x.lineWidth = 4.2; x.stroke(path);
  x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 1.6; x.setLineDash([9, 5, 3, 6, 14, 4]); x.lineDashOffset = sd % 40; x.stroke(path); x.setLineDash([]);
  // beach: damp sand at the waterline, dry sand above it
  x.fillStyle = '#cbb583'; x.fill(path, 'evenodd');
  x.save(); x.clip(path, 'evenodd');
  x.fillStyle = '#7d9a55'; x.fill(path, 'evenodd');
  isl.land.forEach(function (k) { var h = G.hexes[k], p = hexXY(h), cx = p.x - ox, cy = p.y - oy, g = x.createRadialGradient(cx, cy, 4, cx, cy, 42), col = GROUND[h.ter]; g.addColorStop(0, rgba(col, 0.96)); g.addColorStop(0.65, rgba(col, 0.82)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(cx - 42, cy - 42, 84, 84); });
  // broad patches of lusher and drier ground, then a fine stipple
  for (i = 0; i < isl.land.length * 9; i++) { var hk = G.hexes[isl.land[i % isl.land.length]], hp = hexXY(hk), px = hp.x - ox + (hash2(i, 1, sd) - 0.5) * 76, py = hp.y - oy + (hash2(i, 2, sd) - 0.5) * 76, rad = 9 + hash2(i, 3, sd) * 15, pg = x.createRadialGradient(px, py, 0, px, py, rad), lush = hash2(i, 4, sd) > 0.5; pg.addColorStop(0, lush ? 'rgba(46,84,48,0.26)' : 'rgba(206,196,128,0.24)'); pg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = pg; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
  for (i = 0; i < isl.land.length * 70; i++) { var h2 = G.hexes[isl.land[i % isl.land.length]], q = hexXY(h2); x.fillStyle = hash2(i, 7, sd) > 0.5 ? 'rgba(34,62,36,0.2)' : 'rgba(226,222,160,0.2)'; x.fillRect(q.x - ox + (hash2(i, 5, sd) - 0.5) * 78, q.y - oy + (hash2(i, 6, sd) - 0.5) * 78, 0.9 + hash2(i, 8, sd) * 0.8, 0.7); }
  // light from the north-west across the whole island
  var lg = x.createLinearGradient(0, 0, W, H); lg.addColorStop(0, 'rgba(255,244,200,0.14)'); lg.addColorStop(0.5, 'rgba(255,244,200,0)'); lg.addColorStop(1, 'rgba(14,34,40,0.2)'); x.fillStyle = lg; x.fillRect(0, 0, W, H);
  // where the green gives way: a dark scrub line, damp sand, dry sand, a pale crest
  x.strokeStyle = 'rgba(40,66,38,0.55)'; x.lineWidth = 21; x.stroke(path);
  x.strokeStyle = '#cbb583'; x.lineWidth = 17; x.stroke(path);
  x.strokeStyle = '#e4d6aa'; x.lineWidth = 10.5; x.stroke(path);
  x.strokeStyle = 'rgba(250,242,214,0.6)'; x.lineWidth = 3.2; x.setLineDash([16, 7, 6, 9]); x.lineDashOffset = sd % 30; x.stroke(path); x.setLineDash([]);
  x.strokeStyle = 'rgba(120,98,62,0.5)'; x.lineWidth = 1.4; x.stroke(path);
  x.restore();
  // growth, back to front, kept clear of the shore
  var items = [];
  function inside(px, py, pad) { return x.isPointInPath(path, px * SS, py * SS, 'evenodd') && x.isPointInPath(path, (px - pad) * SS, py * SS, 'evenodd') && x.isPointInPath(path, (px + pad) * SS, py * SS, 'evenodd') && x.isPointInPath(path, px * SS, (py + pad) * SS, 'evenodd') && x.isPointInPath(path, px * SS, (py - pad) * SS, 'evenodd'); }
  var TONES = ['#2f5b3a', '#38683f', '#447446', '#32603c'];
  isl.land.forEach(function (k) {
    var h = G.hexes[k], p = hexXY(h), cx = p.x - ox, cy = p.y - oy, r = rng((h.q * 73856093) ^ (h.r * 19349663) ^ G.seed), n, a, d, s;
    function spot(minR, maxR, pad) { for (var t = 0; t < 8; t++) { a = r() * Math.PI * 2; d = minR + r() * (maxR - minR); var px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.9; if (inside(px, py, pad)) return [px, py]; } return null; }
    function trees(count, minR, maxR, size) { for (n = 0; n < count; n++) { s = spot(minR, maxR, 10); if (s) items.push({ y: s[1], t: 'tree', x: s[0], r: size + r() * 2.2, c: TONES[Math.floor(r() * TONES.length)] }); } }
    function scrub(count) { for (n = 0; n < count; n++) { s = spot(4, 31, 8); if (s) items.push({ y: s[1] - 40, t: r() > 0.3 ? 'bush' : 'rock', x: s[0], yy: s[1], r: 1.4 + r() * 1.4 }); } }
    if (h.ter === 'wood') { trees(20, 7, 32, 4.2); scrub(4); }
    else if (h.ter === 'hill') { [[1, -8, 31, 20], [-14, 5, 21, 12], [14, 7, 19, 11]].forEach(function (mm) { if (inside(cx + mm[0], cy + mm[1] - 4, 11)) items.push({ y: cy + mm[1], t: 'mound', x: cx + mm[0], w: mm[2] * (0.88 + r() * 0.26), h: mm[3] * (0.88 + r() * 0.26) }); }); trees(4, 19, 31, 3.4); scrub(6); }
    else if (h.ter === 'cane') { [[-11, -9, 21, 12], [11, 0, 19, 12], [-8, 11, 21, 11]].forEach(function (f) { if (inside(cx + f[0], cy + f[1], 14)) items.push({ y: cy + f[1] - 22, t: 'cane', x: cx + f[0], w: f[2], h: f[3], sk: (r() - 0.5) * 0.36 }); }); s = spot(21, 31, 10); if (s) items.push({ y: s[1], t: 'palm', x: s[0], s: 11 }); trees(2, 22, 32, 3.2); scrub(3); }
    else { for (n = 0; n < 3; n++) { s = spot(15, 31, 10); if (s) items.push({ y: s[1], t: 'palm', x: s[0], s: 10 + r() * 3 }); } trees(3, 12, 31, 3.6); scrub(9); }
  });
  items.sort(function (a, b) { return a.y - b.y; });
  var ir = rng(sd + 5);
  items.forEach(function (it) {
    if (it.t === 'tree') tree(x, it.x, it.y, it.r, it.c, ir); else if (it.t === 'palm') palm(x, it.x, it.y, it.s); else if (it.t === 'mound') mound(x, it.x, it.y, it.w, it.h, ir); else if (it.t === 'cane') caneField(x, it.x, it.y + 22, it.w, it.h, it.sk, ir);
    else if (it.t === 'bush') { shadow(x, it.x + it.r * 0.5, it.yy + it.r * 0.5, it.r * 1.1, it.r * 0.55, 0.22); disc(x, it.x, it.yy, it.r, '#4b7446'); disc(x, it.x - it.r * 0.3, it.yy - it.r * 0.3, it.r * 0.5, '#7a9c5c'); }
    else { shadow(x, it.x + it.r * 0.5, it.yy + it.r * 0.4, it.r, it.r * 0.5, 0.2); poly(x, [it.x - it.r, it.yy + it.r * 0.5, it.x - it.r * 0.4, it.yy - it.r * 0.6, it.x + it.r * 0.6, it.yy - it.r * 0.4, it.x + it.r, it.yy + it.r * 0.5], '#8e8a7a'); poly(x, [it.x - it.r * 0.4, it.yy - it.r * 0.6, it.x + it.r * 0.6, it.yy - it.r * 0.4, it.x, it.yy + it.r * 0.2], '#b9b3a0'); }
  });
  var o = { c: c, x: ox, y: oy, w: c.width / SS, h: c.height / SS };
  cache[id] = o; return o;
}

/* ---- textures ---- */
function seaTile() {
  if (cache.sea) return cache.sea;
  var N = 512, c = cv(N, N), x = c.getContext('2d'), r = rng(5), i, k;
  x.fillStyle = PAL.sea; x.fillRect(0, 0, N, N);
  function wrap(fn, px, py, m) { for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) { if (px + dx * N < -m || px + dx * N > N + m || py + dy * N < -m || py + dy * N > N + m) continue; fn(px + dx * N, py + dy * N); } }
  for (i = 0; i < 26; i++) { var rad = 50 + r() * 90, lt = r() > 0.5; wrap(function (px, py) { var g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, lt ? 'rgba(110,205,210,0.11)' : 'rgba(4,30,48,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); }, r() * N, r() * N, rad); }
  x.lineCap = 'round';
  for (i = 0; i < 110; i++) { var len = 9 + r() * 12, al = 0.07 + r() * 0.1; wrap(function (px, py) { x.strokeStyle = 'rgba(205,240,238,' + al + ')'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(px - len, py); x.quadraticCurveTo(px - len / 2, py - 3.4, px, py); x.quadraticCurveTo(px + len / 2, py + 3.4, px + len, py); x.stroke(); }, r() * N, r() * N, 30); }
  cache.sea = c; return c;
}
function glintTile() {
  if (cache.glint) return cache.glint;
  var N = 512, c = cv(N, N), x = c.getContext('2d'), r = rng(9);
  x.lineCap = 'round';
  for (var i = 0; i < 46; i++) { var px = 20 + r() * (N - 40), py = 10 + r() * (N - 20), len = 5 + r() * 9; x.strokeStyle = 'rgba(235,252,248,' + (0.1 + r() * 0.16) + ')'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(px - len, py); x.quadraticCurveTo(px, py - 3, px + len, py); x.stroke(); }
  cache.glint = c; return c;
}
function paperTile() {
  if (cache.paper) return cache.paper;
  var N = 768, c = cv(N, N), x = c.getContext('2d'), r = rng(3), i;
  x.fillStyle = PAL.paper; x.fillRect(0, 0, N, N);
  for (i = 0; i < 26; i++) { var rad = 70 + r() * 150, px = r() * N, py = r() * N; for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) { var g = x.createRadialGradient(px + dx * N, py + dy * N, 0, px + dx * N, py + dy * N, rad); g.addColorStop(0, i % 2 ? 'rgba(150,110,60,0.06)' : 'rgba(255,246,220,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px + dx * N - rad, py + dy * N - rad, rad * 2, rad * 2); } }
  for (i = 0; i < 2600; i++) { x.fillStyle = 'rgba(90,60,30,' + (0.04 + r() * 0.08) + ')'; x.fillRect(r() * N, r() * N, 1 + r() * 2.4, 1.4); }
  for (i = 0; i < 110; i++) { x.strokeStyle = 'rgba(110,80,45,0.08)'; x.lineWidth = 1; var fx = r() * N, fy = r() * N; x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + (r() - 0.5) * 30, fy + (r() - 0.5) * 8); x.stroke(); }
  cache.paper = c; return c;
}

/* ---- flags: one emblem per faction, on a swallow-tailed banner ---- */
function emblem(fkey) {
  var id = 'em' + fkey; if (cache[id]) return cache[id];
  var col = root.HX.FACTIONS[fkey].col, c = cv(128, 128), x = c.getContext('2d'), black = fkey === 'breth', field = black ? '#231d22' : col, ink = black ? col : '#1f1812';
  x.scale(2, 2); x.lineJoin = 'round'; x.lineCap = 'round';
  x.beginPath(); x.moveTo(8, 5); x.lineTo(56, 5); x.lineTo(56, 58); x.lineTo(32, 47); x.lineTo(8, 58); x.closePath();
  var g = x.createLinearGradient(8, 0, 56, 0); g.addColorStop(0, mix(field, '#ffffff', 0.12)); g.addColorStop(0.5, field); g.addColorStop(1, mix(field, '#000000', 0.22)); x.fillStyle = g; x.fill();
  x.strokeStyle = black ? col : '#1b1611'; x.lineWidth = 2.4; x.stroke();
  x.strokeStyle = ink; x.fillStyle = ink; x.lineWidth = 3;
  if (fkey === 'crown') { poly(x, [19, 36, 19, 18, 26, 27, 32, 13, 38, 27, 45, 18, 45, 36], ink); x.fillRect(19, 38.5, 26, 3.6); disc(x, 19, 16, 2.2, ink); disc(x, 32, 11, 2.4, ink); disc(x, 45, 16, 2.2, ink); }
  else if (fkey === 'breth') { line(x, 17, 40, 47, 14, ink, 3.6); line(x, 47, 40, 17, 14, ink, 3.6); disc(x, 32, 23, 10.5, ink); x.fillStyle = ink; x.fillRect(26.5, 29, 11, 8); disc(x, 28, 23, 3, field); disc(x, 36, 23, 3, field); x.fillStyle = field; x.fillRect(29.3, 33, 1.4, 4); x.fillRect(32.3, 33, 1.4, 4); x.fillRect(31.3, 27.5, 1.4, 2.6); }
  else if (fkey === 'comp') { line(x, 32, 12, 32, 38, ink, 3); line(x, 24, 40, 40, 40, ink, 3.4); line(x, 17, 17, 47, 17, ink, 3); disc(x, 32, 12, 2.6, ink); [17, 47].forEach(function (px) { line(x, px, 17, px - 5.5, 28, ink, 1.6); line(x, px, 17, px + 5.5, 28, ink, 1.6); x.beginPath(); x.moveTo(px - 7, 28); x.quadraticCurveTo(px, 37, px + 7, 28); x.closePath(); x.fillStyle = ink; x.fill(); }); }
  else if (fkey === 'order') { x.beginPath(); for (var i = 0; i < 16; i++) { var a = i * Math.PI / 8 - Math.PI / 2, r = i % 4 === 0 ? 19 : i % 2 === 0 ? 11 : 4.5; if (i) x.lineTo(32 + Math.cos(a) * r, 27 + Math.sin(a) * r); else x.moveTo(32 + Math.cos(a) * r, 27 + Math.sin(a) * r); } x.closePath(); x.fill(); x.beginPath(); x.arc(32, 27, 14.5, 0, Math.PI * 2); x.lineWidth = 1.8; x.stroke(); disc(x, 32, 27, 2.2, field); }
  else { x.lineWidth = 4.2; x.beginPath(); x.moveTo(15, 35); x.bezierCurveTo(14, 18, 31, 11, 41, 17); x.bezierCurveTo(49, 22, 46, 33, 38, 31.5); x.bezierCurveTo(32, 30.5, 32, 23.5, 37.5, 23.5); x.stroke(); x.beginPath(); x.moveTo(13, 35); x.quadraticCurveTo(24, 43, 33, 37); x.quadraticCurveTo(42, 32, 51, 38); x.stroke(); }
  cache[id] = c; return c;
}

/* ---- icons: 24-unit box, 2-unit round strokes. Resources are in colour, the rest take the text colour. ---- */
var ICON = {
  timber: function (x) { [[4, 14.5, 16], [7, 8, 14]].forEach(function (l) { x.fillStyle = '#a06a3a'; rr(x, l[0], l[1], l[2], 6, 3); x.fill(); x.strokeStyle = '#3a271a'; x.lineWidth = 1.2; x.stroke(); disc(x, l[0] + l[2] - 3, l[1] + 3, 2.6, '#e2bd86'); x.stroke(); disc(x, l[0] + l[2] - 3, l[1] + 3, 0.9, '#a06a3a'); }); },
  gold: function (x) { [[12, 18], [12, 14.5], [12, 11]].forEach(function (c, i) { x.beginPath(); x.ellipse(c[0], c[1], 7.5, 3.4, 0, 0, Math.PI * 2); x.fillStyle = i === 2 ? '#ffe07a' : '#e9b233'; x.fill(); x.strokeStyle = '#6b4a12'; x.lineWidth = 1.2; x.stroke(); }); x.fillStyle = '#b8811c'; x.fillRect(11.2, 9.4, 1.6, 3.2); },
  rum: function (x) { x.beginPath(); x.moveTo(10, 2.5); x.lineTo(14, 2.5); x.lineTo(14, 7); x.quadraticCurveTo(18, 9.5, 18, 13); x.lineTo(18, 20); x.quadraticCurveTo(18, 21.5, 16.5, 21.5); x.lineTo(7.5, 21.5); x.quadraticCurveTo(6, 21.5, 6, 20); x.lineTo(6, 13); x.quadraticCurveTo(6, 9.5, 10, 7); x.closePath(); x.fillStyle = '#d9772a'; x.fill(); x.strokeStyle = '#4a2410'; x.lineWidth = 1.2; x.stroke(); x.fillStyle = '#f6e7c4'; x.fillRect(7.6, 12.5, 8.8, 5.2); x.fillStyle = '#4a2410'; x.fillRect(9.6, 1.6, 4.8, 1.8); x.fillRect(9.6, 14.6, 4.8, 1); },
  sci: function (x) { x.fillStyle = '#f3e7c6'; rr(x, 5, 5, 14, 15, 1.5); x.fill(); x.strokeStyle = '#4b3b22'; x.lineWidth = 1.2; x.stroke(); x.fillStyle = '#9cc8f0'; rr(x, 3, 3, 18, 4.2, 2.1); x.fill(); x.stroke(); rr(x, 3, 17.6, 18, 4.2, 2.1); x.fill(); x.stroke(); x.strokeStyle = '#6a5636'; x.lineWidth = 1; [10, 12.6, 15.2].forEach(function (y) { x.beginPath(); x.moveTo(8, y); x.lineTo(16, y); x.stroke(); }); },
  build: function (x) { st(x, [[5, 20, 14, 11]]); x.beginPath(); x.moveTo(11, 8); x.lineTo(15.5, 3.5); x.lineTo(20.5, 8.5); x.lineTo(16, 13); x.closePath(); x.fill(); },
  ship: function (x) { x.beginPath(); x.moveTo(2.5, 15.5); x.lineTo(21.5, 15.5); x.lineTo(18, 20.5); x.lineTo(6, 20.5); x.closePath(); x.fill(); st(x, [[12, 15, 12, 3]]); x.beginPath(); x.moveTo(13.5, 4); x.lineTo(13.5, 13); x.lineTo(20, 13); x.closePath(); x.fill(); x.beginPath(); x.moveTo(10.5, 6.5); x.lineTo(10.5, 13); x.lineTo(5, 13); x.closePath(); x.fill(); },
  flag: function (x) { st(x, [[6, 3, 6, 21]]); x.beginPath(); x.moveTo(6, 4); x.lineTo(20, 6); x.lineTo(16, 9.5); x.lineTo(20, 13); x.lineTo(6, 13); x.closePath(); x.fill(); },
  log: function (x) { rr(x, 5, 3.5, 14, 17, 2); x.stroke(); st(x, [[8.5, 8.5, 15.5, 8.5], [8.5, 12, 15.5, 12], [8.5, 15.5, 13, 15.5]]); },
  diplo: function (x) { rr(x, 3, 6, 18, 13, 1.5); x.stroke(); x.beginPath(); x.moveTo(3.5, 7); x.lineTo(12, 13); x.lineTo(20.5, 7); x.stroke(); disc(x, 12, 15.2, 2.6, x.fillStyle); },
  menu: function (x) { st(x, [[4, 7, 20, 7], [4, 12, 20, 12], [4, 17, 20, 17]]); },
  x: function (x) { st(x, [[6, 6, 18, 18], [18, 6, 6, 18]]); },
  sword: function (x) { x.beginPath(); x.moveTo(5, 19); x.quadraticCurveTo(14, 16, 19.5, 4); x.stroke(); x.beginPath(); x.moveTo(19, 19); x.quadraticCurveTo(10, 16, 4.5, 4); x.stroke(); st(x, [[3.5, 15, 8.5, 20.5], [20.5, 15, 15.5, 20.5]]); },
  shield: function (x) { x.beginPath(); x.moveTo(4.5, 21); x.lineTo(4.5, 5); x.lineTo(8, 5); x.lineTo(8, 8.5); x.lineTo(10.4, 8.5); x.lineTo(10.4, 5); x.lineTo(13.6, 5); x.lineTo(13.6, 8.5); x.lineTo(16, 8.5); x.lineTo(16, 5); x.lineTo(19.5, 5); x.lineTo(19.5, 21); x.closePath(); x.fill(); },
  hold: function (x) { x.beginPath(); x.arc(12, 5, 2, 0, Math.PI * 2); x.stroke(); st(x, [[12, 7, 12, 20], [8, 10.5, 16, 10.5]]); x.beginPath(); x.moveTo(5, 13.5); x.quadraticCurveTo(5, 20.5, 12, 20.5); x.quadraticCurveTo(19, 20.5, 19, 13.5); x.stroke(); },
  split: function (x) { st(x, [[12, 21, 12, 13], [12, 13, 6, 5], [12, 13, 18, 5], [6, 5, 6, 9.5], [6, 5, 10, 6], [18, 5, 18, 9.5], [18, 5, 14, 6]]); },
  raid: function (x) { x.beginPath(); x.moveTo(9.5, 8); x.quadraticCurveTo(3.5, 13, 5, 18); x.quadraticCurveTo(6, 21.5, 12, 21.5); x.quadraticCurveTo(18, 21.5, 19, 18); x.quadraticCurveTo(20.5, 13, 14.5, 8); x.closePath(); x.fill(); st(x, [[9, 6.5, 15, 6.5], [9.5, 6, 8, 3], [14.5, 6, 16, 3]]); },
  gear: function (x) { x.beginPath(); x.arc(12, 12, 5.2, 0, Math.PI * 2); x.stroke(); for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; st(x, [[12 + Math.cos(a) * 5.2, 12 + Math.sin(a) * 5.2, 12 + Math.cos(a) * 9.6, 12 + Math.sin(a) * 9.6]]); } disc(x, 12, 12, 1.8, x.fillStyle); },
  sound: function (x) { x.beginPath(); x.moveTo(3.5, 9.5); x.lineTo(7.5, 9.5); x.lineTo(12.5, 5); x.lineTo(12.5, 19); x.lineTo(7.5, 14.5); x.lineTo(3.5, 14.5); x.closePath(); x.fill(); x.beginPath(); x.arc(12.5, 12, 4, -0.9, 0.9); x.stroke(); x.beginPath(); x.arc(12.5, 12, 7.5, -0.9, 0.9); x.stroke(); },
  check: function (x) { x.lineWidth = 2.6; st(x, [[5, 12.5, 10, 17.5], [10, 17.5, 19.5, 6.5]]); },
  lock: function (x) { rr(x, 5.5, 11, 13, 10, 1.5); x.fill(); x.beginPath(); x.arc(12, 11, 4, Math.PI, 0); x.stroke(); },
  end: function (x) { st(x, [[6, 3.5, 18, 3.5], [6, 20.5, 18, 20.5]]); x.beginPath(); x.moveTo(7.5, 4); x.lineTo(16.5, 4); x.lineTo(12, 12); x.closePath(); x.fill(); x.beginPath(); x.moveTo(7.5, 20); x.lineTo(12, 12); x.lineTo(16.5, 20); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(9.4, 20); x.lineTo(12, 16.6); x.lineTo(14.6, 20); x.closePath(); x.fill(); },
  next: function (x) { st(x, [[4, 12, 19, 12], [13.5, 6.5, 19.5, 12], [13.5, 17.5, 19.5, 12]]); },
  back: function (x) { st(x, [[20, 12, 5, 12], [10.5, 6.5, 4.5, 12], [10.5, 17.5, 4.5, 12]]); },
  star: function (x) { x.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 4.2 : 9.6; if (i) x.lineTo(12 + Math.cos(a) * r, 12.6 + Math.sin(a) * r); else x.moveTo(12 + Math.cos(a) * r, 12.6 + Math.sin(a) * r); } x.closePath(); x.fill(); },
  eye: function (x) { x.lineWidth = 4.4; st(x, [[4, 20, 10, 14]]); x.lineWidth = 3.2; st(x, [[10.5, 13.5, 15, 9]]); x.lineWidth = 2; st(x, [[15.5, 8.5, 19, 5]]); x.beginPath(); x.arc(19.6, 4.4, 1.6, 0, Math.PI * 2); x.stroke(); },
  hex: function (x) { x.beginPath(); for (var i = 0; i < 6; i++) { var a = (60 * i - 30) * Math.PI / 180; if (i) x.lineTo(12 + Math.cos(a) * 9.5, 12 + Math.sin(a) * 9.5); else x.moveTo(12 + Math.cos(a) * 9.5, 12 + Math.sin(a) * 9.5); } x.closePath(); x.fill(); },
  moves: function (x) { [[7, 16], [12, 19], [17, 14]].forEach(function (p) { x.beginPath(); x.moveTo(3, p[0]); x.quadraticCurveTo(10, p[0] - 5, p[1] - 3, p[0] - 1); x.quadraticCurveTo(p[1] + 1.4, p[0] + 1.4, p[1] - 2.4, p[0] + 2.2); x.stroke(); }); },
  course: function (x) { x.beginPath(); x.arc(12, 12, 8.8, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(15.8, 8.2); x.lineTo(13.4, 13.4); x.lineTo(8.2, 15.8); x.lineTo(10.6, 10.6); x.closePath(); x.fill(); },
  isle: function (x) { x.beginPath(); x.moveTo(3, 19); x.quadraticCurveTo(12, 11.5, 21, 19); x.closePath(); x.fill(); x.beginPath(); x.moveTo(12, 15); x.quadraticCurveTo(11.4, 9, 13.4, 5); x.stroke(); [[18.5, 6.5], [8, 5.5], [17, 2.8], [9.5, 9]].forEach(function (p) { x.beginPath(); x.moveTo(13.4, 5); x.quadraticCurveTo((13.4 + p[0]) / 2, p[1] - 2.4, p[0], p[1]); x.stroke(); }); }
};
function rr(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.lineTo(px + w - r, py); x.quadraticCurveTo(px + w, py, px + w, py + r); x.lineTo(px + w, py + h - r); x.quadraticCurveTo(px + w, py + h, px + w - r, py + h); x.lineTo(px + r, py + h); x.quadraticCurveTo(px, py + h, px, py + h - r); x.lineTo(px, py + r); x.quadraticCurveTo(px, py, px + r, py); x.closePath(); }
function st(x, segs) { segs.forEach(function (s) { x.beginPath(); x.moveTo(s[0], s[1]); x.lineTo(s[2], s[3]); x.stroke(); }); }
var COLOUR_ICONS = { timber: 1, gold: 1, rum: 1, sci: 1 };
function icon(n) {
  var id = 'ic' + n; if (cache[id]) return cache[id];
  var c = cv(72, 72), x = c.getContext('2d'); x.scale(3, 3); x.lineJoin = 'round'; x.lineCap = 'round'; x.lineWidth = 2; x.strokeStyle = '#ffffff'; x.fillStyle = '#ffffff';
  ICON[n](x); cache[id] = c; return c;
}
function iconCSS() {
  var css = '';
  for (var n in ICON) { var u = icon(n).toDataURL(); css += COLOUR_ICONS[n] ? '.i-' + n + '{background:url(' + u + ') center/100% 100% no-repeat}' : '.i-' + n + '{background:currentColor;-webkit-mask:url(' + u + ') center/100% 100% no-repeat;mask:url(' + u + ') center/100% 100% no-repeat}'; }
  return css;
}
function url(c) { return c.toDataURL(); }

ART.PAL = PAL; ART.S = S; ART.HEXW = HEXW; ART.ROW = ROW; ART.SS = SS; ART.SHIP = SHIP; ART.GROUND = GROUND;
ART.cv = cv; ART.mix = mix; ART.rgba = rgba; ART.hash2 = hash2; ART.vnoise = vnoise; ART.rng = rng;
ART.hexXY = hexXY; ART.hexPath = hexPath; ART.edgePath = edgePath; ART.CORNER = CORNER; ART.put = put; ART.line = line; ART.disc = disc; ART.poly = poly;
ART.ship = ship; ART.town = town; ART.freeport = freeport; ART.plot = plot; ART.scaffold = scaffold; ART.wreck = wreck; ART.reef = reef; ART.fogPuff = fogPuff; ART.compass = compass; ART.island = island;
ART.seaTile = seaTile; ART.glintTile = glintTile; ART.paperTile = paperTile; ART.emblem = emblem; ART.icon = icon; ART.iconCSS = iconCSS; ART.url = url;
root.ART = ART;
})(window);
