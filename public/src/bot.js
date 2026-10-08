import * as THREE from 'three';
import { buildSoldier, makeLabel } from './models.js';
import { GUNS, CLASSES } from './guns.js';
import { G } from './ctx.js';
import { think } from './bot-brain.js';

export const TEAM_COLORS = { phantoms: 0x3d7be0, ghosts: 0xe08a2e };
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffc860, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
const flashGeo = new THREE.BoxGeometry(0.12, 0.12, 0.2);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Bot {
  constructor(team, name) {
    this.team = team;
    this.name = name;
    this.isPlayer = false;
    this.kills = this.deaths = this.score = 0;
    this.health = 100;
    this.alive = false;
    this.lastHit = -99;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.speed = 0;
    this.grounded = false;
    this.aimErr = new THREE.Vector2();
    this.lastPos = new THREE.Vector3();
    Object.assign(this, {
      target: null, nextScan: 0, reactUntil: 0, strafe: 0, strafeUntil: 0, goal: null, goalUntil: 0,
      stuckCheck: 0, nextShot: 0, burst: 4, mag: 0, reloadT: 0, alertedBy: null, alertT: -99,
      deathT: 0, respawnAt: 0, walkPhase: 0, flashT: 0,
    });
    this.hb = [{ part: 'head', box: new THREE.Box3() }, { part: 'body', box: new THREE.Box3() }];

    this.model = buildSoldier(TEAM_COLORS[team]);
    this.model.root.visible = false;
    this.model.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    if (team === G.player.team) {
      const label = makeLabel(name, '#8fb8ff');
      label.position.y = 2.25;
      this.model.root.add(label);
    }
    this.flash = new THREE.Mesh(flashGeo, flashMat);
    this.flash.position.set(0.08, 0.5, -1.05);
    this.flash.visible = false;
    this.model.upper.add(this.flash);
    G.scene.add(this.model.root);
  }

  pickLoadout() {
    this.def = GUNS[pick(pick(CLASSES).guns)];
    this.mag = this.def.mag;
    this.reloadT = 0;
    this.model.setGun(this.def.model);
  }

  spawn(p, yaw) {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.yaw = yaw; this.pitch = 0;
    this.health = 100;
    this.alive = true;
    this.target = null;
    this.goal = null;
    this.alertedBy = null;
    this.lastPos.copy(p);
    this.stuckCheck = G.time + 1;
    this.pickLoadout();
    this.model.root.visible = true;
    this.animate(0);
  }

  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.6, this.pos.z); }
  chest(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.25, this.pos.z); }

  hitboxes() {
    const p = this.pos;
    this.hb[0].box.min.set(p.x - 0.17, p.y + 1.48, p.z - 0.17);
    this.hb[0].box.max.set(p.x + 0.17, p.y + 1.86, p.z + 0.17);
    this.hb[1].box.min.set(p.x - 0.3, p.y, p.z - 0.3);
    this.hb[1].box.max.set(p.x + 0.3, p.y + 1.48, p.z + 0.3);
    return this.hb;
  }

  onDamaged(attacker) {
    if (attacker === this) return;
    this.alertedBy = attacker;
    this.alertT = G.time;
    this.nextScan = Math.min(this.nextScan, G.time + 0.1);
  }

  die() {
    this.alive = false;
    this.deathT = 0;
    this.respawnAt = G.time + 4 + Math.random() * 2;
    this.target = null;
    this.flash.visible = false;
  }

  muzzleFlash() { this.flashT = 0.05; }

  update(dt) {
    if (this.alive) {
      think(this, dt);
      this.animate(dt);
      this.flashT -= dt;
      this.flash.visible = this.flashT > 0;
    } else if (this.model.root.visible) {
      this.deathT += dt;
      this.model.root.rotation.x = Math.min(1, this.deathT * 3) * Math.PI * 0.48;
      if (this.deathT > 3) this.model.root.visible = false;
    }
    if (!this.alive && G.time >= this.respawnAt && !G.match.over) G.match.respawn(this);
  }

  animate(dt) {
    const m = this.model;
    m.root.position.copy(this.pos);
    m.root.rotation.set(0, this.yaw, 0);
    m.upper.rotation.x = this.pitch;
    this.walkPhase += dt * this.speed * 2.2;
    const swing = Math.sin(this.walkPhase) * Math.min(this.speed / 4, 1) * 0.7;
    m.legL.rotation.x = swing;
    m.legR.rotation.x = -swing;
  }
}
