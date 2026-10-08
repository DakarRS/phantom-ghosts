import * as THREE from 'three';
import { G } from './ctx.js';
import { GUNS } from './shared/guns.js';

const a = new THREE.Vector3(), b = new THREE.Vector3();
const who = (id) => G.roster.get(id) ?? { name: '?', team: 'phantoms' };

// Applies one server event to effects, sound and HUD; `game` handles changes to the local player.
export function handleEvent([type, ...d], game) {
  switch (type) {
    case 'tr': {
      // Start from the shooter's gun as drawn here rather than their server-side eye position.
      const r = G.remotes.get(d[0]);
      G.effects.tracer(r?.alive ? r.muzzle(a) : a.set(d[1], d[2], d[3]), b.set(d[4], d[5], d[6]));
      break;
    }
    case 'im': G.effects.impact(new THREE.Vector3(d[0], d[1], d[2]), new THREE.Vector3(d[3], d[4], d[5])); break;
    case 'bl': G.effects.blood(a.set(d[0], d[1], d[2])); break;
    case 'ex': {
      const p = new THREE.Vector3(d[0], d[1], d[2]);
      const dist = p.distanceTo(G.camera.position);
      G.effects.explosion(p);
      G.audio.explosion(dist);
      G.shake = Math.max(G.shake, 1 - dist / 25);
      break;
    }
    case 'sh': {
      const r = G.remotes.get(d[0]);
      if (!r || !GUNS[d[1]]) break;
      r.shot();
      G.audio.shot(GUNS[d[1]], r.pos.distanceTo(G.camera.position));
      break;
    }
    case 'kf':
      G.hud.killfeed(who(d[0]), who(d[1]), d[2], !!d[3]);
      if (d[1] === G.myId) game.killedWith = d[2];
      break;
    case 'hm': G.hud.hitmarker(!!d[0], !!d[1]); G.audio.hit(!!d[0]); break;
    case 'dmg': G.hud.damageFrom({ x: d[0], z: d[1] }); G.audio.hurt(); break;
    case 'nt':
      G.hud.notify(d[0], d[1]);
      if (d[1] >= 100) G.audio.kill();
      break;
    case 'died': game.died(d[0]); break;
    case 'spawned': game.spawned(new THREE.Vector3(d[0], d[1], d[2]), d[3]); break;
    case 'pos': G.player.pos.set(d[0], d[1], d[2]); G.player.vel.set(0, 0, 0); break;
    case 'end': game.ended(d[0] || null); break;
    case 'reset': game.reset(); break;
  }
}
