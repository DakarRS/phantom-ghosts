import * as THREE from 'three';
import { GUNS, CLASSES } from '../../public/src/shared/guns.js';
import { BOUND } from '../../public/src/shared/map.js';
import { G, r2 } from './ctx.js';
import { Body } from './body.js';

// Generous on purpose: slides peak around 11.5 m/s and packets arrive in bursts.
const MAX_SPEED = 16;
const PRIMARIES = new Set(CLASSES.flatMap((c) => c.guns));

// A connected player. Movement is trusted within sanity limits; everything combat-related is decided here.
export class Human extends Body {
  constructor(id, team, name, client) {
    super(id, team, name);
    this.client = client;
    this.sprint = false;
    this.lastState = 0;
    this.equip('ak12');
  }

  equip(primary) {
    this.loadout = [PRIMARIES.has(primary) ? primary : 'ak12', 'm9', 'knife'];
    this.gunKey = this.loadout[0];
    this.nades = 2;
    this.fireTokens = {};
  }

  spawn(p, yaw) {
    this.pos.copy(p);
    this.yaw = yaw;
    this.pitch = 0;
    this.eyeH = 1.62;
    this.health = 100;
    this.alive = true;
    this.lastHit = -99;
    this.lastState = G.time;
    this.history.length = 0;
    this.damagers.clear();
    G.direct(this, 'spawned', r2(p.x), r2(p.y), r2(p.z), r2(yaw));
  }

  die() { this.alive = false; }

  applyState(m) {
    if (!this.alive || !Array.isArray(m.p)) return;
    const [x, y, z] = m.p;
    if (![x, y, z, m.yaw, m.pitch, m.eh].every(Number.isFinite)) return;
    const dt = Math.max(G.time - this.lastState, 0.05);
    if (Math.hypot(x - this.pos.x, z - this.pos.z) > MAX_SPEED * dt + 1 || Math.abs(y - this.pos.y) > 15 * dt + 2) {
      G.direct(this, 'pos', r2(this.pos.x), r2(this.pos.y), r2(this.pos.z));
      return;
    }
    this.pos.set(Math.max(-BOUND, Math.min(BOUND, x)), Math.max(0, y), Math.max(-BOUND, Math.min(BOUND, z)));
    this.yaw = m.yaw;
    this.pitch = Math.max(-1.6, Math.min(1.6, m.pitch));
    this.eyeH = Math.max(0.8, Math.min(1.62, m.eh));
    this.sprint = !!m.s;
    if (this.loadout.includes(m.w)) this.gunKey = m.w;
    this.lastState = G.time;
  }

  // Token bucket per gun: tolerates network bunching while capping sustained fire at the gun's RPM.
  canFire(key, now) {
    if (!this.alive || !this.loadout.includes(key)) return false;
    const rate = GUNS[key].rpm / 60;
    const burst = Math.min(3, Math.max(1, rate / 5));
    const b = (this.fireTokens[key] ??= { tokens: burst, at: now });
    b.tokens = Math.min(burst, b.tokens + (now - b.at) * rate * 1.25);
    b.at = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  update(dt) {
    if (this.alive && G.time - this.lastHit > 5 && this.health < 100) this.health = Math.min(100, this.health + 25 * dt);
  }
}

export function toVec(a, maxLen = Infinity) {
  if (!Array.isArray(a) || a.length !== 3 || !a.every(Number.isFinite)) return null;
  const v = new THREE.Vector3(...a);
  return v.length() > maxLen ? null : v;
}
