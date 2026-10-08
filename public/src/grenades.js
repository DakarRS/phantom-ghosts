import * as THREE from 'three';
import { G } from './ctx.js';
import { overlap, lineOfSight } from './physics.js';
import { FRAG } from './guns.js';

const RADIUS = 9, MAX_DMG = 170, FUSE = 3, SIZE = 0.07;
const geo = new THREE.SphereGeometry(SIZE, 8, 6);
const mat = new THREE.MeshLambertMaterial({ color: 0x3b4a2c });
const feet = new THREE.Vector3(), chest = new THREE.Vector3();

function blocked(p) {
  if (p.y < SIZE) return true;
  feet.set(p.x, p.y - SIZE, p.z);
  return !!overlap(feet, SIZE, SIZE * 2);
}

export class Grenades {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  throw(owner) {
    const dir = G.camera.getWorldDirection(new THREE.Vector3());
    const pos = G.camera.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, 0.4);
    const vel = dir.multiplyScalar(18).add(new THREE.Vector3(0, 3, 0)).addScaledVector(owner.vel, 0.5);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.list.push({ mesh, pos, vel, fuse: FUSE, owner });
    G.audio.pin();
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i];
      g.fuse -= dt;
      if (g.fuse <= 0) {
        this.explode(g);
        this.scene.remove(g.mesh);
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
      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += dt * 10;
    }
  }

  explode(g) {
    G.effects.explosion(g.pos);
    const camDist = g.pos.distanceTo(G.camera.position);
    G.audio.explosion(camDist);
    G.shake = Math.max(G.shake ?? 0, 1 - camDist / 25);
    const from = g.pos.clone().setY(g.pos.y + 0.3);
    for (const e of G.entities) {
      if (!e.alive || (e.team === g.owner.team && e !== g.owner)) continue;
      e.chest(chest);
      const d = chest.distanceTo(g.pos);
      if (d > RADIUS || !lineOfSight(from, chest)) continue;
      G.match.damage(e, MAX_DMG * Math.pow(1 - d / RADIUS, 1.3), g.owner, FRAG, false);
    }
  }
}
