import * as THREE from 'three';

// Map geometry as plain data: the browser renders it and the server collides against it.
let out;

function box(x0, y0, z0, x1, y1, z1, color, { collide = true, kind } = {}) {
  out.push({ min: [x0, y0, z0], max: [x1, y1, z1], color, kind, collide });
}

// Wall running along `axis` from a0..a1, thickness t0..t1 on the other axis. Openings: {a, b, lo, hi}, sorted.
function wall(axis, a0, a1, t0, t1, h, openings, color) {
  const seg = (s0, s1, y0, y1) => axis === 'x'
    ? box(s0, y0, t0, s1, y1, t1, color)
    : box(t0, y0, s0, t1, y1, s1, color);
  let cur = a0;
  for (const o of openings) {
    if (o.a > cur) seg(cur, o.a, 0, h);
    if (o.lo > 0) seg(o.a, o.b, 0, o.lo);
    if (o.hi < h) seg(o.a, o.b, o.hi, h);
    cur = o.b;
  }
  if (cur < a1) seg(cur, a1, 0, h);
}

const door = (a, b) => ({ a, b, lo: 0, hi: 2.6 });
const win = (a, b) => ({ a, b, lo: 1.1, hi: 2.3 });
const upWin = (a, b) => ({ a, b, lo: 4.6, hi: 5.9 });

function mainBuilding() {
  const C = 0xb9b2a3, H = 7.2, FLOOR = 0x7d776c;
  wall('x', -9, 9, 6.6, 7, H, [win(-6, -4), upWin(-3.5, -2), door(-1.2, 1.2), upWin(2, 3.5), win(4, 6), upWin(7, 8.2)], C);
  wall('x', -9, 9, -7, -6.6, H, [upWin(-7, -5), win(-1, 1), door(3, 5.4), upWin(6.5, 8)], C);
  wall('z', -6.6, 6.6, -9, -8.6, H, [upWin(-5, -3.5), door(-1.2, 1.2), win(3, 5)], C);
  wall('z', -6.6, 6.6, 8.6, 9, H, [win(-5, -3), door(-1.2, 1.2), upWin(2.5, 4.5)], C);

  // Second floor with a stairwell hole in the south-west corner.
  box(-8.6, 3.4, -4.0, 8.6, 3.7, 6.6, FLOOR);
  box(-3.6, 3.4, -6.6, 8.6, 3.7, -4.0, FLOOR);
  const steps = 11;
  for (let i = 0; i < steps; i++) {
    const x0 = -8.6 + i * (5 / steps);
    box(x0, 0, -6.6, x0 + 5 / steps, (i + 1) * (3.7 / steps), -4.6, 0x8a8273);
  }
  box(-3.6, 3.7, -4.6, -3.4, 4.7, -4.0, 0x555555);
  box(-9.2, H, -7.2, 9.2, H + 0.3, 7.2, 0x8c857a);

  box(4, 0, 2, 5.2, 1.2, 3.2, 0x7a5b34);
  box(5.4, 0, 2.2, 6.4, 1, 3.2, 0x7a5b34);
  box(-6, 3.7, 3, -4.8, 4.9, 4.2, 0x7a5b34);
  box(2, 3.7, -3, 6, 4.6, -2.6, 0x6b6f75);
}

function shed(cx, cz, flip) {
  const C = 0x8f9a8c, H = 3.4, s = flip ? -1 : 1;
  const x0 = cx - 4, x1 = cx + 4, z0 = cz - 4, z1 = cz + 4;
  wall('x', x0, x1, z0, z0 + 0.3, H, flip ? [door(cx - 1, cx + 1)] : [win(cx - 2.5, cx - 0.5)], C);
  wall('x', x0, x1, z1 - 0.3, z1, H, flip ? [win(cx + 0.5, cx + 2.5)] : [door(cx - 1, cx + 1)], C);
  wall('z', z0 + 0.3, z1 - 0.3, x0, x0 + 0.3, H, s > 0 ? [door(cz - 1, cz + 1)] : [win(cz - 1, cz + 1)], C);
  wall('z', z0 + 0.3, z1 - 0.3, x1 - 0.3, x1, H, s > 0 ? [win(cz - 1, cz + 1)] : [door(cz - 1, cz + 1)], C);
  box(x0 - 0.2, H, z0 - 0.2, x1 + 0.2, H + 0.25, z1 + 0.2, 0x5d6660);
  crate(cx + 2 * s, cz - 2);
}

function container(cx, cz, rot, level, color) {
  const [w, d] = rot ? [2.44, 6.1] : [6.1, 2.44];
  const y = level * 2.6;
  box(cx - w / 2, y, cz - d / 2, cx + w / 2, y + 2.6, cz + d / 2, color, { kind: 'rib' });
}

function crate(cx, cz, level = 0, s = 1.2) {
  box(cx - s / 2, level * s, cz - s / 2, cx + s / 2, (level + 1) * s, cz + s / 2, 0x86643a);
}

function barrier(cx, cz, rot) {
  const [w, d] = rot ? [0.5, 3] : [3, 0.5];
  box(cx - w / 2, 0, cz - d / 2, cx + w / 2, 1.05, cz + d / 2, 0xa9a59b);
}

function stairsUp(x0, z0, z1, top, dir) {
  const n = Math.ceil(top / 0.33), depth = 0.45;
  for (let i = 0; i < n; i++) {
    const a = x0 + dir * i * depth, b = a + dir * depth;
    box(Math.min(a, b), 0, z0, Math.max(a, b), (i + 1) * (top / n), z1, 0x6b6f75);
  }
}

function crane(x, z) {
  const Y = 0xd8a520;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    box(x + dx * 1.2 - 0.2, 0, z + dz * 1.2 - 0.2, x + dx * 1.2 + 0.2, 26, z + dz * 1.2 + 0.2, Y);
  }
  for (let y = 3; y < 26; y += 4) box(x - 1.4, y, z - 1.4, x + 1.4, y + 0.2, z + 1.4, Y, { collide: false });
  box(x - 2, 26, z - 2, x + 2, 28.5, z + 2, 0x30353a, { collide: false });
  box(x - 34, 28.5, z - 0.8, x + 6, 29.8, z + 0.8, Y, { collide: false });
  box(x + 6, 27.5, z - 1.5, x + 10, 30, z + 1.5, 0x555b60, { collide: false });
  box(x - 25, 13, z - 0.03, x - 24.94, 28.5, z + 0.03, 0x222222, { collide: false });
  box(x - 25.6, 12, z - 0.6, x - 24.4, 13, z + 0.6, 0x7a5b34, { collide: false });
}

// One half of the cover layout; the other half is mirrored through the origin so both teams get the same map.
const HALF = {
  containers: [
    [-22, -18, 0, 0, 0xa83a2c], [-22, -15.4, 0, 0, 0x2d5b9a], [-22, -18, 0, 1, 0xc8962a],
    [9, -21, 1, 0, 0x3b7a43], [16, -30, 0, 0, 0xc0602a], [-8, -30, 0, 0, 0x6c7178],
    [-38, -26, 1, 0, 0x2d5b9a], [38, -20, 1, 0, 0xa83a2c], [38, -20, 1, 1, 0x3b7a43], [0, -15, 0, 0, 0x7a3b6e],
  ],
  crates: [[-14, -10, 0], [-14, -11.2, 0], [-14, -10, 1], [20, -12, 0], [21.2, -12, 0], [-30, -36, 0], [28, -40, 0], [5, -36, 0], [5, -36, 1], [-44, -10, 0]],
  barriers: [[-4, -24, 0], [4, -25, 0], [-30, -14, 1], [26, -26, 1], [14, -8, 0], [-44, -38, 0], [44, -38, 0], [-12, -40, 0], [12, -40, 0]],
};

function mirrored(list, fn) {
  for (const [x, z, ...rest] of list) { fn(x, z, ...rest); fn(-x, -z, ...rest); }
}

export const BOUND = 51;

export function buildMap() {
  out = [];
  const B = BOUND, W = 0x8b8579;
  box(-B - 1, 0, -B - 1, B + 1, 6, -B, W);
  box(-B - 1, 0, B, B + 1, 6, B + 1, W);
  box(-B - 1, 0, -B, -B, 6, B, W);
  box(B, 0, -B, B + 1, 6, B, W);

  mainBuilding();
  shed(-30, 8, false);
  shed(30, -8, true);
  mirrored(HALF.containers, container);
  mirrored(HALF.crates, crate);
  mirrored(HALF.barriers, barrier);
  stairsUp(-28.65, -16.5, -14.3, 2.6, 1);
  stairsUp(28.65, 14.3, 16.5, 2.6, -1);
  crane(44, 2);

  const boxes = out;
  const spawnRow = (z) => [-30, -20, -10, 0, 10, 20, 30].map((x) => new THREE.Vector3(x, 0, z));
  return {
    boxes,
    colliders: boxes.filter((b) => b.collide).map((b) => new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max))),
    spawns: { phantoms: spawnRow(-46), ghosts: spawnRow(46) },
    pois: [
      [0, 10], [0, -10], [-20, 0], [20, 0], [-30, 8], [30, -8], [-12, -24], [12, 24], [25, 25], [-25, -25],
      [35, -35], [-35, 35], [-40, 0], [40, 0], [0, 25], [0, -25], [-14, 14], [14, -14],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
  };
}
