/* Salt & Steel renderer: the chart, the title scene and the battle scene. Everything is drawn at device resolution. */
(function (root) {
'use strict';
var HX = root.HX, ART = root.ART, P = ART.PAL, S = ART.S, HEXW = ART.HEXW, ROW = ART.ROW;
var RN = {};
var V = { z: 0.9, tz: 0.9, cx: 0, cy: 0, tx: null, ty: null, vw: 390, vh: 700, dpr: 1, padTop: 56, padBot: 120, minZ: 0.3, maxZ: 1.9, bounds: null };
var L = { seen: null, dim: null, edge: null, grid: null, terr: [], isl: {}, dock: {}, supRef: null, supPath: null, roses: [] };
var fleetPos = {}, fx = [], pat = null, QUAL = 0;
var DOCK_PREF = [5, 4, 0, 3, 1, 2];
var hexXY = ART.hexXY;

function col(G, fid) { return fid == null || fid < 0 ? P.neutral : HX.FACTIONS[G.factions[fid].key].col; }
function fkeyOf(G, fid) { return fid == null || fid < 0 ? 'neutral' : G.factions[fid].key; }
function shipOf(G, fid, cls) { return fid >= 0 ? ART.ship(G.factions[fid].key, cls) : ART.ship('neutral', cls, P.neutral); }

function buildTerrain(G) {
  var R = G.R; L.dock = {}; L.supRef = null; L.supPath = null;
  V.bounds = { x: HEXW * (R + 0.5), y: ROW * R + S };
  var bx = V.bounds.x, by = V.bounds.y, r = ART.rng(G.seed ^ 0x5eed);
  L.roses = [[-bx * (0.45 + r() * 0.2), -by * (0.4 + r() * 0.2)], [bx * (0.45 + r() * 0.2), by * (0.35 + r() * 0.25)], [bx * (0.1 + r() * 0.3), -by * (0.55 + r() * 0.3)]];
}
function dockDir(G, k) {
  if (k in L.dock) return L.dock[k];
  var nb = HX.nbrs(k), h = G.hexes[k], out = null;
  for (var i = 0; i < 6 && !out; i++) { var o = G.hexes[nb[DOCK_PREF[i]]]; if (HX.isWater(o)) { var a = hexXY(h), b = hexXY(o), dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy); out = { x: dx / len, y: dy / len }; } }
  L.dock[k] = out || { x: 0, y: 1 }; return L.dock[k];
}
function buildOverlay(G, vis, explored) {
  var seen = new Path2D(), dim = new Path2D(), edge = new Path2D(), grid = new Path2D(), terr = {}, k, h, p, nb, d, o;
  for (k in G.hexes) {
    if (!explored[k]) continue;
    h = G.hexes[k]; p = hexXY(h); nb = HX.nbrs(k);
    ART.hexPath(seen, p.x, p.y, 1.012);
    if (!vis[k]) ART.hexPath(dim, p.x, p.y, 1.012);
    for (d = 0; d < 6; d++) { o = G.hexes[nb[d]]; if (!o || !explored[nb[d]]) ART.edgePath(edge, p.x, p.y, d); else if (d < 3 && h.type !== 'land' && o.type !== 'land') ART.edgePath(grid, p.x, p.y, d); }
    if (h.terr != null) {
      var t = terr[h.terr] || (terr[h.terr] = { col: col(G, h.terr), fill: new Path2D(), edge: new Path2D() });
      if (h.type !== 'land') ART.hexPath(t.fill, p.x, p.y, 1.012);
      for (d = 0; d < 6; d++) { o = G.hexes[nb[d]]; if (!o || o.terr !== h.terr) ART.edgePath(t.edge, p.x, p.y, d); }
    }
  }
  L.isl = {};
  G.isl.forEach(function (isl) {
    var near = {}, any = false, all = true;
    isl.land.forEach(function (l) { near[l] = 1; HX.nbrs(l).forEach(function (n) { if (G.hexes[n]) near[n] = 1; }); if (explored[l]) any = true; });
    if (!any) return;
    var cp = new Path2D(); for (var n2 in near) { if (explored[n2]) { var q = hexXY(G.hexes[n2]); ART.hexPath(cp, q.x, q.y, 1.012); } else all = false; }
    L.isl[isl.id] = all ? null : cp;
  });
  L.seen = seen; L.dim = dim; L.edge = edge; L.grid = grid; L.terr = Object.keys(terr).map(function (x) { return terr[x]; });
}

/* ---------- camera ---------- */
function resize(vw, vh, dpr) { V.vw = vw; V.vh = vh; V.dpr = dpr; }
function yShift() { return (V.vh / 2 - (V.padTop + (V.vh - V.padTop - V.padBot) / 2)) / V.z; }
function clampCam() { if (!V.bounds) return; var b = V.bounds, mx = Math.max(0, b.x - V.vw / (2 * V.z) + 90), my = Math.max(0, b.y - (V.vh - V.padTop - V.padBot) / (2 * V.z) + 90), ys = yShift(); V.cx = Math.max(-mx, Math.min(mx, V.cx)); V.cy = Math.max(-my + ys, Math.min(my + ys, V.cy)); if (V.tx != null) { V.tx = Math.max(-mx, Math.min(mx, V.tx)); V.ty = Math.max(-my + ys, Math.min(my + ys, V.ty)); } }
function fitZ() { if (!V.bounds) return 1; return Math.min(V.vw / (V.bounds.x * 2 + 40), (V.vh - V.padTop - 40) / (V.bounds.y * 2 + 40)); }
function reset(G) { fleetPos = {}; fx = []; V.minZ = Math.max(0.2, Math.min(0.8, fitZ())); V.z = V.tz = V.vw >= 480 ? 1 : 0.9; var f0 = G.fleets.filter(function (x) { return x.owner === 0; })[0], p = hexXY(G.hexes[G.factions[0].capital || (f0 ? HX.fkey(f0) : '0,0')]); V.cx = p.x; V.cy = p.y + yShift(); V.tx = V.ty = null; clampCam(); }
function focus(G, k, instant) { var h = G.hexes[k]; if (!h) return; var p = hexXY(h); V.tx = p.x; V.ty = p.y + yShift(); if (instant) { V.cx = V.tx; V.cy = V.ty; V.tx = V.ty = null; } }
function onScreen(G, k) { var p = hexXY(G.hexes[k]), sx = (p.x - V.cx) * V.z + V.vw / 2, sy = (p.y - V.cy) * V.z + V.vh / 2; return sx > 40 && sx < V.vw - 40 && sy > V.padTop + 40 && sy < V.vh - V.padBot - 40; }
function panBy(dx, dy) { V.cx -= dx / V.z; V.cy -= dy / V.z; V.tx = V.ty = null; clampCam(); }
function zoomAt(sx, sy, factor) { var z0 = V.z, z1 = Math.max(V.minZ, Math.min(V.maxZ, z0 * factor)), wx = V.cx + (sx - V.vw / 2) / z0, wy = V.cy + (sy - V.vh / 2) / z0; V.z = V.tz = z1; V.cx = wx - (sx - V.vw / 2) / z1; V.cy = wy - (sy - V.vh / 2) / z1; V.tx = V.ty = null; clampCam(); }
function stepZoom(dir) { V.tz = Math.max(V.minZ, Math.min(V.maxZ, V.tz * (dir > 0 ? 1.4 : 1 / 1.4))); }
function pick(sx, sy) {
  var wx = V.cx + (sx - V.vw / 2) / V.z, wy = V.cy + (sy - V.vh / 2) / V.z;
  // a ship lying at a quay hangs over the hex edge: a tap on it means its port
  var best = null, bd = 22; for (var id in fleetPos) { var f = fleetPos[id]; if (!f.docked) continue; var dd = Math.hypot(f.x - wx, f.y - 8 - wy); if (dd < bd) { bd = dd; best = f.k; } }
  if (best) return best;
  var r = (2 / 3 * wy) / S, q = (Math.sqrt(3) / 3 * wx - wy / 3) / S, s = -q - r, rq = Math.round(q), rr = Math.round(r), rs = Math.round(s), dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return rq + ',' + rr;
}
function addFx(o) { o.t0 = performance.now(); fx.push(o); }
function moving() { return V.tx != null || Math.abs(V.tz - V.z) > 0.003 || fx.length > 0; }
function setQuality(q) { QUAL = q; }

function patterns(ctx) {
  if (pat && pat.ctx === ctx) return pat;
  pat = { ctx: ctx, sea: ctx.createPattern(ART.seaTile(), 'repeat'), glint: ctx.createPattern(ART.glintTile(), 'repeat'), paper: ctx.createPattern(ART.paperTile(), 'repeat') };
  return pat;
}
function patShift(p, sx, sy, k) { if (p.setTransform && root.DOMMatrix) p.setTransform(new DOMMatrix([k, 0, 0, k, sx, sy])); }
function hexStroke(ctx, x, y, k) { ctx.beginPath(); ART.hexPath(ctx, x, y, k); ctx.stroke(); }
function pips(ctx, x, y, n, colr) { var w = n * 5 + 3; ctx.fillStyle = 'rgba(16,22,26,0.82)'; rrect(ctx, x - w / 2, y - 3, w, 6, 3); ctx.fill(); ctx.fillStyle = colr; for (var i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x - (n - 1) * 2.5 + i * 5, y, 1.7, 0, Math.PI * 2); ctx.fill(); } }
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0); ctx.lineTo(x + w, y + h - r); ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2); ctx.lineTo(x + r, y + h); ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI); ctx.lineTo(x, y + r); ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5); ctx.closePath(); }

function frame(ctx, t, st) {
  var G = st.G;
  if (V.tx != null) { V.cx += (V.tx - V.cx) * 0.2; V.cy += (V.ty - V.cy) * 0.2; if (Math.abs(V.tx - V.cx) < 0.5 && Math.abs(V.ty - V.cy) < 0.5) { V.cx = V.tx; V.cy = V.ty; V.tx = V.ty = null; } }
  if (Math.abs(V.tz - V.z) > 0.003) V.z += (V.tz - V.z) * 0.25; else V.z = V.tz;
  clampCam();
  var z = V.z, dpr = V.dpr, k = z * dpr, left = V.cx - V.vw / (2 * z), top = V.cy - V.vh / (2 * z), ww = V.vw / z, wh = V.vh / z, pt = patterns(ctx);
  var F = G.factions[0], key, h, p, i;
  function world() { ctx.setTransform(k, 0, 0, k, (V.vw / 2 - V.cx * z) * dpr, (V.vh / 2 - V.cy * z) * dpr); }
  function vis(x, y, m) { return x > left - m && x < left + ww + m && y > top - m && y < top + wh + m; }
  world(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = QUAL ? 'low' : 'high';
  // the blank chart: vellum, rhumb lines, compass roses
  patShift(pt.paper, 0, 0, dpr / 2 / k); ctx.fillStyle = pt.paper; ctx.fillRect(left, top, ww, wh);
  ctx.strokeStyle = ART.rgba(P.sepia, 0.2); ctx.lineWidth = 0.9; ctx.beginPath();
  L.roses.forEach(function (c, n) { for (i = 0; i < (n === 2 ? 8 : 16); i++) { var a = i * Math.PI / (n === 2 ? 4 : 8) + 0.02; ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + Math.cos(a) * 5000, c[1] + Math.sin(a) * 5000); } });
  ctx.stroke();
  L.roses.forEach(function (c, n) { if (n < 2 && vis(c[0], c[1], 140)) ART.put(ctx, ART.compass(), c[0], c[1], 1.5); });
  // charted water
  patShift(pt.sea, 0, 0, 0.72); ctx.fillStyle = pt.sea; ctx.fill(L.seen);
  if (z > 0.36 && !QUAL) { patShift(pt.glint, (t * 0.006) % 368.64, Math.sin(t * 0.0004) * 8, 0.72); ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 0.0011); ctx.fillStyle = pt.glint; ctx.fill(L.seen); ctx.globalAlpha = 1; }
  L.terr.forEach(function (tr) { ctx.fillStyle = ART.rgba(tr.col, 0.07); ctx.fill(tr.fill); });
  if (z > 0.42) { ctx.strokeStyle = 'rgba(215,243,243,0.1)'; ctx.lineWidth = 1; ctx.stroke(L.grid); }
  // an island only half charted is clipped to the part that has been seen
  G.isl.forEach(function (isl) {
    var cl = L.isl[isl.id]; if (cl === undefined) return;
    var sp = ART.island(G, isl); if (sp.x > left + ww || sp.y > top + wh || sp.x + sp.w < left || sp.y + sp.h < top) return;
    if (cl) { ctx.save(); ctx.clip(cl); ctx.drawImage(sp.c, sp.x, sp.y, sp.w, sp.h); ctx.restore(); } else ctx.drawImage(sp.c, sp.x, sp.y, sp.w, sp.h);
  });
  L.terr.forEach(function (tr) { ctx.strokeStyle = ART.rgba(tr.col, 0.24); ctx.lineWidth = 7; ctx.stroke(tr.edge); ctx.strokeStyle = ART.rgba(tr.col, 0.95); ctx.lineWidth = 2; ctx.setLineDash([9, 6]); ctx.stroke(tr.edge); ctx.setLineDash([]); });
  ctx.strokeStyle = 'rgba(9,40,54,0.4)'; ctx.lineWidth = 6; ctx.stroke(L.edge); ctx.strokeStyle = '#0c3547'; ctx.lineWidth = 1.8; ctx.stroke(L.edge);
  // what stands on the hexes, back to front
  var items = [], labels = [], fogs = [];
  for (key in G.hexes) {
    if (!F.explored[key]) continue; h = G.hexes[key]; p = hexXY(h); if (!vis(p.x, p.y, 60)) continue;
    if (h.type === 'fog') fogs.push([p.x, p.y, h.v]);
    if (h.type === 'sea' && !h.debris) continue;
    if (h.type === 'land' && !h.base && !h.plot) continue;
    items.push([p.y, p.x, key, h]);
  }
  items.sort(function (a, b) { return a[0] - b[0]; });
  items.forEach(function (it) {
    var x = it[1], y = it[0], hx = it[3], b = hx.base, own = b ? b.owner : null, kk = it[2];
    if (hx.type === 'reef') ART.put(ctx, ART.reef(hx.v), x, y);
    else if (hx.type === 'wreck') { ART.put(ctx, ART.wreck(), x, y + 6); if (st.vis[kk] && (Math.floor(t / 500) + hx.v) % 3 === 0) { ctx.fillStyle = '#fff3c4'; var gx = x + 9, gy = y - 12; ctx.beginPath(); ctx.moveTo(gx, gy - 4); ctx.lineTo(gx + 1.2, gy - 1.2); ctx.lineTo(gx + 4, gy); ctx.lineTo(gx + 1.2, gy + 1.2); ctx.lineTo(gx, gy + 4); ctx.lineTo(gx - 1.2, gy + 1.2); ctx.lineTo(gx - 4, gy); ctx.lineTo(gx - 1.2, gy - 1.2); ctx.closePath(); ctx.fill(); } }
    else if (b) {
      var dk = dockDir(G, kk), c = own == null ? P.neutral : col(G, own);
      ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + dk.x * 8, y + 8 + dk.y * 6); ctx.lineTo(x + dk.x * 33, y + 8 + dk.y * 29); ctx.stroke();
      ctx.strokeStyle = '#b08458'; ctx.lineWidth = 3; ctx.stroke();
      if (b.kind === 'station') ART.put(ctx, ART.freeport(c), x - dk.x * 6, y + 11 - dk.y * 5, 1.2);
      else { var tr = HX.tier(G, kk); ART.put(ctx, ART.town(c, tr, b.cap, b.b.fort || 0, b.b.yard || 0, own == null), x - dk.x * 7, y + 10 - dk.y * 6, 1.3); if (own != null) pips(ctx, x - dk.x * 7, y + 26 - dk.y * 6, tr, c); }
      if (b.siege && Math.floor(t / 400) % 2) { ctx.strokeStyle = P.danger; ctx.lineWidth = 3; ctx.setLineDash([7, 6]); hexStroke(ctx, x, y, 0.93); ctx.setLineDash([]); }
      if (st.idle && st.idle[kk]) { var bob = Math.sin(t * 0.006) * 1.5; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(x + 19, y - 22 + bob, 6.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(x + 19, y - 22 + bob, 5.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = P.ink; ctx.fillRect(x + 18.2, y - 25.6 + bob, 1.6, 4.6); ctx.fillRect(x + 18.2, y - 20 + bob, 1.6, 1.6); }
    } else if (hx.plot) {
      if (hx.plot.lvl > 0) { ART.put(ctx, ART.plot(hx.plot.id, hx.plot.lvl), x, y + 9, 1.25); if (hx.plot.lvl > 1) pips(ctx, x, y + 20, hx.plot.lvl, P.sail); }
      else ART.put(ctx, ART.scaffold(), x, y + 9, 1.25);
    }
    if (hx.debris) { ctx.fillStyle = '#8a5f33'; ctx.fillRect(x - 10, y + 12, 6, 1.8); ctx.fillRect(x + 5, y + 16, 5, 1.8); ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(x - 1, y + 15, 1.6, 0, Math.PI * 2); ctx.fill(); }
  });
  // water seen once but not watched now fades back toward the chart
  ctx.fillStyle = 'rgba(210,196,158,0.27)'; ctx.fill(L.dim); ctx.fillStyle = 'rgba(12,30,40,0.1)'; ctx.fill(L.dim);
  // range of the chosen fleet
  if (st.sup) {
    if (st.sup !== L.supRef) { L.supRef = st.sup; L.supPath = new Path2D(); for (key in G.hexes) { if (key in st.sup || !F.explored[key]) continue; p = hexXY(G.hexes[key]); ART.hexPath(L.supPath, p.x, p.y, 1.012); } }
    ctx.fillStyle = 'rgba(6,16,22,0.42)'; ctx.fill(L.supPath);
  } else L.supRef = null;
  if (st.reach) for (key in st.reach) { h = G.hexes[key]; p = hexXY(h); if (!vis(p.x, p.y, 50)) continue; var atk = st.reach[key].atk, cc = atk ? P.danger : st.lit; ctx.fillStyle = atk ? ART.rgba(cc, 0.3) : 'rgba(255,255,255,0.13)'; ctx.beginPath(); ART.hexPath(ctx, p.x, p.y, 0.94); ctx.fill(); ctx.strokeStyle = ART.rgba(cc, 0.95); ctx.lineWidth = atk ? 2.6 : 1.8; if (!atk) ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]); if (atk) { ctx.fillStyle = 'rgba(20,10,8,0.85)'; ctx.beginPath(); ctx.arc(p.x, p.y - 22, 8.5, 0, Math.PI * 2); ctx.fill(); ctx.drawImage(ART.icon('sword'), p.x - 6.5, p.y - 28.5, 13, 13); } }
  if (st.course) { ctx.strokeStyle = ART.rgba(st.lit, 0.5); ctx.lineWidth = 1.4; ctx.setLineDash([4, 6]); for (key in st.course) { if (st.reach && st.reach[key]) continue; p = hexXY(G.hexes[key]); if (vis(p.x, p.y, 50)) hexStroke(ctx, p.x, p.y, 0.9); } ctx.setLineDash([]); }
  if (st.sites) st.sites.forEach(function (sk) { var sp = hexXY(G.hexes[sk]); ctx.strokeStyle = P.ink; ctx.lineWidth = 4.4; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 0.01; hexStroke(ctx, sp.x, sp.y, 0.9); ctx.strokeStyle = P.gold; ctx.lineWidth = 2.4; hexStroke(ctx, sp.x, sp.y, 0.9); ctx.setLineDash([]); ctx.lineDashOffset = 0; });
  fogs.forEach(function (fg) { ART.put(ctx, ART.fogPuff(fg[2]), fg[0] + Math.sin(t * 0.0003 + fg[2]) * 5, fg[1] + Math.cos(t * 0.00025 + fg[2]) * 3, 1.05); });
  // fleets
  var seenF = {}, dt = 0.2;
  G.fleets.forEach(function (fl) {
    var fk = HX.fkey(fl); if (!HX.fleetVisible(G, 0, fl, st.vis)) return;
    var hh = G.hexes[fk], pp = hexXY(hh), tx = pp.x, ty = pp.y + 12, docked = !!hh.base;
    if (docked) { var dk = dockDir(G, fk); tx = pp.x + dk.x * 37; ty = pp.y + dk.y * 33 + 12; }
    var fp = fleetPos[fl.id];
    if (!fp) fp = fleetPos[fl.id] = { x: tx, y: ty }; else { fp.x += (tx - fp.x) * dt; fp.y += (ty - fp.y) * dt; if (Math.abs(tx - fp.x) < 0.3) fp.x = tx; if (Math.abs(ty - fp.y) < 0.3) fp.y = ty; }
    fp.k = fk; fp.docked = docked && fl.owner === 0; seenF[fl.id] = 1;
    if (!vis(fp.x, fp.y, 80)) return;
    var cls = HX.topClass(fl.ships), sp = shipOf(G, fl.owner, cls), mine = fl.owner === 0, Ls = ART.SHIP[cls].L, moving = Math.abs(tx - fp.x) + Math.abs(ty - fp.y) > 1;
    var bobY = Math.sin(t * 0.0022 + fl.id * 1.7) * 1.1, fxp = fp.x, fyp = fp.y + bobY, flip = !mine, c = fl.owner < 0 ? P.neutral : col(G, fl.owner);
    var picked = mine && st.selFleet && fk === st.sel;
    if (picked) { var pu = 0.5 + 0.5 * Math.sin(t * 0.006); ctx.beginPath(); ctx.ellipse(fxp, fp.y + 2, Ls * 0.82, 11, 0, 0, Math.PI * 2); ctx.fillStyle = ART.rgba(st.accent, 0.38); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 4.6; ctx.stroke(); ctx.strokeStyle = ART.mix(st.accent, '#ffffff', 0.35 + 0.5 * pu); ctx.lineWidth = 2.4; ctx.stroke(); }
    ctx.strokeStyle = 'rgba(238,247,243,' + (moving ? 0.95 : 0.7) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fxp - Ls * 0.58, fp.y + 1.6); ctx.quadraticCurveTo(fxp, fp.y + 4.4 + Math.sin(t * 0.004 + fl.id) * 0.8, fxp + Ls * 0.58, fp.y + 1.6); ctx.stroke();
    ART.put(ctx, sp, fxp, fyp, picked ? 1.12 : 1, flip);
    pips(ctx, fxp, fp.y + 9, Math.min(5, HX.shipCount(fl.ships)), c);
    var topY = fyp - sp.ay / sp.ss;
    if (fl.pirate) { var jy = topY - 3; ctx.fillStyle = P.ink; ctx.fillRect(fxp - 1, jy - 9, 1.6, 11); ctx.beginPath(); ctx.moveTo(fxp + 0.6, jy - 9.5); ctx.lineTo(fxp + 12, jy - 8); ctx.lineTo(fxp + 12, jy - 1.5); ctx.lineTo(fxp + 0.6, jy - 1); ctx.closePath(); ctx.fillStyle = '#17131a'; ctx.fill(); ctx.strokeStyle = '#f1ead9'; ctx.lineWidth = 0.7; ctx.stroke(); ctx.fillStyle = '#f1ead9'; ctx.beginPath(); ctx.arc(fxp + 6.2, jy - 5.8, 1.9, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(fxp + 5.2, jy - 4.6, 2, 1.6); ctx.fillStyle = '#17131a'; ctx.fillRect(fxp + 5.3, jy - 6.3, 0.8, 0.8); ctx.fillRect(fxp + 6.5, jy - 6.3, 0.8, 0.8); }
    if (mine && fl.mp > 0 && !fl.hold && !fl.dest && !fl.auto) { var bb = Math.sin(t * 0.007 + fl.id) * 1.8, cy2 = topY - 5 + bb; ctx.beginPath(); ctx.moveTo(fxp - 5.5, cy2 - 5); ctx.lineTo(fxp, cy2 + 1); ctx.lineTo(fxp + 5.5, cy2 - 5); ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4; ctx.stroke(); }
    if (mine && fl.dest && G.hexes[fl.dest]) { var dp = hexXY(G.hexes[fl.dest]); ctx.strokeStyle = P.ink; ctx.lineWidth = 3.6; ctx.setLineDash([2, 9]); ctx.lineDashOffset = -t * 0.012; ctx.beginPath(); ctx.moveTo(fp.x, fp.y - 6); ctx.lineTo(dp.x, dp.y); ctx.stroke(); ctx.strokeStyle = st.accent; ctx.lineWidth = 2.2; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; }
  });
  for (var id in fleetPos) if (!seenF[id]) delete fleetPos[id];
  // selection and the guide's pointer
  if (st.sel && G.hexes[st.sel] && !(st.selFleet && !G.hexes[st.sel].base)) { p = hexXY(G.hexes[st.sel]); ctx.strokeStyle = 'rgba(16,22,26,0.7)'; ctx.lineWidth = 5.5; hexStroke(ctx, p.x, p.y, 0.97); ctx.strokeStyle = st.selFleet ? 'rgba(255,255,255,0.55)' : Math.floor(t / 450) % 2 ? '#ffffff' : P.gold; ctx.lineWidth = 2.6; hexStroke(ctx, p.x, p.y, 0.97); }
  if (st.tutHex && G.hexes[st.tutHex]) { p = hexXY(G.hexes[st.tutHex]); var b2 = Math.abs(Math.sin(t * 0.005)) * 7; ctx.strokeStyle = P.gold; ctx.lineWidth = 3; ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 0.004)); hexStroke(ctx, p.x, p.y, 0.97); ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(p.x - 8, p.y - 46 - b2); ctx.lineTo(p.x + 8, p.y - 46 - b2); ctx.lineTo(p.x, p.y - 33 - b2); ctx.closePath(); ctx.fillStyle = P.gold; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.stroke(); }
  // effects on the water
  var now = performance.now();
  fx = fx.filter(function (e) { return now - e.t0 < e.dur; });
  fx.forEach(function (e) {
    if (e.screen) return; var u = (now - e.t0) / e.dur, ph = G.hexes[e.key]; if (!ph) return; var q = hexXY(ph);
    if (e.type === 'flash') { ctx.fillStyle = ART.rgba(e.col || '#ffffff', (1 - u) * 0.6); ctx.beginPath(); ART.hexPath(ctx, q.x, q.y, 1); ctx.fill(); }
    else if (e.type === 'boom') { for (var n2 = 0; n2 < 9; n2++) { var an = n2 * 0.7 + e.t0, rd = 6 + u * 26 * (0.5 + ART.hash2(n2, 1, 3) * 0.6); ctx.fillStyle = u < 0.2 ? 'rgba(255,236,170,' + (1 - u) + ')' : 'rgba(225,225,220,' + (1 - u) * 0.8 + ')'; ctx.beginPath(); ctx.arc(q.x + Math.cos(an) * rd, q.y + Math.sin(an) * rd * 0.7, 3 + u * 7, 0, Math.PI * 2); ctx.fill(); } }
  });
  // names, in screen space so the lettering stays crisp
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (z >= 0.4) {
    var fs = Math.round(Math.max(11, Math.min(15, 13 * z / 0.9)));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
    G.isl.forEach(function (isl) {
      var sx = 0, by = -1e9, n = 0; isl.land.forEach(function (l) { if (!F.explored[l]) return; var q = hexXY(G.hexes[l]); sx += q.x; by = Math.max(by, q.y); n++; });
      if (!n) return; sx /= n; if (!vis(sx, by, 80)) return;
      var o = HX.islandOwner(G, isl), cap = isl.port && G.hexes[isl.port].base.cap, lx = (sx - V.cx) * z + V.vw / 2, ly = (by + 30 - V.cy) * z + V.vh / 2;
      ctx.font = '600 ' + (cap ? fs + 2 : fs) + 'px "Barlow Condensed", "Arial Narrow", system-ui, sans-serif'; var nm = isl.name.toUpperCase();
      if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(12,26,34,0.85)'; ctx.strokeText(nm, lx, ly); ctx.fillStyle = o != null ? ART.mix(col(G, o), '#ffffff', 0.4) : '#f1e7cc'; ctx.fillText(nm, lx, ly);
    });
  }
  fx.forEach(function (e) {
    if (!e.screen || !G.hexes[e.key]) return; var u = (now - e.t0) / e.dur, q = hexXY(G.hexes[e.key]);
    var tx2 = (q.x - V.cx) * z + V.vw / 2, ty2 = (q.y - 20 - u * 26 - V.cy) * z + V.vh / 2;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; ctx.font = '700 20px "Barlow", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = u < 0.7 ? 1 : (1 - u) / 0.3; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(12,20,26,0.95)'; ctx.strokeText(e.txt, tx2, ty2); ctx.fillStyle = e.col || '#ffffff'; ctx.fillText(e.txt, tx2, ty2); ctx.globalAlpha = 1;
  });
}

/* ---------- title scene: a squadron under sail at dusk ---------- */
function titleFrame(ctx, t, fkey, withLogo) {
  var W = V.vw, H = V.vh, dpr = V.dpr, hz = Math.round(H * (withLogo ? 0.46 : 0.4)), i;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  var g = ctx.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#0a2230'); g.addColorStop(0.45, '#1c5566'); g.addColorStop(0.82, '#d99a6c'); g.addColorStop(1, '#ffdca0'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz);
  var sx = W * 0.7, sy = hz - 8, sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 150); sg.addColorStop(0, 'rgba(255,244,205,0.95)'); sg.addColorStop(0.16, 'rgba(255,222,150,0.75)'); sg.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, hz);
  for (i = 0; i < 6; i++) { var cx = ((ART.hash2(i, 1, 4) * (W + 300) + t * 0.004 * (1 + i * 0.2)) % (W + 300)) - 150, cy = hz * (0.3 + ART.hash2(i, 2, 4) * 0.5), cw = 70 + ART.hash2(i, 3, 4) * 110; ctx.fillStyle = 'rgba(255,214,170,' + (0.1 + ART.hash2(i, 5, 4) * 0.14) + ')'; ctx.beginPath(); ctx.ellipse(cx, cy, cw, 7 + ART.hash2(i, 6, 4) * 7, 0, 0, Math.PI * 2); ctx.fill(); }
  // far islands with palms
  ctx.fillStyle = '#1f4a54'; [[W * 0.16, 120, 26], [W * 0.38, 70, 13], [W * 0.95, 110, 20]].forEach(function (m) { ctx.beginPath(); ctx.moveTo(m[0] - m[1], hz + 1); ctx.quadraticCurveTo(m[0] - m[1] * 0.2, hz - m[2] * 1.7, m[0] + m[1] * 0.2, hz - m[2]); ctx.quadraticCurveTo(m[0] + m[1] * 0.6, hz - m[2] * 0.5, m[0] + m[1], hz + 1); ctx.closePath(); ctx.fill(); });
  ctx.strokeStyle = '#1f4a54'; [[W * 0.1, 22], [W * 0.2, 30], [W * 0.92, 24]].forEach(function (pm) { var bx = pm[0], by = hz - pm[1] * 0.7, tx = bx + 6, ty = by - pm[1]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + 1, by - pm[1] * 0.6, tx, ty); ctx.stroke(); ctx.lineWidth = 2.4; for (var f = 0; f < 6; f++) { var a = -Math.PI * 0.95 + f * Math.PI * 0.38; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * 8, ty - 5, tx + Math.cos(a) * 14, ty + Math.sin(a) * 7 + 5); ctx.stroke(); } });
  // sea
  var s2 = ctx.createLinearGradient(0, hz, 0, H); s2.addColorStop(0, '#e2a06a'); s2.addColorStop(0.08, '#6f8f8a'); s2.addColorStop(0.3, '#1c6078'); s2.addColorStop(1, '#0a2533'); ctx.fillStyle = s2; ctx.fillRect(0, hz, W, H - hz);
  for (i = 0; i < 70; i++) { var u = ART.hash2(i, 7, 9), gy = hz + 3 + u * u * (H - hz) * 0.75, gw = (4 + u * 26) * (0.6 + 0.4 * Math.sin(t * 0.003 + i * 2.1)), gx = sx + (ART.hash2(i, 8, 9) - 0.5) * (30 + u * 150); ctx.strokeStyle = 'rgba(255,228,170,' + (0.5 - u * 0.36) + ')'; ctx.lineWidth = 1 + u * 1.6; ctx.beginPath(); ctx.moveTo(gx - gw, gy); ctx.lineTo(gx + gw, gy); ctx.stroke(); }
  for (i = 0; i < 9; i++) { var wy = hz + 14 + i * i * 4.2 + i * 12, amp = 1.5 + i * 0.5; ctx.strokeStyle = 'rgba(220,244,240,' + (0.05 + i * 0.012) + ')'; ctx.lineWidth = 1 + i * 0.18; ctx.beginPath(); for (var wx = -20; wx <= W + 20; wx += 14) { var yy = wy + Math.sin(wx * 0.018 * (1 - i * 0.05) + t * 0.0009 * (1 + i * 0.25) + i * 1.7) * amp; if (wx === -20) ctx.moveTo(wx, yy); else ctx.lineTo(wx, yy); } ctx.stroke(); }
  // the chosen faction's squadron, near ships large, far ships small
  var line = [['manowar', 0.3, 2.3], ['galleon', 0.215, 1.8], ['frigate', 0.145, 1.4], ['brig', 0.09, 1.05], ['sloop', 0.045, 0.75]];
  line.slice().reverse().forEach(function (sh, n) {
    var sp = ART.ship(fkey, sh[0]), sc = sh[2] * Math.min(1.25, W / 400), span = W + 420 * sc, px = ((t * 0.012 * (0.5 + sh[2] * 0.22) + n * 173 + 60) % span) - 210 * sc, py = hz + (H - hz) * sh[1] + Math.sin(t * 0.0016 + n * 2) * 1.6 * sc, Ls = ART.SHIP[sh[0]].L * sc;
    ctx.save(); ctx.globalAlpha = 0.22; ctx.translate(px, py + 2); ctx.scale(1, -0.7); ART.put(ctx, sp, 0, 0, sc); ctx.restore();
    ctx.strokeStyle = 'rgba(238,247,243,0.7)'; ctx.lineWidth = 1.2 * sc; ctx.beginPath(); ctx.moveTo(px - Ls * 0.9, py + 1.5 * sc); ctx.quadraticCurveTo(px, py + 3.4 * sc, px + Ls * 0.56, py + 1 * sc); ctx.stroke();
    ART.put(ctx, sp, px, py, sc);
  });
}

/* ---------- battle scene: two lines of ships trading broadsides ---------- */
function battleScene(canvas, res, G, done) {
  var W = 360, H = 204, K = 2, a = canvas.getContext('2d'), t0 = performance.now(), stop = false, raf, hz = 84;
  canvas.width = W * K; canvas.height = H * K;
  function units(start, side) {
    var total = 0, t, list = []; for (t in start) total += start[t]; var cap = 9;
    HX.SHIP_ORDER.slice().reverse().forEach(function (cl) { var n = start[cl] || 0; if (!n) return; var v = total > cap ? Math.max(1, Math.round(n * cap / total)) : n; for (var i = 0; i < v && list.length < cap; i++) list.push({ cls: cl, n0: n, v0: v, i: i, dead: 99, side: side }); });
    return list;
  }
  var A = units(res.a0, 0), D = units(res.d0, 1);
  function mark(list, key) { res.rounds.forEach(function (rd, ri) { var byC = {}; list.forEach(function (u) { (byC[u.cls] = byC[u.cls] || []).push(u); }); for (var cl in byC) { var cur = rd[key][cl] || 0, us = byC[cl], keep = cur <= 0 ? 0 : Math.max(1, Math.ceil(cur * us[0].v0 / us[0].n0)); us.forEach(function (u, i) { if (i >= keep && u.dead === 99) u.dead = ri; }); } }); }
  mark(A, 'a'); mark(D, 'd');
  var turret = res.turret ? { x: W - 26, y: 112, sc: 1, dead: res.turretLeft ? 99 : res.rounds.length - 1, fort: true } : null;
  function place(list, side) { list.forEach(function (u, i) { var lane = i % 3, slot = Math.floor(i / 3), x = 30 + slot * 46 + lane * 12 + (side && turret ? 34 : 0); u.x = side ? W - x : x; u.y = 112 + lane * 30; u.sc = 0.82 + lane * 0.16; }); }
  place(A, 0); place(D, 1);
  var all = A.concat(D).sort(function (p, q) { return p.y - q.y; });
  var RT = 1000, intro = 650, total = intro + res.rounds.length * RT + 900, shots = [];
  res.rounds.forEach(function (rd, ri) { [[A, D, 0], [D, A, 1]].forEach(function (pr) { var src = pr[0].filter(function (u) { return u.dead >= ri; }), dst = pr[1].filter(function (u) { return u.dead >= ri; }); if (pr[2] === 0 && turret && turret.dead >= ri) dst = dst.concat([turret]); if (pr[2] === 1 && turret && turret.dead >= ri) src = src.concat([turret]); if (!dst.length) return; src.forEach(function (u, i) { var tg = dst[Math.floor(ART.hash2(i, ri, pr[2] + 5) * dst.length)]; shots.push({ t: intro + ri * RT + 60 + ART.hash2(i, ri, 9 + pr[2]) * 560, from: u, to: tg, side: pr[2] }); }); }); });
  var port = G.hexes[res.key] && G.hexes[res.key].base;
  function draw() {
    if (stop) return; var t = performance.now() - t0, i;
    a.setTransform(K, 0, 0, K, 0, 0); a.lineCap = 'round'; a.lineJoin = 'round';
    var g = a.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#12384a'); g.addColorStop(0.7, '#5d8f93'); g.addColorStop(1, '#f1c68c'); a.fillStyle = g; a.fillRect(0, 0, W, hz);
    if (port) { a.fillStyle = '#2a5a5e'; a.beginPath(); a.moveTo(W * 0.56, hz + 1); a.quadraticCurveTo(W * 0.74, hz - 46, W * 0.86, hz - 22); a.quadraticCurveTo(W * 0.95, hz - 12, W + 10, hz - 16); a.lineTo(W + 10, hz + 1); a.closePath(); a.fill(); }
    var s2 = a.createLinearGradient(0, hz, 0, H); s2.addColorStop(0, '#7fa49c'); s2.addColorStop(0.18, '#1f6880'); s2.addColorStop(1, '#0c3345'); a.fillStyle = s2; a.fillRect(0, hz, W, H - hz);
    for (i = 0; i < 6; i++) { var wy = hz + 10 + i * 20; a.strokeStyle = 'rgba(220,244,240,' + (0.07 + i * 0.012) + ')'; a.lineWidth = 1 + i * 0.12; a.beginPath(); for (var wx = -10; wx <= W + 10; wx += 12) { var yy = wy + Math.sin(wx * 0.03 + t * 0.0016 + i * 1.3) * (1.2 + i * 0.3); if (wx === -10) a.moveTo(wx, yy); else a.lineTo(wx, yy); } a.stroke(); }
    var slide = Math.min(1, t / intro), ease = 1 - (1 - slide) * (1 - slide), ri = Math.floor((t - intro) / RT), within = (t - intro) - ri * RT;
    function unit(u) {
      var side = u.side, ux = u.x + (side ? 1 : -1) * (1 - ease) * 150, uy = u.y + Math.sin(t * 0.003 + u.x) * 1, since = (t - intro) - (u.dead * RT + 720), dead = u.dead < ri || (u.dead === ri && within > 720);
      if (dead && since > 900) return;
      var sp = u.fort ? fortSprite() : shipOf(G, side ? res.def : res.att, u.cls);
      a.save(); a.translate(ux, uy);
      if (dead) { var s = Math.min(1, since / 900); a.globalAlpha = 1 - s; a.translate(0, s * 20); a.rotate((side ? -1 : 1) * s * 0.5); }
      if (!u.fort) { a.strokeStyle = 'rgba(238,247,243,0.7)'; a.lineWidth = 1.4; a.beginPath(); a.moveTo(-ART.SHIP[u.cls].L * 0.6 * u.sc, 1.5); a.quadraticCurveTo(0, 4, ART.SHIP[u.cls].L * 0.6 * u.sc, 1.5); a.stroke(); }
      ART.put(a, sp, 0, 0, u.sc * (u.fort ? 1.3 : 1.05), !!side && !u.fort);
      a.restore();
    }
    all.forEach(unit); if (turret) { turret.side = 1; unit(turret); }
    shots.forEach(function (s) {
      var u = (t - s.t) / 300; if (u < 0 || u > 2.6) return;
      var fx0 = s.from.x + (s.side ? -14 : 14) * s.from.sc, fy0 = s.from.y - 7 * s.from.sc, tx = s.to.x, ty = s.to.y - 6 * s.to.sc;
      if (u < 0.3) { a.fillStyle = 'rgba(255,232,150,' + (1 - u / 0.3) + ')'; a.beginPath(); a.arc(fx0, fy0, 5 * (0.5 + u * 2), 0, Math.PI * 2); a.fill(); }
      for (var n = 0; n < 3; n++) { var pu = Math.min(1, u / 2.6), pr2 = 3 + pu * 9 + n * 1.5; a.fillStyle = 'rgba(232,232,226,' + (0.5 * (1 - pu)) + ')'; a.beginPath(); a.arc(fx0 + (s.side ? -1 : 1) * (2 + n * 4) * pu * 3, fy0 - pu * 10 - n * 2, pr2, 0, Math.PI * 2); a.fill(); }
      if (u <= 1) { a.fillStyle = '#17120e'; a.beginPath(); a.arc(fx0 + (tx - fx0) * u, fy0 + (ty - fy0) * u - Math.sin(u * Math.PI) * 16, 1.7, 0, Math.PI * 2); a.fill(); }
      else if (u < 1.5) { var v = (u - 1) / 0.5; a.fillStyle = 'rgba(255,190,110,' + (1 - v) + ')'; a.beginPath(); a.arc(tx, ty, 2 + v * 6, 0, Math.PI * 2); a.fill(); }
    });
    if (t >= total) { stop = true; done(); return; }
    raf = requestAnimationFrame(draw);
  }
  raf = requestAnimationFrame(draw);
  return { skip: function () { if (stop) return; stop = true; cancelAnimationFrame(raf); done(); }, kill: function () { stop = true; cancelAnimationFrame(raf); } };
}
var fortSp = null;
function fortSprite() {
  if (fortSp) return fortSp;
  var SS = ART.SS, c = ART.cv(40 * SS, 44 * SS), x = c.getContext('2d'); x.scale(SS, SS); x.translate(20, 40);
  ART.poly(x, [-18, 2, -12, -8, 12, -8, 18, 2], '#6f695d');
  x.fillStyle = P.stone; x.fillRect(-9, -30, 18, 23); x.fillStyle = 'rgba(40,35,30,0.28)'; x.fillRect(0, -30, 9, 23);
  x.fillStyle = P.stone; for (var i = 0; i < 4; i++) x.fillRect(-10.5 + i * 6, -33, 3.4, 3.2);
  x.fillStyle = '#2a211a'; x.fillRect(-6, -22, 3, 2.4); x.fillRect(-6, -14, 3, 2.4); x.fillRect(2, -18, 3, 2.4);
  fortSp = c; fortSp.ax = 20 * SS; fortSp.ay = 40 * SS; fortSp.ss = SS; return fortSp;
}

/* ---------- the rumoured chart shown before a game ---------- */
function miniMap(canvas, G) {
  var R = G.R, W = 264, s = W / ((2 * R + 1) * 1.75 + 2), H = Math.ceil((2 * R + 1) * s * 1.5 + s * 2 + 8); canvas.width = W; canvas.height = H;
  var x = canvas.getContext('2d'); x.fillStyle = P.paper; x.fillRect(0, 0, W, H); x.fillStyle = x.createPattern(ART.paperTile(), 'repeat'); x.fillRect(0, 0, W, H);
  x.strokeStyle = ART.rgba(P.sepia, 0.25); x.lineWidth = 1; x.beginPath(); for (var i = 0; i < 16; i++) { var a = i * Math.PI / 8; x.moveTo(W * 0.3, H * 0.34); x.lineTo(W * 0.3 + Math.cos(a) * 600, H * 0.34 + Math.sin(a) * 600); } x.stroke();
  var caps = [];
  for (var k in G.hexes) {
    var h = G.hexes[k], px = W / 2 + (h.q + h.r / 2) * s * 1.732, py = H / 2 + h.r * s * 1.5;
    if (h.type === 'land') { x.fillStyle = h.base && h.base.kind === 'station' ? '#3a2a1c' : ART.mix(ART.GROUND[h.ter], P.sepia, 0.45); x.beginPath(); x.arc(px, py, s * 0.98, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(60,40,20,0.8)'; x.lineWidth = 1.2; x.stroke(); }
    else if (h.type === 'reef') { x.strokeStyle = 'rgba(70,50,30,0.7)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(px - 2.2, py - 2.2); x.lineTo(px + 2.2, py + 2.2); x.moveTo(px + 2.2, py - 2.2); x.lineTo(px - 2.2, py + 2.2); x.stroke(); }
    if (h.base && h.base.cap) caps.push([px, py, col(G, h.base.owner)]);
    G.factions.forEach(function (F) { if (F.capital == null && F.start === k) caps.push([px, py, col(G, F.id)]); });
  }
  caps.forEach(function (c) { x.fillStyle = P.ink; x.beginPath(); x.arc(c[0], c[1], s * 1.25 + 1.6, 0, Math.PI * 2); x.fill(); x.fillStyle = c[2]; x.beginPath(); x.arc(c[0], c[1], s * 1.25, 0, Math.PI * 2); x.fill(); });
  x.strokeStyle = ART.rgba(P.sepia, 0.8); x.lineWidth = 2; x.strokeRect(3, 3, W - 6, H - 6); x.lineWidth = 0.8; x.strokeRect(7, 7, W - 14, H - 14);
}

RN.V = V; RN.buildTerrain = buildTerrain; RN.buildOverlay = buildOverlay; RN.resize = resize; RN.reset = reset; RN.focus = focus; RN.onScreen = onScreen; RN.panBy = panBy; RN.zoomAt = zoomAt; RN.stepZoom = stepZoom; RN.pick = pick;
RN.addFx = addFx; RN.moving = moving; RN.setQuality = setQuality; RN.frame = frame; RN.titleFrame = titleFrame; RN.battleScene = battleScene; RN.miniMap = miniMap; RN.col = col;
root.RN = RN;
})(window);
