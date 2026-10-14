/* Salt & Steel core: rules, map generation, AI. Pure data in, pure data out (state is JSON-serialisable). */
(function (root) {
'use strict';
var HX = {};
var NEUTRAL = -1, HEG_TURNS = 8, HEG_SHARE = 2 / 3;
var DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/* ---------- tables ---------- */
var SIZES = {
  s: { n: 'Straits', R: 9, rivals: 2, d: '271 hexes · 2 rivals · about an hour' },
  m: { n: 'Archipelago', R: 11, rivals: 3, d: '397 hexes · 3 rivals · an evening' },
  l: { n: 'Open Ocean', R: 13, rivals: 4, d: '547 hexes · 4 rivals · a long voyage' }
};
var DIFFS = {
  easy: { n: 'Deckhand', mult: 0.8, war: 46, d: 'Rivals earn less and keep the peace longer.' },
  normal: { n: 'Captain', mult: 1, war: 32, d: 'An even contest.' },
  hard: { n: 'Admiral', mult: 1.25, war: 20, d: 'Rivals earn more and strike early.' }
};
var RES = ['a', 'c', 'f'];
var RESN = { a: 'Timber', c: 'Gold', f: 'Rum', s: 'Lore' };

/* No ship simply beats another. Each class has its own numbers, its own price in stores and one trait; factions field their own variants, and every Navy discovery sharpens the guns. */
var TRAITS = {
  evade: ['Nimble', 'Takes half damage.'], raid: ['Boarders', 'Half again the salvage and plunder.'], first: ['Chase guns', 'Fires an opening volley.'],
  armor: ['Thick oak', 'Takes a quarter less damage.'], siege: ['Broadside', 'Half again the damage to forts.']
};
var SHIPS = {
  sloop: { n: 'Sloop', a: 8, c: 0, f: 2, atk: 1, hp: 5, spd: 5, cargo: 4, t: 1, upk: 0, tr: 'evade', tech: null, yard: 1 },
  brig: { n: 'Brig', a: 12, c: 4, f: 6, atk: 4, hp: 10, spd: 4, cargo: 10, t: 1, upk: 1, tr: 'raid', tech: null, yard: 1 },
  frigate: { n: 'Frigate', a: 16, c: 20, f: 6, atk: 7, hp: 15, spd: 4, cargo: 10, t: 2, upk: 1.5, tr: 'first', tech: 'gundecks', yard: 1 },
  galleon: { n: 'Galleon', a: 44, c: 14, f: 14, atk: 9, hp: 38, spd: 3, cargo: 25, t: 3, upk: 2.5, tr: 'armor', tech: 'greathulls', yard: 2 },
  manowar: { n: 'Man-o\'-war', a: 80, c: 70, f: 40, atk: 24, hp: 90, spd: 3, cargo: 40, t: 4, upk: 5, tr: 'siege', tech: 'firstrate', yard: 3 }
};
var NAVY = ['gundecks', 'greathulls', 'sheathing', 'firstrate'];
var SHIP_ORDER = ['sloop', 'brig', 'frigate', 'galleon', 'manowar'];

/* Plot structures stand on a land hex of the island. Harbour structures stand in the port itself. */
var BLD = {
  sawmill: { n: 'Sawmill', plot: true, ter: 'wood', res: 'a', cost: [[20, 0, 0], [40, 10, 0], [70, 30, 0]], d: 'Cuts timber. Best in forest.' },
  mine: { n: 'Gold mine', plot: true, ter: 'hill', res: 'c', cost: [[18, 0, 0], [36, 12, 0], [60, 30, 0]], d: 'Digs gold. Best in hills.' },
  still: { n: 'Distillery', plot: true, ter: 'cane', res: 'f', cost: [[18, 6, 0], [36, 16, 0], [60, 34, 0]], d: 'Makes rum. Best on cane fields.' },
  school: { n: 'Observatory', plot: true, ter: 'hill', res: 's', cost: [[15, 15, 0], [30, 30, 0], [55, 60, 0]], d: 'Gathers lore. A little better on high ground.' },
  yard: { n: 'Shipyard', plot: false, cost: [[30, 10, 0], [55, 30, 0], [90, 60, 20]], d: 'Builds ships. Level 2 for galleons, level 3 for men-o\'-war.' },
  fort: { n: 'Fort', plot: false, cost: [[25, 10, 0], [45, 25, 0], [80, 50, 0]], d: 'Shore guns that fight beside any fleet defending the harbour.' }
};
var BLD_ORDER = ['sawmill', 'mine', 'still', 'school', 'yard', 'fort'];
var PLOT_ORDER = ['sawmill', 'mine', 'still', 'school'];
var TER_N = { wood: 'Forest', hill: 'Hills', cane: 'Cane fields', grass: 'Grassland' };

var TECH = {
  saws: { n: 'Crosscut Saws', br: 0, tier: 1, cost: 20, req: [], d: 'Sawmills yield +1 timber per level.' },
  shafts: { n: 'Deep Shafts', br: 0, tier: 2, cost: 45, req: ['saws'], d: 'Gold mines and distilleries yield +1 per level.' },
  masonry: { n: 'Stone Masonry', br: 0, tier: 3, cost: 80, req: ['shafts'], d: 'Structures can be raised to level 3.' },
  guilds: { n: 'Craft Guilds', br: 0, tier: 4, cost: 130, req: ['masonry'], d: 'Everything builds one turn faster.' },
  gundecks: { n: 'Gun Decks', br: 1, tier: 1, cost: 20, req: [], d: 'Unlocks the Frigate.' },
  greathulls: { n: 'Great Hulls', br: 1, tier: 2, cost: 45, req: ['gundecks'], d: 'Unlocks the Galleon (needs a level 2 shipyard).' },
  sheathing: { n: 'Copper Sheathing', br: 1, tier: 3, cost: 80, req: ['greathulls'], d: 'All ships gain 20% hull.' },
  firstrate: { n: 'Ships of the Line', br: 1, tier: 4, cost: 130, req: ['sheathing', 'masonry'], d: 'Unlocks the Man-o\'-war (needs a level 3 shipyard).' },
  casks: { n: 'Salted Stores', br: 2, tier: 1, cost: 20, req: [], d: 'Fleets can sail 2 hexes further from harbour.' },
  rigging: { n: 'Studding Sails', br: 2, tier: 2, cost: 45, req: ['casks'], d: 'All ships sail 1 hex further each turn.' },
  spyglass: { n: 'Spyglasses', br: 2, tier: 3, cost: 80, req: ['rigging'], d: 'See 1 hex further and into fog banks.' },
  winds: { n: 'Trade Winds', br: 2, tier: 4, cost: 130, req: ['spyglass'], d: 'Fleets ride between your capital, free ports and shipyard ports for 1 move.' }
};
var TECH_ORDER = ['saws', 'shafts', 'masonry', 'guilds', 'gundecks', 'greathulls', 'sheathing', 'firstrate', 'casks', 'rigging', 'spyglass', 'winds'];
var BRANCH = ['Colony', 'Navy', 'Navigation'];

var FACTIONS = {
  crown: { n: 'Crown of Valdane', short: 'Valdane', col: '#f2b53f', cap: 'Port Valdane', style: 'square', role: 'Shipwrights', ships: { galleon: { n: 'Royal Galleon', hp: 1.2 }, manowar: { n: 'First Rate', hp: 1.15 } },
    perk: 'Structures cost 20% less.', blurb: 'A royal navy with deep docks and the heaviest hulls afloat.',
    pers: { aggr: 0.3, expand: 0.6, tech: 0.7, def: 0.9 }, att0: 5,
    voice: { threat: 'Your flags crowd waters the Crown has surveyed. Strike them, or we shall.', greet: 'His Majesty\'s navy notes your colours. Keep to your side of the chart and we shall get along.', war: 'By order of the Crown, your ports are forfeit. We are at war.', peace: 'The Admiralty finds this war wasteful. Terms accepted.', raided: 'Your theft has been entered in the ledger.', gift: 'Received and recorded. The Crown thanks you.', refuse: 'The Admiralty sees no profit in peace. Declined.', offer: 'Enough timber has gone to the bottom. The Crown proposes peace.', lose: 'Our docks will outlast us. Remember who built them.' } },
  breth: { n: 'Black Brethren', short: 'Brethren', col: '#f0524f', cap: 'Gallows Cove', style: 'ragged', role: 'Raiders', ships: { brig: { n: 'Corsair', spd: 1, atkA: 1 } },
    perk: 'Guns hit 15% harder. Plunder takes more.', blurb: 'Pirates with a few harbours. Their corsairs are the fastest raiders on the water.',
    pers: { aggr: 1, expand: 0.6, tech: 0.3, def: 0.3 }, att0: -15,
    voice: { threat: 'The Brethren smell a fat prize. Pay tribute or run out your guns.', greet: 'So there is a new flag on the water. We are not impressed.', war: 'Your harbours will burn bright. No quarter!', peace: 'Bah. Keep your rocks. For now.', raided: 'You steal from thieves? You will bleed for it.', gift: 'Tribute. Good. You learn.', refuse: 'The Brethren do not strike their colours.', offer: 'Enough. The Brethren offer a truce. Take it.', lose: 'We sink. We do not beg.' } },
  comp: { n: 'Meridian Company', short: 'Meridian', col: '#4fd08c', cap: 'Meridian Quay', style: 'tall', role: 'Traders', ships: { brig: { n: 'Packet', cost: 0.8 }, galleon: { n: 'Indiaman', cargo: 2, upk: 0.6 } },
    perk: '+2 timber, gold and rum each turn.', blurb: 'A trading house with full warehouses and cheap, roomy ships.',
    pers: { aggr: 0.2, expand: 0.7, tech: 0.5, def: 0.6 }, att0: 15,
    voice: { threat: 'Our factors find your waters undervalued. A gift would balance the books.', greet: 'The Meridian Company welcomes a new customer. Everything is negotiable.', war: 'Consider this a hostile acquisition. Nothing personal.', peace: 'A bargain is a bargain. Peace it is.', raided: 'That was not in the contract.', gift: 'A pleasure doing business.', refuse: 'The terms are unacceptable.', offer: 'War is bad for margins. Shall we settle?', lose: 'The account is closed.' } },
  order: { n: 'Astrolabe Order', short: 'Astrolabe', col: '#b392ff', cap: 'Lodestar Isle', style: 'lateen', role: 'Navigators', ships: { sloop: { n: 'Caravel', atkA: 1, hp: 1.4 }, frigate: { n: 'Survey Frigate', spd: 1 } },
    perk: '+30% lore. Lookouts see 1 hex further.', blurb: 'Chart-makers whose small ships sail further and see more.',
    pers: { aggr: 0.45, expand: 0.4, tech: 1, def: 0.5 }, att0: 0,
    voice: { threat: 'The stars lean toward conflict. You may still change your heading.', greet: 'We charted your course before you sailed it. Now you may study ours.', war: 'The reckoning is made. The Order sails against you.', peace: 'The heading shifts. We accept.', raided: 'You reached into waters you cannot read. They noticed.', gift: 'An interesting offering.', refuse: 'It is not yet the hour.', offer: 'The stars favour quiet water. Peace?', lose: 'Our charts remain. Read them closely.' } },
  tide: { n: 'Tidewater Clan', short: 'Tidewater', col: '#ff7fb2', cap: 'Driftholm', style: 'claw', role: 'Wayfarers', ships: { sloop: { n: 'Proa', spd: 1 }, brig: { n: 'War Proa', hp: 0.85, cost: 0.75 } },
    perk: 'Ships cost 15% less. New ports cost 30% less.', blurb: 'Sea nomads with swarms of light, cheap boats.',
    pers: { aggr: 0.7, expand: 1, tech: 0.3, def: 0.2 }, att0: -10,
    voice: { threat: 'The tide rises toward your shores. Share your catch, or lose it.', greet: 'New sails on the old water. The Clan is watching.', war: 'The tide comes in. You stand below the line.', peace: 'The tide turns. We go.', raided: 'You took from the Clan. The Clan remembers.', gift: 'Shared. Good.', refuse: 'The tide is not done with you.', offer: 'The Clan tires of this. Let us part.', lose: 'The tide goes out. It always returns.' } }
};
var FACTION_ORDER = ['crown', 'breth', 'comp', 'order', 'tide'];

var CLAIM = { port: [80, 40, 25], islet: [45, 22, 12], resettle: [40, 20, 12], station: [0, 0, 0] };
var KIND_N = { colony: 'Port', station: 'Free port' };
var TYPE_N = { sea: 'Open sea', land: 'Island', fog: 'Fog bank', wreck: 'Shipwreck', reef: 'Reef' };

/* ---------- rng ---------- */
function mul(a) { var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function rngFrom(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; return mul(a); }; }
function grnd(G) { G.rs = (G.rs + 0x6D2B79F5) >>> 0; return mul(G.rs); }
function gint(G, n) { return Math.floor(grnd(G) * n); }

/* ---------- hex helpers ---------- */
function K(q, r) { return q + ',' + r; }
var NB = {};
function nbrs(k) { var c = NB[k]; if (c) return c; var p = k.split(','), q = +p[0], r = +p[1]; c = DIRS.map(function (d) { return (q + d[0]) + ',' + (r + d[1]); }); NB[k] = c; return c; }
function hdist(a, b) { var dq = a.q - b.q, dr = a.r - b.r; return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2; }
function kdist(G, a, b) { return hdist(G.hexes[a], G.hexes[b]); }
function fkey(fl) { return fl.q + ',' + fl.r; }
function hexesWithin(G, k, n) { var h = G.hexes[k], out = []; for (var dq = -n; dq <= n; dq++) for (var dr = Math.max(-n, -dq - n); dr <= Math.min(n, -dq + n); dr++) { var kk = K(h.q + dq, h.r + dr); if (G.hexes[kk]) out.push(kk); } return out; }
function isWater(h) { return !!h && h.type !== 'land' && h.type !== 'reef'; }
/* Ships sail on water and may enter a land hex only where a harbour stands. */
function passable(h) { return !!h && h.type !== 'reef' && (h.type !== 'land' || !!h.base); }

/* ---------- islands ---------- */
function islandOf(G, k) { var h = G.hexes[k]; return h && h.isl != null ? G.isl[h.isl] : null; }
function plotsOf(G, k) { var isl = islandOf(G, k); return isl ? isl.land.filter(function (x) { return x !== isl.port; }) : []; }
function islandOwner(G, isl) { if (!isl.port) return null; var b = G.hexes[isl.port].base; return b ? b.owner : null; }
function fit(h, id) { var t = h.ter; if (id === 'school') return t === 'hill' ? 1 : 0; return t === BLD[id].ter ? 2 : t === 'grass' ? 1 : 0; }

/* ---------- faction helpers ---------- */
function has(F, t) { return !!F.tech[t]; }
function cost3(arr, m) { return { a: Math.ceil(arr[0] * m), c: Math.ceil(arr[1] * m), f: Math.ceil(arr[2] * m) }; }
function canAfford(F, c, reserve) { reserve = reserve || 0; return F.res.a - reserve >= c.a && F.res.c >= c.c && F.res.f >= c.f; }
function pay(F, c) { F.res.a -= c.a; F.res.c -= c.c; F.res.f -= c.f; }
function gain(F, c) { F.res.a += c.a || 0; F.res.c += c.c || 0; F.res.f += c.f || 0; }
function bldCost(F, id, lvl) { return cost3(BLD[id].cost[lvl - 1], F.key === 'crown' ? 0.8 : 1); }
function statFor(key, tech, t) {
  var b = SHIPS[t], o = (key && FACTIONS[key].ships[t]) || {}, lv = 0; if (tech) NAVY.forEach(function (x) { if (tech[x]) lv++; });
  return { n: o.n || b.n, atk: (b.atk + (o.atkA || 0)) * (key === 'breth' ? 1.15 : 1) * (1 + 0.08 * lv), hp: b.hp * (o.hp || 1) * (tech && tech.sheathing ? 1.2 : 1), spd: b.spd + (o.spd || 0), cargo: b.cargo * (o.cargo || 1), upk: b.upk * (o.upk || 1), tr: b.tr, variant: !!o.n };
}
function shipStat(G, owner, t) { var F = owner >= 0 ? G.factions[owner] : null; return statFor(F ? F.key : null, F ? F.tech : null, t); }
function shipName(G, owner, t) { return shipStat(G, owner, t).n; }
function shipCost(F, id) { var s = SHIPS[id], o = FACTIONS[F.key].ships[id] || {}; return cost3([s.a, s.c, s.f], (F.key === 'tide' ? 0.85 : 1) * (o.cost || 1)); }
function ownBases(G, fid) { var n = 0; for (var k in G.hexes) { var b = G.hexes[k].base; if (b && b.owner === fid) n++; } return n; }
/* The first port is free. After that every port costs dearly, and each one more than the last. */
function claimMult(G, fid) { var n = ownBases(G, fid); if (n < 1) return 0; n--; return 1 + 0.4 * n + 0.05 * n * n; }
function claimCost(G, F, kind) { return cost3(CLAIM[kind], (F.key === 'tide' ? 0.7 : 1) * claimMult(G, F.id)); }
function maxLvl(F) { return has(F, 'masonry') ? 3 : 2; }
function bldTime(F, lvl) { return Math.max(1, lvl + 1 - (has(F, 'guilds') ? 1 : 0)); }
function shipTime(F, id, base) { var y = base.b.yard || 1; return Math.max(1, SHIPS[id].t - (y >= 3 ? 1 : 0) - (has(F, 'guilds') ? 1 : 0)); }
function supplyRange(F) { return 5 + (has(F, 'casks') ? 2 : 0); }
function costStr(c) { var o = []; if (c.a) o.push(c.a + ' timber'); if (c.c) o.push(c.c + ' gold'); if (c.f) o.push(c.f + ' rum'); return o.join(', ') || 'nothing'; }

function log(G, kind, txt, key, fid) { G.log.push({ t: G.turn, k: kind, txt: txt, key: key || null, f: fid == null ? null : fid }); if (G.log.length > 150) G.log.shift(); }
function ev(G, e) { G.ev.push(e); }
function fname(G, fid) { return fid === NEUTRAL || fid == null ? 'Freebooters' : FACTIONS[G.factions[fid].key].short; }

/* ---------- relations ---------- */
function rkey(a, b) { return a < b ? a + '-' + b : b + '-' + a; }
function rel(G, a, b) { return G.rel[rkey(a, b)]; }
function atWar(G, a, b) { if (a === b) return false; if (a === NEUTRAL || b === NEUTRAL) return true; var r = rel(G, a, b); return !!(r && r.war); }
function warsOf(G, fid) { var o = []; G.factions.forEach(function (F) { if (F.alive && F.id !== fid && atWar(G, fid, F.id)) o.push(F.id); }); return o; }
function bordering(G, a, b) { for (var k in G.hexes) { var h = G.hexes[k]; if (h.terr !== a) continue; var n = nbrs(k); for (var i = 0; i < 6; i++) { var o = G.hexes[n[i]]; if (o && o.terr === b) return true; } } return false; }
function attitude(G, a, b) {
  var r = rel(G, a, b); if (!r) return 0;
  var v = Math.round((FACTIONS[G.factions[a].key].att0 + FACTIONS[G.factions[b].key].att0) / 2);
  r.mods.forEach(function (m) { v += m.v; });
  if (r.border) v -= 8;
  return Math.max(-100, Math.min(100, v));
}
function attReasons(G, a, b) {
  var r = rel(G, a, b), o = [];
  var base = Math.round((FACTIONS[G.factions[a].key].att0 + FACTIONS[G.factions[b].key].att0) / 2);
  if (base) o.push({ txt: 'Their nature', v: base });
  if (r.border) o.push({ txt: 'Shared waters', v: -8 });
  var agg = {};
  r.mods.forEach(function (m) { agg[m.txt] = (agg[m.txt] || 0) + m.v; });
  for (var t in agg) o.push({ txt: t, v: agg[t] });
  return o;
}
function addMod(G, a, b, txt, v, ttl) { var r = rel(G, a, b); if (r) r.mods.push({ txt: txt, v: v, ttl: ttl }); }
function meet(G, a, b) { var A = G.factions[a]; if (a === b || A.met[b]) return false; A.met[b] = 1; G.factions[b].met[a] = 1; return true; }
function declareWar(G, a, b, silent) {
  var r = rel(G, a, b); if (!r || r.war) return false;
  var broke = r.truce > 0;
  r.war = true; r.warT = 0; r.truce = 0;
  addMod(G, a, b, 'War declared', -30, 30);
  meet(G, a, b);
  var B = G.factions[b];
  log(G, 'war', fname(G, a) + ' declared war on ' + fname(G, b) + '.', null, a);
  G.factions.forEach(function (F) { if (F.alive && F.id !== a && F.id !== b) addMod(G, a, F.id, broke ? 'Broke a truce' : 'Warmonger', broke ? -15 : -6, 25); });
  if (B.human && !silent) ev(G, { k: 'msg', f: a, line: 'war', title: 'War declared' });
  return true;
}
function makePeace(G, a, b) {
  var r = rel(G, a, b); if (!r || !r.war) return false;
  r.war = false; r.truce = 10; r.warT = 0;
  addMod(G, a, b, 'Peace treaty', 12, 20);
  // lift blockades between the two and send the blockaders off
  for (var k in G.hexes) { var h = G.hexes[k]; if (h.base && h.base.siege && ((h.base.owner === a && h.base.siege.by === b) || (h.base.owner === b && h.base.siege.by === a))) { var by = h.base.siege.by; h.base.siege = null; var fl = fleetAt(G, k, by); if (fl) evict(G, fl); } }
  log(G, 'diplo', fname(G, a) + ' and ' + fname(G, b) + ' made peace.', null, a);
  return true;
}
function evict(G, fl) {
  // move a fleet to the nearest free friendly or neutral water
  var start = fkey(fl), seen = {}, q = [start]; seen[start] = 1;
  var idx = fleetIdx(G);
  while (q.length) {
    var u = q.shift();
    if (u !== start) { var st = hexStance(G, fl.owner, u, idx), h = G.hexes[u]; if (st === 'free' && !(h.base && h.base.owner != null && h.base.owner !== fl.owner)) { fl.q = h.q; fl.r = h.r; fl.dest = null; mergeAt(G, fl); return; } }
    nbrs(u).forEach(function (n) { if (passable(G.hexes[n]) && !seen[n]) { seen[n] = 1; q.push(n); } });
  }
}
function milPower(G, fid) { var p = 0; G.fleets.forEach(function (fl) { if (fl.owner === fid) p += fpower(G, fl.owner, fl.ships); }); return p; }
function baseCount(G, fid) { var n = 0; for (var k in G.hexes) { var b = G.hexes[k].base; if (b && b.owner === fid) n += b.kind === 'colony' ? 2 : 1; } return n; }
function strength(G, fid) { return milPower(G, fid) + baseCount(G, fid) * 4 + 5; }
function proposePeace(G, a, b) {
  var r = rel(G, a, b); if (!r || !r.war) return false;
  var ok = r.warT >= 5 && (milPower(G, b) < milPower(G, a) * 1.15 + 6 || r.warT > 18);
  if (ok) { makePeace(G, a, b); ev(G, { k: 'msg', f: b, line: 'peace', title: 'Peace agreed' }); }
  else ev(G, { k: 'msg', f: b, line: 'refuse', title: 'Peace refused' });
  return ok;
}
function gift(G, a, b, res, amt) {
  var A = G.factions[a]; if (A.res[res] < amt) return false;
  A.res[res] -= amt; G.factions[b].res[res] += amt;
  addMod(G, a, b, 'Gifts', G.factions[b].key === 'comp' ? 14 : 9, 20);
  ev(G, { k: 'msg', f: b, line: 'gift', title: 'Gift received' });
  return true;
}

/* ---------- fleets ---------- */
function fleetIdx(G) { var idx = {}; G.fleets.forEach(function (fl) { var k = fkey(fl); (idx[k] = idx[k] || []).push(fl); }); return idx; }
function fleetAt(G, k, owner) { for (var i = 0; i < G.fleets.length; i++) { var fl = G.fleets[i]; if (fl.owner === owner && fkey(fl) === k) return fl; } return null; }
function fleetsAt(G, k) { return G.fleets.filter(function (fl) { return fkey(fl) === k; }); }
function shipCount(ships) { var n = 0; for (var t in ships) n += ships[t]; return n; }
function topClass(ships) { for (var i = SHIP_ORDER.length - 1; i >= 0; i--) if (ships[SHIP_ORDER[i]] > 0) return SHIP_ORDER[i]; return 'sloop'; }
function sloopsOnly(ships) { var n = shipCount(ships); return n > 0 && n === (ships.sloop || 0); }


function fpower(G, owner, ships) { var p = 0; for (var t in ships) { var s = shipStat(G, owner, t); p += ships[t] * (s.atk * 2.5 + s.hp * 0.6); } return Math.round(p / 4); }
function fleetSpeed(G, fl) {
  var sp = 99; for (var t in fl.ships) if (fl.ships[t] > 0) sp = Math.min(sp, shipStat(G, fl.owner, t).spd);
  if (sp === 99) sp = 0;
  if (fl.owner >= 0) { var F = G.factions[fl.owner]; if (has(F, 'rigging')) sp += 1; if (F.starved) sp = Math.max(1, Math.floor(sp / 2)); }
  return sp;
}
function fleetCargo(G, fl) { var c = 0, raid = false; for (var t in fl.ships) { var s = shipStat(G, fl.owner, t); c += fl.ships[t] * s.cargo; if (s.tr === 'raid') raid = true; } return Math.round(c * (raid ? 1.5 : 1)); }
function newFleet(G, owner, k, ships, mp) { var h = G.hexes[k]; var fl = { id: G.nid++, owner: owner, q: h.q, r: h.r, ships: ships, mp: 0, dest: null, hold: false, auto: false }; fl.mp = mp == null ? fleetSpeed(G, fl) : mp; G.fleets.push(fl); return fl; }
function addShips(G, owner, k, ships, fresh) {
  var fl = fleetAt(G, k, owner);
  if (fl) { for (var t in ships) fl.ships[t] = (fl.ships[t] || 0) + ships[t]; if (!sloopsOnly(fl.ships)) fl.auto = false; return fl; }
  return newFleet(G, owner, k, ships, fresh ? null : 0);
}
function removeFleet(G, fl) { var i = G.fleets.indexOf(fl); if (i >= 0) G.fleets.splice(i, 1); fl.dead = true; }
function mergeAt(G, fl) {
  var k = fkey(fl);
  for (var i = 0; i < G.fleets.length; i++) { var o = G.fleets[i]; if (o !== fl && o.owner === fl.owner && fkey(o) === k) { for (var t in fl.ships) o.ships[t] = (o.ships[t] || 0) + fl.ships[t]; o.mp = Math.min(o.mp, fl.mp); o.hold = false; o.auto = false; if (!o.dest) o.dest = fl.dest; removeFleet(G, fl); return o; } }
  return fl;
}
function split(G, fl, sel) {
  var ships = {}, n = 0, left = 0;
  for (var t in fl.ships) { var take = Math.min(fl.ships[t], sel[t] || 0); if (take > 0) { ships[t] = take; n += take; } left += fl.ships[t] - take; }
  if (!n) return null; if (!left) return fl;
  for (var t2 in ships) { fl.ships[t2] -= ships[t2]; if (!fl.ships[t2]) delete fl.ships[t2]; }
  var nf = newFleet(G, fl.owner, fkey(fl), ships, Math.min(fl.mp, 99)); nf.mp = Math.min(fl.mp, fleetSpeed(G, nf)); return nf;
}

/* ---------- bases, territory, supply, vision ---------- */
function slots(G, k) { return plotsOf(G, k).length; }
function usedSlots(G, k) { return plotsOf(G, k).filter(function (p) { return G.hexes[p].plot; }).length; }
function tier(G, k) {
  var h = G.hexes[k], b = h.base; if (!b) return 0; if (b.kind !== 'colony') return 1;
  var s = 0; for (var id in b.b) s += b.b[id];
  plotsOf(G, k).forEach(function (p) { var pl = G.hexes[p].plot; if (pl) s += pl.lvl; });
  return s >= 9 ? 3 : s >= 4 ? 2 : 1;
}
function baseDef(G, h) {
  var b = h.base; if (!b || b.owner == null) return { atk: 0, hp: 0 };
  var atk = 0, hp = 0;
  if (b.kind === 'colony') { atk = b.cap ? 10 : 4; hp = b.cap ? 90 : 35; var g = b.b.fort || 0; atk += g * 10; hp += g * 55; }
  else if (b.kind === 'station') { atk = 6; hp = 45; }
  return { atk: atk, hp: hp };
}
function recalcTerr(G) {
  var list = [], k;
  for (k in G.hexes) { var h = G.hexes[k]; h.terr = null; if (h.base && h.base.owner != null) list.push(k); }
  list.sort(function (a, b) { return G.hexes[a].base.founded - G.hexes[b].base.founded || (a < b ? -1 : 1); });
  // the whole island belongs to its port, then the coastal waters around it
  list.forEach(function (k2) { var o = G.hexes[k2].base.owner; islandOf(G, k2).land.forEach(function (l) { G.hexes[l].terr = o; }); });
  list.forEach(function (k3) { var o = G.hexes[k3].base.owner; islandOf(G, k3).land.forEach(function (l) { nbrs(l).forEach(function (n) { var x = G.hexes[n]; if (x && x.terr == null && x.type !== 'land') x.terr = o; }); }); });
  for (var key in G.rel) { var p = key.split('-'); G.rel[key].border = bordering(G, +p[0], +p[1]); }
}
function rangeBonus(ships) { return sloopsOnly(ships) ? 3 : 0; }
function supply(G, fid, extra) {
  var R = supplyRange(G.factions[fid]) + (extra || 0), d = {}, q = [];
  for (var k in G.hexes) { var b = G.hexes[k].base; if (b && b.owner === fid) { d[k] = 0; q.push(k); } }
  if (!q.length) { for (var k0 in G.hexes) d[k0] = 0; return d; }
  for (var i = 0; i < q.length; i++) { var u = q[i]; if (d[u] >= R) continue; var n = nbrs(u); for (var j = 0; j < 6; j++) { var v = n[j]; if (!G.hexes[v] || v in d) continue; d[v] = d[u] + 1; q.push(v); } }
  return d;
}
function supplyFor(G, fl) { return supply(G, fl.owner, rangeBonus(fl.ships)); }
function visBonus(F) { return (F.key === 'order' ? 1 : 0) + (has(F, 'spyglass') ? 1 : 0); }
function sight(F, ships) { return (ships.sloop ? 3 : 2) + visBonus(F); }
function vision(G, fid) {
  var F = G.factions[fid], vis = {}, bonus = visBonus(F);
  function mark(k, n) { hexesWithin(G, k, n).forEach(function (x) { vis[x] = 1; }); }
  for (var k in G.hexes) { var b = G.hexes[k].base; if (b && b.owner === fid) { mark(k, (b.kind === 'station' || b.cap ? 3 : 2) + bonus); islandOf(G, k).land.forEach(function (l) { mark(l, 1); }); } }
  G.fleets.forEach(function (fl) { if (fl.owner === fid) mark(fkey(fl), sight(F, fl.ships)); });
  for (var v in vis) F.explored[v] = 1;
  return vis;
}
function fleetVisible(G, fid, fl, vis) {
  if (fl.owner === fid) return true; var k = fkey(fl); if (!vis[k]) return false;
  if (G.hexes[k].type !== 'fog' || has(G.factions[fid], 'spyglass')) return true;
  var n = nbrs(k); for (var i = 0; i < 6; i++) { if (fleetAt(G, n[i], fid)) return true; var o = G.hexes[n[i]]; if (o && o.base && o.base.owner === fid) return true; }
  return false;
}
function contactCheck(G, fid, vis) {
  var out = [];
  for (var k in vis) { var h = G.hexes[k]; if (h.terr != null && h.terr !== fid && meet(G, fid, h.terr)) out.push(h.terr); }
  G.fleets.forEach(function (fl) { if (fl.owner >= 0 && fl.owner !== fid && vis[fkey(fl)] && meet(G, fid, fl.owner)) out.push(fl.owner); });
  out.forEach(function (o) { log(G, 'diplo', 'First sighting of the ' + FACTIONS[G.factions[o].key].n + '.', null, o); if (G.factions[fid].human) ev(G, { k: 'msg', f: o, line: 'greet', title: 'Sail ho' }); });
  return out;
}

/* ---------- economy ---------- */
function besieged(G, k) { var h = G.hexes[k]; return !!(h.base && h.base.siege && fleetAt(G, k, h.base.siege.by)); }
function plotYield(F, h, id, lvl) {
  var f = fit(h, id);
  if (id === 'sawmill') return (1 + f + (has(F, 'saws') ? 1 : 0)) * lvl;
  if (id === 'mine') return (Math.max(1, f) + (has(F, 'shafts') ? 1 : 0)) * lvl;
  if (id === 'still') return (Math.max(1, f) + (has(F, 'shafts') ? 1 : 0)) * lvl;
  return (2 + f) * lvl;
}
function baseYield(G, k) {
  var h = G.hexes[k], b = h.base, y = { a: 0, c: 0, f: 0, s: 0 };
  if (!b || b.owner == null || besieged(G, k)) return y;
  var F = G.factions[b.owner];
  if (b.kind === 'colony') {
    if (b.cap) { y.a += 3; y.c += 2; y.f += 3; y.s += 2; } else { y.a += 2; y.c += 1; y.f += 1; y.s += 1; }
    plotsOf(G, k).forEach(function (p) { var ph = G.hexes[p], pl = ph.plot; if (pl && pl.lvl > 0) y[BLD[pl.id].res] += plotYield(F, ph, pl.id, pl.lvl); });
  } else if (b.kind === 'station') { y.a += 3; y.c += 2; y.f += 2; y.s += 1; }
  return y;
}
function bldEffect(F, h, id, lvl) {
  var tot = lvl > 1 ? ' a turn in total.' : ' a turn.';
  if (BLD[id].plot) {
    var f = fit(h, id), note = id === 'school' ? '' : f === 2 ? ' Ideal ground.' : f === 1 ? '' : ' Poor ground.';
    return '+' + plotYield(F, h, id, lvl) + ' ' + RESN[BLD[id].res].toLowerCase() + tot + note;
  }
  if (id === 'yard') return lvl === 1 ? 'Builds sloops, brigs and frigates.' : lvl === 2 ? 'Adds galleons.' : 'Adds men-o\'-war. Ships build a turn faster.';
  return 'Shore guns +' + 10 * lvl + ', walls +' + 55 * lvl + '.';
}
function upkeep(G, fid) { var u = 0; G.fleets.forEach(function (fl) { if (fl.owner === fid) for (var t in fl.ships) u += fl.ships[t] * shipStat(G, fid, t).upk; }); return Math.ceil(u); }
/* Pirates lying in a faction's waters skim its trade until someone sinks them. */
function pirateToll(G, fid) { var n = 0; G.fleets.forEach(function (fl) { if (fl.pirate && G.hexes[fkey(fl)].terr === fid) n++; }); return n; }
function income(G, fid) {
  var F = G.factions[fid], t = { a: 0, c: 0, f: 0, s: 0 };
  for (var k in G.hexes) { var b = G.hexes[k].base; if (b && b.owner === fid) { var y = baseYield(G, k); t.a += y.a; t.c += y.c; t.f += y.f; t.s += y.s; } }
  if (F.key === 'comp') { t.a += 2; t.c += 2; t.f += 2; }
  if (F.key === 'order') t.s = Math.floor(t.s * 1.3);
  if (!F.human) { var m = DIFFS[G.diff].mult; t.a = Math.round(t.a * m); t.c = Math.round(t.c * m); t.f = Math.round(t.f * m); t.s = Math.round(t.s * m); }
  t.up = upkeep(G, fid); t.fg = t.f; t.f -= t.up;
  t.toll = pirateToll(G, fid); t.ta = Math.min(Math.max(0, t.a), t.toll * 2); t.tc = Math.min(Math.max(0, t.c), t.toll); t.a -= t.ta; t.c -= t.tc;
  return t;
}
function plotQueued(b, at) { var n = 0; b.queue.forEach(function (it) { if (it.k === 'b' && it.at === at) n++; }); return n; }
function harbourQueued(b, id) { var l = b.b[id] || 0; b.queue.forEach(function (it) { if (it.k === 'b' && !it.at && it.id === id) l++; }); return l; }
function freePlots(G, k) { return plotsOf(G, k).filter(function (p) { return !G.hexes[p].plot; }); }
function bestPlot(G, k, id) {
  var best = null, bs = -99;
  freePlots(G, k).forEach(function (p) { var h = G.hexes[p], other = 0; PLOT_ORDER.forEach(function (o) { if (o !== id) other = Math.max(other, fit(h, o)); }); var s = fit(h, id) * 3 - other; if (s > bs) { bs = s; best = p; } });
  return best;
}
/* Everything a port can start building. With `at`, only what can go on that one land hex. */
function buildOptions(G, k, at) {
  var h = G.hexes[k], b = h.base, out = []; if (!b || b.owner == null || b.kind !== 'colony') return out;
  var F = G.factions[b.owner], full = b.queue.length >= 3, sg = besieged(G, k), ml = maxLvl(F);
  function fin(o) {
    var where = o.at ? G.hexes[o.at] : h;
    o.k = 'b'; o.n = BLD[o.id].n; o.ok = true; o.why = '';
    if (o.lvl > 3) { o.ok = false; o.why = 'Fully built'; o.lvl = 3; o.max = true; out.push(o); return; }
    o.cost = bldCost(F, o.id, o.lvl); o.time = bldTime(F, o.lvl);
    o.eff = o.noland ? BLD[o.id].d : bldEffect(F, where, o.id, o.lvl);
    if (o.lvl > ml) { o.ok = false; o.why = 'Needs ' + TECH.masonry.n; o.tech = true; }
    else if (o.noland) { o.ok = false; o.why = 'No free land on this island'; }
    else if (sg) { o.ok = false; o.why = 'Blockaded'; }
    else if (full) { o.ok = false; o.why = 'Queue full'; }
    else if (!canAfford(F, o.cost)) { o.ok = false; o.why = 'Not enough stores'; o.poor = true; }
    out.push(o);
  }
  if (!at) ['yard', 'fort'].forEach(function (id) { fin({ id: id, lvl: harbourQueued(b, id) + 1, at: null }); });
  var plots = at ? [at] : plotsOf(G, k);
  if (at) { var ph0 = G.hexes[at]; if (!ph0 || ph0.isl !== h.isl || at === k) return out; if (!ph0.plot) PLOT_ORDER.forEach(function (id) { fin({ id: id, lvl: 1, at: at }); }); }
  else PLOT_ORDER.forEach(function (id) { var p = bestPlot(G, k, id); fin({ id: id, lvl: 1, at: p, noland: !p }); });
  plots.forEach(function (p) { var pl = G.hexes[p].plot; if (pl) fin({ id: pl.id, lvl: pl.lvl + plotQueued(b, p) + 1, at: p, up: true }); });
  return out;
}
function shipOptions(G, k) {
  var h = G.hexes[k], b = h.base, out = []; if (!b || b.kind !== 'colony' || b.owner == null) return out;
  var F = G.factions[b.owner], y = b.b.yard || 0, full = b.queue.length >= 3, sg = besieged(G, k);
  SHIP_ORDER.forEach(function (id) {
    var s = SHIPS[id], o = { k: 's', id: id, n: shipName(G, b.owner, id), ok: true, why: '', cost: shipCost(F, id), time: shipTime(F, id, b) };
    if (!y) { o.ok = false; o.why = 'Needs a shipyard'; }
    else if (s.tech && !has(F, s.tech)) { o.ok = false; o.why = 'Needs ' + TECH[s.tech].n; o.locked = true; }
    else if (y < s.yard) { o.ok = false; o.why = 'Needs shipyard level ' + s.yard; }
    else if (sg) { o.ok = false; o.why = 'Blockaded'; }
    else if (full) { o.ok = false; o.why = 'Queue full'; }
    else if (!canAfford(F, o.cost)) { o.ok = false; o.why = 'Not enough stores'; o.poor = true; }
    out.push(o);
  });
  return out;
}
function enqueue(G, k, kind, id, at) {
  var o = null;
  if (kind === 's') shipOptions(G, k).forEach(function (x) { if (x.id === id) o = x; });
  else buildOptions(G, k, at || null).forEach(function (x) { if (!o && x.id === id && (at || !x.up)) o = x; });
  if (!o || !o.ok) return { ok: false, why: o ? o.why : 'Unavailable' };
  var b = G.hexes[k].base, F = G.factions[b.owner];
  pay(F, o.cost);
  if (o.at && !G.hexes[o.at].plot) G.hexes[o.at].plot = { id: id, lvl: 0 };
  b.queue.push({ k: kind, id: id, lvl: o.lvl || 0, at: o.at || null, left: o.time, total: o.time, cost: o.cost });
  return { ok: true, item: o };
}
function tidyPlots(G, k) { var b = G.hexes[k].base; plotsOf(G, k).forEach(function (p) { var pl = G.hexes[p].plot; if (pl && pl.lvl === 0 && !(b && plotQueued(b, p))) G.hexes[p].plot = null; }); }
function cancelQueue(G, k, i) {
  var b = G.hexes[k].base, it = b.queue[i]; if (!it) return false;
  // later upgrades of the same structure depend on this one
  for (var j = b.queue.length - 1; j >= i; j--) { var x = b.queue[j]; if (j === i || (it.k === 'b' && x.k === 'b' && x.id === it.id && x.at === it.at)) { var full = x.left === x.total; gain(G.factions[b.owner], full ? x.cost : { a: Math.floor(x.cost.a / 2), c: Math.floor(x.cost.c / 2), f: Math.floor(x.cost.f / 2) }); b.queue.splice(j, 1); } }
  tidyPlots(G, k);
  return true;
}
function availTech(F) { return TECH_ORDER.filter(function (id) { return !F.tech[id] && TECH[id].req.every(function (r) { return F.tech[r]; }); }); }
function setResearch(G, fid, id) { var F = G.factions[fid]; if (availTech(F).indexOf(id) < 0) return false; F.research = id; return true; }

/* ---------- movement ---------- */
function moveCost(h) { return h.type === 'fog' ? 2 : 1; }
function isGate(G, fid, k) { var b = G.hexes[k].base; return !!(b && b.owner === fid && (b.cap || b.kind === 'station' || (b.b && b.b.yard))); }
function gateList(G, fid) { var o = []; if (!has(G.factions[fid], 'winds')) return o; for (var k in G.hexes) if (isGate(G, fid, k)) o.push(k); return o; }
function hexStance(G, fid, k, idx) {
  var h = G.hexes[k], fls = idx[k] || [];
  for (var i = 0; i < fls.length; i++) { var o = fls[i].owner; if (o === fid) continue; return atWar(G, fid, o) ? 'hostile' : 'blocked'; }
  var b = h.base;
  if (b && b.owner != null && b.owner !== fid) {
    if (!atWar(G, fid, b.owner)) return 'blocked';
    if (b.siege && b.siege.by === fid) return 'free';
    return baseDef(G, h).hp > 0 ? 'hostile' : 'free';
  }
  return 'free';
}
/* Dijkstra from fleet. limit = max cost (Infinity for multi-turn paths). Hostile hexes are terminal. */
function paths(G, fl, limit) {
  var fid = fl.owner, sup = supplyFor(G, fl), idx = fleetIdx(G), gates = gateList(G, fid), s = fkey(fl);
  var best = {}; best[s] = { c: 0, p: null, atk: false };
  var open = [s], done = {};
  while (open.length) {
    var bi = 0; for (var i = 1; i < open.length; i++) if (best[open[i]].c < best[open[bi]].c) bi = i;
    var u = open.splice(bi, 1)[0]; if (done[u]) continue; done[u] = 1;
    if (best[u].atk) continue;
    var list = nbrs(u).map(function (n) { return { k: n, jump: false }; });
    if (gates.length && gates.indexOf(u) >= 0) gates.forEach(function (g) { if (g !== u) list.push({ k: g, jump: true }); });
    for (var j = 0; j < list.length; j++) {
      var v = list[j].k, h = G.hexes[v]; if (!passable(h) || done[v] || !(v in sup)) continue;
      var st = hexStance(G, fid, v, idx); if (st === 'blocked') continue;
      var c = best[u].c + (list[j].jump ? 1 : moveCost(h)); if (c > limit) continue;
      if (!best[v] || c < best[v].c) { best[v] = { c: c, p: u, atk: st === 'hostile', jump: list[j].jump }; open.push(v); }
    }
  }
  delete best[s];
  return best;
}
function reach(G, fl) { return fl.mp > 0 ? paths(G, fl, fl.mp) : {}; }
function pathTo(G, fl, dest) { var b = paths(G, fl, Infinity); if (!b[dest]) return null; var p = [], k = dest; while (k) { p.unshift(k); k = b[k].p === fkey(fl) ? null : b[k].p; } return p; }
function blockReason(G, fl, dest) {
  var h = G.hexes[dest]; if (!h) return '';
  if (h.type === 'reef') return 'Reefs cannot be crossed.';
  if (h.type === 'land' && !h.base) return 'Ships cannot sail over land. Lie alongside to found a port.';
  var sup = supplyFor(G, fl); if (!(dest in sup)) return 'Too far from a friendly harbour. Found a port closer first.';
  var st = hexStance(G, fl.owner, dest, fleetIdx(G)); if (st === 'blocked') return 'You are at peace with them. Declare war first.';
  return 'No passage.';
}
function onEnter(G, fl, k) {
  var h = G.hexes[k], F = fl.owner >= 0 ? G.factions[fl.owner] : null; if (!F) return;
  F.explored[k] = 1;
  if (h.type === 'wreck') {
    h.type = 'sea'; var roll = gint(G, 4), txt;
    if (roll === 0) { var a = 20 + gint(G, 20), c = 10 + gint(G, 12); gain(F, { a: a, c: c }); txt = 'salvaged ' + a + ' timber and ' + c + ' gold'; }
    else if (roll === 1) { F.rp += 25; txt = 'recovered a sea chest of charts worth 25 lore'; }
    else if (roll === 2) { fl.ships.brig = (fl.ships.brig || 0) + 2; fl.auto = false; txt = 'refloated two brigs'; }
    else { var f = 20 + gint(G, 15); gain(F, { f: f }); txt = 'hauled up ' + f + ' rum from the hold'; }
    log(G, 'info', fname(G, fl.owner) + ' searched a wreck and ' + txt + '.', k, fl.owner);
    if (F.human) ev(G, { k: 'find', key: k, txt: 'Your crew ' + txt + '.' });
  }
  if (h.debris && (h.debris.a || h.debris.c)) { gain(F, h.debris); if (F.human) ev(G, { k: 'find', key: k, txt: 'Flotsam hauled aboard: ' + costStr(h.debris) + '.' }); h.debris = null; }
}
function settle(G, fl) {
  fl = mergeAt(G, fl);
  var k = fkey(fl), h = G.hexes[k], b = h.base;
  if (b && b.owner != null && b.owner !== fl.owner && atWar(G, fl.owner, b.owner)) { if (!b.siege || b.siege.by !== fl.owner) { b.siege = { by: fl.owner, prog: 0 }; log(G, 'war', fname(G, fl.owner) + ' blockades ' + h.name + '.', k, fl.owner); } }
  return fl;
}
/* Sail along the path toward fl.dest as far as movement allows. Never starts a battle. */
function advance(G, fl) {
  var res = { moved: 0, fleet: fl, battle: null, arrived: false };
  if (!fl.dest) return res;
  var path = pathTo(G, fl, fl.dest); if (!path) { fl.dest = null; return res; }
  var idx = fleetIdx(G);
  for (var i = 0; i < path.length; i++) {
    var k = path[i], h = G.hexes[k], st = hexStance(G, fl.owner, k, idx);
    var jump = has(G.factions[fl.owner], 'winds') && nbrs(fkey(fl)).indexOf(k) < 0;
    var c = jump ? 1 : moveCost(h);
    if (st === 'hostile') { if (fl.mp >= c && i === path.length - 1) res.battle = k; break; }
    if (fl.mp < c) break;
    fl.q = h.q; fl.r = h.r; fl.mp -= c; res.moved++;
    onEnter(G, fl, k);
  }
  if (fkey(fl) === fl.dest) { fl.dest = null; res.arrived = true; }
  if (res.moved) res.fleet = settle(G, fl);
  return res;
}
function order(G, fl, dest, sel) {
  var part = sel ? split(G, fl, sel) : fl; if (!part) return { ok: false, why: 'No ships chosen.' };
  if (!pathTo(G, part, dest)) { if (part !== fl) mergeAt(G, part); return { ok: false, why: blockReason(G, fl, dest) }; }
  part.dest = dest; part.hold = false; part.auto = false;
  var r = advance(G, part); r.ok = true; r.part = part;
  if (r.battle) part.dest = null;
  return r;
}
/* Send a fleet toward the nearest water from which something new can be seen. */
function exploreTarget(G, fl) {
  var F = G.factions[fl.owner], pb = paths(G, fl, Infinity), vr = sight(F, fl.ships), best = null, bs = 1e9;
  for (var k in pb) {
    if (pb[k].atk || G.hexes[k].base) continue; var c = pb[k].c; if (c - 2 >= bs) continue;
    var w = hexesWithin(G, k, vr), un = 0; for (var i = 0; i < w.length; i++) if (!F.explored[w[i]]) un++;
    if (!un) continue; var s = c - Math.min(un, 12) * 0.16; if (s < bs) { bs = s; best = k; }
  }
  return best;
}
function explore(G, fl) {
  var res = { ok: true, moved: 0, fleet: fl, done: false };
  for (var n = 0; n < 4 && fl.mp > 0 && !fl.dead; n++) {
    vision(G, fl.owner);
    var t = exploreTarget(G, fl); if (!t) { fl.auto = false; fl.dest = null; res.done = true; break; }
    fl.auto = true; fl.hold = false; fl.dest = t;
    var r = advance(G, fl); res.moved += r.moved; fl = res.fleet = r.fleet; fl.auto = true;
    if (!r.moved) break;
  }
  if (!res.done) fl.dest = null;
  return res;
}

/* ---------- combat ---------- */
function groups(G, owner, ships, turret) {
  var gs = [];
  SHIP_ORDER.forEach(function (t) { if (ships[t] > 0) { var s = shipStat(G, owner, t); gs.push({ t: t, n: ships[t], n0: ships[t], atk: s.atk, hp: s.hp, tr: s.tr, dmg: 0 }); } });
  if (turret && turret.hp > 0) gs.push({ t: 'turret', n: 1, n0: 1, atk: turret.atk, hp: turret.hp, tr: null, dmg: 0 });
  return gs;
}
function alive(gs) { var n = 0; gs.forEach(function (g) { n += g.n; }); return n; }
/* One volley from S into T. With `only`, just the groups carrying that trait fire, at 60% weight. */
function volley(S, T, rnd, only) {
  var out = T.map(function () { return 0; }), tot = 0;
  T.forEach(function (t) { tot += t.n * t.hp; }); if (!tot) return out;
  S.forEach(function (g) {
    if (!g.n || (only && g.tr !== only)) return; var base = g.n * g.atk * (0.85 + 0.3 * rnd()) * (only ? 0.6 : 1);
    T.forEach(function (t, i) { if (!t.n) return; var d = base * (t.n * t.hp / tot); if (t.tr === 'evade') d *= 0.5; else if (t.tr === 'armor') d *= 0.75; if (g.tr === 'siege' && t.t === 'turret') d *= 1.5; out[i] += d; });
  });
  return out;
}
function applyDmg(T, dm) { T.forEach(function (g, i) { if (!g.n) return; g.dmg += dm[i]; var k = Math.min(g.n, Math.floor(g.dmg / g.hp + 1e-9)); g.n -= k; g.dmg -= k * g.hp; if (!g.n) g.dmg = 0; }); }
function snap(gs) { var o = {}; gs.forEach(function (g) { o[g.t] = g.n; }); return o; }
function simBattle(G, att, def, rnd) {
  var A = groups(G, att.owner, att.ships, null), D = groups(G, def.owner, def.ships, def.turret), rounds = [];
  var pa = volley(A, D, rnd, 'first'), pd = volley(D, A, rnd, 'first'); applyDmg(D, pa); applyDmg(A, pd);
  for (var r = 0; r < 5; r++) {
    if (!alive(A) || !alive(D)) { rounds.push({ a: snap(A), d: snap(D) }); break; }
    var da = volley(A, D, rnd), dd = volley(D, A, rnd);
    applyDmg(D, da); applyDmg(A, dd);
    rounds.push({ a: snap(A), d: snap(D) });
    if (!alive(A) || !alive(D)) break;
  }
  var res = { win: alive(D) === 0 && alive(A) > 0, wiped: alive(A) === 0, rounds: rounds, a0: {}, d0: {}, aLeft: {}, dLeft: {}, turret: !!(def.turret && def.turret.hp > 0), turretLeft: 0 };
  A.forEach(function (g) { res.a0[g.t] = g.n0; if (g.n) res.aLeft[g.t] = g.n; });
  D.forEach(function (g) { if (g.t === 'turret') { res.turretLeft = g.n; return; } res.d0[g.t] = g.n0; if (g.n) res.dLeft[g.t] = g.n; });
  return res;
}
function defenders(G, fl, dest) {
  var h = G.hexes[dest], fls = fleetsAt(G, dest).filter(function (o) { return o.owner !== fl.owner && atWar(G, fl.owner, o.owner); });
  var df = fls[0] || null, b = h.base, turret = null, owner = df ? df.owner : (b ? b.owner : NEUTRAL);
  if (b && b.owner != null && b.owner !== fl.owner && atWar(G, fl.owner, b.owner) && !(b.siege && b.siege.by === fl.owner) && (!df || df.owner === b.owner)) { turret = baseDef(G, h); owner = b.owner; }
  return { fleet: df, owner: owner, ships: df ? df.ships : {}, turret: turret };
}
function lossValue(a0, left) { var v = 0; for (var t in a0) { if (t === 'turret') continue; v += (a0[t] - (left[t] || 0)) * (SHIPS[t].a + SHIPS[t].c); } return v; }
function totalValue(s) { var v = 0; for (var t in s) v += s[t] * (SHIPS[t].a + SHIPS[t].c); return v; }
function forecast(G, fl, dest, n) {
  var d = defenders(G, fl, dest), rnd = rngFrom((G.rs ^ (fl.id * 7919) ^ (G.turn * 104729)) >>> 0), w = 0, al = 0, dl = 0, N = n || 40;
  var av = totalValue(fl.ships) || 1, dv = totalValue(d.ships) || 1;
  for (var i = 0; i < N; i++) { var r = simBattle(G, { owner: fl.owner, ships: fl.ships }, d, rnd); if (r.win) w++; al += lossValue(r.a0, r.aLeft) / av; dl += lossValue(r.d0, r.dLeft) / dv; }
  var p = w / N;
  return { p: p, aLoss: al / N, dLoss: dl / N, def: d, label: p >= 0.9 ? 'Decisive' : p >= 0.7 ? 'Favourable' : p >= 0.45 ? 'Even' : p >= 0.2 ? 'Risky' : 'Hopeless' };
}
function placeName(h) { return h.name || (h.type === 'fog' ? 'the fog bank' : h.type === 'wreck' ? 'the wreck' : 'sea'); }
function attack(G, fl, dest) {
  // sail up to the hex before the target
  var path = pathTo(G, fl, dest); if (!path) return { ok: false, why: 'No passage.' };
  for (var i = 0; i < path.length - 1; i++) { var h0 = G.hexes[path[i]], c0 = nbrs(fkey(fl)).indexOf(path[i]) < 0 ? 1 : moveCost(h0); if (fl.mp < c0) return { ok: false, why: 'Too far.' }; fl.q = h0.q; fl.r = h0.r; fl.mp -= c0; onEnter(G, fl, path[i]); }
  var from = fkey(fl), h = G.hexes[dest], d = defenders(G, fl, dest);
  var res = simBattle(G, { owner: fl.owner, ships: fl.ships }, d, function () { return grnd(G); });
  res.ok = true; res.key = dest; res.from = from; res.att = fl.owner; res.def = d.owner; res.pirate = !!(d.fleet && d.fleet.pirate); res.name = placeName(h);
  var lost = lossValue(res.a0, res.aLeft) + lossValue(res.d0, res.dLeft), boarders = (res.win ? res.aLeft.brig : res.dLeft.brig) ? 1.5 : 1, salv = { a: Math.round(lost * 0.2 * boarders), c: Math.round(lost * 0.1 * boarders) };
  res.salv = salv;
  var AF = G.factions[fl.owner], DF = d.owner >= 0 ? G.factions[d.owner] : null;
  AF.st.fought++; if (DF) DF.st.fought++;
  AF.st.lost += shipCount(res.a0) - shipCount(res.aLeft); AF.st.kills += shipCount(res.d0) - shipCount(res.dLeft);
  if (DF) { DF.st.lost += shipCount(res.d0) - shipCount(res.dLeft); DF.st.kills += shipCount(res.a0) - shipCount(res.aLeft); }
  if (d.fleet) { d.fleet.ships = res.dLeft; if (!shipCount(res.dLeft)) removeFleet(G, d.fleet); }
  fl.ships = res.aLeft; fl.mp = 0; fl.dest = null; fl.auto = false;
  if (res.wiped) removeFleet(G, fl);
  if (res.win) {
    AF.st.won++; gain(AF, salv); res.salvTo = fl.owner;
    if (d.fleet && d.fleet.pirate) { res.bounty = 10 + 6 * shipCount(res.d0); AF.res.c += res.bounty; }
    fl.q = h.q; fl.r = h.r; onEnter(G, fl, dest); res.fleet = settle(G, fl);
    log(G, 'battle', fname(G, fl.owner) + ' won a battle at ' + res.name + (d.owner >= 0 ? ' against ' + fname(G, d.owner) : '') + '.', dest, fl.owner);
  } else {
    if (DF) { DF.st.won++; gain(DF, salv); res.salvTo = d.owner; } else if (!d.fleet || !shipCount(res.dLeft)) { h.debris = salv; }
    if (!res.wiped) settle(G, fl);
    log(G, 'battle', fname(G, fl.owner) + (res.wiped ? ' lost a fleet at ' : ' was beaten off at ') + res.name + '.', dest, fl.owner);
  }
  if (AF.human || (DF && DF.human)) ev(G, { k: 'battle', res: res });
  return res;
}

/* ---------- founding, claiming, plunder, capture ---------- */
function clearWorks(G, k) { var b = G.hexes[k].base; b.queue = []; tidyPlots(G, k); }
/* A harbour that stands empty (abandoned port or free port) is claimed by the fleet lying in it. */
function canClaim(G, fl) {
  var k = fkey(fl), h = G.hexes[k], b = h.base, F = G.factions[fl.owner];
  if (!b || b.owner != null) return { ok: false, why: '' };
  var kind = b.kind === 'station' ? 'station' : 'resettle', cost = claimCost(G, F, kind), o = { ok: true, kind: kind, cost: cost, why: '', n: KIND_N[b.kind] };
  if (h.terr != null && h.terr !== fl.owner) { o.ok = false; o.why = 'Inside ' + fname(G, h.terr) + ' waters'; }
  else if (!canAfford(F, cost)) { o.ok = false; o.why = 'Not enough stores'; o.poor = true; }
  return o;
}
function claim(G, fl) {
  var c = canClaim(G, fl); if (!c.ok) return c;
  var k = fkey(fl), h = G.hexes[k], F = G.factions[fl.owner];
  pay(F, c.cost);
  h.base.owner = fl.owner; h.base.founded = G.turn; h.base.siege = null; h.base.cap = false; clearWorks(G, k);
  if (F.capital == null && h.base.kind === 'colony') { F.capital = k; h.base.cap = true; }
  F.st.claimed++;
  recalcTerr(G);
  log(G, 'claim', fname(G, fl.owner) + ' raised its flag over ' + h.name + '.', k, fl.owner);
  return c;
}
/* An empty island is settled from the water: a fleet alongside founds a port on the chosen land hex. */
function siteKind(G, k) { return islandOf(G, k).land.length === 1 ? 'islet' : 'port'; }
function canFound(G, fid, k) {
  var h = G.hexes[k]; if (!h || h.type !== 'land') return { ok: false, why: '' };
  var isl = G.isl[h.isl]; if (isl.port) return { ok: false, why: '' };
  var F = G.factions[fid], kind = siteKind(G, k), o = { ok: true, kind: kind, cost: claimCost(G, F, kind), why: '', n: 'Port' };
  var water = false, near = null;
  nbrs(k).forEach(function (n) { var x = G.hexes[n]; if (!x) return; if (isWater(x)) water = true; if (!near && passable(x)) near = fleetAt(G, n, fid); });
  if (!water) { o.ok = false; o.why = 'No anchorage on this shore'; o.dry = true; }
  else if (h.terr != null && h.terr !== fid) { o.ok = false; o.why = 'Inside ' + fname(G, h.terr) + ' waters'; }
  else if (!near) { o.ok = false; o.why = 'Bring a fleet alongside'; o.far = true; }
  else if (!canAfford(F, o.cost)) { o.ok = false; o.why = 'Not enough stores'; o.poor = true; }
  return o;
}
function found(G, fid, k) {
  var c = canFound(G, fid, k); if (!c.ok) return c;
  var h = G.hexes[k], isl = G.isl[h.isl], F = G.factions[fid];
  pay(F, c.cost);
  var first = F.capital == null;
  if (first) { isl.name = FACTIONS[F.key].cap; F.capital = k; }
  isl.port = k; h.name = isl.name; h.plot = null;
  h.base = { kind: 'colony', owner: fid, lvl: 1, b: {}, queue: [], founded: G.turn, raidCd: 0, siege: null, cap: first };
  F.st.claimed++;
  recalcTerr(G);
  log(G, 'claim', first ? fname(G, fid) + ' made landfall and founded ' + isl.name + '.' : fname(G, fid) + ' founded a port on ' + isl.name + '.', k, fid);
  return c;
}
function canRaid(G, fl) {
  var h = G.hexes[fkey(fl)], b = h.base;
  if (!b || b.owner == null || b.owner === fl.owner || !atWar(G, fl.owner, b.owner)) return { ok: false, why: '' };
  if (b.raidCd > 0) return { ok: false, why: 'Warehouses are bare for ' + b.raidCd + ' more turns' };
  if (fl.raided === G.turn) return { ok: false, why: 'Already plundered this turn' };
  return { ok: true };
}
function raid(G, fl) {
  var c = canRaid(G, fl); if (!c.ok) return c;
  var h = G.hexes[fkey(fl)], b = h.base, V = G.factions[b.owner], F = G.factions[fl.owner], cap = fleetCargo(G, fl), frac = F.key === 'breth' ? 0.3 : 0.2, loot = { a: 0, c: 0, f: 0 };
  RES.forEach(function (r) { var want = Math.floor(V.res[r] * frac), take = Math.min(want, cap); cap -= take; loot[r] = take; V.res[r] -= take; F.res[r] += take; });
  b.raidCd = 4; fl.raided = G.turn;
  addMod(G, fl.owner, b.owner, 'Plunder', -12, 20);
  log(G, 'war', fname(G, fl.owner) + ' plundered ' + h.name + ' for ' + costStr(loot) + '.', fkey(fl), fl.owner);
  if (V.human) ev(G, { k: 'find', key: fkey(fl), bad: true, txt: fname(G, fl.owner) + ' plundered ' + h.name + ' and took ' + costStr(loot) + '.' });
  else if (F.human && grnd(G) < 0.5) ev(G, { k: 'msg', f: b.owner, line: 'raided', title: 'Plunder taken' });
  return { ok: true, loot: loot };
}
function eliminate(G, fid, by) {
  var F = G.factions[fid]; if (!F.alive) return;
  F.alive = false; F.diedT = G.turn;
  G.fleets.filter(function (fl) { return fl.owner === fid; }).forEach(function (fl) { removeFleet(G, fl); });
  for (var k in G.hexes) {
    var b = G.hexes[k].base; if (!b) continue;
    if (b.siege && b.siege.by === fid) b.siege = null;
    if (b.owner === fid) { b.owner = null; b.siege = null; b.cap = false; clearWorks(G, k); }
  }
  for (var key in G.rel) { var p = key.split('-'); if (+p[0] === fid || +p[1] === fid) G.rel[key].war = false; }
  recalcTerr(G);
  log(G, 'war', 'The ' + FACTIONS[F.key].n + ' has fallen to ' + fname(G, by) + '.', null, by);
  ev(G, { k: 'msg', f: fid, line: 'lose', title: 'The ' + FACTIONS[F.key].n + ' has fallen', by: by });
}
function capture(G, k, by) {
  var h = G.hexes[k], b = h.base, old = b.owner, wasCap = b.cap;
  b.owner = by; b.siege = null; b.cap = false; b.founded = G.turn; b.raidCd = 3; clearWorks(G, k);
  if (b.kind === 'colony') {
    for (var id in b.b) b.b[id] = Math.max(1, b.b[id] - 1);
    plotsOf(G, k).forEach(function (p) { var pl = G.hexes[p].plot; if (pl) pl.lvl = Math.max(1, pl.lvl - 1); });
  }
  G.factions[by].st.captured++;
  addMod(G, by, old, 'Took our harbours', -15, 30);
  log(G, 'war', fname(G, by) + ' captured ' + h.name + ' from ' + fname(G, old) + '.', k, by);
  if (G.factions[old].human || G.factions[by].human) ev(G, { k: 'capture', key: k, by: by, from: old, cap: wasCap });
  recalcTerr(G);
  if (wasCap) eliminate(G, old, by);
}
function siegeNeed(b) { return b.cap ? 4 : b.kind === 'colony' ? 2 : 1; }

/* ---------- victory ---------- */
function islandsHeld(G) { var by = {}; G.isl.forEach(function (isl) { var o = islandOwner(G, isl); if (o != null) by[o] = (by[o] || 0) + 1; }); return { total: G.isl.length, by: by, need: Math.ceil(G.isl.length * HEG_SHARE) }; }
function checkOver(G) {
  if (G.over) return G.over;
  var H = G.factions[0], aliveN = G.factions.filter(function (F) { return F.alive; });
  var sh = islandsHeld(G);
  if (!H.alive) G.over = { win: false, reason: H.capital ? 'Your home port has fallen.' : 'Your ships were lost before you made landfall.', winner: null };
  else if (aliveN.length === 1) G.over = { win: true, reason: 'Every rival capital has struck its colours.', winner: 0 };
  else {
    var lead = null; for (var f in sh.by) if (sh.by[f] >= sh.need) lead = +f;
    if (lead == null) { if (G.heg) { log(G, 'info', 'The bid for mastery of the seas by ' + fname(G, G.heg.f) + ' has foundered.', null, G.heg.f); G.heg = null; } }
    else if (!G.heg || G.heg.f !== lead) { G.heg = { f: lead, t: G.turn }; log(G, 'war', fname(G, lead) + ' holds ' + sh.by[lead] + ' of ' + sh.total + ' islands. Mastery of the seas in ' + HEG_TURNS + ' turns.', null, lead); ev(G, { k: 'heg', f: lead }); }
    else if (G.turn - G.heg.t >= HEG_TURNS) G.over = lead === 0 ? { win: true, reason: 'You have held ' + sh.by[lead] + ' of ' + sh.total + ' islands long enough. These seas sail under your flag.', winner: 0 } : { win: false, reason: 'The ' + FACTIONS[G.factions[lead].key].n + ' holds ' + sh.by[lead] + ' of ' + sh.total + ' islands and rules the seas.', winner: lead };
  }
  if (G.over) { G.over.turn = G.turn; ev(G, { k: 'over' }); }
  return G.over;
}

/* ---------- round processing ---------- */
function completeItem(G, k, it) {
  var h = G.hexes[k], b = h.base, F = G.factions[b.owner];
  if (it.k === 'b') {
    var lvl;
    if (it.at) { var ph = G.hexes[it.at]; if (!ph.plot) ph.plot = { id: it.id, lvl: 0 }; lvl = ++ph.plot.lvl; }
    else lvl = b.b[it.id] = (b.b[it.id] || 0) + 1;
    log(G, 'build', h.name + ' completed ' + BLD[it.id].n + ' ' + lvl + '.', it.at || k, b.owner);
  } else { var s = {}; s[it.id] = 1; addShips(G, b.owner, k, s, true); F.st.built++; log(G, 'build', h.name + ' launched a ' + shipName(G, b.owner, it.id) + '.', k, b.owner); }
}
function researchTick(G, F, s) {
  F.rp += s;
  if (!F.research && !F.human) aiResearch(G, F);
  var guard = 0;
  while (F.research && F.rp >= TECH[F.research].cost && guard++ < 5) {
    var id = F.research; F.rp -= TECH[id].cost; F.tech[id] = 1; F.research = null;
    log(G, 'tech', fname(G, F.id) + ' mastered ' + TECH[id].n + '.', null, F.id);
    if (F.human) ev(G, { k: 'tech', id: id }); else aiResearch(G, F);
  }
  if (!F.research && availTech(F).length === 0) F.rp = 0;
}
function endRound(G) {
  var k, h, b;
  G.factions.forEach(function (F) { if (F.alive && F.capital == null && !G.fleets.some(function (fl) { return fl.owner === F.id; })) eliminate(G, F.id, NEUTRAL); });
  G.factions.forEach(function (F) {
    if (!F.alive) return;
    var inc = income(G, F.id);
    F.res.a += inc.a; F.res.c += inc.c; F.res.f += inc.f;
    if (F.res.a < 0) F.res.a = 0; if (F.res.c < 0) F.res.c = 0;
    if (F.res.f < 0) { F.res.f = 0; if (!F.starved && F.human) log(G, 'loss', 'The rum has run dry. Your crews sail at half speed.', null, F.id); F.starved = true; } else F.starved = false;
    researchTick(G, F, inc.s);
  });
  for (k in G.hexes) {
    h = G.hexes[k]; b = h.base; if (!b) continue;
    if (b.raidCd > 0) b.raidCd--;
    if (b.owner == null) continue;
    if (b.siege) {
      var bf = fleetAt(G, k, b.siege.by);
      if (!bf || !atWar(G, b.siege.by, b.owner)) b.siege = null;
      else if (!fleetAt(G, k, b.owner)) { b.siege.prog++; if (b.siege.prog >= siegeNeed(b)) { capture(G, k, b.siege.by); continue; } }
    }
    if (b.queue.length && !besieged(G, k)) { var it = b.queue[0]; it.left--; if (it.left <= 0) { b.queue.shift(); completeItem(G, k, it); } }
  }
  for (var key in G.rel) { var r = G.rel[key]; r.mods = r.mods.filter(function (m) { return --m.ttl > 0; }); if (r.war) r.warT++; if (r.truce > 0) r.truce--; }
  G.turn++;
  G.fleets.forEach(function (fl) { fl.mp = fleetSpeed(G, fl); });
  checkOver(G);
  if (!G.over) {
    var H = G.factions[0];
    if (H.human) {
      var vis = vision(G, 0);
      // lookouts wake anchored and exploring fleets when an enemy comes close
      G.fleets.forEach(function (fl) { if (fl.owner === 0 && (fl.hold || fl.auto)) { hexesWithin(G, fkey(fl), 2).forEach(function (x) { fleetsAt(G, x).forEach(function (o) { if (o.owner !== 0 && (o.owner !== NEUTRAL || o.pirate) && atWar(G, 0, o.owner) && fleetVisible(G, 0, o, vis)) { fl.hold = false; if (fl.auto) { fl.auto = false; fl.dest = null; } } }); }); } });
      G.fleets.filter(function (fl) { return fl.owner === 0 && fl.auto; }).forEach(function (fl) { if (fl.dead) return; var r = explore(G, fl); if (r.done) ev(G, { k: 'find', key: fkey(r.fleet), txt: 'Nothing left to chart within reach. Your explorers await orders.' }); });
      G.fleets.filter(function (fl) { return fl.owner === 0 && fl.dest && !fl.auto; }).forEach(function (fl) { if (fl.dead) return; var r = advance(G, fl); if (r.battle || (!r.moved && !r.arrived)) r.fleet.dest = null; });
      vis = vision(G, 0); contactCheck(G, 0, vis);
    }
  }
}
/* ---------- roaming pirates ----------
   Like barbarians: they belong to no flag, appear off the waters of a faction at peace, and are always a weaker fleet than that faction can put to sea.
   They never attack. They drift into its waters and skim its trade, and pay a bounty in gold when sunk. */
function piratesTurn(G) {
  var rnd = function () { return grnd(G); }, busy = fleetIdx(G);
  G.fleets.filter(function (fl) { return fl.pirate; }).forEach(function (fl) {
    var prey = G.factions[fl.prey], here = fkey(fl);
    if (!prey || !prey.alive) { removeFleet(G, fl); return; }
    if (G.hexes[here].terr === fl.prey && rnd() < 0.7) return;
    // two steps over open water toward the prey's waters, never onto a fleet or into a harbour
    var seen = {}, q = [here], goal = null; seen[here] = null;
    for (var i = 0; i < q.length && !goal; i++) { var u = q[i]; if (u !== here && G.hexes[u].terr === fl.prey) { goal = u; break; } nbrs(u).forEach(function (n) { var h = G.hexes[n]; if (!h || n in seen || !isWater(h) || h.base || (busy[n] && n !== here)) return; seen[n] = u; q.push(n); }); }
    var path = []; for (var k = goal; k && k !== here; k = seen[k]) path.unshift(k);
    if (!goal) { var opt = nbrs(here).filter(function (n) { var h = G.hexes[n]; return h && isWater(h) && !h.base && !busy[n]; }); if (opt.length) path = [opt[Math.floor(rnd() * opt.length)]]; }
    var to = path[Math.min(1, path.length - 1)]; if (!to) return;
    delete busy[here]; fl.q = G.hexes[to].q; fl.r = G.hexes[to].r; busy[to] = [fl];
    if (G.hexes[to].terr === fl.prey && G.hexes[here].terr !== fl.prey) { log(G, 'loss', 'Pirates are raiding the waters of ' + fname(G, fl.prey) + '.', to, fl.prey); if (prey.human) ev(G, { k: 'find', key: to, bad: true, txt: 'Pirates are raiding your waters. Sink them for a bounty.' }); }
  });
  if (G.turn < 8) return;
  G.factions.forEach(function (F) {
    if (!F.alive || F.capital == null || warsOf(G, F.id).length || rnd() > 0.14) return;
    if (G.fleets.some(function (fl) { return fl.pirate && fl.prey === F.id; })) return;
    // always the weaker side: under half the strength of the prey's best fleet
    var best = 0; G.fleets.forEach(function (fl) { if (fl.owner === F.id) best = Math.max(best, fpower(G, F.id, fl.ships)); }); if (best < 5) return;
    var aim = best * 0.45, ships = { sloop: 1 }, guard = 0;
    while (fpower(G, NEUTRAL, ships) < aim - 2 && guard++ < 6) { var t = aim > 26 && !ships.frigate ? 'frigate' : 'brig'; ships[t] = (ships[t] || 0) + 1; if (fpower(G, NEUTRAL, ships) > aim) { ships[t]--; if (!ships[t]) delete ships[t]; break; } }
    var cap = G.hexes[F.capital], cand = []; for (var k in G.hexes) { var h = G.hexes[k], d = hdist(h, cap); if (h.type === 'sea' && h.terr == null && d >= 4 && d <= 7 && !busy[k]) cand.push(k); }
    if (!cand.length) return;
    var at = cand[Math.floor(rnd() * cand.length)], pf = newFleet(G, NEUTRAL, at, ships, 0); pf.pirate = true; pf.prey = F.id; busy[at] = [pf];
  });
}
function endTurn(G) {
  if (G.over) return;
  for (var i = 0; i < G.factions.length; i++) { var F = G.factions[i]; if (F.alive && !F.human) { aiTurn(G, F); if (checkOver(G)) break; } }
  if (!G.over) piratesTurn(G);
  if (!G.over) endRound(G);
}
function idleList(G) {
  var F = G.factions[0], out = [];
  if (F.capital != null && !F.research && availTech(F).length) out.push({ k: 'research' });
  for (var k in G.hexes) { var b = G.hexes[k].base; if (b && b.owner === 0 && b.kind === 'colony' && !b.queue.length && !besieged(G, k)) { var any = buildOptions(G, k).concat(shipOptions(G, k)).some(function (o) { return o.ok; }); if (any) out.push({ k: 'base', key: k }); } }
  G.fleets.forEach(function (fl) { if (fl.owner !== 0 || fl.mp <= 0 || fl.hold || fl.dest || fl.auto) return; var h = G.hexes[fkey(fl)]; if (h.base && h.base.siege && h.base.siege.by === 0) return; out.push({ k: 'fleet', key: fkey(fl) }); });
  return out;
}

/* ---------- AI ---------- */
function aiResearch(G, F) {
  var av = availTech(F); if (!av.length) return;
  var P = FACTIONS[F.key].pers, best = null, bs = -1;
  av.forEach(function (id) { var t = TECH[id], w = [1 + P.tech * 0.6, 0.7 + P.aggr, 0.8 + P.expand * 0.7][t.br] * (1 + grnd(G)) / Math.sqrt(t.cost); if (warsOf(G, F.id).length && t.br === 1) w *= 1.5; if (w > bs) { bs = w; best = id; } });
  F.research = best;
}
function aiDiplomacy(G, F, P) {
  var wars = warsOf(G, F.id), minWar = DIFFS[G.diff].war, mine = strength(G, F.id);
  G.factions.forEach(function (O) {
    if (!O.alive || O.id === F.id) return; var r = rel(G, F.id, O.id);
    if (!r.war) {
      if (G.turn < minWar || r.truce > 0 || wars.length) return;
      if (!F.met[O.id] && !r.border) return;
      var host = P.aggr * 22 - attitude(G, F.id, O.id) * 0.6 + (r.border ? 12 : 0) + (mine / strength(G, O.id) - 1) * 30 + (G.turn > 70 ? 10 : 0);
      if (host > 28 && grnd(G) < 0.12 + P.aggr * 0.1) {
        if (O.human && (!r.warned || G.turn - r.warned > 30)) { r.warned = G.turn; ev(G, { k: 'msg', f: F.id, line: 'threat', title: 'A warning', txt: 'They may declare war within a few turns. A gift could cool tempers. So could a stronger fleet.' }); return; }
        if (O.human && G.turn - r.warned < 3) return;
        declareWar(G, F.id, O.id); wars.push(O.id);
      }
    } else if (r.warT > 12) {
      var theirs = strength(G, O.id);
      if ((mine < theirs * 0.7 || r.warT > 30) && grnd(G) < 0.2) { if (O.human) { if (!r.offered || G.turn - r.offered > 8) { r.offered = G.turn; ev(G, { k: 'offer', f: F.id }); } } else if (strength(G, O.id) < mine * 1.6 || r.warT > 30) makePeace(G, F.id, O.id); }
    }
  });
}
function quickOdds(G, fl, dest) { return forecast(G, fl, dest, 8).p; }
function baseValue(G, k) { var b = G.hexes[k].base; if (!b) return 2; if (b.kind === 'colony') { var s = 0; for (var id in b.b) s += b.b[id]; plotsOf(G, k).forEach(function (p) { var pl = G.hexes[p].plot; if (pl) s += pl.lvl; }); return (b.cap ? 14 : 8) + s; } return 7; }
function soonAfford(F, inc, cst) { return canAfford(F, cst) || (F.res.a + inc.a * 6 >= cst.a && F.res.c + inc.c * 6 >= cst.c && F.res.f + Math.max(0, inc.f) * 6 >= cst.f); }
/* The land hex of a free island to put the port on, given a fleet lying at `from`. Grassland first: it loses least. */
function aiSite(G, fid, isl, from) {
  var best = null, bs = -1, adj = nbrs(from);
  isl.land.forEach(function (l) { if (adj.indexOf(l) < 0) return; var h = G.hexes[l]; if (h.terr != null && h.terr !== fid) return; var s = { grass: 3, cane: 1, wood: 1, hill: 0 }[h.ter] + (h.v % 10) / 20; if (s > bs) { bs = s; best = l; } });
  return best;
}
function aiPickTarget(G, F, P, fl, taken, ctx) {
  var fid = F.id, here = fkey(fl), scoutOnly = sloopsOnly(fl.ships), best = null, bs = -1e9;
  var hh = G.hexes[here];
  if (ctx.threat && !scoutOnly && hdist(hh, G.hexes[F.capital]) <= 5 && ctx.threatPow > fpower(G, fid, fl.ships) * 0.8) {
    var tk = ctx.threatKey, od = quickOdds(G, fl, tk), cb = G.hexes[F.capital].base;
    var desperate = tk === F.capital && cb.siege && cb.siege.prog >= siegeNeed(cb) - 2;
    if ((od >= 0.55 || (desperate && od > 0.1)) && paths(G, fl, Infinity)[tk]) return { k: tk, type: 'atk', force: true };
    return here === F.capital ? null : { k: F.capital, type: 'home' };
  }
  var pb = paths(G, fl, Infinity), k;
  for (k in pb) {
    var h = G.hexes[k], d = pb[k].c, s = -1e9, type = null, b = h.base;
    if (pb[k].atk) {
      if (scoutOnly) continue;
      var p = quickOdds(G, fl, k); if (p < 0.62) continue;
      var val = b ? baseValue(G, k) : 3; if (b && b.owner == null) val = 8;
      if (ctx.nearHome[k]) val += 6;
      s = val * (0.5 + P.aggr) - d * 0.8 + p * 3; type = 'atk';
    } else if (b && b.owner != null && b.owner !== fid) { s = baseValue(G, k) * (0.5 + P.aggr) - d * 0.8; type = 'siege'; }
    else if (b && b.owner == null && !taken[k] && (h.terr == null || h.terr === fid)) {
      var kind = b.kind === 'station' ? 'station' : 'resettle', v = kind === 'station' ? 8 : 11 + slots(G, k);
      if (soonAfford(F, ctx.inc, claimCost(G, F, kind))) { s = v * (0.6 + P.expand) - d * 0.7; type = 'claim'; }
    } else if (h.type === 'wreck') { s = 5 + (scoutOnly ? 3 : 0) - d * 0.6; type = 'explore'; }
    if (type && s > bs) { bs = s; best = { k: k, type: type }; }
  }
  // free islands: sail to the nearest water alongside
  G.isl.forEach(function (isl) {
    if (!ctx.ready || isl.port || taken['i' + isl.id]) return;
    var bk = null, bc = 1e9;
    isl.land.forEach(function (l) { var lh = G.hexes[l]; if (lh.terr != null && lh.terr !== fid) return; nbrs(l).forEach(function (n) { if (pb[n] && !pb[n].atk && pb[n].c < bc && !G.hexes[n].base) { bc = pb[n].c; bk = n; } }); });
    if (!bk) return;
    var kind = isl.land.length === 1 ? 'islet' : 'port';
    if (!soonAfford(F, ctx.inc, claimCost(G, F, kind))) return;
    var s2 = (6.5 + isl.land.length * 1.6) * (0.6 + P.expand) - bc * 0.7;
    if (s2 > bs) { bs = s2; best = { k: bk, type: 'found', isl: isl.id, kind: kind }; }
  });
  if (best && bs > -3) return best;
  // gather at the capital
  if (here !== F.capital && pb[F.capital] && !scoutOnly) return { k: F.capital, type: 'home' };
  return null;
}
function aiFleets(G, F, P) {
  var fid = F.id, taken = {}, cap = G.hexes[F.capital];
  // no second port until the first can build ships
  var ready = false; for (var bk in G.hexes) { var bb = G.hexes[bk].base; if (bb && bb.owner === fid && bb.b && bb.b.yard) ready = true; }
  F.ai.reserve = 0;
  var mine = G.fleets.filter(function (fl) { return fl.owner === fid; }).sort(function (a, b) { return fpower(G, fid, b.ships) - fpower(G, fid, a.ships); });
  for (var i = 0; i < mine.length; i++) {
    var fl = mine[i];
    for (var step = 0; step < 3 && !fl.dead; step++) {
      var here = fkey(fl), wait = false;
      var cc = canClaim(G, fl);
      if (cc.kind) { if (cc.ok) claim(G, fl); else if (cc.poor) { F.ai.reserve = Math.max(F.ai.reserve, cc.cost.a); taken[here] = 1; break; } }
      // found a port on any free island alongside
      nbrs(here).forEach(function (n) {
        var lh = G.hexes[n]; if (wait || !ready || !lh || lh.type !== 'land') return; var isl = G.isl[lh.isl]; if (isl.port) return;
        var site = aiSite(G, fid, isl, here); if (!site) return;
        var fc = canFound(G, fid, site);
        if (fc.ok) found(G, fid, site); else if (fc.poor) { F.ai.reserve = Math.max(F.ai.reserve, fc.cost.a); taken['i' + isl.id] = 1; wait = true; }
      });
      if (wait) break;
      if (canRaid(G, fl).ok) raid(G, fl);
      if (fl.mp <= 0) break;
      var hb = G.hexes[here].base; if (hb && hb.siege && hb.siege.by === fid) break;
      var ctx = { ready: ready, inc: income(G, fid), nearHome: {}, threat: false, threatPow: 0, threatKey: null };
      // threats near home
      G.fleets.forEach(function (o) { if (o.owner === fid || !atWar(G, fid, o.owner) || (o.owner === NEUTRAL && !o.pirate)) return; var ok = fkey(o); if (G.hexes[ok].terr === fid) ctx.nearHome[ok] = 1; if (hdist(cap, G.hexes[ok]) <= 3) { var pw = fpower(G, o.owner, o.ships); if (pw > ctx.threatPow) { ctx.threat = true; ctx.threatPow = pw; ctx.threatKey = ok; } } });
      var tgt = aiPickTarget(G, F, P, fl, taken, ctx);
      if (!tgt) break;
      taken[tgt.type === 'found' ? 'i' + tgt.isl : tgt.k] = 1;
      if (tgt.type === 'found') F.ai.reserve = Math.max(F.ai.reserve, claimCost(G, F, tgt.kind).a);
      var r = reach(G, fl);
      if (r[tgt.k] && r[tgt.k].atk) { attack(G, fl, tgt.k); break; }
      var force = tgt.force;
      var res = order(G, fl, tgt.k); if (!res.ok) break;
      fl = res.fleet; fl.dest = null;
      if (res.battle) { if (force || quickOdds(G, fl, res.battle) >= 0.6) attack(G, fl, res.battle); break; }
      if (fkey(fl) === here) break;
    }
  }
}
function aiShipType(G, F, bk, wars) {
  var ok = shipOptions(G, bk).filter(function (o) { return o.ok && o.id !== 'sloop'; });
  if (!ok.length) return null;
  var counts = {}; G.fleets.forEach(function (fl) { if (wars.indexOf(fl.owner) >= 0) for (var t in fl.ships) counts[t] = (counts[t] || 0) + fl.ships[t]; });
  var main = null, mx = 0; for (var t in counts) if (counts[t] > mx && t !== 'sloop') { mx = counts[t]; main = t; }
  var best = null, bs = -1;
  ok.forEach(function (o) { var w = { brig: 2, frigate: 3, galleon: 4.5, manowar: 7 }[o.id] * (0.6 + grnd(G)); if (main === 'galleon' && o.id === 'frigate') w *= 1.3; if (w > bs) { bs = w; best = o.id; } });
  return best;
}
function aiEconomy(G, F, P) {
  var fid = F.id, wars = warsOf(G, fid), inc = income(G, fid), mil = milPower(G, fid), reserve = F.ai.reserve || 0;
  var want = (8 + G.turn * 0.9) * (0.55 + P.aggr * 0.55) * (wars.length ? 1.6 : 1);
  var bases = [], anyYard = false, scouts = 0, k;
  for (k in G.hexes) { var b0 = G.hexes[k].base; if (b0 && b0.owner === fid && b0.kind === 'colony') { bases.push(k); if (b0.b.yard) anyYard = true; } }
  G.fleets.forEach(function (fl) { if (fl.owner === fid) scouts += fl.ships.sloop || 0; });
  bases.sort(function (a, b2) { return (G.hexes[b2].base.cap ? 1 : 0) - (G.hexes[a].base.cap ? 1 : 0); });
  var needTech = 'Needs ' + TECH.masonry.n;
  bases.forEach(function (k2) {
    var h = G.hexes[k2], b = h.base; if (b.queue.length || besieged(G, k2)) return;
    var opts = [];
    if (b.b.yard) {
      if (scouts < 1 + (P.expand > 0.6 ? 1 : 0) && G.turn < 40) opts.push({ k: 's', id: 'sloop', w: 6.5 });
      if (mil < want || inc.a > 25) { var st = aiShipType(G, F, k2, wars); if (st && inc.f - shipStat(G, fid, st).upk > -1) opts.push({ k: 's', id: st, w: 3 + 6 * Math.max(0, (want - mil) / want) + (wars.length ? 2 : 0) }); }
    }
    var need = { sawmill: 5.2 - inc.a * 0.22, mine: 4.3 - inc.c * 0.3, still: 4.2 - inc.f * 0.5, school: 2.6 + P.tech * 2 - inc.s * 0.3, yard: !anyYard ? 9 : (b.b.yard === 1 && has(F, 'greathulls') ? 4.5 : b.b.yard === 2 && has(F, 'firstrate') ? 5 : b.b.yard ? -5 : (b.cap ? 3 : inc.a > 22 ? 3.2 : 0.5)), fort: P.def * 2.2 + (wars.length ? 3.5 : 0) - (b.cap ? 0 : 1.5) - (G.turn < 20 ? 3 : 0) };
    buildOptions(G, k2).forEach(function (o) { if (o.max || o.noland || o.why === needTech) return; opts.push({ k: 'b', id: o.id, at: o.at, w: need[o.id] - (o.lvl - 1) * 1.3 + (o.at ? (fit(G.hexes[o.at], o.id) - 1) * 0.9 : 0), o: o }); });
    opts.sort(function (x, y) { return y.w - x.w; });
    for (var i = 0; i < opts.length; i++) {
      var op = opts[i]; if (op.w <= 0) break; if (op.used) continue;
      var c = op.k === 's' ? shipCost(F, op.id) : op.o.cost;
      if (canAfford(F, c, op.k === 's' && (wars.length || mil < want * 0.5) ? 0 : reserve)) { var r = enqueue(G, k2, op.k, op.id, op.at); if (r.ok) { if (op.k === 's') mil += 3; else op.used = true; inc = income(G, fid); } if (F.res.a > 90 && b.queue.length < 2 && !op.again) { op.again = true; if (op.k === 's') i--; continue; } break; }
      if (i === 0 && opts[1] && op.w - opts[1].w > 2.5) break; // save up for what matters
    }
  });
}
/* Before anything else an AI must make landfall: its home island if that is still free, otherwise the best free island it can reach. */
function aiLandfall(G, F) {
  var fid = F.id, fl = G.fleets.filter(function (x) { return x.owner === fid; })[0]; if (!fl) return;
  for (var step = 0; step < 2; step++) {
    var here = fkey(fl), done = false;
    nbrs(here).forEach(function (n) { var lh = G.hexes[n]; if (done || !lh || lh.type !== 'land') return; var isl = G.isl[lh.isl]; if (isl.port || (isl.land.length < 3 && G.turn < 6)) return; var site = nbrs(here).indexOf(F.start) >= 0 && G.hexes[F.start].isl === isl.id ? F.start : aiSite(G, fid, isl, here); if (site && found(G, fid, site).ok) done = true; });
    if (done || fl.mp <= 0) return;
    var pb = paths(G, fl, Infinity), best = null, bs = -1e9;
    G.isl.forEach(function (isl) {
      if (isl.port) return; var home = G.hexes[F.start].isl === isl.id;
      isl.land.forEach(function (l) { nbrs(l).forEach(function (n) { var p = pb[n]; if (!p || p.atk || G.hexes[n].base) return; var s = (home ? 40 : isl.land.length * 4) - p.c * 2 + (home && l === F.start ? 3 : 0); if (s > bs) { bs = s; best = n; } }); });
    });
    if (!best) return;
    var r = order(G, fl, best); if (!r.ok || !r.moved) return; fl = r.fleet; fl.dest = null;
  }
}
function aiTurn(G, F) {
  var P = FACTIONS[F.key].pers;
  if (F.capital == null) { aiLandfall(G, F); if (F.capital == null) return; }
  if (!F.research) aiResearch(G, F);
  aiDiplomacy(G, F, P);
  aiFleets(G, F, P);
  aiEconomy(G, F, P);
}

/* ---------- map generation ---------- */
var NAME_A = ['Marrow', 'Gallows', 'Saffron', 'Cutlass', 'Mango', 'Lantern', 'Tamarind', 'Barnacle', 'Driftwood', 'Parrot', 'Coral', 'Ember', 'Hollow', 'Kraken', 'Molasses', 'Nutmeg', 'Osprey', 'Pelican', 'Quarter', 'Siren', 'Thistle', 'Umber', 'Widow', 'Yarrow', 'Zephyr', 'Anchor', 'Cinder', 'Dagger', 'Fathom', 'Gull', 'Heron', 'Indigo', 'Jasper', 'Lagoon', 'Mizzen', 'Needle', 'Oyster', 'Pepper', 'Ransom', 'Sable', 'Tallow', 'Hook', 'Monsoon', 'Cobalt', 'Ginger', 'Tortoise', 'Crow', 'Salt'];
var NAME_B = { 1: ['Rock', 'Key', 'Skerry'], 2: ['Cay', 'Key', 'Islet'], 3: ['Cay', 'Isle', 'Key'], 4: ['Isle', 'Island'], 5: ['Island', 'Isle'], 6: ['Island'] };
var STATION_N = ['Port Solace', 'Saltmarket', 'Smuggler\'s Rest', 'Lantern Quay', 'Freehaven'];
var TERS = ['wood', 'wood', 'wood', 'hill', 'hill', 'cane', 'cane', 'grass'];
function genMap(G, R, nF) {
  var rnd = function () { return grnd(G); }, hexes = {}, keys = [], q, r, k;
  for (q = -R; q <= R; q++) for (r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) { k = K(q, r); hexes[k] = { q: q, r: r, type: 'sea', name: null, terr: null, base: null, debris: null, v: 0 }; keys.push(k); }
  G.hexes = hexes; G.R = R; G.isl = [];
  var centre = hexes['0,0'], used = {};
  function px(h) { return { x: h.q + h.r / 2, y: h.r * 0.866 }; }
  function shuffled(arr) { var a = arr.slice(); for (var j = a.length - 1; j > 0; j--) { var m = Math.floor(rnd() * (j + 1)), t = a[j]; a[j] = a[m]; a[m] = t; } return a; }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  // distance from k to the nearest land of any island other than `own` (capped)
  function landGap(k0, own, cap) { var w = hexesWithin(G, k0, cap), best = cap + 1, h0 = hexes[k0]; for (var i = 0; i < w.length; i++) { var x = hexes[w[i]]; if (x.type === 'land' && x.isl !== own) best = Math.min(best, hdist(h0, x)); } return best; }
  function okLand(k0, own, gap) { var h0 = hexes[k0]; return !!h0 && h0.type === 'sea' && hdist(h0, centre) <= R - 1 && landGap(k0, own, gap) > gap; }
  function mkIsland(seed, size, name, gap) {
    if (!okLand(seed, -1, gap)) return null;
    var id = G.isl.length, isl = { id: id, name: name, land: [], port: null };
    function add(k0) { var h0 = hexes[k0]; h0.type = 'land'; h0.isl = id; h0.ter = pick(TERS); h0.plot = null; isl.land.push(k0); }
    add(seed);
    for (var tries = 0; isl.land.length < size && tries < 40; tries++) {
      var from = pick(isl.land), cand = shuffled(nbrs(from)).filter(function (x) { return okLand(x, id, gap); });
      // never wall in the seed: its harbour needs open water
      cand = cand.filter(function (x) { return nbrs(seed).indexOf(x) < 0 || nbrs(seed).filter(function (y) { return hexes[y] && hexes[y].type === 'land'; }).length < 4; });
      if (cand.length) add(cand[0]);
    }
    if (!name) { var nm, g = 0; do { nm = pick(NAME_A) + ' ' + pick(NAME_B[Math.min(6, isl.land.length)]); } while (used[nm.split(' ')[0]] && g++ < 80); used[nm.split(' ')[0]] = 1; isl.name = nm; }
    G.isl.push(isl); return isl;
  }
  // capitals: evenly round a ring, each on a five-hex island with one plot of every kind of ground
  var ring = keys.filter(function (x) { return hdist(hexes[x], centre) === R - 2; });
  var a0 = rnd() * Math.PI * 2, caps = [], home = {};
  for (var i = 0; i < nF; i++) {
    var ang = a0 + i * Math.PI * 2 / nF, tx = Math.cos(ang) * (R - 2), ty = Math.sin(ang) * (R - 2), best = null, bd = 1e9;
    ring.forEach(function (x) { if (caps.indexOf(x) >= 0) return; var p = px(hexes[x]), d = (p.x - tx) * (p.x - tx) + (p.y - ty) * (p.y - ty); if (d < bd) { bd = d; best = x; } });
    caps.push(best);
  }
  caps.forEach(function (ck) {
    var isl = mkIsland(ck, 5, null, 2), ters = shuffled(['wood', 'hill', 'cane', 'grass']);
    isl.land.forEach(function (l, n) { hexes[l].ter = n === 0 ? 'grass' : ters[(n - 1) % 4]; });
    hexesWithin(G, ck, 3).forEach(function (x) { home[x] = 1; });
  });
  // a free port at the heart of the map, more on larger seas
  var st = mkIsland('0,0', 2, STATION_N[0], 2), stations = [st];
  var extra = R >= 13 ? 2 : R >= 11 ? 1 : 0;
  shuffled(keys).forEach(function (x) { if (extra <= 0) return; var d = hdist(hexes[x], centre); if (d < Math.floor(R / 2) || d > R - 4) return; if (stations.some(function (s) { return kdist(G, s.land[0], x) < Math.floor(R * 0.7); })) return; if (landGap(x, -1, 4) <= 4) return; var s2 = mkIsland(x, 1 + Math.floor(rnd() * 2), STATION_N[stations.length], 2); if (s2) { stations.push(s2); extra--; } });
  // every capital gets a sister island and an islet within a first voyage
  caps.forEach(function (ck) {
    var wd = {}, wq = [ck]; wd[ck] = 0;
    for (var wi = 0; wi < wq.length; wi++) nbrs(wq[wi]).forEach(function (x) { if (isWater(hexes[x]) && !(x in wd)) { wd[x] = wd[wq[wi]] + 1; wq.push(x); } });
    [[3, 3, 4, 3], [1, 3, 5, 9]].forEach(function (spec) {
      var cand = shuffled(keys).filter(function (x) { var d = kdist(G, ck, x); return d >= spec[1] && d <= spec[2] && hdist(hexes[x], centre) <= R - 2 && okLand(x, -1, 2) && nbrs(x).some(function (n) { return wd[n] <= spec[3]; }); });
      cand.sort(function (a, b) { return hdist(hexes[a], centre) - hdist(hexes[b], centre) + (rnd() - 0.5) * 3; });
      for (var n = 0; n < cand.length; n++) if (mkIsland(cand[n], spec[0], null, 2)) break;
    });
  });
  // the rest: spread wide, each new island as far from the others as the dice allow
  var total = keys.length, target = Math.round(total / 20), SIZE_W = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5, 6];
  for (var guard = 0; G.isl.length < target && guard < 200; guard++) {
    var bestK = null, bestD = -1;
    for (var n2 = 0; n2 < 14; n2++) { var c = pick(keys); if (!okLand(c, -1, 2)) continue; var d2 = Math.min(6, landGap(c, -1, 6)) + rnd() * 0.5; if (d2 > bestD) { bestD = d2; bestK = c; } }
    if (bestK) mkIsland(bestK, pick(SIZE_W), null, 2);
  }
  // reefs in short lines, fog in banks, wrecks scattered
  function openSea(x) { var h0 = hexes[x]; return !!h0 && h0.type === 'sea' && !home[x]; }
  function grow(type, seeds, minN, maxN, line, clear) {
    for (var s = 0; s < seeds; s++) {
      var cand = shuffled(keys).filter(function (x) { return openSea(x) && landGap(x, -1, clear) > clear; }); if (!cand.length) return;
      var cur = cand[0], n = minN + Math.floor(rnd() * (maxN - minN + 1)), dir = Math.floor(rnd() * 6);
      for (var j = 0; j < n && cur; j++) { hexes[cur].type = type; var opts = (line ? [nbrs(cur)[dir]] : shuffled(nbrs(cur))).filter(function (x) { return openSea(x) && landGap(x, -1, clear) > clear; }); cur = opts[0]; }
    }
  }
  grow('reef', Math.round(total * 0.016), 2, 4, true, 1);
  grow('fog', Math.round(total * 0.013), 3, 6, false, 0);
  var nWreck = Math.round(total * 0.04);
  shuffled(keys).forEach(function (x) { if (nWreck > 0 && openSea(x) && !nbrs(x).some(function (o) { return hexes[o] && hexes[o].type === 'wreck'; })) { hexes[x].type = 'wreck'; nWreck--; } });
  // connectivity: open reefs until all water is one sea
  for (var pass = 0; pass < 20; pass++) {
    var start = nbrs(caps[0]).filter(function (x) { return isWater(hexes[x]); })[0], seen = {}, qu = [start]; seen[start] = 1;
    for (var qi = 0; qi < qu.length; qi++) nbrs(qu[qi]).forEach(function (x) { if (isWater(hexes[x]) && !seen[x]) { seen[x] = 1; qu.push(x); } });
    var bad = {}, anyBad = false; keys.forEach(function (x) { if (isWater(hexes[x]) && !seen[x]) { bad[x] = 1; anyBad = true; } }); if (!anyBad) break;
    keys.forEach(function (x) { if (hexes[x].type === 'reef' && nbrs(x).some(function (o) { return bad[o]; })) hexes[x].type = 'sea'; });
  }
  stations.forEach(function (s) { var sk = s.land[0]; s.port = sk; hexes[sk].name = s.name; hexes[sk].base = { kind: 'station', owner: null, lvl: 1, b: {}, queue: [], founded: 0, raidCd: 0, siege: null, cap: false }; });
  keys.forEach(function (x) { hexes[x].v = Math.floor(rnd() * 1000); });
  return caps;
}

function newGame(opts) {
  var size = SIZES[opts.size] || SIZES.s, seed = (opts.seed >>> 0) || 1;
  var G = { v: 1, seed: seed, rs: seed, size: opts.size || 's', diff: opts.diff || 'normal', turn: 1, nid: 1, hexes: {}, isl: [], factions: [], fleets: [], rel: {}, log: [], ev: [], over: null, heg: null, tut: !!opts.tutorial };
  var keys = [opts.faction || 'crown'], rest = FACTION_ORDER.filter(function (x) { return x !== keys[0]; });
  for (var j = rest.length - 1; j > 0; j--) { var m = gint(G, j + 1), t = rest[j]; rest[j] = rest[m]; rest[m] = t; }
  keys = keys.concat(rest.slice(0, size.rivals));
  var caps = genMap(G, size.R, keys.length);
  keys.forEach(function (key, i) {
    var F = { id: i, key: key, human: i === 0 && !opts.allAI, alive: true, res: { a: 80, c: 40, f: 25 }, rp: 0, tech: {}, research: null, capital: null, start: caps[i], explored: {}, met: {}, starved: false, ai: { reserve: 0 }, st: { built: 0, lost: 0, kills: 0, won: 0, fought: 0, claimed: 0, captured: 0 } };
    if (i === 0 && !opts.allAI && G.diff === 'easy') { F.res.a += 30; F.res.c += 15; }
    G.factions.push(F);
    // two ships lying off the island that would make a good home; where to settle is the captain's choice
    var sea = nbrs(caps[i]).filter(function (x) { return isWater(G.hexes[x]); }), out = sea.filter(function (x) { return hdist(G.hexes[x], G.hexes['0,0']) < hdist(G.hexes[caps[i]], G.hexes['0,0']); })[0] || sea[0];
    newFleet(G, i, out, { sloop: 1, brig: 1 });
  });
  for (var a = 0; a < keys.length; a++) for (var b = a + 1; b < keys.length; b++) G.rel[rkey(a, b)] = { war: false, warT: 0, truce: 0, mods: [], border: false, offered: 0 };
  for (var k in G.hexes) { var hx = G.hexes[k]; if (hx.base && hx.base.kind === 'station') newFleet(G, NEUTRAL, k, { brig: 2, frigate: 1 }); }
  recalcTerr(G);
  G.factions.forEach(function (F) { if (!F.human) for (var j2 = 0; j2 < G.factions.length; j2++) if (j2 !== F.id && !G.factions[j2].human) F.met[j2] = 1; });
  if (G.factions[0].human) { var vis = vision(G, 0); contactCheck(G, 0, vis); }
  log(G, 'info', 'Two ships of the ' + FACTIONS[keys[0]].n + ' reach unknown waters.', caps[0], 0);
  return G;
}

HX.NEUTRAL = NEUTRAL; HX.HEG_TURNS = HEG_TURNS; HX.DIRS = DIRS; HX.SIZES = SIZES; HX.DIFFS = DIFFS; HX.RES = RES; HX.RESN = RESN; HX.SHIPS = SHIPS; HX.SHIP_ORDER = SHIP_ORDER; HX.BLD = BLD; HX.BLD_ORDER = BLD_ORDER; HX.PLOT_ORDER = PLOT_ORDER; HX.TER_N = TER_N;
HX.TECH = TECH; HX.TECH_ORDER = TECH_ORDER; HX.BRANCH = BRANCH; HX.FACTIONS = FACTIONS; HX.FACTION_ORDER = FACTION_ORDER; HX.KIND_N = KIND_N; HX.TYPE_N = TYPE_N;
HX.K = K; HX.nbrs = nbrs; HX.hdist = hdist; HX.fkey = fkey; HX.hexesWithin = hexesWithin; HX.rngFrom = rngFrom; HX.isWater = isWater; HX.passable = passable;
HX.islandOf = islandOf; HX.plotsOf = plotsOf; HX.islandOwner = islandOwner; HX.pirateToll = pirateToll; HX.TRAITS = TRAITS; HX.statFor = statFor; HX.shipStat = shipStat; HX.shipName = shipName; HX.shipCost = shipCost; HX.fit = fit; HX.plotYield = plotYield; HX.bestPlot = bestPlot; HX.freePlots = freePlots;
HX.newGame = newGame; HX.endTurn = endTurn; HX.income = income; HX.baseYield = baseYield; HX.buildOptions = buildOptions; HX.shipOptions = shipOptions; HX.enqueue = enqueue; HX.cancelQueue = cancelQueue;
HX.availTech = availTech; HX.setResearch = setResearch; HX.reach = reach; HX.order = order; HX.attack = attack; HX.forecast = forecast; HX.defenders = defenders; HX.blockReason = blockReason; HX.explore = explore;
HX.canClaim = canClaim; HX.claim = claim; HX.canFound = canFound; HX.found = found; HX.canRaid = canRaid; HX.raid = raid; HX.supply = supply; HX.supplyFor = supplyFor; HX.vision = vision; HX.fleetVisible = fleetVisible; HX.contactCheck = contactCheck;
HX.fleetAt = fleetAt; HX.fleetsAt = fleetsAt; HX.fleetSpeed = fleetSpeed; HX.fpower = fpower; HX.shipCount = shipCount; HX.topClass = topClass; HX.sloopsOnly = sloopsOnly; HX.slots = slots; HX.usedSlots = usedSlots; HX.tier = tier; HX.baseDef = baseDef; HX.besieged = besieged; HX.siegeNeed = siegeNeed;
HX.atWar = atWar; HX.rel = rel; HX.attitude = attitude; HX.attReasons = attReasons; HX.declareWar = declareWar; HX.proposePeace = proposePeace; HX.makePeace = makePeace; HX.gift = gift; HX.strength = strength; HX.milPower = milPower;
HX.islandsHeld = islandsHeld; HX.checkOver = checkOver; HX.idleList = idleList; HX.costStr = costStr; HX.canAfford = canAfford; HX.fname = fname; HX.supplyRange = supplyRange; HX.aiTurn = aiTurn; HX.endRound = endRound; HX.isGate = isGate; HX.upkeep = upkeep; HX.maxLvl = maxLvl; HX.claimCost = claimCost; HX.claimMult = claimMult; HX.ownBases = ownBases; HX.mergeAt = mergeAt; HX.split = split; HX.placeName = placeName;

if (typeof module !== 'undefined' && module.exports) module.exports = HX; else root.HX = HX;
})(typeof window !== 'undefined' ? window : globalThis);
