import * as THREE from 'three';
import { raycastWorld } from '../../public/src/shared/physics.js';
import { damageAt } from '../../public/src/shared/guns.js';
import { G, r2 } from './ctx.js';

const ray = new THREE.Ray();
const tmp = new THREE.Vector3();

// Nearest of world geometry or an enemy hitbox. Friendly fire is off, so teammates are transparent.
// `rewind` is the server time the shooter was seeing, for lag compensation.
export function castBullet(shooter, origin, dir, maxDist, rewind = null) {
  const world = raycastWorld(origin, dir, maxDist);
  let best = world ? world.dist : maxDist;
  let hit = null;
  ray.origin.copy(origin);
  ray.direction.copy(dir);
  for (const e of G.entities) {
    if (!e.alive || e.team === shooter.team) continue;
    for (const hb of e.hitboxesAt(rewind)) {
      if (!ray.intersectBox(hb.box, tmp)) continue;
      const d = tmp.distanceTo(origin);
      if (d < best) { best = d; hit = { entity: e, part: hb.part, point: tmp.clone() }; }
    }
  }
  return { hit, world: hit ? null : world, dist: best, end: origin.clone().addScaledVector(dir, best) };
}

const v3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];

export function fireBullet(shooter, origin, dir, def, muzzle = origin, rewind = null) {
  const r = castBullet(shooter, origin, dir, 400, rewind);
  G.emit('tr', shooter.id, ...v3(muzzle), ...v3(r.end));
  if (r.hit) {
    const head = r.hit.part === 'head';
    G.emit('bl', ...v3(r.hit.point));
    G.match.damage(r.hit.entity, damageAt(def, r.dist) * (head ? def.headMult : 1), shooter, def, head);
  } else if (r.world) {
    G.emit('im', ...v3(r.world.point), ...v3(r.world.normal));
  }
  return r;
}
