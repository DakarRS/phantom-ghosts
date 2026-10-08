import * as THREE from 'three';
import { buildSoldier, makeLabel } from './models.js';
import { GUNS } from './shared/guns.js';

export const TEAM_COLORS = { phantoms: 0x3d7be0, ghosts: 0xe08a2e };
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffc860, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
const flashGeo = new THREE.BoxGeometry(0.12, 0.12, 0.2);
const nadeGeo = new THREE.SphereGeometry(0.07, 8, 6);
const nadeMat = new THREE.MeshLambertMaterial({ color: 0x3b4a2c });
const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

// Another player or bot, drawn from interpolated server snapshots.
class Remote {
  constructor(scene, id, info, friendly) {
    this.scene = scene;
    this.id = id;
    this.name = info.name;
    this.team = info.team;
    this.model = buildSoldier(TEAM_COLORS[this.team]);
    this.model.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    if (friendly) {
      const label = makeLabel(this.name, '#8fb8ff');
      label.position.y = 2.25;
      this.model.root.add(label);
    }
    this.flash = new THREE.Mesh(flashGeo, flashMat);
    this.flash.position.set(0.08, 0.5, -1.05);
    this.flash.visible = false;
    this.model.upper.add(this.flash);
    scene.add(this.model.root);
    Object.assign(this, { buf: [], alive: false, deathT: 0, gunKey: null, walk: 0, speed: 0, flashT: 0, eyeH: 1.6 });
    this.pos = new THREE.Vector3();
  }

  push(st, [, x, y, z, yaw, pitch, alive, gun, eh]) {
    if (alive && !this.alive) {
      // Respawned: don't slide across the map from where they died.
      this.buf.length = 0;
      this.model.root.visible = true;
      this.model.root.rotation.x = 0;
    }
    if (!alive && this.alive) this.deathT = 0;
    this.alive = !!alive;
    if (gun !== this.gunKey && GUNS[gun]) {
      this.gunKey = gun;
      this.model.setGun(GUNS[gun].model);
    }
    this.buf.push({ st, x, y, z, yaw, pitch, eh });
    while (this.buf.length > 2 && this.buf[1].st < st - 1) this.buf.shift();
  }

  sample(t) {
    const b = this.buf;
    if (!b.length) return null;
    if (t <= b[0].st) return b[0];
    let i = b.length - 1;
    while (i > 0 && b[i].st > t) i--;
    const a = b[i], c = b[i + 1];
    if (!c) return a;
    const k = (t - a.st) / (c.st - a.st);
    const lerp = (key) => a[key] + (c[key] - a[key]) * k;
    return { x: lerp('x'), y: lerp('y'), z: lerp('z'), yaw: lerpAngle(a.yaw, c.yaw, k), pitch: lerp('pitch'), eh: lerp('eh') };
  }

  update(dt, t) {
    const m = this.model;
    this.flashT -= dt;
    this.flash.visible = this.alive && this.flashT > 0;
    if (!this.alive) {
      if (!m.root.visible) return;
      this.deathT += dt;
      m.root.rotation.x = Math.min(1, this.deathT * 3) * Math.PI * 0.48;
      if (this.deathT > 3) m.root.visible = false;
      return;
    }
    const s = this.sample(t);
    if (!s) return;
    const moved = Math.hypot(s.x - this.pos.x, s.z - this.pos.z);
    if (dt > 0) this.speed += (Math.min(moved / dt, 12) - this.speed) * Math.min(1, dt * 10);
    this.pos.set(s.x, s.y, s.z);
    this.eyeH = s.eh;

    m.root.position.copy(this.pos);
    m.root.rotation.set(0, s.yaw, 0);
    const crouch = Math.max(0, Math.min(1, (1.6 - s.eh) / 0.6));
    m.upper.position.y = 0.9 - 0.45 * crouch;
    m.upper.rotation.x = s.pitch;
    for (const leg of [m.legL, m.legR]) {
      leg.position.y = 0.9 - 0.45 * crouch;
      leg.scale.y = 1 - 0.5 * crouch;
    }
    this.walk += dt * this.speed * 2.2;
    const swing = Math.sin(this.walk) * Math.min(this.speed / 4, 1) * 0.7;
    m.legL.rotation.x = swing;
    m.legR.rotation.x = -swing;
  }

  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.eyeH, this.pos.z); }

  muzzle(out = new THREE.Vector3()) {
    this.model.root.updateMatrixWorld(true);
    return this.flash.getWorldPosition(out);
  }

  shot() { this.flashT = 0.05; }
  dispose() { this.scene.remove(this.model.root); }
}

export class Remotes {
  constructor(scene) {
    this.scene = scene;
    this.map = new Map();
    this.nades = new Map();
  }

  get(id) { return this.map.get(id); }

  apply(st, ents, nades, roster, myId, myTeam) {
    const seen = new Set();
    for (const e of ents) {
      const id = e[0];
      if (id === myId) continue;
      let r = this.map.get(id);
      if (!r) {
        const info = roster.get(id);
        if (!info) continue;
        r = new Remote(this.scene, id, info, info.team === myTeam);
        this.map.set(id, r);
      }
      seen.add(id);
      r.push(st, e);
    }
    for (const [id, r] of this.map) if (!seen.has(id)) { r.dispose(); this.map.delete(id); }

    const live = new Set();
    for (const [id, x, y, z] of nades) {
      live.add(id);
      let n = this.nades.get(id);
      if (!n) {
        n = { mesh: new THREE.Mesh(nadeGeo, nadeMat), target: new THREE.Vector3(x, y, z) };
        n.mesh.position.copy(n.target);
        this.scene.add(n.mesh);
        this.nades.set(id, n);
      }
      n.target.set(x, y, z);
    }
    for (const [id, n] of this.nades) if (!live.has(id)) { this.scene.remove(n.mesh); this.nades.delete(id); }
  }

  update(dt, t) {
    for (const r of this.map.values()) r.update(dt, t);
    for (const n of this.nades.values()) n.mesh.position.lerp(n.target, Math.min(1, dt * 20));
  }

  clear() {
    for (const r of this.map.values()) r.dispose();
    for (const n of this.nades.values()) this.scene.remove(n.mesh);
    this.map.clear();
    this.nades.clear();
  }
}
