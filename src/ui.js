/* Salt & Steel interface: screens, instruments, ship's papers, input, the first-turn guide, saving. */
(function () {
'use strict';
var HX = window.HX, ART = window.ART, RN = window.RN, P = ART.PAL;
function $(s) { return document.querySelector(s); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } }, del: function (k) { try { localStorage.removeItem(k); } catch (e) { } } };
var SAVE = 'saltsteel.save.v2', OPT = 'saltsteel.opt.v1', REC = 'saltsteel.rec.v1';
function record() { try { return JSON.parse(store.get(REC) || 'null') || { w: 0, l: 0 }; } catch (e) { return { w: 0, l: 0 }; } }

var S = {
  screen: 'title', G: null, vis: {}, sel: null, reach: null, course: null, sites: null, courseMode: false, detach: null, busy: false, idle: [], idleBases: {}, idleIdx: 0, tab: 'place',
  setup: { faction: 'crown', size: 's', diff: 'normal', seed: 1 + Math.floor(Math.random() * 99999), tutorial: true },
  opt: { sfx: true, battles: true }, modalOpen: false, onClose: null, tick: null, logSeen: 0, techSel: null, buildTab: 'b', buildTown: null, confirmWar: null, tutHex: null
};
window.__tf = S;

/* ---------- small html helpers ---------- */
function ic(n, cls) { return '<i class="ic i-' + n + (cls ? ' ' + cls : '') + '"></i>'; }
var urlCache = {};
function sprURL(id, c) { if (!urlCache[id]) urlCache[id] = ART.url(c); return urlCache[id]; }
/* k = css pixels per world unit, so classes keep their relative size */
function shipImg(fk, cls, k, neutral) { var c = neutral ? ART.ship('neutral', cls, P.neutral) : ART.ship(fk, cls); return '<img alt="" src="' + sprURL('s' + (neutral ? 'n' : fk) + cls, c) + '" width="' + Math.round(c.width / c.ss * k) + '" height="' + Math.round(c.height / c.ss * k) + '">'; }
function plotImg(id, lvl, k) { var c = ART.plot(id, lvl); return '<img alt="" src="' + sprURL('p' + id + lvl, c) + '" width="' + Math.round(c.width / c.ss * k) + '" height="' + Math.round(c.height / c.ss * k) + '">'; }
function emblemImg(fk, px) { return '<img alt="" src="' + sprURL('e' + fk, ART.emblem(fk)) + '" width="' + px + '" height="' + px + '">'; }
function fkOf(G, fid) { return fid >= 0 ? G.factions[fid].key : 'neutral'; }
function fcol(G, fid) { return RN.col(G, fid); }
function sw(G, fid) { return '<i class="sw" style="background:' + fcol(G, fid) + '"></i>'; }
function chips(G, owner, ships) { var o = ''; HX.SHIP_ORDER.forEach(function (t) { if (ships[t] > 0) o += '<span class="chip" title="' + HX.shipName(G, owner, t) + '">' + shipImg(fkOf(G, owner), t, 0.5, owner < 0) + '×' + ships[t] + '</span>'; }); return '<div class="chips">' + (o || '<span class="hint">None</span>') + '</div>'; }
function costHTML(c, F) { var o = ''; [['a', 'timber'], ['c', 'gold'], ['f', 'rum']].forEach(function (r) { if (c[r[0]]) o += '<span' + (F && F.res[r[0]] < c[r[0]] ? ' class="no"' : '') + '>' + ic(r[1], 's12') + c[r[0]] + '</span>'; }); return '<span class="cost">' + (o || 'Free') + '</span>'; }
function turns(n) { return n + (n === 1 ? ' turn' : ' turns'); }
function roman(n) { return ['', 'I', 'II', 'III'][n] || n; }
function townOf(G, k) { var h = G.hexes[k]; if (!h) return null; if (h.base) return k; var isl = HX.islandOf(G, k); return isl ? isl.port : null; }

/* ---------- sound ---------- */
var AC = null;
var SFX = { tap: [620, 620, 0.03, 0.03], ok: [520, 780, 0.1, 0.045], move: [300, 440, 0.11, 0.04], build: [392, 587, 0.14, 0.045], end: [330, 196, 0.24, 0.045], err: [170, 120, 0.14, 0.05], war: [220, 98, 0.5, 0.06], win: [523, 1046, 0.55, 0.055], tech: [660, 990, 0.28, 0.045] };
function sfx(n) {
  if (!S.opt.sfx) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
    var d = SFX[n], t = AC.currentTime, g = AC.createGain(); g.connect(AC.destination);
    if (n === 'boom') { var len = AC.sampleRate * 0.45, buf = AC.createBuffer(1, len, AC.sampleRate), ch = buf.getChannelData(0), lp = 0; for (var i = 0; i < len; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.12; ch[i] = lp * Math.pow(1 - i / len, 2.4) * 3; } var src = AC.createBufferSource(); src.buffer = buf; g.gain.value = 0.22; src.connect(g); src.start(); return; }
    var o = AC.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(d[0], t); o.frequency.exponentialRampToValueAtTime(d[1], t + d[2]); g.gain.setValueAtTime(d[3] * 2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d[2] + 0.08); o.connect(g); o.start(t); o.stop(t + d[2] + 0.1);
  } catch (e) { }
}

/* ---------- accent ---------- */
function setAccent(colr) {
  var rs = document.documentElement.style; rs.setProperty('--acc', colr); rs.setProperty('--acc-deep', ART.mix(colr, '#1d1711', 0.5));
  if (!$('#dyn')) { var st = document.createElement('style'); st.id = 'dyn'; st.textContent = ART.iconCSS(); document.head.appendChild(st); }
}

/* ---------- toasts, banner, modal ---------- */
function toast(txt) { var d = document.createElement('div'); d.innerHTML = txt; $('#toast').appendChild(d); setTimeout(function () { d.remove(); }, 2900); while ($('#toast').children.length > 3) $('#toast').firstChild.remove(); }
function modal(html, mid, onClose) { var m = $('#modal'); m.className = mid ? 'mid' : ''; m.innerHTML = '<div class="dlg paper" role="dialog" aria-modal="true">' + html + '</div>'; m.hidden = false; S.modalOpen = true; S.onClose = onClose || null; tutCheck(); }
function closeModal(silent) { var m = $('#modal'); if (battleCtl) { var bc = battleCtl; battleCtl = null; bc.kill(); } m.hidden = true; m.innerHTML = ''; S.modalOpen = false; S.confirmWar = null; var cb = S.onClose; S.onClose = null; if (cb) cb(); if (!silent && S.screen === 'game') { tutCheck(); pump(); } }
function head(title, noClose) { return '<div class="dlg-h"><h2>' + title + '</h2>' + (noClose ? '' : '<button class="x" data-act="close" aria-label="Close">' + ic('x') + '</button>') + '</div>'; }

/* ---------- title and setup ---------- */
function show(screen) { S.screen = screen; $('#title').hidden = screen !== 'title'; $('#setup').hidden = screen !== 'setup'; $('#hud').hidden = screen !== 'game'; $('#vig').hidden = screen !== 'game'; }
function savedGame() { var s = store.get(SAVE); if (!s) return null; try { var G = JSON.parse(s); return G && G.v === 1 && G.isl && !G.over ? G : null; } catch (e) { return null; } }
function renderTitle() {
  var sv = savedGame(), rec = record();
  setAccent(HX.FACTIONS[S.setup.faction].col);
  $('#title').innerHTML = '<h1>Salt <i>&amp;</i><br>Steel</h1><p class="tag">Chart the sea. Raise ports. Rule the islands.</p>' +
    (sv ? '<button class="btn solid" data-act="continue"><span>Continue<small>' + HX.FACTIONS[sv.factions[0].key].n + ' · turn ' + sv.turn + '</small></span></button>' : '') +
    '<button class="btn' + (sv ? '' : ' solid') + '" data-act="newgame">New voyage</button><button class="btn" data-act="help">How to play</button><button class="btn" data-act="options">Options</button><div class="ver">' + (rec.w + rec.l ? 'SERVICE RECORD · ' + rec.w + ' WON · ' + rec.l + ' LOST' : '') + '</div>';
  show('title');
}
var previewG = null;
function renderSetup() {
  var st = S.setup, F = HX.FACTIONS[st.faction], h = '';
  setAccent(F.col);
  h += '<header><button class="sq" data-act="totitle" aria-label="Back">' + ic('back') + '</button><h1>New voyage</h1></header>';
  h += '<section><h2>YOUR FLAG</h2><div class="fac-tabs">';
  HX.FACTION_ORDER.forEach(function (k) { h += '<button data-act="fac" data-id="' + k + '" aria-pressed="' + (k === st.faction) + '" aria-label="' + HX.FACTIONS[k].n + '">' + emblemImg(k, 44) + '</button>'; });
  h += '</div><div class="fac-card paper"><div class="hd">' + emblemImg(st.faction, 64) + '<div><h3>' + F.n + '</h3><div class="role">' + F.role.toUpperCase() + '</div></div></div><p>' + F.blurb + '</p><p class="perk">' + ic('star') + '<span>' + F.perk + '</span></p><div class="lineup">';
  HX.SHIP_ORDER.forEach(function (c) { h += '<div>' + shipImg(st.faction, c, 0.72) + '<span>' + HX.statFor(st.faction, null, c).n + '</span></div>'; });
  h += '</div></div></section>';
  h += '<section><h2>THE SEA</h2><div class="opts c3">';
  ['s', 'm', 'l'].forEach(function (k) { var z = HX.SIZES[k]; h += '<button class="opt" data-act="size" data-id="' + k + '" aria-pressed="' + (k === st.size) + '"><b>' + z.n + '</b><small>' + z.d.split(' · ').slice(0, 2).join(', ') + '</small></button>'; });
  h += '</div><div class="seedrow"><canvas id="mini"></canvas><div class="grow"><div class="hint">' + HX.SIZES[st.size].d.split(' · ')[2].replace(/^./, function (c) { return c.toUpperCase(); }) + '.</div><div class="cap">SEED ' + st.seed + '</div><button class="btn" data-act="reroll">Another chart</button></div></div></section>';
  h += '<section><h2>RIVALS</h2><div class="opts c3">';
  ['easy', 'normal', 'hard'].forEach(function (k) { var d = HX.DIFFS[k]; h += '<button class="opt" data-act="diff" data-id="' + k + '" aria-pressed="' + (k === st.diff) + '"><b>' + d.n + '</b><small>' + d.d + '</small></button>'; });
  h += '</div></section>';
  h += '<button class="toggle" data-act="tut" aria-pressed="' + st.tutorial + '"><span class="box">' + ic('check') + '</span><span>Guide my first turn</span></button>';
  h += '<button class="btn solid" data-act="launch" style="font-size:20px;min-height:56px">Weigh anchor</button>';
  var el = $('#setup'), sc = el.scrollTop; el.innerHTML = h; el.scrollTop = sc; show('setup');
  previewG = HX.newGame({ size: st.size, seed: st.seed, faction: st.faction, diff: st.diff, allAI: true });
  RN.miniMap($('#mini'), previewG);
}

/* ---------- game entry, saving ---------- */
function enterGame(G) {
  S.G = G; S.sel = null; S.tab = 'place'; S.reach = null; S.detach = null; S.courseMode = false; S.tick = null; S.logSeen = G.log.length; S.idleIdx = 0;
  setAccent(HX.FACTIONS[G.factions[0].key].col);
  show('game'); RN.buildTerrain(G); layout(); RN.reset(G);
  if (G.tut && G.tutStep == null) G.tutStep = 0;
  refresh();
}
function save() { if (S.G && !S.G.over) store.set(SAVE, JSON.stringify(S.G)); else store.del(SAVE); }

/* ---------- refresh cycle ---------- */
function mover(fl) { if (!S.detach) return fl; var ships = {}, n = 0; for (var t in fl.ships) { var v = Math.min(fl.ships[t], S.detach[t] || 0); if (v) { ships[t] = v; n += v; } } return n ? { id: fl.id, owner: 0, q: fl.q, r: fl.r, ships: ships, mp: fl.mp } : null; }
function sitesNear(G, k) { var out = []; HX.nbrs(k).forEach(function (n) { var h = G.hexes[n]; if (!h || h.type !== 'land') return; var c = HX.canFound(G, 0, n); if (c.ok || c.poor) out.push(n); }); return out; }
function calcReach() {
  var G = S.G; S.reach = null; S.course = null; S.sup = null; S.sites = null;
  if (!S.sel) return; var fl = HX.fleetAt(G, S.sel, 0); if (!fl) { S.courseMode = false; return; }
  var st = sitesNear(G, S.sel); if (st.length) S.sites = st;
  if (fl.mp <= 0) { S.courseMode = false; return; }
  var mv = mover(fl); if (!mv) return;
  S.reach = HX.reach(G, mv); S.sup = HX.supplyFor(G, mv);
  if (S.courseMode) { S.course = {}; for (var k in S.sup) if (k !== S.sel && HX.passable(G.hexes[k])) S.course[k] = 1; }
}
function refresh() {
  var G = S.G; if (!G) return;
  S.vis = HX.vision(G, 0); HX.contactCheck(G, 0, S.vis);
  RN.buildOverlay(G, S.vis, G.factions[0].explored);
  if (S.sel && !G.hexes[S.sel]) S.sel = null;
  calcReach();
  S.idle = G.over ? [] : HX.idleList(G); S.idleBases = {}; S.idle.forEach(function (i) { if (i.k === 'base') S.idleBases[i.key] = 1; });
  renderTop(); renderSheet(); renderFabs(); renderCoach(); layout(); tutCheck(); pump();
}
function layout() { var cvs = $('#cv'), app = $('#app'), dpr = Math.min([3, 2, 1.5][Q.lvl], window.devicePixelRatio || 1), w = app.clientWidth, h = app.clientHeight; if (cvs.width !== Math.round(w * dpr) || cvs.height !== Math.round(h * dpr)) { cvs.width = Math.round(w * dpr); cvs.height = Math.round(h * dpr); } RN.resize(w, h, dpr); RN.V.padTop = 56 + (S.screen === 'game' ? $('#coach').offsetHeight : 0); RN.V.padBot = S.screen === 'game' ? $('#bottom').offsetHeight : 0; $('#toast').style.bottom = (S.screen === 'game' ? RN.V.padBot + 10 : 200) + 'px'; }

/* ---------- instruments ---------- */
function renderTop() {
  var G = S.G, F = G.factions[0], inc = HX.income(G, 0), h = '';
  [['a', 'timber'], ['c', 'gold'], ['f', 'rum']].forEach(function (r) { var v = inc[r[0]]; h += '<button class="res" data-act="eco" aria-label="' + HX.RESN[r[0]] + ' ' + F.res[r[0]] + ', ' + (v >= 0 ? 'plus ' : 'minus ') + Math.abs(v) + ' a turn">' + ic(r[1]) + '<span><b>' + F.res[r[0]] + '</b><span class="' + (v < 0 ? 'neg' : '') + '">' + (v >= 0 ? '+' : '−') + Math.abs(v) + '</span></span></button>'; });
  h += '<button class="res" data-act="research" aria-label="Lore ' + inc.s + ' a turn">' + ic('sci') + '<span><b>' + inc.s + '</b><span>a turn</span></span></button>';
  h += '<div class="turn"><span>TURN</span><b>' + G.turn + '</b></div>';
  h += '<button class="sq plain" data-act="menu" aria-label="Menu" style="width:44px;height:44px">' + ic('menu') + '</button>';
  $('#top').innerHTML = h;
}
function renderFabs() {
  var G = S.G, F = G.factions[0], inc = HX.income(G, 0), h = '<div class="fabl">', n = S.idle.length;
  var rt = F.research ? Math.max(1, Math.ceil((HX.TECH[F.research].cost - F.rp) / Math.max(1, inc.s))) : null, anyTech = F.capital != null && HX.availTech(F).length;
  h += '<button class="sq' + (!F.research && anyTech ? ' alert' : '') + '" data-act="research" aria-label="Discoveries">' + ic('sci') + (F.research ? '<span class="sub">' + rt + 'T</span>' : anyTech ? '<span class="badge">!</span>' : '') + '</button>';
  var unread = G.log.length - S.logSeen; h += '<button class="sq" data-act="log" aria-label="Ship\'s log">' + ic('log') + (unread > 0 ? '<span class="badge">' + Math.min(99, unread) + '</span>' : '') + '</button>';
  var wars = 0; G.factions.forEach(function (O) { if (O.alive && O.id && HX.atWar(G, 0, O.id)) wars++; });
  h += '<button class="sq' + (wars ? ' war' : '') + '" data-act="diplo" aria-label="Parley">' + ic('diplo') + (wars ? '<span class="sub bad">WAR</span>' : '') + '</button></div><div class="fabr">';
  if (n) h += '<button class="sq" id="endsm" data-act="endturn" aria-label="End turn">' + ic('end') + '</button><button class="btn solid" id="next" data-act="next"><span>Next ' + ic('next', 's12') + '</span><small>' + n + ' to go</small></button>';
  else h += '<button class="btn solid end" id="next" data-act="endturn"><span>End turn ' + ic('end', 's12') + '</span></button>';
  h += '</div>';
  $('#fabs').innerHTML = h;
}
function yieldHTML(y) { var o = ''; [['a', 'timber'], ['c', 'gold'], ['f', 'rum'], ['s', 'sci']].forEach(function (r) { if (y[r[0]]) o += '<span>' + ic(r[1]) + '+' + y[r[0]] + '</span>'; }); return '<div class="yield">' + (o || '<span class="dim">No output</span>') + '</div>'; }
var WATER = { fog: 'half speed, hides fleets', wreck: 'sail in to search it', reef: 'impassable' };
var SUITS = { wood: 'Best for a sawmill.', hill: 'Best for a gold mine.', cane: 'Best for a distillery.', grass: 'Fair ground for anything.' };
function landList(G, isl) { var c = {}; isl.land.forEach(function (l) { var t = G.hexes[l].ter; c[t] = (c[t] || 0) + 1; }); return ['wood', 'hill', 'cane', 'grass'].filter(function (t) { return c[t]; }).map(function (t) { return HX.TER_N[t].toLowerCase(); }).join(', '); }
function queueHTML(b) { if (!b.queue.length) return ''; var o = '<div class="sec">'; b.queue.forEach(function (it, i) { var nm = it.k === 's' ? HX.shipName(S.G, 0, it.id) : HX.BLD[it.id].n + (it.lvl > 1 ? ' ' + roman(it.lvl) : ''); var pp = ''; for (var j = 0; j < it.total; j++) pp += '<i' + (j < it.total - it.left ? ' class="on"' : '') + '></i>'; o += '<div class="row"><span class="grow">' + nm + ' <span class="dim">· ' + (i === 0 ? turns(it.left) + ' left' : 'waiting') + '</span></span><span class="pips">' + pp + '</span><button class="x" data-act="qcancel" data-i="' + i + '" aria-label="Cancel ' + nm + '">' + ic('x', 's12') + '</button></div>'; }); return o + '</div>'; }
function traitHTML(tr) { var t = HX.TRAITS[tr]; return '<b>' + t[0] + '.</b> ' + t[1]; }
function num(v) { return Math.round(v * 10) / 10; }
function segHTML(h, tab, fl) { return '<div class="seg"><button data-act="tab" data-id="place" aria-pressed="' + (tab === 'place') + '">' + esc(h.name || HX.TYPE_N[h.type]) + '</button><button data-act="tab" data-id="fleet" aria-pressed="' + (tab === 'fleet') + '">Fleet · ' + HX.shipCount(fl.ships) + '</button></div>'; }
function fleetHTML(G, k, fl, close) {
  var F = G.factions[0], h = G.hexes[k], n = HX.shipCount(fl.ships), top = HX.topClass(fl.ships), o = '';
  var state = fl.auto ? 'exploring' : fl.dest ? 'on course' : fl.hold ? 'at anchor' : '';
  o += '<div class="sh-head"><div class="lead">' + shipImg(F.key, top, 0.8) + '</div><div class="grow"><h2>' + (n === 1 ? HX.shipName(G, 0, top) : 'Fleet of ' + n) + '</h2><div class="meta">Strength ' + HX.fpower(G, 0, fl.ships) + ' · moves ' + fl.mp + '/' + HX.fleetSpeed(G, fl) + (state ? ' · ' + state : '') + '</div></div>' + close + '</div>';
  o += '<div class="sec">';
  if (S.detach) { o += '<div class="list">'; HX.SHIP_ORDER.forEach(function (t) { if (!fl.ships[t]) return; o += '<div class="row"><span class="grow">' + HX.shipName(G, 0, t) + ' <span class="dim">of ' + fl.ships[t] + '</span></span><span class="step"><button data-act="det" data-id="' + t + '" data-d="-1" aria-label="Fewer">−</button><b>' + (S.detach[t] || 0) + '</b><button data-act="det" data-id="' + t + '" data-d="1" aria-label="More">+</button></span></div>'; }); o += '</div>'; }
  else if (n > 1) o += chips(G, 0, fl.ships);
  o += '</div>';
  var a2 = '', cl = HX.canClaim(G, fl), rd = HX.canRaid(G, fl);
  if (cl.kind) a2 += '<button class="btn solid" data-act="claim"' + (cl.ok ? '' : ' disabled') + '>' + ic('flag') + '<span>' + (cl.kind === 'station' ? 'Claim port' : 'Raise flag') + (cl.ok ? '' : '<small>' + cl.why + '</small>') + '</span>' + costHTML(cl.cost, F) + '</button>';
  if (rd.ok || rd.why) a2 += '<button class="btn danger" data-act="raid"' + (rd.ok ? '' : ' disabled') + '>' + ic('raid') + '<span>Plunder' + (rd.ok ? '' : '<small>' + rd.why + '</small>') + '</span></button>';
  if (fl.mp > 0 || fl.auto) a2 += '<button class="btn' + (fl.auto ? ' sel' : '') + '" data-act="explore">' + ic('eye') + (fl.auto ? 'Stop' : 'Explore') + '</button>';
  if (fl.mp > 0) a2 += '<button class="btn' + (S.courseMode ? ' sel' : '') + '" data-act="course">' + ic('course') + (S.courseMode ? 'Pick a hex' : 'Course') + '</button>';
  if (n > 1 && fl.mp > 0) a2 += '<button class="btn' + (S.detach ? ' sel' : '') + '" data-act="detach">' + ic('split') + (S.detach ? 'All ships' : 'Detach') + '</button>';
  if (fl.mp > 0 || fl.hold) a2 += '<button class="btn" data-act="hold">' + ic('hold') + (fl.hold ? 'Weigh' : 'Anchor') + '</button>';
  if (fl.dest && !fl.auto) a2 += '<button class="btn" data-act="stop">' + ic('x') + 'Stop</button>';
  o += '<div class="acts">' + a2 + '</div>';
  if (S.sites && !S.courseMode) o += '<div class="hint" style="margin-top:8px">Tap a marked shore to found a port.</div>';
  return o;
}
function renderSheet() {
  var el = $('#sheet'), G = S.G, k = S.sel;
  if (!k || !G.hexes[k]) { el.hidden = true; return; }
  var h = G.hexes[k], F = G.factions[0], vis = S.vis[k], b = h.base, o = '', owner = b ? b.owner : null, mine = owner === 0, isl = HX.islandOf(G, k), fl = HX.fleetAt(G, k, 0);
  var tab = sheetTab();
  var close = '<button class="sq plain" data-act="desel" aria-label="Close" style="width:44px;height:44px;margin:-6px -6px -6px 0">' + ic('x') + '</button>';
  el.className = tab === 'fleet' ? 'deck' : 'paper';
  if (fl && b) o += segHTML(h, tab, fl);
  if (tab === 'fleet') { el.innerHTML = o + fleetHTML(G, k, fl, close); el.hidden = false; el.scrollTop = 0; return; }
  if (!F.explored[k]) { el.innerHTML = '<div class="sh-head"><div class="grow"><h2>Uncharted</h2><div class="meta">Sail closer to chart it.</div></div>' + close + '</div>'; el.hidden = false; return; }
  var meta = [], title, io = isl ? HX.islandOwner(G, isl) : null;
  if (h.type === 'land') {
    title = isl.name;
    if (b) { meta.push(owner == null ? (b.kind === 'station' ? 'Free port' : 'Abandoned port') : HX.KIND_N[b.kind] + (b.cap ? ', capital' : '')); if (owner != null && !mine) meta.push(HX.FACTIONS[G.factions[owner].key].n); }
    else { meta.push(HX.TER_N[h.ter]); meta.push(!isl.port ? 'unclaimed' : io === 0 ? 'yours' : io == null ? 'abandoned' : HX.fname(G, io)); }
  } else { title = HX.TYPE_N[h.type]; if (h.terr != null) meta.push(h.terr === 0 ? 'your waters' : HX.fname(G, h.terr) + ' waters'); if (WATER[h.type]) meta.push(WATER[h.type]); }
  if (!vis) meta.push('out of sight');
  o += '<div class="sh-head">';
  if (b && owner != null && b.kind === 'colony') o += '<div class="tierbox"><small>TIER</small><b>' + roman(HX.tier(G, k)) + '</b></div>';
  o += '<div class="grow"><h2>' + esc(title) + '</h2><div class="meta">' + meta.join(' · ') + '</div></div>' + close + '</div>';
  if (mine) {
    var sg = HX.besieged(G, k);
    o += '<div class="sec">' + (sg ? '<div class="row alarm">Blockaded by ' + HX.fname(G, b.siege.by) + '. Falls in ' + turns(HX.siegeNeed(b) - b.siege.prog) + '.</div>' : yieldHTML(HX.baseYield(G, k))) + '</div>';
    if (b.kind === 'colony') {
      var bl = ''; ['yard', 'fort'].forEach(function (id) { if (b.b[id]) bl += '<span class="chip soft">' + HX.BLD[id].n + ' ' + roman(b.b[id]) + '</span>'; });
      HX.plotsOf(G, k).forEach(function (p) { var pl = G.hexes[p].plot; if (pl && pl.lvl) bl += '<span class="chip soft">' + HX.BLD[pl.id].n + ' ' + roman(pl.lvl) + '</span>'; });
      if (bl) o += '<div class="sec"><div class="chips">' + bl + '</div></div>';
      o += queueHTML(b);
      o += '<div class="acts"><button class="btn sel" data-act="build" data-tab="b">' + ic('build') + 'Build</button><button class="btn' + (b.b.yard ? ' sel' : '') + '" data-act="build" data-tab="s">' + ic('ship') + 'Ships</button></div>';
    }
  } else if (b && owner != null) {
    var war = HX.atWar(G, 0, owner), df = HX.baseDef(G, h);
    o += '<div class="sec"><div class="row"><span class="grow">' + (war ? '<b class="bad">At war</b>' : 'At peace') + (df.hp ? ' · guns ' + df.atk + ', walls ' + df.hp : ' · undefended') + '</span>' + (war ? '' : '<button class="btn" data-act="diplo" style="min-height:36px;font-size:14px">Parley</button>') + '</div>';
    if (b.siege) { var need = HX.siegeNeed(b), pp2 = ''; for (var s2 = 0; s2 < need; s2++) pp2 += '<i' + (s2 < b.siege.prog ? ' class="on"' : '') + '></i>'; o += '<div class="row"><span class="grow">' + (b.siege.by === 0 ? 'Your blockade' : 'Blockaded by ' + HX.fname(G, b.siege.by)) + ' · falls in ' + turns(need - b.siege.prog) + '</span><span class="pips">' + pp2 + '</span></div>'; }
    o += '</div>';
  } else if (b) {
    o += '<div class="sec"><div class="hint">' + (b.kind === 'station' ? 'Beat the guard, then claim it.' : 'Sail in to claim it.') + '</div></div>';
  } else if (h.type === 'land') {
    var pl = h.plot, town = isl.port;
    if (io === 0) {
      var tb = G.hexes[town].base;
      if (pl) {
        o += '<div class="sec"><div class="row"><span class="grow"><b>' + HX.BLD[pl.id].n + (pl.lvl ? ' ' + roman(pl.lvl) : '') + '</b> <span class="dim">· ' + (pl.lvl ? '+' + HX.plotYield(F, h, pl.id, pl.lvl) + ' ' + HX.RESN[HX.BLD[pl.id].res].toLowerCase() : 'building') + '</span></span>' + ic({ a: 'timber', c: 'gold', f: 'rum', s: 'sci' }[HX.BLD[pl.id].res]) + '</div></div>';
        var up = HX.buildOptions(G, town, k)[0], acts = '';
        if (up && !up.max) acts += '<button class="btn sel" data-act="enq" data-kind="b" data-id="' + up.id + '" data-at="' + k + '"' + (up.ok ? '' : ' disabled') + '>' + ic('build') + '<span>Level ' + roman(up.lvl) + (up.ok ? '' : '<small>' + up.why + '</small>') + '</span>' + costHTML(up.cost, F) + '</button>';
        acts += '<button class="btn" data-act="goto" data-k="' + town + '">' + ic('flag') + 'Port</button>';
        o += '<div class="acts">' + acts + '</div>';
      } else {
        o += '<div class="sec"><div class="hint">' + SUITS[h.ter] + '</div></div><div class="acts"><button class="btn sel" data-act="buildat" data-k="' + k + '"' + (tb.queue.length >= 3 ? ' disabled' : '') + '>' + ic('build') + '<span>Build here' + (tb.queue.length >= 3 ? '<small>Queue full</small>' : '') + '</span></button><button class="btn" data-act="goto" data-k="' + town + '">' + ic('flag') + 'Port</button></div>';
      }
    } else if (!isl.port) {
      var n = isl.land.length, cc = HX.canFound(G, 0, k);
      o += '<div class="sec"><div class="hint">' + (n === 1 ? 'An islet: room for a harbour only.' : n + ' land hexes: ' + landList(G, isl) + '.') + (F.capital == null ? ' Your first port is free.' : '') + '</div></div>';
      if (cc.dry) o += '<div class="sec"><div class="row">No anchorage on this side.</div></div>';
      else if (cc.far) o += '<div class="sec"><div class="row"><span class="grow">Bring a fleet alongside</span>' + costHTML(cc.cost, F) + '</div></div>';
      else o += '<div class="acts"><button class="btn solid" data-act="found" data-k="' + k + '"' + (cc.ok ? '' : ' disabled') + '>' + ic('flag') + '<span>' + (F.capital == null ? 'Found home port' : 'Found port') + (cc.ok ? '' : '<small>' + cc.why + '</small>') + '</span>' + costHTML(cc.cost, F) + '</button></div>';
    } else {
      o += '<div class="sec"><div class="hint">' + (pl && pl.lvl ? HX.BLD[pl.id].n + ' ' + roman(pl.lvl) + '. ' : '') + 'Take the port to take the island.</div></div><div class="acts"><button class="btn" data-act="goto" data-k="' + town + '">' + ic('flag') + 'Show port</button></div>';
    }
  }
  HX.fleetsAt(G, k).forEach(function (o2) { if (o2.owner === 0 || !HX.fleetVisible(G, 0, o2, S.vis)) return; o += '<div class="sec"><div class="lbl">' + sw(G, o2.owner) + (o2.owner < 0 ? (o2.pirate ? 'Pirates' : 'Harbour guard') : HX.fname(G, o2.owner) + ' fleet') + ' · strength ' + HX.fpower(G, o2.owner, o2.ships) + '</div>' + chips(G, o2.owner, o2.ships) + '</div>'; });
  el.innerHTML = o; el.hidden = false; el.scrollTop = 0;
}
function sheetTab() { var G = S.G, k = S.sel; if (!k || !G.hexes[k]) return 'place'; var fl = HX.fleetAt(G, k, 0); if (!fl) return 'place'; return G.hexes[k].base ? S.tab : 'fleet'; }
function renderCoach() {
  var G = S.G, h = '';
  if (G.tut && G.tutStep != null && TUT[G.tutStep]) { var st = TUT[G.tutStep]; h += '<div class="coach paper"><div class="hd"><span>FIRST ORDERS ' + (G.tutStep + 1) + '/' + TUT.length + '</span><button data-act="' + (st.final ? 'tutdone' : 'tutskip') + '">' + (st.final ? 'Aye' : 'Skip guide') + '</button></div><div>' + st.txt(G) + '</div></div>'; }
  else if (S.tick) h += '<button class="tick" data-act="log"><i class="dot"></i><span>' + esc(S.tick) + '</span></button>';
  if (G.heg) h += '<button class="tick" data-act="diplo"><i class="dot" style="background:var(--warn)"></i><span>' + (G.heg.f === 0 ? 'You win' : HX.fname(G, G.heg.f) + ' wins') + ' mastery of the seas in ' + turns(Math.max(1, HX.HEG_TURNS - (G.turn - G.heg.t))) + '.</span></button>';
  $('#coach').innerHTML = h;
}

/* ---------- first-turn guide ---------- */
function capKey(G) { return G.factions[0].capital; }
function myFleet(G) { var fl = G.fleets.filter(function (x) { return x.owner === 0; }); return fl.length ? HX.fkey(fl[0]) : null; }
function canSettle(G, k) { var c = k && G.hexes[k] && G.hexes[k].type === 'land' ? HX.canFound(G, 0, k) : null; return !!(c && c.ok); }
var TUT = [
  { txt: function () { return 'Two ships and no harbour. Tap your <b>fleet</b>.'; }, hex: function (G) { return myFleet(G); }, done: function (G) { return !!capKey(G) || (!!S.sel && S.sel === myFleet(G)); } },
  { txt: function () { return 'Lit water is where you can sail this turn. Gold rings mark shores you can settle. <b>Tap one</b> to choose your home.'; }, hex: function (G) { var st = G.factions[0].start; return S.sites && S.sites.indexOf(st) >= 0 ? st : S.sel === myFleet(G) ? null : myFleet(G); }, done: function (G) { return !!capKey(G) || canSettle(G, S.sel); } },
  { txt: function () { return 'Your first port is free. Every later one costs more than the last. Tap <b>Found home port</b>.'; }, glow: '[data-act="found"]', hex: function (G) { return canSettle(G, S.sel) ? null : G.factions[0].start; }, done: function (G) { return !!capKey(G); } },
  { txt: function () { return 'A port builds on its island\'s land. Tap <b>Build</b>, then <b>Sawmill</b>.'; }, glow: '[data-act="build"][data-tab="b"],[data-act="enq"][data-id="sawmill"]', hex: function (G) { return S.sel === capKey(G) ? null : capKey(G); }, done: function (G) { return G.hexes[capKey(G)].base.queue.length > 0; } },
  { txt: function () { return 'Now the ships. Tap your <b>fleet</b>, then <b>Explore</b>: it will chart the sea by itself.'; }, glow: '[data-act="explore"]', hex: function (G) { var k = myFleet(G); return k && S.sel !== k ? k : null; }, done: function (G) { return !myFleet(G) || G.fleets.some(function (x) { return x.owner === 0 && (x.auto || x.mp === 0); }); } },
  { txt: function () { return 'Tap the <b>scroll</b> and pick a discovery.'; }, glow: '#fabs [data-act="research"],[data-act="techgo"]', done: function (G) { return !!G.factions[0].research; } },
  { txt: function () { return 'End the turn with the <b>hourglass</b>.'; }, glow: '[data-act="endturn"]', done: function (G) { return G.turn > 1; } },
  { txt: function () { return 'Take every rival capital, or hold two thirds of the islands. More ports mean more land to build on.'; }, final: true, done: function () { return false; } }
];
function tutCheck() {
  var G = S.G; if (!G || S.screen !== 'game') return;
  document.querySelectorAll('.tut-glow').forEach(function (e) { e.classList.remove('tut-glow'); });
  S.tutHex = null;
  if (!G.tut || G.tutStep == null) return;
  var moved = false; while (TUT[G.tutStep] && TUT[G.tutStep].done(G)) { G.tutStep++; moved = true; }
  if (!TUT[G.tutStep]) { G.tut = false; renderCoach(); return; }
  if (moved) { renderCoach(); sfx('ok'); }
  var st = TUT[G.tutStep];
  if (st.hex && !S.modalOpen) S.tutHex = st.hex(G);
  if (S.tutHex && S.tutHex !== S.tutSeen && !RN.onScreen(G, S.tutHex)) RN.focus(G, S.tutHex);
  S.tutSeen = S.tutHex;
  if (st.glow) document.querySelectorAll(st.glow).forEach(function (e) { e.classList.add('tut-glow'); });
}

/* ---------- selection and orders ---------- */
function select(k, focus, tab) { var f0 = HX.fleetAt(S.G, k, 0); S.sel = k; S.tab = tab || 'place'; S.detach = null; S.courseMode = false; calcReach(); renderSheet(); layout(); if (focus || !RN.onScreen(S.G, k)) RN.focus(S.G, k); tutCheck(); }
function desel() { S.sel = null; S.reach = null; S.sup = null; S.course = null; S.sites = null; S.detach = null; S.courseMode = false; renderSheet(); layout(); tutCheck(); }
function afterOrder(res) {
  S.detach = null; S.courseMode = false;
  if (!res.ok) { toast(res.why); sfx('err'); refresh(); return; }
  sfx('move');
  if (res.battle) { S.sel = HX.fkey(res.fleet); refresh(); openForecast(res.fleet, res.battle); return; }
  S.sel = HX.fkey(res.fleet || res.part); S.tab = 'fleet'; refresh();
  if (res.fleet && res.fleet.dest) toast('Course set');
}
function tapHex(k) {
  var G = S.G; if (S.busy || !G || G.over) return;
  if (!G.hexes[k]) { desel(); return; }
  var fl = S.sel ? HX.fleetAt(G, S.sel, 0) : null;
  if (fl && k !== S.sel) {
    if (S.reach && S.reach[k]) { if (S.reach[k].atk) openForecast(fl, k); else afterOrder(HX.order(G, fl, k, S.detach)); return; }
    if (S.courseMode) { if (S.course && S.course[k]) afterOrder(HX.order(G, fl, k, S.detach)); else { toast(HX.blockReason(G, fl, k)); sfx('err'); } return; }
  }
  if (k === S.sel) { desel(); return; }
  sfx('tap'); select(k);
}
function openForecast(fl, k) {
  var G = S.G, mv = mover(fl) || fl, f = HX.forecast(G, mv, k, 60), h = G.hexes[k], known = S.vis[k];
  var dfl = f.def.fleet, seen = dfl ? HX.fleetVisible(G, 0, dfl, S.vis) : true, dpow = HX.fpower(G, f.def.owner, f.def.ships);
  var o = head(h.base ? 'Attack ' + esc(h.name) + '?' : f.def.fleet && f.def.fleet.pirate ? 'Engage the pirates?' : 'Engage the ' + HX.fname(G, f.def.owner) + ' fleet?');
  o += '<div class="vs"><div class="side"><h3>' + sw(G, 0) + 'YOUR FLEET · ' + HX.fpower(G, 0, mv.ships) + '</h3>' + chips(G, 0, mv.ships) + '</div><div class="mid">VS</div><div class="side"><h3>' + sw(G, f.def.owner) + HX.fname(G, f.def.owner).toUpperCase() + (known && seen ? ' · ' + dpow : '') + '</h3>' + (known && seen ? chips(G, f.def.owner, f.def.ships) : '<div class="hint">Strength unknown</div>') + (f.def.turret && f.def.turret.hp ? '<div class="chip soft">' + ic('shield', 's12') + 'Guns ' + f.def.turret.atk + ' · walls ' + f.def.turret.hp + '</div>' : '') + '</div></div>';
  var cls = f.p >= 0.7 ? 'good' : f.p >= 0.45 ? 'warn' : 'bad';
  o += '<div class="row" style="flex-direction:column;align-items:stretch;gap:6px;padding:10px"><div style="display:flex;justify-content:space-between"><b class="cap ' + cls + '">' + f.label.toUpperCase() + '</b><b>' + Math.round(f.p * 100) + '% to win</b></div><div class="bar"><i style="width:' + Math.round(f.p * 100) + '%"></i></div><div class="hint">Losses: you ~' + Math.round(f.aLoss * 100) + '%, them ~' + Math.round(f.dLoss * 100) + '%.' + (h.base && h.base.owner != null && h.base.owner !== 0 ? ' Then hold it ' + turns(HX.siegeNeed(h.base)) + ' to take it.' : '') + '</div></div>';
  o += '<div class="acts"><button class="btn" data-act="close">Hold fire</button><button class="btn danger" data-act="attack" data-k="' + k + '">' + ic('sword') + 'Attack</button></div>';
  modal(o, true);
}
function doAttack(k) {
  var G = S.G, fl = HX.fleetAt(G, S.sel, 0); if (!fl) { closeModal(); return; }
  var part = S.detach ? HX.split(G, fl, S.detach) : fl; S.detach = null;
  closeModal(true);
  var res = HX.attack(G, part, k);
  if (!res.ok) { if (part !== fl) HX.mergeAt(G, part); toast(res.why); refresh(); return; }
  RN.addFx({ type: 'boom', key: k, dur: 900 }); sfx('boom');
  S.sel = res.win ? k : (res.wiped ? null : HX.fkey(part));
  refresh();
}
function endTurn() {
  var G = S.G; if (S.busy || !G || G.over || S.modalOpen) return;
  S.busy = true; desel(); sfx('end');
  var bn = $('#banner'); bn.textContent = 'RIVAL FLEETS ARE UNDER SAIL'; bn.hidden = false;
  setTimeout(function () {
    HX.endTurn(G); S.busy = false; bn.hidden = true; S.idleIdx = 0;
    var news = G.log.filter(function (l) { return l.t === G.turn - 1 && l.f !== 0 && (l.k === 'war' || l.k === 'diplo' || l.k === 'loss') && (l.f == null || l.f < 0 || G.factions[0].met[l.f]); });
    S.tick = news.length ? news[news.length - 1].txt : null;
    save(); refresh();
    if (!G.over) { toast('Turn ' + G.turn); G.log.filter(function (l) { return l.t === G.turn - 1 && l.f === 0 && l.k === 'build'; }).slice(-2).forEach(function (l) { toast(esc(l.txt)); }); }
  }, 160);
}
function nextAction() {
  var list = S.idle; if (!list.length) { endTurn(); return; }
  var it = list[S.idleIdx % list.length]; S.idleIdx++;
  sfx('tap');
  if (it.k === 'research') openTech(); else select(it.key, true, it.k === 'fleet' ? 'fleet' : 'place');
}

/* ---------- event pump ---------- */
var battleCtl = null;
function pump() {
  var G = S.G; if (!G || S.modalOpen || S.screen !== 'game') return;
  while (G.ev.length) {
    var e = G.ev.shift();
    if (e.k === 'battle') { showBattle(e.res); return; }
    if (e.k === 'msg') { if ((e.line === 'greet' && G.over) || !G.factions[0].met[e.f]) continue; showMsg(e); return; }
    if (e.k === 'offer') { if (!G.factions[e.f].alive || !HX.atWar(G, 0, e.f)) continue; showOffer(e); return; }
    if (e.k === 'heg') { var sh = HX.islandsHeld(G); modal(head('Mastery of the seas') + '<p class="quote">' + (e.f === 0 ? 'You hold ' + sh.by[0] + ' of ' + sh.total + ' islands. Keep them for ' + HX.HEG_TURNS + ' turns and these seas are yours.' : 'The ' + HX.FACTIONS[G.factions[e.f].key].n + ' holds ' + sh.by[e.f] + ' of ' + sh.total + ' islands. Take one back within ' + HX.HEG_TURNS + ' turns or they rule the seas.') + '</p><button class="btn solid" data-act="close">Understood</button>', true); sfx('war'); return; }
    if (e.k === 'over') { showOver(); return; }
    if (e.k === 'find') { toast(e.bad ? '<span class="bad">' + esc(e.txt) + '</span>' : esc(e.txt)); RN.addFx({ type: 'flash', key: e.key, dur: 500, col: e.bad ? P.danger : P.gold }); sfx(e.bad ? 'err' : 'ok'); }
    else if (e.k === 'tech') { toast(ic('sci') + ' ' + HX.TECH[e.id].n + ' mastered'); sfx('tech'); }
    else if (e.k === 'capture') { RN.addFx({ type: 'flash', key: e.key, dur: 700, col: fcol(G, e.by) }); toast(e.by === 0 ? '<b>' + esc(G.hexes[e.key].name) + '</b> is yours.' : '<span class="bad">' + esc(G.hexes[e.key].name) + ' has fallen to ' + HX.fname(G, e.by) + '.</span>'); sfx(e.by === 0 ? 'win' : 'war'); }
  }
}
function lossTable(G, owner, start, left, turret, turretLeft) { var o = ''; HX.SHIP_ORDER.forEach(function (t) { if (!start[t]) return; var l = left[t] || 0; o += '<div class="row"><span class="grow nw">' + HX.shipName(G, owner, t) + '</span><span class="nw">' + start[t] + ' → <b class="' + (l < start[t] ? 'bad' : 'good') + '">' + l + '</b></span></div>'; }); if (turret) o += '<div class="row"><span class="grow">Shore guns</span><b class="cap ' + (turretLeft ? 'good' : 'bad') + '">' + (turretLeft ? 'HELD' : 'SILENCED') + '</b></div>'; return o || '<div class="hint">No ships</div>'; }
function battleResult(res) {
  var G = S.G, mineAtt = res.att === 0, title, cls;
  if (mineAtt) { title = res.win ? 'Victory at ' + res.name : res.wiped ? 'Fleet lost at ' + res.name : 'Beaten off at ' + res.name; cls = res.win ? 'good' : 'bad'; }
  else { title = res.win ? 'Defeat at ' + res.name : res.name === 'sea' ? 'Attack at sea beaten off' : 'Attack on ' + res.name + ' beaten off'; cls = res.win ? 'bad' : 'good'; }
  var o = '<div class="big ' + cls + '">' + esc(title) + '</div><div class="vs"><div class="side"><h3>' + sw(G, res.att) + HX.fname(G, res.att).toUpperCase() + ' ATTACKED</h3>' + lossTable(G, res.att, res.a0, res.aLeft) + '</div><div class="mid"></div><div class="side"><h3>' + sw(G, res.def) + (res.pirate ? 'PIRATES' : HX.fname(G, res.def).toUpperCase()) + ' DEFENDED</h3>' + lossTable(G, res.def, res.d0, res.dLeft, res.turret, res.turretLeft) + '</div></div>';
  if (res.bounty && res.att === 0) o += '<div class="row"><span class="grow">Pirate bounty</span>' + costHTML({ c: res.bounty }) + '</div>';
  if (res.salvTo === 0 && (res.salv.a || res.salv.c)) o += '<div class="row"><span class="grow">Salvage hauled aboard</span>' + costHTML(res.salv) + '</div>';
  o += '<button class="btn solid" data-act="close">Continue</button>';
  return o;
}
function showBattle(res) {
  var G = S.G;
  if (G.hexes[res.key] && !RN.onScreen(G, res.key)) RN.focus(G, res.key);
  if (!S.opt.battles) { modal(battleResult(res), true); sfx(res.att === 0 === res.win ? 'ok' : 'err'); return; }
  modal('<div class="cap" style="font-size:13px;text-align:center;letter-spacing:0.08em">' + sw(G, res.att) + HX.fname(G, res.att).toUpperCase() + ' <span class="dim">' + (res.name === 'sea' ? 'ENGAGES' : 'ATTACKS') + '</span> ' + (res.name === 'sea' ? sw(G, res.def) + (res.pirate ? 'PIRATES' : HX.fname(G, res.def).toUpperCase()) : esc(res.name).toUpperCase()) + '</div><canvas id="bcv"></canvas><button class="btn" data-act="bskip">Skip</button>', true);
  var fin = function () { if (!battleCtl) return; battleCtl = null; var d = $('#modal .dlg'); if (d) d.innerHTML = battleResult(res); sfx((res.att === 0) === res.win ? 'win' : 'err'); };
  battleCtl = RN.battleScene($('#bcv'), res, G, fin); battleCtl.fin = fin;
  var n = 0, iv = setInterval(function () { if (!battleCtl || n++ > 5) { clearInterval(iv); return; } sfx('boom'); }, 800);
}
function envoy(G, fid, eyebrow) { var FD = HX.FACTIONS[G.factions[fid].key]; return '<div class="hd">' + emblemImg(G.factions[fid].key, 60) + '<div><div class="eyebrow">' + esc(eyebrow).toUpperCase() + '</div><h3 style="font-size:22px;line-height:24px">' + FD.n + '</h3></div></div>'; }
function showMsg(e) {
  var G = S.G, F = G.factions[e.f], FD = HX.FACTIONS[F.key];
  var o = '<div class="fcard">' + envoy(G, e.f, e.title || 'A message') + '<p class="quote">“' + FD.voice[e.line] + '”</p>' + (e.txt ? '<p class="hint">' + esc(e.txt) + '</p>' : '') + (e.line === 'lose' && e.by != null && e.by !== 0 ? '<p class="hint">Their capital fell to ' + HX.fname(G, e.by) + '. Their ports stand abandoned.</p>' : '') + '</div><button class="btn solid" data-act="close">Continue</button>';
  modal(o, true); sfx(e.line === 'war' || e.line === 'threat' ? 'war' : 'ok');
}
function showOffer(e) {
  var G = S.G, FD = HX.FACTIONS[G.factions[e.f].key];
  modal('<div class="fcard">' + envoy(G, e.f, 'An offer of peace') + '<p class="quote">“' + FD.voice.offer + '”</p></div><div class="acts"><button class="btn" data-act="close">Fight on</button><button class="btn solid" data-act="acceptpeace" data-f="' + e.f + '">Accept peace</button></div>', true); sfx('ok');
}
function showOver() {
  var G = S.G, ov = G.over, F = G.factions[0], st = F.st, bases = HX.ownBases(G, 0);
  store.del(SAVE);
  if (!G.recorded) { G.recorded = true; var rec = record(); if (ov.win) rec.w++; else rec.l++; store.set(REC, JSON.stringify(rec)); }
  var o = '<div class="big ' + (ov.win ? 'good' : 'bad') + '" style="font-size:36px;line-height:40px;padding-top:8px">' + (ov.win ? 'Victory' : 'Defeat') + '</div><p style="text-align:center;text-wrap:balance">' + esc(ov.reason) + '</p><div class="stats"><div><b>' + ov.turn + '</b><small>turns</small></div><div><b>' + bases + '</b><small>ports held</small></div><div><b>' + Object.keys(F.tech).length + '</b><small>discoveries</small></div><div><b>' + st.built + '</b><small>ships built</small></div><div><b>' + st.won + ' / ' + st.fought + '</b><small>battles won</small></div><div><b>' + st.kills + '</b><small>ships sunk</small></div></div><div class="acts"><button class="btn" data-act="totitle">Main menu</button><button class="btn solid" data-act="newgame">New voyage</button></div>';
  modal(o, true); sfx(ov.win ? 'win' : 'war');
}

/* ---------- panels ---------- */
function bldItem(G, op, F, at) {
  var art = op.id === 'yard' ? ic('ship', 's24') : op.id === 'fort' ? ic('shield', 's24') : plotImg(op.id, Math.max(1, op.lvl), 1.5), where = op.at ? HX.TER_N[G.hexes[op.at].ter].toLowerCase() : '';
  return '<button class="item" data-act="enq" data-kind="b" data-id="' + op.id + '" data-at="' + (op.at || '') + '"' + (op.ok ? '' : ' disabled') + '><span class="art">' + art + '</span><span class="grow"><span class="nm">' + op.n + (op.lvl > 1 ? ' ' + roman(op.lvl) : '') + (where && !at ? '<span class="st">on ' + where + '</span>' : '') + '</span><span class="ds">' + (op.max ? 'Fully built.' : op.eff) + '</span>' + (op.ok || op.max ? '' : '<span class="why">' + op.why + '</span>') + '</span>' + (op.max ? '' : '<span class="rt">' + costHTML(op.cost, F) + '<span class="hint">' + turns(op.time) + '</span></span>') + '</button>';
}
function openBuild(tab, at) {
  var G = S.G, k = townOf(G, S.sel); if (!k) return; var h = G.hexes[k], b = h.base, F = G.factions[0]; if (!b || b.owner !== 0) return;
  S.buildTab = at ? 'b' : (tab || S.buildTab); S.buildTown = k;
  var o, opts;
  if (at) {
    o = head('Build on ' + HX.TER_N[G.hexes[at].ter].toLowerCase()) + '<div class="list">';
    HX.buildOptions(G, k, at).forEach(function (op) { o += bldItem(G, op, F, at); });
    modal(o + '</div>'); return;
  }
  o = head(esc(h.name)) + '<div class="tabs"><button data-act="btab" data-tab="b" aria-pressed="' + (S.buildTab === 'b') + '">Structures</button><button data-act="btab" data-tab="s" aria-pressed="' + (S.buildTab === 's') + '">Ships</button></div><div class="list">';
  if (S.buildTab === 'b') {
    opts = HX.buildOptions(G, k);
    var ns = HX.slots(G, k);
    o += '<div class="grp">HARBOUR</div>';
    opts.filter(function (x) { return !HX.BLD[x.id].plot; }).forEach(function (op) { o += bldItem(G, op, F); });
    var fresh = opts.filter(function (x) { return HX.BLD[x.id].plot && !x.up; }), ups = opts.filter(function (x) { return x.up; });
    if (ns && !(fresh[0] && fresh[0].noland)) { o += '<div class="grp">LAND · ' + (ns - HX.usedSlots(G, k)) + ' FREE</div>'; fresh.forEach(function (op) { o += bldItem(G, op, F); }); }
    if (ups.length) { o += '<div class="grp">IMPROVE</div>'; ups.forEach(function (op) { o += bldItem(G, op, F); }); }
  } else {
    
    HX.shipOptions(G, k).forEach(function (op) {
      var s = HX.shipStat(G, 0, op.id);
      o += '<button class="item" data-act="enq" data-kind="s" data-id="' + op.id + '"' + (op.ok ? '' : ' disabled') + '><span class="art">' + shipImg(F.key, op.id, 0.85) + '</span><span class="grow"><span class="nm">' + s.n + '</span><span class="sline">Guns ' + num(s.atk) + ' · hull ' + num(s.hp) + ' · moves ' + s.spd + (s.upk ? ' · ' + num(s.upk) + ' rum' : '') + '</span><span class="trait">' + traitHTML(s.tr) + '</span>' + (op.ok ? '' : '<span class="why">' + op.why + '</span>') + '</span><span class="rt">' + costHTML(op.cost, F) + '<span class="hint">' + turns(op.time) + '</span></span></button>';
    });
  }
  modal(o + '</div>');
}
function openTech() {
  var G = S.G, F = G.factions[0], inc = HX.income(G, 0), av = HX.availTech(F);
  if (!S.techSel || F.tech[S.techSel]) S.techSel = F.research || av[0] || HX.TECH_ORDER[0];
  var o = head('Discoveries') + '<div class="hint">' + ic('sci', 's12') + ' +' + inc.s + ' lore a turn' + (F.rp && !F.research ? ' · ' + F.rp + ' in hand' : '') + '</div><div class="tree">';
  HX.BRANCH.forEach(function (b) { o += '<div class="bh">' + b.toUpperCase() + '</div>'; });
  var icon = { saws: 'timber', shafts: 'gold', masonry: 'build', guilds: 'gear', gundecks: 'sword', greathulls: 'ship', sheathing: 'shield', firstrate: 'star', casks: 'rum', rigging: 'moves', spyglass: 'eye', winds: 'course' };
  for (var t = 1; t <= 4; t++) for (var br = 0; br < 3; br++) {
    var id = HX.TECH_ORDER.filter(function (x) { return HX.TECH[x].br === br && HX.TECH[x].tier === t; })[0], T = HX.TECH[id];
    var state = F.tech[id] ? 'done' : F.research === id ? 'now' : av.indexOf(id) >= 0 ? 'open' : 'lock';
    o += '<button class="node t' + t + ' ' + state + (S.techSel === id ? ' cur' : '') + '" data-act="techsel" data-id="' + id + '">' + ic(state === 'done' ? 'check' : state === 'lock' ? 'lock' : icon[id]) + '<b>' + T.n + '</b><small>' + (state === 'done' ? 'Known' : state === 'now' ? F.rp + ' / ' + T.cost : T.cost) + '</small></button>';
  }
  var id2 = S.techSel, T2 = HX.TECH[id2], done = F.tech[id2], open = av.indexOf(id2) >= 0, left = Math.max(0, T2.cost - F.rp);
  o += '</div><div class="tdetail"><div class="nm">' + T2.n + ' <span class="dim" style="font-size:12px;letter-spacing:0.08em">' + HX.BRANCH[T2.br].toUpperCase() + ' ' + roman(T2.tier) + '</span></div><div>' + T2.d + '</div>';
  if (done) o += '<div class="good cap">KNOWN</div>';
  else if (!open) o += '<div class="hint">Needs ' + T2.req.filter(function (r) { return !F.tech[r]; }).map(function (r) { return HX.TECH[r].n; }).join(' and ') + ' first.</div>';
  else if (F.research === id2) o += '<div class="bar"><i style="width:' + Math.round(100 * F.rp / T2.cost) + '%"></i></div><div class="hint">Under study · about ' + turns(Math.max(1, Math.ceil(left / Math.max(1, inc.s)))) + ' left</div>';
  else o += '<button class="btn solid" data-act="techgo" data-id="' + id2 + '">Study · about ' + turns(Math.max(1, Math.ceil(left / Math.max(1, inc.s)))) + '</button>';
  o += '</div>';
  modal(o);
}
function openDiplo() {
  var G = S.G, F = G.factions[0], sh = HX.islandsHeld(G), o = head('Parley');
  o += '<div class="row" style="flex-direction:column;align-items:stretch;gap:6px;padding:10px"><div class="grp" style="margin:0">ROADS TO VICTORY</div><div>Take every rival capital: <b>' + G.factions.filter(function (x) { return x.id && !x.alive; }).length + ' of ' + (G.factions.length - 1) + '</b> fallen.</div><div>Or hold ' + sh.need + ' of ' + sh.total + ' islands for ' + HX.HEG_TURNS + ' turns: you hold <b>' + (sh.by[0] || 0) + '</b>.</div><div class="bar"><i style="width:' + Math.min(100, Math.round(100 * (sh.by[0] || 0) / sh.need)) + '%"></i></div></div><div class="list">';
  var any = false;
  G.factions.forEach(function (O) {
    if (!O.id) return; var FD = HX.FACTIONS[O.key];
    if (!F.met[O.id]) { o += '<div class="row dim">An unknown flag · not yet sighted</div>'; return; }
    any = true;
    if (!O.alive) { o += '<div class="row"><span class="grow">' + sw(G, O.id) + FD.n + '</span><span class="dim">Fallen</span></div>'; return; }
    var r = HX.rel(G, 0, O.id), att = HX.attitude(G, 0, O.id), mood = att >= 25 ? 'Friendly' : att >= 5 ? 'Cordial' : att > -15 ? 'Wary' : att > -40 ? 'Hostile' : 'Furious';
    var mine = HX.strength(G, 0), theirs = HX.strength(G, O.id), cmp = theirs > mine * 1.4 ? 'much stronger than you' : theirs > mine * 1.1 ? 'stronger than you' : theirs < mine * 0.7 ? 'much weaker than you' : theirs < mine * 0.9 ? 'weaker than you' : 'about your equal';
    o += '<div class="fcard box' + (r.war ? ' atwar' : '') + '"><div class="hd">' + emblemImg(O.key, 44) + '<div style="flex:1;min-width:0"><h3>' + FD.n + '</h3><div class="hint">' + FD.role + ' · ' + cmp + ' · ' + (sh.by[O.id] || 0) + ((sh.by[O.id] || 0) === 1 ? ' island' : ' islands') + '</div></div><div class="state ' + (r.war ? 'bad' : '') + '">' + (r.war ? 'WAR' : r.truce > 0 ? 'TRUCE ' + r.truce : 'PEACE') + '</div></div>';
    o += '<div class="att" role="img" aria-label="Attitude ' + mood + '"><i style="left:' + (50 + att / 2) + '%"></i></div><div class="reasons"><b style="color:var(--ink)">' + mood + '</b>';
    HX.attReasons(G, 0, O.id).forEach(function (m) { o += '<span>' + m.txt + ' <b class="' + (m.v > 0 ? 'good' : 'bad') + '">' + (m.v > 0 ? '+' : '') + m.v + '</b></span>'; });
    o += '</div><div class="acts" style="margin-top:0">';
    if (r.war) o += '<button class="btn" data-act="peace" data-f="' + O.id + '">Propose peace</button>';
    else if (S.confirmWar === O.id) o += '<button class="btn danger" data-act="war2" data-f="' + O.id + '">' + ic('sword') + '<span>Confirm war' + (r.truce > 0 ? '<small>Breaks the truce</small>' : '') + '</span></button>';
    else o += '<button class="btn" data-act="war" data-f="' + O.id + '">Declare war</button>';
    o += '<button class="btn" data-act="gift" data-f="' + O.id + '"' + (F.res.c >= 20 ? '' : ' disabled') + '>Gift ' + ic('gold', 's12') + '20</button></div></div>';
  });
  if (!any) o += '<div class="hint">You have sighted no other flag yet. Explore to make contact.</div>';
  modal(o + '</div>');
}
function openLog() {
  var G = S.G, o = head('Ship\'s log') + '<div class="list">'; S.logSeen = G.log.length; S.tick = null;
  var kcol = { war: '#a3261a', battle: '#c9861f', loss: '#a3261a', tech: '#4d86b8', build: '#8a7a5c', claim: '#2c6b3a', diplo: '#6a4fa3', info: '#8a7a5c' };
  G.log.slice().reverse().forEach(function (l) {
    var shown = l.f === 0 || l.k === 'war' || l.k === 'diplo' || (l.key && S.vis[l.key]) || (l.k === 'battle' && l.key && G.factions[0].explored[l.key]);
    if (!shown || (l.f !== 0 && l.f != null && l.f >= 0 && !G.factions[0].met[l.f])) return;
    o += '<button class="logrow" data-act="goto" data-k="' + (l.key || '') + '"><span class="t">T' + l.t + '</span><i class="mk" style="background:' + kcol[l.k] + '"></i><span>' + esc(l.txt) + '</span></button>';
  });
  modal(o + '</div>'); renderFabs(); renderCoach();
}
function openEco() {
  var G = S.G, F = G.factions[0], inc = HX.income(G, 0), o = head('Ledger') + '<table class="eco"><tr><th>Source</th><th>' + ic('timber', 's12') + '</th><th>' + ic('gold', 's12') + '</th><th>' + ic('rum', 's12') + '</th><th>' + ic('sci', 's12') + '</th></tr>';
  for (var k in G.hexes) { var b = G.hexes[k].base; if (!b || b.owner !== 0) continue; var y = HX.baseYield(G, k); o += '<tr><td>' + esc(G.hexes[k].name) + (HX.besieged(G, k) ? ' <span class="bad">(blockaded)</span>' : '') + '</td><td>' + y.a + '</td><td>' + y.c + '</td><td>' + y.f + '</td><td>' + y.s + '</td></tr>'; }
  if (F.key === 'comp') o += '<tr><td>Company charter</td><td>2</td><td>2</td><td>2</td><td>0</td></tr>';
  if (F.key === 'order') o += '<tr><td>Order\'s navigators</td><td></td><td></td><td></td><td>+30%</td></tr>';
  if (inc.toll) o += '<tr><td class="bad">Pirates in your waters</td><td class="bad">−' + inc.ta + '</td><td class="bad">−' + inc.tc + '</td><td></td><td></td></tr>';
  o += '<tr><td>Crews\' rum ration</td><td></td><td></td><td class="bad">−' + inc.up + '</td><td></td></tr><tr class="tot"><td>Each turn</td><td>' + inc.a + '</td><td>' + inc.c + '</td><td class="' + (inc.f < 0 ? 'bad' : '') + '">' + inc.f + '</td><td>' + inc.s + '</td></tr></table>';
  if (F.starved) o += '<div class="row alarm">Out of rum. Fleets sail at half speed.</div>';
  o += '<div class="row"><span class="grow">Next port</span>' + costHTML(HX.claimCost(G, F, 'port'), F) + '</div><div class="hint">Fleets sail up to ' + HX.supplyRange(F) + ' hexes from a harbour.</div>';
  modal(o);
}
function openMenu() { modal(head('At anchor') + '<div class="list"><button class="btn solid" data-act="close">Back to sea</button><button class="btn" data-act="help">How to play</button><button class="btn" data-act="options">Options</button><button class="btn" data-act="quit">Save and return to port</button><button class="btn danger" data-act="abandon">Abandon this voyage</button></div>', true); }
function openOptions() {
  function tg(k, label) { return '<button class="toggle" data-act="opt" data-id="' + k + '" aria-pressed="' + S.opt[k] + '"><span class="box">' + ic('check') + '</span><span>' + label + '</span></button>'; }
  modal(head('Options') + tg('sfx', 'Sound effects') + tg('battles', 'Show battle scenes') + '<button class="btn solid" data-act="close">Done</button>', true);
}
function openHelp() {
  var fk = S.G ? S.G.factions[0].key : S.setup.faction;
  var tl = ''; HX.SHIP_ORDER.forEach(function (t) { var st = HX.statFor(fk, null, t); tl += '<li><b>' + st.n + '</b>: ' + HX.TRAITS[st.tr][1].toLowerCase().replace(/\.$/, '') + '</li>'; });
  var o = head('How to play') + '<div class="help"><h3>EACH TURN</h3><p>Set ports to work, sail fleets, end the turn. <b>Next</b> jumps to whatever still needs orders.</p>' +
    '<h3>ISLANDS</h3><p>You begin with two ships. Sail alongside a free island and found a port on a shore hex. The first is free; each later port costs more than the last. Every other land hex holds one structure: forest for sawmills, hills for gold mines, cane for distilleries.</p>' +
    '<h3>FLEETS</h3><p>Once you have a port, fleets stay within 5 hexes of a friendly harbour; sloops alone go 3 further. Reefs block, fog slows. Every ship but the sloop drinks rum.</p>' +
    '<h3>SHIPS</h3><ul>' + tl + '</ul><p>Each flag builds its own variants, and every Navy discovery adds 8% to all guns.</p>' +
    '<h3>PIRATES</h3><p>While you are at peace, small pirate fleets drift into your waters and skim a little of your timber and gold. They never attack and are always weaker than you. Sink them for a bounty.</p>' +
    '<h3>WAR</h3><p>You see the odds before every fight. Win at an enemy harbour, then hold it 2 turns (4 for a capital) to take it.</p>' +
    '<h3>VICTORY</h3><p>Take every rival capital, or hold two thirds of the islands for ' + HX.HEG_TURNS + ' turns.</p></div><button class="btn solid" data-act="close">Close</button>';
  modal(o);
}

/* ---------- actions ---------- */
var ACT = {
  newgame: function () { closeModal(true); renderSetup(); sfx('ok'); },
  totitle: function () { closeModal(true); S.G = null; renderTitle(); },
  continue: function () { var G = savedGame(); if (G) { sfx('ok'); enterGame(G); } },
  help: openHelp, options: openOptions,
  fac: function (d) { S.setup.faction = d.id; sfx('tap'); renderSetup(); },
  size: function (d) { S.setup.size = d.id; sfx('tap'); renderSetup(); },
  diff: function (d) { S.setup.diff = d.id; sfx('tap'); renderSetup(); },
  reroll: function () { S.setup.seed = 1 + Math.floor(Math.random() * 99999); sfx('move'); renderSetup(); },
  tut: function () { S.setup.tutorial = !S.setup.tutorial; sfx('tap'); renderSetup(); },
  launch: function () { var st = S.setup; sfx('build'); enterGame(HX.newGame({ size: st.size, seed: st.seed, faction: st.faction, diff: st.diff, tutorial: st.tutorial })); save(); },
  opt: function (d) { S.opt[d.id] = !S.opt[d.id]; store.set(OPT, JSON.stringify(S.opt)); sfx('tap'); openOptions(); },
  close: function () { closeModal(); },
  menu: openMenu, eco: openEco, research: function () { sfx('tap'); openTech(); }, log: openLog, diplo: function () { sfx('tap'); openDiplo(); },
  quit: function () { save(); closeModal(true); S.G = null; renderTitle(); },
  abandon: function (d, el) { if (el.dataset.sure) { store.del(SAVE); closeModal(true); S.G = null; renderTitle(); } else { el.dataset.sure = '1'; el.innerHTML = 'Tap again to abandon'; } },
  next: nextAction, endturn: endTurn, desel: desel,
  zoomin: function () { RN.stepZoom(1); }, zoomout: function () { RN.stepZoom(-1); },
  build: function (d) { sfx('tap'); openBuild(d.tab); }, btab: function (d) { openBuild(d.tab); },
  buildat: function (d) { sfx('tap'); openBuild('b', d.k); },
  enq: function (d) {
    var G = S.G, town = townOf(G, S.sel), r = HX.enqueue(G, town, d.kind, d.id, d.at || null); if (!r.ok) { toast(r.why); sfx('err'); return; }
    sfx('build'); toast(r.item.n + (r.item.lvl > 1 ? ' ' + roman(r.item.lvl) : '') + ' · ' + turns(r.item.time));
    if (r.item.at) RN.addFx({ type: 'flash', key: r.item.at, dur: 600, col: P.gold });
    if (S.modalOpen) { var keep = G.hexes[town].base.queue.length < 3; closeModal(true); refresh(); if (keep && d.kind === 's') openBuild('s'); } else refresh();
  },
  qcancel: function (d) { HX.cancelQueue(S.G, townOf(S.G, S.sel), +d.i); sfx('tap'); refresh(); },
  claim: function () { var G = S.G, fl = HX.fleetAt(G, S.sel, 0), r = HX.claim(G, fl); if (!r.ok) { toast(r.why); sfx('err'); return; } RN.addFx({ type: 'flash', key: S.sel, dur: 600, col: fcol(G, 0) }); sfx('build'); toast('Your flag flies over <b>' + esc(G.hexes[S.sel].name) + '</b>'); refresh(); },
  found: function (d) { var G = S.G, r = HX.found(G, 0, d.k); if (!r.ok) { toast(r.why); sfx('err'); return; } RN.addFx({ type: 'flash', key: d.k, dur: 700, col: fcol(G, 0) }); sfx('build'); toast('<b>' + esc(G.hexes[d.k].name) + '</b> founded'); S.sel = d.k; S.tab = 'place'; refresh(); },
  raid: function () { var G = S.G, fl = HX.fleetAt(G, S.sel, 0), r = HX.raid(G, fl); if (!r.ok) { toast(r.why); return; } sfx('boom'); RN.addFx({ type: 'text', screen: true, key: S.sel, dur: 1400, txt: '+' + (r.loot.a + r.loot.c + r.loot.f), col: P.gold }); toast('Plunder: ' + HX.costStr(r.loot)); refresh(); },
  hold: function () { var fl = HX.fleetAt(S.G, S.sel, 0); fl.hold = !fl.hold; if (fl.hold) { fl.dest = null; fl.auto = false; } sfx('tap'); refresh(); },
  stop: function () { var fl = HX.fleetAt(S.G, S.sel, 0); fl.dest = null; refresh(); },
  explore: function () {
    var G = S.G, fl = HX.fleetAt(G, S.sel, 0); if (!fl) return;
    if (fl.auto) { fl.auto = false; fl.dest = null; sfx('tap'); refresh(); return; }
    var part = S.detach ? HX.split(G, fl, S.detach) : fl; S.detach = null; S.courseMode = false; if (!part) return;
    var r = HX.explore(G, part); sfx('move'); S.sel = HX.fkey(r.fleet); S.tab = 'fleet';
    toast(r.done && !r.moved ? 'Nothing left to chart in range' : 'Exploring'); refresh();
  },
  course: function () { S.courseMode = !S.courseMode; sfx('tap'); calcReach(); renderSheet(); layout(); },
  detach: function () { var fl = HX.fleetAt(S.G, S.sel, 0); if (S.detach) S.detach = null; else { S.detach = {}; var top = HX.SHIP_ORDER.filter(function (t) { return fl.ships[t]; })[0]; S.detach[top] = 1; } sfx('tap'); calcReach(); renderSheet(); layout(); },
  det: function (d) { var fl = HX.fleetAt(S.G, S.sel, 0), v = (S.detach[d.id] || 0) + (+d.d); S.detach[d.id] = Math.max(0, Math.min(fl.ships[d.id], v)); calcReach(); renderSheet(); },
  tab: function (d) { S.tab = d.id; sfx('tap'); calcReach(); renderSheet(); layout(); },
  attack: function (d) { doAttack(d.k); },
  bskip: function () { if (battleCtl) battleCtl.skip(); },
  techsel: function (d) { S.techSel = d.id; sfx('tap'); openTech(); },
  techgo: function (d) { HX.setResearch(S.G, 0, d.id); sfx('tech'); closeModal(true); toast('Studying ' + HX.TECH[d.id].n); refresh(); },
  war: function (d) { S.confirmWar = +d.f; openDiplo(); },
  war2: function (d) { HX.declareWar(S.G, 0, +d.f); sfx('war'); closeModal(true); toast('<span class="bad">You are at war with the ' + HX.FACTIONS[S.G.factions[+d.f].key].n + '.</span>'); refresh(); },
  peace: function (d) { closeModal(true); HX.proposePeace(S.G, 0, +d.f); refresh(); },
  acceptpeace: function (d) { HX.makePeace(S.G, 0, +d.f); closeModal(true); toast('Peace with the ' + HX.FACTIONS[S.G.factions[+d.f].key].n + '.'); refresh(); },
  gift: function (d) { closeModal(true); HX.gift(S.G, 0, +d.f, 'c', 20); refresh(); },
  goto: function (d) { if (d.k && S.G.hexes[d.k] && S.G.factions[0].explored[d.k]) { closeModal(true); select(d.k, true); } },
  tutskip: function () { S.G.tut = false; S.G.tutStep = null; renderCoach(); tutCheck(); },
  tutdone: function () { S.G.tut = false; S.G.tutStep = null; renderCoach(); tutCheck(); }
};

/* ---------- input ---------- */
function bind() {
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    var fn = ACT[el.dataset.act]; if (fn) { e.preventDefault(); fn(el.dataset, el); }
  });
  $('#modal').addEventListener('click', function (e) { if (e.target === $('#modal') && !$('#modal').classList.contains('mid')) closeModal(); });
  var cvs = $('#cv'), ptrs = {}, n = 0, drag = null, pinch = null;
  function pos(e) { var r = cvs.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  cvs.addEventListener('pointerdown', function (e) { if (S.screen !== 'game') return; try { cvs.setPointerCapture(e.pointerId); } catch (x) { } var p = pos(e); ptrs[e.pointerId] = p; n = Object.keys(ptrs).length; Q.touch = true; if (n === 1) drag = { x0: p.x, y0: p.y, x: p.x, y: p.y, t: performance.now(), moved: false }; else if (n === 2) { var a = Object.values(ptrs); pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) }; if (drag) drag.moved = true; } });
  cvs.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) return; var p = pos(e), old = ptrs[e.pointerId]; ptrs[e.pointerId] = p;
    if (n === 1 && drag) { if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > 8) drag.moved = true; if (drag.moved) RN.panBy(p.x - old.x, p.y - old.y); }
    else if (n === 2 && pinch) { var a = Object.values(ptrs), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2; if (pinch.d > 0) RN.zoomAt(mx, my, d / pinch.d); pinch.d = d; }
  });
  function up(e) { if (!ptrs[e.pointerId]) return; var p = ptrs[e.pointerId]; delete ptrs[e.pointerId]; var was = n; n = Object.keys(ptrs).length; if (was === 1 && drag && !drag.moved && e.type === 'pointerup') tapHex(RN.pick(p.x, p.y)); if (n < 2) pinch = null; if (n === 0) { drag = null; Q.touch = false; } else if (n === 1) { var q = Object.values(ptrs)[0]; drag = { x0: q.x, y0: q.y, moved: true }; } }
  cvs.addEventListener('pointerup', up); cvs.addEventListener('pointercancel', up);
  cvs.addEventListener('wheel', function (e) { if (S.screen !== 'game') return; e.preventDefault(); var p = pos(e); RN.zoomAt(p.x, p.y, e.deltaY < 0 ? 1.12 : 0.89); }, { passive: false });
  window.addEventListener('resize', layout);
  document.addEventListener('keydown', function (e) {
    if (S.screen !== 'game') return;
    if (e.key === 'Escape') { if (S.modalOpen) { if (!$('#modal .dlg [data-act="close"]')) return; closeModal(); } else desel(); }
    else if ((e.key === 'Enter' || e.key === ' ') && !S.modalOpen && e.target === document.body) { e.preventDefault(); nextAction(); }
  });
}

/* Draw at 30 frames a second when nothing but the water is moving, and step the picture quality down if the device cannot keep up. */
var Q = { lvl: 0, ema: 16, last: 0, since: 0, n: 0, touch: false };
function loop(t) {
  requestAnimationFrame(loop);
  var dt = Q.last ? t - Q.last : 16; Q.last = t; if (dt < 300) Q.ema += (dt - Q.ema) * 0.04;
  if (Q.lvl < 2 && Q.ema > 27 && t - Q.since > 3000) { Q.lvl++; Q.since = t; Q.ema = 16; RN.setQuality(Q.lvl); layout(); }
  if (!Q.touch && !RN.moving() && (Q.n++ & 1)) return;
  var cvs = $('#cv'), ctx = cvs.getContext('2d');
  if (S.screen === 'game' && S.G) RN.frame(ctx, t, { G: S.G, vis: S.vis, sel: S.sel, reach: S.reach, course: S.course, sup: S.sup, sites: S.sites, accent: fcol(S.G, 0), lit: ART.mix(fcol(S.G, 0), '#ffffff', 0.6), tutHex: S.tutHex, idle: S.idleBases, selFleet: sheetTab() === 'fleet' });
  else RN.titleFrame(ctx, t, S.setup.faction, S.screen === 'title');
}
function boot() {
  try { var o = JSON.parse(store.get(OPT) || 'null'); if (o) for (var k in o) if (k in S.opt) S.opt[k] = !!o[k]; } catch (e) { }
  bind(); renderTitle(); layout(); requestAnimationFrame(loop);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
}
var hot = window.claude && window.claude.hot;
if (hot && hot.snapshot) { try { hot.snapshot(function () { save(); return {}; }); } catch (e) { } }
S.api = { refresh: refresh, endTurn: endTurn, select: select, enterGame: enterGame, tapHex: tapHex };
boot();
})();
