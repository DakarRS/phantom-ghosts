import * as THREE from 'three';

const MAX_DECALS = 80;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.tracers = [];
    this.decals = [];
    this.geo = new THREE.BoxGeometry(1, 1, 1);
    this.matCache = new Map();
    this.decalGeo = new THREE.PlaneGeometry(0.11, 0.11);
    this.decalMat = new THREE.MeshBasicMaterial({
      color: 0x151515, transparent: true, opacity: 0.85, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4,
    });
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe7a0, transparent: true, opacity: 0.85 });
    // A single persistent light; adding/removing lights would force shader recompiles.
    this.flash = new THREE.PointLight(0xffb060, 0, 14, 2);
    scene.add(this.flash);
    this.flashT = 0;
  }

  mat(color, glow) {
    const key = color + (glow ? 'g' : '');
    if (!this.matCache.has(key)) {
      this.matCache.set(key, glow
        ? new THREE.MeshBasicMaterial({ color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })
        : new THREE.MeshLambertMaterial({ color }));
    }
    return this.matCache.get(key);
  }

  particle(pos, vel, color, size, life, { gravity = 9.8, glow = false, grow = 0 } = {}) {
    const m = new THREE.Mesh(this.geo, this.mat(color, glow));
    m.position.copy(pos);
    m.scale.setScalar(size);
    m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    this.scene.add(m);
    this.parts.push({ m, vel, life, max: life, size, gravity, grow });
  }

  tracer(a, b) {
    const g = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const line = new THREE.Line(g, this.tracerMat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.05 });
  }

  impact(p, n) {
    for (let i = 0; i < 5; i++) {
      const v = n.clone().multiplyScalar(2 + Math.random() * 3).add(rand3(2.5));
      this.particle(p, v, 0xffd070, 0.025, 0.18, { glow: true });
    }
    for (let i = 0; i < 3; i++) {
      this.particle(p, n.clone().multiplyScalar(0.8).add(rand3(0.5)), 0x8a8578, 0.05, 0.5, { gravity: 1, grow: 0.25 });
    }
    const d = new THREE.Mesh(this.decalGeo, this.decalMat);
    d.position.copy(p).addScaledVector(n, 0.01);
    d.lookAt(p.clone().add(n));
    this.scene.add(d);
    this.decals.push(d);
    if (this.decals.length > MAX_DECALS) this.scene.remove(this.decals.shift());
  }

  blood(p) {
    for (let i = 0; i < 7; i++) this.particle(p, rand3(2.2), 0x8a0f0f, 0.06, 0.4);
  }

  explosion(p) {
    for (let i = 0; i < 26; i++) this.particle(p, rand3(10).setY(Math.random() * 9), 0xffa030, 0.18, 0.45, { glow: true, gravity: 4 });
    for (let i = 0; i < 16; i++) this.particle(p, rand3(3).setY(1 + Math.random() * 3), 0x4a4640, 0.5, 1.6, { gravity: -0.5, grow: 1.2 });
    this.light(p, 60, 0.25);
  }

  light(p, intensity, dur) {
    this.flash.position.copy(p);
    this.flash.intensity = intensity;
    this.flashT = dur;
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life -= dt;
      if (q.life <= 0) { this.scene.remove(q.m); this.parts.splice(i, 1); continue; }
      q.vel.y -= q.gravity * dt;
      q.m.position.addScaledVector(q.vel, dt);
      if (q.m.position.y < 0) { q.m.position.y = 0; q.vel.set(0, 0, 0); }
      const k = q.life / q.max;
      q.m.scale.setScalar(q.size * (q.grow ? 1 + (1 - k) * q.grow * 4 : k));
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) { this.scene.remove(t.line); t.line.geometry.dispose(); this.tracers.splice(i, 1); }
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flash.intensity = 0;
    }
  }
}

function rand3(s) {
  return new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
}
