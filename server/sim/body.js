import * as THREE from 'three';
import { G } from './ctx.js';

const HISTORY = 1;
const MAX_REWIND = 0.35;

const makeHitboxes = () => [{ part: 'head', box: new THREE.Box3() }, { part: 'body', box: new THREE.Box3() }];

function fill(hb, x, y, z, eyeH) {
  const top = y + eyeH;
  hb[0].box.min.set(x - 0.17, top - 0.15, z - 0.17);
  hb[0].box.max.set(x + 0.17, top + 0.27, z + 0.17);
  hb[1].box.min.set(x - 0.3, y, z - 0.3);
  hb[1].box.max.set(x + 0.3, top - 0.15, z + 0.3);
  return hb;
}

// Shared by bots and humans. Keeps a short position history so a shot can be checked
// against where the target was on the shooter's screen, not where it is now.
export class Body {
  constructor(id, team, name) {
    this.id = id;
    this.team = team;
    this.name = name;
    this.kills = this.deaths = this.score = 0;
    this.health = 100;
    this.alive = false;
    this.lastHit = -99;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.eyeH = 1.6;
    this.damagers = new Set();
    this.history = [];
    this.hb = makeHitboxes();
    this.hbPast = makeHitboxes();
  }

  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.eyeH, this.pos.z); }
  chest(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.eyeH - 0.4, this.pos.z); }
  hitboxes() { return fill(this.hb, this.pos.x, this.pos.y, this.pos.z, this.eyeH); }

  hitboxesAt(t) {
    const h = this.history;
    if (t == null || !h.length || t >= G.time) return this.hitboxes();
    t = Math.max(t, G.time - MAX_REWIND, h[0].t);
    let a = 0;
    while (a < h.length - 1 && h[a + 1].t <= t) a++;
    const b = Math.min(a + 1, h.length - 1);
    const k = b === a ? 0 : (t - h[a].t) / (h[b].t - h[a].t);
    const lerp = (key) => h[a][key] + (h[b][key] - h[a][key]) * k;
    return fill(this.hbPast, lerp('x'), lerp('y'), lerp('z'), lerp('e'));
  }

  record() {
    this.history.push({ t: G.time, x: this.pos.x, y: this.pos.y, z: this.pos.z, e: this.eyeH });
    while (this.history[0].t < G.time - HISTORY) this.history.shift();
  }
}
