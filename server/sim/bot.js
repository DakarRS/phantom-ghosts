import * as THREE from 'three';
import { GUNS, CLASSES } from '../../public/src/shared/guns.js';
import { G } from './ctx.js';
import { Body } from './body.js';
import { think } from './bot-brain.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Bot extends Body {
  constructor(id, team, name) {
    super(id, team, name);
    this.isBot = true;
    this.speed = 0;
    this.grounded = false;
    this.aimErr = new THREE.Vector2();
    this.lastPos = new THREE.Vector3();
    Object.assign(this, {
      target: null, nextScan: 0, reactUntil: 0, strafe: 0, strafeUntil: 0, goal: null, goalUntil: 0,
      stuckCheck: 0, nextShot: 0, burst: 4, mag: 0, reloadT: 0, alertedBy: null, alertT: -99, respawnAt: 0,
    });
    this.pickLoadout();
  }

  get sprint() { return false; }

  pickLoadout() {
    this.gunKey = pick(pick(CLASSES).guns);
    this.def = GUNS[this.gunKey];
    this.mag = this.def.mag;
    this.reloadT = 0;
  }

  spawn(p, yaw) {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.health = 100;
    this.alive = true;
    this.target = this.goal = this.alertedBy = null;
    this.lastPos.copy(p);
    this.stuckCheck = G.time + 1;
    this.pickLoadout();
  }

  onDamaged(attacker) {
    if (attacker === this) return;
    this.alertedBy = attacker;
    this.alertT = G.time;
    this.nextScan = Math.min(this.nextScan, G.time + 0.1);
  }

  die() {
    this.alive = false;
    this.respawnAt = G.time + 4 + Math.random() * 2;
    this.target = null;
  }

  muzzleFlash() { G.emit('sh', this.id, this.gunKey); }

  update(dt) {
    if (this.alive) think(this, dt);
    else if (G.time >= this.respawnAt) G.match.respawn(this);
  }
}
