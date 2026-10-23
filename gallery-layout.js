/* ==========================================================
   gallery-layout.js — pure layout maths for the procedural museum.
   No Three.js here, so it is easy to test and reuse.

   Local room frame (before rotation by `yaw`):
     - room interior spans x ∈ [-W/2, W/2], z ∈ [-D/2, D/2]
     - ENTRANCE door: centre of the south wall  (0, +D/2), outward normal (0, +1)
     - EXIT door: north / west / east wall, varied per class, outward normal n
   World frame: x east, z south, y up. Three.js rotation.y = yaw maps
   a local (x, z) to  (x·cos + z·sin,  −x·sin + z·cos).

   The chain is  [pre] R0 R1 … R(N-1) [post]
     - "pre"  is a copy of the last room placed in front of R0's entrance
     - "post" is a copy of the first room placed after R(N-1)'s exit
   Walking into a copy teleports the player to the identical spot in the
   real room, so the loop is seamless in both directions.
   ========================================================== */

export const DOOR_W = 3.2;
export const WALL_T = 0.3;
export const CORR_L = 10.6;     // corridor length between interior wall faces
export const PLAYER_R = 0.35;

const SIDE_CYCLE = ['N', 'W', 'N', 'E', 'W', 'E'];
const OFFSETS = [0.18, -0.18, 0, 0.22, -0.22];
const r6 = v => Math.round(v * 1e6) / 1e6;

/* ---------- vector helpers ---------- */
export function rot(v, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [r6(v[0] * c + v[1] * s), r6(-v[0] * s + v[1] * c)];
}
export function worldOf(P, yaw, v) {
  const r = rot(v, yaw);
  return [r6(P[0] + r[0]), r6(P[1] + r[1])];
}
const sub = (a, b) => [r6(a[0] - b[0]), r6(a[1] - b[1])];

/** Yaw (multiple of 90°) that turns local axis vector `localVec` into `worldVec`. */
export function yawFor(localVec, worldVec) {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const r = rot(localVec, yaw);
    if (Math.abs(r[0] - worldVec[0]) < 1e-5 && Math.abs(r[1] - worldVec[1]) < 1e-5) return yaw;
  }
  throw new Error('yawFor: vectors are not axis-aligned');
}

/* ---------- room design ---------- */
export function roomDims(count, ci) {
  const S = Math.min(40, Math.ceil(Math.max(14, 5.2 + (count + 4) * 1.1)));
  return { W: S + (ci % 3 === 1 ? 4 : 0), D: S };   // every third room is wider (rectangular)
}

export function exitFor(side, W, D, ci) {
  const o = OFFSETS[ci % OFFSETS.length];
  if (side === 'N') return { side: 'N', pos: [r6(o * W), -D / 2], normal: [0, -1] };
  if (side === 'W') return { side: 'W', pos: [-W / 2, r6(o * D)], normal: [-1, 0] };
  return { side: 'E', pos: [W / 2, r6(o * D)], normal: [1, 0] };
}

/* ---------- collision boxes (axis-aligned, include wall thickness) ---------- */
function boxOf(e) {
  const c = Math.abs(Math.cos(e.yaw)), s = Math.abs(Math.sin(e.yaw));
  const hw = (c * e.W + s * e.D) / 2 + WALL_T;
  const hd = (s * e.W + c * e.D) / 2 + WALL_T;
  return { x0: e.P[0] - hw, x1: e.P[0] + hw, z0: e.P[1] - hd, z1: e.P[1] + hd };
}
function corrBoxOf(E, d, len) {
  const hw = DOOR_W / 2 + WALL_T;
  const e2 = [E[0] + d[0] * len, E[1] + d[1] * len];
  const padX = d[0] === 0 ? hw : 0, padZ = d[1] === 0 ? hw : 0;
  return {
    x0: Math.min(E[0], e2[0]) - padX, x1: Math.max(E[0], e2[0]) + padX,
    z0: Math.min(E[1], e2[1]) - padZ, z1: Math.max(E[1], e2[1]) + padZ
  };
}
export function boxesOverlap(a, b, m = 0.8) {
  return a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.z0 < b.z1 + m && a.z1 > b.z0 - m;
}

/* ---------- layout planner ---------- */
export function planLayout(counts, yaw0 = 0, k = 0) {
  const N = counts.length;
  const dims = counts.map((n, i) => roomDims(n, i));
  const placed = [];                      // { box, tag }
  const entries = [];
  const corridors = [];
  let collisions = 0;

  const mk = (role, ci, P, yaw) => ({ role, ci, W: dims[ci].W, D: dims[ci].D, P, yaw, exit: null });
  let cur = mk('main', 0, [0, 0], yaw0);

  for (let i = 0; i < N; i++) {
    entries.push(cur);
    placed.push({ box: boxOf(cur), tag: 'room' + i });

    const nextCi = (i + 1) % N;
    const pref = SIDE_CYCLE[(i + k) % SIDE_CYCLE.length];
    const order = [pref, ...['N', 'W', 'E'].filter(s => s !== pref)];
    let best = null;

    for (const side of order) {
      const exit = exitFor(side, cur.W, cur.D, cur.ci);
      const E = worldOf(cur.P, cur.yaw, exit.pos);
      const d = rot(exit.normal, cur.yaw);
      const nd = dims[nextCi];
      const nyaw = yawFor([0, 1], [-d[0], -d[1]]);
      const Q = [r6(E[0] + d[0] * CORR_L), r6(E[1] + d[1] * CORR_L)];
      const nP = sub(Q, rot([0, nd.D / 2], nyaw));
      const nextRoom = mk(i === N - 1 ? 'post' : 'main', nextCi, nP, nyaw);
      const cb = corrBoxOf(E, d, CORR_L), nb = boxOf(nextRoom);
      let hits = 0;
      for (const p of placed) {
        if (p.tag === 'room' + i) continue;
        if (boxesOverlap(cb, p.box)) hits++;
        if (boxesOverlap(nb, p.box)) hits++;
      }
      if (!best || hits < best.hits) best = { exit, E, d, nextRoom, cb, nb, hits };
      if (hits === 0) break;
    }

    cur.exit = best.exit;
    collisions += best.hits;
    corridors.push({ E: best.E, d: best.d, len: CORR_L, closed: false });
    placed.push({ box: best.cb, tag: 'corr' + i });
    cur = best.nextRoom;
  }

  /* post room: copy of class 0 after the last main room */
  cur.exit = entries[0].exit;
  entries.push(cur);
  placed.push({ box: boxOf(cur), tag: 'post' });

  /* closed stub leaving the post room's exit */
  {
    const E = worldOf(cur.P, cur.yaw, cur.exit.pos);
    const d = rot(cur.exit.normal, cur.yaw);
    const stub = { E, d, len: CORR_L, closed: true };
    const sb = corrBoxOf(E, d, CORR_L);
    for (const p of placed) if (p.tag !== 'post' && boxesOverlap(sb, p.box)) collisions++;
    corridors.push(stub);
    placed.push({ box: sb, tag: 'poststub' });
  }

  /* pre room: copy of the last class in front of R0's entrance */
  {
    const e0 = entries[0];
    const exitLast = entries[N - 1].exit;
    const Q0 = worldOf(e0.P, e0.yaw, [0, e0.D / 2]);
    const a = rot([0, 1], e0.yaw);                       // outward normal of R0's entrance
    const Epre = [r6(Q0[0] + a[0] * CORR_L), r6(Q0[1] + a[1] * CORR_L)];
    const dPre = [-a[0], -a[1]];
    const ypre = yawFor(exitLast.normal, dPre);
    const Ppre = sub(Epre, rot(exitLast.pos, ypre));
    const pre = { role: 'pre', ci: N - 1, W: dims[N - 1].W, D: dims[N - 1].D, P: Ppre, yaw: ypre, exit: exitLast };

    const cb = corrBoxOf(Epre, dPre, CORR_L), pb = boxOf(pre);
    for (const p of placed) {
      if (p.tag === 'room0') continue;
      if (boxesOverlap(cb, p.box)) collisions++;
      if (boxesOverlap(pb, p.box)) collisions++;
    }
    corridors.unshift({ E: Epre, d: dPre, len: CORR_L, closed: false });
    placed.push({ box: cb, tag: 'precorr' }, { box: pb, tag: 'pre' });

    /* closed stub behind the pre room's entrance */
    const Qp = worldOf(pre.P, pre.yaw, [0, pre.D / 2]);
    const dp = rot([0, 1], pre.yaw);
    const sb = corrBoxOf(Qp, dp, CORR_L);
    for (const p of placed) if (p.tag !== 'pre' && p.tag !== 'precorr' && boxesOverlap(sb, p.box)) collisions++;
    corridors.push({ E: Qp, d: dp, len: CORR_L, closed: true });
    entries.unshift(pre);
  }

  return { entries, corridors, collisions };
}

/** Try every start orientation and side pattern, keep the cleanest layout. */
export function bestPlan(counts) {
  let best = null;
  for (const yaw0 of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (let k = 0; k < SIDE_CYCLE.length; k++) {
      const p = planLayout(counts, yaw0, k);
      if (!best || p.collisions < best.collisions) best = p;
      if (best.collisions === 0) return best;
    }
  }
  return best;
}

/* ---------- walkable area ---------- */
export function walkRects(plan) {
  const rects = [];
  const m = PLAYER_R + 0.15;
  plan.entries.forEach((e, i) => {
    const b = boxOf(e);
    rects.push({ x0: b.x0 + WALL_T + m, x1: b.x1 - WALL_T - m, z0: b.z0 + WALL_T + m, z1: b.z1 - WALL_T - m, entry: i });
  });
  const hw = DOOR_W / 2 - PLAYER_R;
  for (const c of plan.corridors) {
    const a0 = -1.0, a1 = c.closed ? c.len - 0.7 : c.len + 1.0;   // overlap 1 m into the rooms
    const s = [c.E[0] + c.d[0] * a0, c.E[1] + c.d[1] * a0];
    const e = [c.E[0] + c.d[0] * a1, c.E[1] + c.d[1] * a1];
    const padX = c.d[0] === 0 ? hw : 0, padZ = c.d[1] === 0 ? hw : 0;
    rects.push({
      x0: Math.min(s[0], e[0]) - padX, x1: Math.max(s[0], e[0]) + padX,
      z0: Math.min(s[1], e[1]) - padZ, z1: Math.max(s[1], e[1]) + padZ
    });
  }
  return rects;
}

/** Re-express a world position + camera yaw from one room copy in another. */
export function mapPoint(from, to, x, z, yaw) {
  const local = rot([x - from.P[0], z - from.P[1]], -from.yaw);
  const w = rot(local, to.yaw);
  return { x: to.P[0] + w[0], z: to.P[1] + w[1], yaw: yaw + (to.yaw - from.yaw) };
}

/* ---------- artwork placement ---------- */
function perimPoint(s, hx, hz) {
  const a = 2 * hx, b = 2 * hz;
  if (s < a) return [-hx + s, -hz];
  s -= a; if (s < b) return [hx, -hz + s];
  s -= b; if (s < a) return [hx - s, hz];
  s -= a; return [-hx, hz - s];
}

/** Pedestal slots (local room coords) with a yaw that faces the room centre. */
export function artSlots(e, n) {
  const { W, D } = e;
  const doors = [[0, D / 2], e.exit.pos];
  const build = spacing => {
    const rings = [];
    for (const inset of [2.6, 6.4, 10.2, 14]) {
      const hx = W / 2 - inset, hz = D / 2 - inset;
      if (hx < 1.2 || hz < 1.2) break;
      const per = 4 * (hx + hz);
      const count = Math.max(4, Math.floor(per / spacing));
      const step = per / count;
      const ring = [];
      for (let i = 0; i < count; i++) {
        const p = perimPoint(i * step + step / 2, hx, hz);
        if (doors.some(d => Math.hypot(p[0] - d[0], p[1] - d[1]) < 3.7)) continue;
        ring.push(p);
      }
      rings.push(ring);
    }
    return rings;
  };
  let rings = build(4.4);
  if (rings.reduce((a, r) => a + r.length, 0) < n) rings = build(3.4);

  const out = [];
  for (const ring of rings) {
    const need = n - out.length;
    if (need <= 0) break;
    if (ring.length <= need) { out.push(...ring); continue; }
    for (let i = 0; i < need; i++) out.push(ring[Math.floor((i * ring.length) / need)]);
  }
  return out.map(p => ({ x: p[0], z: p[1], yaw: Math.atan2(-p[0], -p[1]) }));
}

/* ---------- data grouping ---------- */
export function groupByClass(items) {
  const map = new Map();
  for (const it of items) {
    const code = (it.classCode || 'UNSORTED').toUpperCase();
    if (!map.has(code)) map.set(code, { code, name: it.className || code, items: [] });
    map.get(code).items.push(it);
  }
  const list = [...map.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  list.forEach(c => c.items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
  return list;
}
