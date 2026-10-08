import * as THREE from 'three';
import { buildGun, part, limb } from './models.js';

const GLOVE = 0x24262a, SLEEVE = 0x2f3d2c;
const SWITCH_TIME = 0.35;
const v3 = (a) => new THREE.Vector3(...a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (a) => a * a * (3 - 2 * a);

function flashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.3, 'rgba(255,200,90,0.9)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  x.fillStyle = g;
  x.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 12 : 32, a = (i / 16) * Math.PI * 2;
    x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  x.fill();
  return new THREE.CanvasTexture(c);
}

// Rendered in its own scene on top of the world so the gun never clips into walls.
export class ViewModel {
  constructor(aspect) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xe2efff, 0x6b6250, 2.0));
    const sun = new THREE.DirectionalLight(0xfff0d4, 1.8);
    sun.position.set(0.5, 1, 0.3);
    this.scene.add(sun);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({
      map: flashTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }));
    this.pos = new THREE.Vector3();
    Object.assign(this, { swayX: 0, swayY: 0, phase: 0, sprint: 0, kickZ: 0, kickRot: 0, flashT: 0 });
    Object.assign(this, { reloadT: 0, reloadDur: 1, boltT: 0, boltDur: 1, stabT: 0, switchT: 0 });
  }

  setGun(def) {
    if (this.gun) this.root.remove(this.gun);
    this.def = def;
    this.gun = buildGun(def.model);
    this.addArms(this.gun);
    this.flash.position.set(0, 0.015, this.gun.userData.muzzleZ - 0.06);
    this.gun.add(this.flash);
    this.root.add(this.gun);
    this.switchT = SWITCH_TIME;
    this.reloadT = this.boltT = this.stabT = 0;
  }

  addArms(g) {
    const u = g.userData;
    const grip = v3(u.grip);
    part(g, GLOVE, 0.06, 0.09, 0.09, grip.x + 0.005, grip.y, grip.z);
    limb(g, SLEEVE, grip.clone().add(v3([0.02, -0.02, 0.04])), grip.clone().add(v3([0.14, -0.2, 0.45])), 0.085);
    if (!u.fore) return;
    const fore = v3(u.fore);
    part(g, GLOVE, 0.08, 0.06, 0.09, fore.x - 0.01, fore.y - 0.02, fore.z);
    limb(g, SLEEVE, fore.clone().add(v3([-0.02, -0.03, 0.04])), fore.clone().add(v3([-0.22, -0.25, 0.5])), 0.085);
  }

  // The viewmodel scene is in camera-local space, so mapping through the world camera gives a world position.
  muzzleWorld(cam, out = new THREE.Vector3()) {
    this.root.updateMatrixWorld(true);
    out.set(0, 0.015, this.gun.userData.muzzleZ);
    this.gun.localToWorld(out);
    return out.applyMatrix4(cam.matrixWorld);
  }

  kick(def) {
    const r = def.recoil[0];
    this.kickZ += 0.03 + r * 1.2;
    this.kickRot += 0.02 + r * 2.5;
    this.flashT = 0.05;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.8 + Math.random() * 0.5);
  }

  reload(dur) { this.reloadT = this.reloadDur = dur; }
  cancelReload() { this.reloadT = 0; }
  bolt(dur) { this.boltT = this.boltDur = dur; }
  stab() { this.stabT = 0.35; }

  update(dt, s) {
    if (!this.gun) return;
    const u = this.gun.userData;
    const ea = ease(s.ads);
    const pos = this.pos.set(
      u.hip[0] * (1 - ea),
      u.hip[1] + (-u.sightY - u.hip[1]) * ea,
      u.hip[2] + (u.adsZ - u.hip[2]) * ea,
    );
    let rx = 0, ry = 0, rz = 0;

    this.sprint += ((s.sprint ? 1 : 0) - this.sprint) * (1 - Math.exp(-dt * 10));
    pos.x -= 0.04 * this.sprint; pos.y -= 0.06 * this.sprint;
    ry += 0.55 * this.sprint; rx -= 0.2 * this.sprint; rz += 0.15 * this.sprint;

    const k = 1 - Math.exp(-dt * 8);
    this.swayX += (clamp(-s.dx * 0.0012, -0.07, 0.07) - this.swayX) * k;
    this.swayY += (clamp(-s.dy * 0.0012, -0.07, 0.07) - this.swayY) * k;
    const sw = 1 - ea * 0.85;
    ry += this.swayX * sw; rx += this.swayY * sw; pos.x += this.swayX * 0.1 * sw;

    const amp = Math.min(s.speed / 5, 1.5) * (s.grounded ? 1 : 0.15) * (1 - ea * 0.85);
    this.phase += dt * s.speed * 1.35;
    pos.x += Math.sin(this.phase) * 0.011 * amp;
    pos.y -= Math.abs(Math.cos(this.phase)) * 0.012 * amp;
    rz += Math.sin(this.phase) * 0.025 * amp;
    pos.y += Math.sin(s.time * 1.7) * 0.0025 * (1 - ea);

    const rk = Math.min(1, dt * 16);
    this.kickZ -= this.kickZ * rk;
    this.kickRot -= this.kickRot * rk;
    pos.z += this.kickZ; rx += this.kickRot;

    if (this.reloadT > 0) {
      this.reloadT -= dt;
      const w = Math.sin((1 - Math.max(0, this.reloadT) / this.reloadDur) * Math.PI);
      rx -= 0.35 * w; rz += 0.5 * w; pos.y -= 0.07 * w; pos.x -= 0.04 * w;
    }
    if (this.boltT > 0) {
      this.boltT -= dt;
      const w = Math.sin((1 - Math.max(0, this.boltT) / this.boltDur) * Math.PI);
      rz += 0.3 * w; rx -= 0.1 * w; pos.y -= 0.03 * w;
    }
    if (this.stabT > 0) {
      this.stabT -= dt;
      const w = Math.sin((1 - Math.max(0, this.stabT) / 0.35) * Math.PI);
      pos.z -= 0.28 * w; pos.x -= 0.12 * w; ry += 0.6 * w;
    }
    if (this.switchT > 0) {
      this.switchT -= dt;
      const w = Math.max(0, this.switchT) / SWITCH_TIME;
      pos.y -= 0.35 * w; rx -= 0.6 * w;
    }

    this.root.position.copy(pos);
    this.root.rotation.set(rx, ry, rz);
    this.flashT -= dt;
    this.flash.visible = this.flashT > 0;
    this.root.visible = !s.scoped;
    const fov = 62 - ea * 12;
    if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }
}
