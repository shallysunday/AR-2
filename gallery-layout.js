/* ==========================================================
   gallery-layout.js — layout math with connecting corridors
   ========================================================== */

export const DOOR_W = 3.6;
export const WALL_T = 0.3;
export const CORR_L = 5.0;       // Short hallway to connect class rooms
export const PLAYER_R = 0.35;

const SIDE_CYCLE = ['N', 'W', 'N', 'E', 'W', 'E'];
const OFFSETS = [0, -0.15, 0.15];
const r6 = v => Math.round(v * 1e6) / 1e6;

export function rot(v, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [r6(v[0] * c + v[1] * s), r6(-v[0] * s + v[1] * c)];
}
export function worldOf(P, yaw, v) {
  const r = rot(v, yaw);
  return [r6(P[0] + r[0]), r6(P[1] + r[1])];
}
const sub = (a, b) => [r6(a[0] - b[0]), r6(a[1] - b[1])];

export function yawFor(localVec, worldVec) {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const r = rot(localVec, yaw);
    if (Math.abs(r[0] - worldVec[0]) < 1e-5 && Math.abs(r[1] - worldVec[1]) < 1e-5) return yaw;
  }
  throw new Error('yawFor: vectors are not axis-aligned');
}

export function roomDims(count, ci) {
  const S = Math.min(36, Math.ceil(Math.max(16, 6 + (count + 2) * 1.2)));
  return { W: S + (ci % 2 === 1 ? 4 : 0), D: S };
}

export function exitFor(side, W, D, ci) {
  const o = OFFSETS[ci % OFFSETS.length];
  if (side === 'N') return { side: 'N', pos: [r6(o * W), -D / 2], normal: [0, -1] };
  if (side === 'W') return { side: 'W', pos: [-W / 2, r6(o * D)], normal: [-1, 0] };
  return { side: 'E', pos: [W / 2, r6(o * D)], normal: [1, 0] };
}

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

export function planLayout(counts, yaw0 = 0, k = 0) {
  const N = counts.length;
  const dims = counts.map((n, i) => roomDims(n, i));
  const placed = [];
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

  cur.exit = entries[0].exit;
  entries.push(cur);
  placed.push({ box: boxOf(cur), tag: 'post' });

  {
    const E = worldOf(cur.P, cur.yaw, cur.exit.pos);
    const d = rot(cur.exit.normal, cur.yaw);
    const stub = { E, d, len: CORR_L, closed: true };
    const sb = corrBoxOf(E, d, CORR_L);
    for (const p of placed) if (p.tag !== 'post' && boxesOverlap(sb, p.box)) collisions++;
    corridors.push(stub);
    placed.push({ box: sb, tag: 'poststub' });
  }

  {
    const e0 = entries[0];
    const exitLast = entries[N - 1].exit;
    const Q0 = worldOf(e0.P, e0.yaw, [0, e0.D / 2]);
    const a = rot([0, 1], e0.yaw);
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

    const Qp = worldOf(pre.P, pre.yaw, [0, pre.D / 2]);
    const dp = rot([0, 1], pre.yaw);
    const sb = corrBoxOf(Qp, dp, CORR_L);
    for (const p of placed) if (p.tag !== 'pre' && p.tag !== 'precorr' && boxesOverlap(sb, p.box)) collisions++;
    corridors.push({ E: Qp, d: dp, len: CORR_L, closed: true });
    entries.unshift(pre);
  }

  return { entries, corridors, collisions };
}

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

export function walkRects(plan) {
  const rects = [];
  const m = PLAYER_R + 0.15;
  plan.entries.forEach((e, i) => {
    const b = boxOf(e);
    rects.push({ x0: b.x0 + WALL_T + m, x1: b.x1 - WALL_T - m, z0: b.z0 + WALL_T + m, z1: b.z1 - WALL_T - m, entry: i });
  });
  const hw = DOOR_W / 2 - PLAYER_R;
  for (const c of plan.corridors) {
    const a0 = -1.0, a1 = c.closed ? c.len - 0.7 : c.len + 1.0;
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

export function mapPoint(from, to, x, z, yaw) {
  const local = rot([x - from.P[0], z - from.P[1]], -from.yaw);
  const w = rot(local, to.yaw);
  return { x: to.P[0] + w[0], z: to.P[1] + w[1], yaw: yaw + (to.yaw - from.yaw) };
}

function perimPoint(s, hx, hz) {
  const a = 2 * hx, b = 2 * hz;
  if (s < a) return [-hx + s, -hz];
  s -= a; if (s < b) return [hx, -hz + s];
  s -= b; if (s < a) return [hx - s, hz];
  s -= a; return [-hx, hz - s];
}

/** Slot layout generator separating 2D Wall slots from 3D Pedestal slots */
export function artSlots(e, itemsList) {
  const { W, D, exit } = e;
  const doors = [
    { x: 0, z: D / 2 },
    { x: exit.pos[0], z: exit.pos[1] }
  ];

  const isNearDoor = (x, z) => doors.some(d => Math.hypot(x - d.x, z - d.z) < 3.5);

  const wallSlots = [];
  const insetWall = 0.25;

  // South wall
  for (let x = -W / 2 + 3; x <= W / 2 - 3; x += 3.8) {
    if (!isNearDoor(x, D / 2)) wallSlots.push({ x, z: D / 2 - insetWall, yaw: Math.PI });
  }
  // North wall
  for (let x = -W / 2 + 3; x <= W / 2 - 3; x += 3.8) {
    if (!isNearDoor(x, -D / 2)) wallSlots.push({ x, z: -D / 2 + insetWall, yaw: 0 });
  }
  // West wall
  for (let z = -D / 2 + 3; z <= D / 2 - 3; z += 3.8) {
    if (!isNearDoor(-W / 2, z)) wallSlots.push({ x: -W / 2 + insetWall, z, yaw: Math.PI / 2 });
  }
  // East wall
  for (let z = -D / 2 + 3; z <= D / 2 - 3; z += 3.8) {
    if (!isNearDoor(W / 2, z)) wallSlots.push({ x: W / 2 - insetWall, z, yaw: -Math.PI / 2 });
  }

  const pedestalSlots = [];
  for (const inset of [3.2, 6.8]) {
    const hx = W / 2 - inset, hz = D / 2 - inset;
    if (hx < 1.5 || hz < 1.5) break;
    const per = 4 * (hx + hz);
    const count = Math.max(4, Math.floor(per / 4.4));
    const step = per / count;
    for (let i = 0; i < count; i++) {
      const p = perimPoint(i * step + step / 2, hx, hz);
      if (!isNearDoor(p[0], p[1])) {
        pedestalSlots.push({ x: p[0], z: p[1], yaw: Math.atan2(-p[0], -p[1]) });
      }
    }
  }

  const assigned = [];
  let wIdx = 0, pIdx = 0;

  itemsList.forEach(art => {
    const is2D = art.is2D || !art.modelUrl || art.type === '2d';
    if (is2D) {
      const slot = wallSlots[wIdx++] || pedestalSlots[pIdx++] || { x: 0, z: 0, yaw: 0 };
      assigned.push({ ...slot, is2D: true });
    } else {
      const slot = pedestalSlots[pIdx++] || wallSlots[wIdx++] || { x: 0, z: 0, yaw: 0 };
      assigned.push({ ...slot, is2D: false });
    }
  });

  return assigned;
}

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