import * as THREE from 'three';
import { G, r2 } from './ctx.js';
import { overlap, lineOfSight } from '../../public/src/shared/physics.js';
import { FRAG } from '../../public/src/shared/guns.js';

const RADIUS = 9, MAX_DMG = 170, FUSE = 3, SIZE = 0.07;
const feet = new THREE.Vector3(), chest = new THREE.Vector3();

function blocked(p) {
  if (p.y < SIZE) return true;
  feet.set(p.x, p.y - SIZE, p.z);
  return !!overlap(feet, SIZE, SIZE * 2);
}

export class Grenades {
  constructor() {
    this.list = [];
    this.nextId = 1;
  }

  throw(owner, pos, vel) {
    this.list.push({ id: this.nextId++, pos, vel, fuse: FUSE, owner });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i];
      g.fuse -= dt;
      if (g.fuse <= 0) {
        this.explode(g);
        this.list.splice(i, 1);
        continue;
      }
      g.vel.y -= 18 * dt;
      for (const a of ['x', 'y', 'z']) {
        const d = g.vel[a] * dt;
        g.pos[a] += d;
        if (!blocked(g.pos)) continue;
        g.pos[a] -= d;
        g.vel[a] *= -0.35;
        if (a === 'y') { g.vel.x *= 0.8; g.vel.z *= 0.8; }
      }
    }
  }

  explode(g) {
    G.emit('ex', r2(g.pos.x), r2(g.pos.y), r2(g.pos.z));
    const from = g.pos.clone().setY(g.pos.y + 0.3);
    for (const e of G.entities) {
      if (!e.alive || (e.team === g.owner.team && e !== g.owner)) continue;
      e.chest(chest);
      const d = chest.distanceTo(g.pos);
      if (d > RADIUS || !lineOfSight(from, chest)) continue;
      G.match.damage(e, MAX_DMG * Math.pow(1 - d / RADIUS, 1.3), g.owner, FRAG, false);
    }
  }

  snapshot() { return this.list.map((g) => [g.id, r2(g.pos.x), r2(g.pos.y), r2(g.pos.z)]); }
}
