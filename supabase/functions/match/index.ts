// Salt & Steel match server. Holds the authoritative state and resolves each turn once every joined player has ended theirs.
// Deploy: supabase functions deploy match --no-verify-jwt   (after node scripts/sync-engine.js)
import "./engine/core.js";
import "./engine/match.js";
// deno-lint-ignore no-explicit-any
const M = (globalThis as any).MATCH;

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HEAD = { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" };
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, apikey, authorization",
  "access-control-allow-methods": "POST, OPTIONS",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...HEAD, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`database ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : [];
}

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const randomHex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I, easy to read aloud
const roomCode = () => [...crypto.getRandomValues(new Uint8Array(6))].map((b) => ALPHA[b % ALPHA.length]).join("");

async function findMatch(code: string) {
  const rows = await rest(`matches?code=eq.${encodeURIComponent(code)}&select=*`);
  return rows[0] || null;
}
async function seatFor(matchId: string, token: string) {
  const rows = await rest(`match_seats?match_id=eq.${matchId}&token_hash=eq.${await sha256(token)}&select=seat`);
  return rows.length ? rows[0].seat as number : null;
}

// Write the state only if nobody else has written since we read it (optimistic version check).
async function save(row: any, m: any) {
  const status = m.G.over ? "over" : (Object.values(m.seats).every(Boolean) ? "playing" : "waiting");
  const rows = await rest(`matches?id=eq.${row.id}&version=eq.${row.version}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ state: m, version: row.version + 1, status, updated_at: new Date().toISOString() }),
  });
  return rows.length === 1;
}

async function withMatch(code: string, fn: (row: any, m: any) => any) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await findMatch(code);
    if (!row) return reply({ error: "No match with that code." }, 404);
    const out = await fn(row, row.state);
    if (out.save === false) return reply(out.body, out.status || 200);
    if (await save(row, out.m)) return reply(out.body, out.status || 200);
  }
  return reply({ error: "The match was busy. Try again." }, 409);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return reply({ error: "POST only." }, 405);
  let body: any;
  try { body = await req.json(); } catch { return reply({ error: "Bad request." }, 400); }
  try {
    switch (body.action) {
      case "create": {
        const code = roomCode();
        const seed = (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0) || 1;
        const m = M.newMatch({ size: body.size === "m" || body.size === "l" ? body.size : "s", seed, humans: 2, diff: "normal" });
        M.joinSeat(m, 0);
        const token = randomHex(24);
        const [row] = await rest("matches", { method: "POST", headers: { Prefer: "return=representation" },
          body: JSON.stringify({ code, state: m, version: 1, status: "waiting" }) });
        await rest("match_seats", { method: "POST", body: JSON.stringify({ match_id: row.id, seat: 0, token_hash: await sha256(token) }) });
        return reply({ code, seat: 0, token });
      }
      case "join": {
        const token = randomHex(24);
        return await withMatch(body.code, async (row, m) => {
          const seat = Object.keys(m.seats).map(Number).find((s) => !m.seats[s]);
          if (seat === undefined) return { save: false, status: 409, body: { error: "That match is full." } };
          M.joinSeat(m, seat);
          await rest("match_seats", { method: "POST", body: JSON.stringify({ match_id: row.id, seat, token_hash: await sha256(token) }) });
          return { m, body: { seat, token, code: row.code } };
        });
      }
      case "state": {
        const row = await findMatch(body.code);
        if (!row) return reply({ error: "No match with that code." }, 404);
        const seat = await seatFor(row.id, body.token);
        if (seat === null) return reply({ error: "Not in this match." }, 403);
        return reply({ version: row.version, view: M.viewFor(row.state, seat) });
      }
      case "orders": {
        const token = body.token;
        const row0 = await findMatch(body.code);
        if (!row0) return reply({ error: "No match with that code." }, 404);
        const seat = await seatFor(row0.id, token);
        if (seat === null) return reply({ error: "Not in this match." }, 403);
        return await withMatch(body.code, (row, m) => {
          const r = M.submitOrders(m, seat, body.orders || []);
          if (!r.ok) return { save: false, status: 409, body: r };
          return { m, body: { ...r, view: M.viewFor(m, seat) } };
        });
      }
      case "end": {
        const row0 = await findMatch(body.code);
        if (!row0) return reply({ error: "No match with that code." }, 404);
        const seat = await seatFor(row0.id, body.token);
        if (seat === null) return reply({ error: "Not in this match." }, 403);
        return await withMatch(body.code, (row, m) => {
          const r = M.endMyTurn(m, seat);
          if (!r.ok) return { save: false, status: 409, body: r };
          return { m, body: { ...r, view: M.viewFor(m, seat) } };
        });
      }
      default:
        return reply({ error: "Unknown action." }, 400);
    }
  } catch (e) {
    return reply({ error: String((e as Error).message || e) }, 500);
  }
});
