import * as THREE from 'three';

export const colliders = [];
const EPS = 0.001;
const probe = { min: new THREE.Vector3(), max: new THREE.Vector3() };

export function addCollider(box) { colliders.push(box); }

// Strict overlap so a body resting exactly on a surface doesn't count as intersecting it.
function intersects(a, b) {
  return a.min.x < b.max.x - EPS && a.max.x > b.min.x + EPS &&
         a.min.y < b.max.y - EPS && a.max.y > b.min.y + EPS &&
         a.min.z < b.max.z - EPS && a.max.z > b.min.z + EPS;
}

// Returns the tallest collider overlapping an upright box body whose feet are at pos.
export function overlap(pos, r, h) {
  probe.min.set(pos.x - r, pos.y, pos.z - r);
  probe.max.set(pos.x + r, pos.y + h, pos.z + r);
  let found = null;
  for (const c of colliders) {
    if (intersects(probe, c) && (!found || c.max.y > found.max.y)) found = c;
  }
  return found;
}

// Axis-separated move with step-up, so bodies slide along walls and climb stairs/ledges.
export function moveBody(pos, vel, dt, r, h, step = 0.5) {
  let grounded = false;
  for (const axis of ['x', 'z']) {
    const d = vel[axis] * dt;
    if (d === 0) continue;
    const from = pos[axis];
    pos[axis] += d;
    const c = overlap(pos, r, h);
    if (!c) continue;
    const rise = c.max.y - pos.y;
    if (rise > 0 && rise <= step) {
      const y = pos.y;
      pos.y = c.max.y + EPS;
      if (!overlap(pos, r, h)) continue;
      pos.y = y;
    }
    pos[axis] = d > 0 ? c.min[axis] - r - EPS : c.max[axis] + r + EPS;
    if (overlap(pos, r, h)) pos[axis] = from;
    vel[axis] = 0;
  }

  const dy = vel.y * dt;
  pos.y += dy;
  const c = overlap(pos, r, h);
  if (c) {
    if (dy <= 0) { pos.y = c.max.y + EPS; grounded = true; }
    else pos.y = c.min.y - h - EPS;
    vel.y = 0;
  }
  if (pos.y <= 0) { pos.y = 0; vel.y = 0; grounded = true; }
  return grounded;
}

const ray = new THREE.Ray();
const tmp = new THREE.Vector3();

export function raycastWorld(origin, dir, maxDist) {
  ray.origin.copy(origin);
  ray.direction.copy(dir);
  let best = maxDist;
  let hitBox = null;
  let ground = false;
  for (const c of colliders) {
    if (ray.intersectBox(c, tmp)) {
      const d = tmp.distanceTo(origin);
      if (d < best) { best = d; hitBox = c; }
    }
  }
  if (dir.y < 0 && origin.y >= 0) {
    const t = -origin.y / dir.y;
    if (t < best) { best = t; hitBox = null; ground = true; }
  }
  if (!hitBox && !ground) return null;
  const point = origin.clone().addScaledVector(dir, best);
  const normal = ground ? new THREE.Vector3(0, 1, 0) : boxNormal(hitBox, point);
  return { dist: best, point, normal };
}

function boxNormal(b, p) {
  const faces = [
    [Math.abs(p.x - b.min.x), -1, 0, 0], [Math.abs(p.x - b.max.x), 1, 0, 0],
    [Math.abs(p.y - b.min.y), 0, -1, 0], [Math.abs(p.y - b.max.y), 0, 1, 0],
    [Math.abs(p.z - b.min.z), 0, 0, -1], [Math.abs(p.z - b.max.z), 0, 0, 1],
  ];
  faces.sort((a, b2) => a[0] - b2[0]);
  return new THREE.Vector3(faces[0][1], faces[0][2], faces[0][3]);
}

const losDir = new THREE.Vector3();
export function lineOfSight(a, b) {
  losDir.subVectors(b, a);
  const dist = losDir.length();
  losDir.divideScalar(dist);
  return !raycastWorld(a, losDir, dist - 0.05);
}
