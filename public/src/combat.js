import * as THREE from 'three';
import { raycastWorld } from './physics.js';
import { damageAt } from './guns.js';
import { G } from './ctx.js';

const ray = new THREE.Ray();
const tmp = new THREE.Vector3();

// Nearest of: world geometry, or an enemy hitbox. Friendly fire is off, so teammates are transparent.
export function castBullet(shooter, origin, dir, maxDist) {
  const world = raycastWorld(origin, dir, maxDist);
  let best = world ? world.dist : maxDist;
  let hit = null;
  ray.origin.copy(origin);
  ray.direction.copy(dir);
  for (const e of G.entities) {
    if (!e.alive || e.team === shooter.team) continue;
    for (const hb of e.hitboxes()) {
      if (!ray.intersectBox(hb.box, tmp)) continue;
      const d = tmp.distanceTo(origin);
      if (d < best) { best = d; hit = { entity: e, part: hb.part, point: tmp.clone() }; }
    }
  }
  const end = origin.clone().addScaledVector(dir, best);
  return { hit, world: hit ? null : world, dist: best, end };
}

export function fireBullet(shooter, origin, dir, def, muzzle) {
  const r = castBullet(shooter, origin, dir, 400);
  G.effects.tracer(muzzle ?? origin, r.end);
  if (r.hit) {
    const head = r.hit.part === 'head';
    G.effects.blood(r.hit.point);
    G.match.damage(r.hit.entity, damageAt(def, r.dist) * (head ? def.headMult : 1), shooter, def, head);
  } else if (r.world) {
    G.effects.impact(r.world.point, r.world.normal);
  }
  return r;
}
