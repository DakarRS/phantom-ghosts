import * as THREE from 'three';
import { moveBody, overlap, raycastWorld } from './shared/physics.js';
import { G } from './ctx.js';

const RADIUS = 0.35, STAND = 1.8, CROUCH = 1.15;
const WALK = 5.2, GRAVITY = 22, JUMP = 7;
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), eye = new THREE.Vector3();

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.team = 'phantoms';
    this.name = 'You';
    this.isPlayer = true;
    this.kills = this.deaths = this.score = 0;
    this.health = 100;
    this.alive = false;
    this.lastHit = -99;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.recoil = 0;
    this.eyeH = 1.62;
    this.crouched = false;
    this.slideT = 0;
    this.lean = 0;
    this.grounded = false;
    this.sprinting = false;
    this.moving = 0;
    this.stepDist = 0;
    this.hb = [{ part: 'head', box: new THREE.Box3() }, { part: 'body', box: new THREE.Box3() }];
  }

  spawn(p, yaw) {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.yaw = yaw; this.pitch = 0; this.recoil = 0;
    this.health = 100;
    this.alive = true;
    this.crouched = false;
    this.slideT = 0;
    this.lean = 0;
    this.eyeH = 1.62;
    this.lastHit = -99;
  }

  die() { this.alive = false; }

  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.eyeH, this.pos.z); }
  chest(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.eyeH - 0.4, this.pos.z); }

  hitboxes() {
    const p = this.pos, top = p.y + this.eyeH;
    this.hb[0].box.min.set(p.x - 0.17, top - 0.15, p.z - 0.17);
    this.hb[0].box.max.set(p.x + 0.17, top + 0.2, p.z + 0.17);
    this.hb[1].box.min.set(p.x - 0.3, p.y, p.z - 0.3);
    this.hb[1].box.max.set(p.x + 0.3, top - 0.15, p.z + 0.3);
    return this.hb;
  }

  // Most of the kick sticks (you have to pull down); the rest springs back.
  addRecoil(v, h) {
    this.pitch += v * 0.6;
    this.recoil += v * 0.4;
    this.yaw += h;
  }

  update(dt, input, arsenal) {
    const sens = 0.0021 * (this.camera.fov / 80);
    this.yaw -= input.mouse.dx * sens;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - input.mouse.dy * sens));
    this.recoil *= Math.exp(-dt * 9);

    fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const mx = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    const mz = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);

    const sprintHeld = (input.down('ShiftLeft') || input.down('ShiftRight')) && mz > 0 && !arsenal.blocksSprint();
    const crouchPressed = input.hit('KeyC') || input.hit('ControlLeft');
    if (crouchPressed && sprintHeld && this.grounded && this.slideT <= 0) {
      this.slideT = 0.8;
      this.vel.x = fwd.x * 11.5;
      this.vel.z = fwd.z * 11.5;
      this.crouched = true;
      G.audio.slide();
    } else if (input.hit('KeyC')) {
      this.crouched = !this.crouched;
    }
    this.sprinting = sprintHeld && this.slideT <= 0;
    if (this.sprinting) this.crouched = false;

    const low = this.slideT > 0 || this.crouched || input.down('ControlLeft');
    const height = !low && !overlap(this.pos, RADIUS, STAND) ? STAND : CROUCH;

    if (this.slideT > 0) {
      this.slideT -= dt;
      const damp = Math.exp(-dt * 1.6);
      this.vel.x *= damp;
      this.vel.z *= damp;
    } else {
      let speed = WALK * arsenal.walkMult();
      if (this.sprinting) speed *= 1.6;
      else if (height === CROUCH) speed *= 0.55;
      speed *= 1 - 0.4 * arsenal.ads;
      const len = Math.hypot(mx, mz) || 1;
      const wx = (right.x * mx + fwd.x * mz) / len * speed;
      const wz = (right.z * mx + fwd.z * mz) / len * speed;
      const k = 1 - Math.exp(-(this.grounded ? 14 : 2.5) * dt);
      this.vel.x += (wx - this.vel.x) * k;
      this.vel.z += (wz - this.vel.z) * k;
    }
    if (input.hit('Space') && this.grounded) {
      this.vel.y = JUMP;
      this.slideT = 0;
      this.crouched = false;
    }
    this.vel.y -= GRAVITY * dt;
    this.grounded = moveBody(this.pos, this.vel, dt, RADIUS, height);

    const eyeTarget = this.slideT > 0 ? 0.85 : height === CROUCH ? 1.05 : 1.62;
    this.eyeH += (eyeTarget - this.eyeH) * (1 - Math.exp(-dt * 12));

    const leanTarget = this.sprinting ? 0 : (input.down('KeyE') ? 1 : 0) - (input.down('KeyQ') ? 1 : 0);
    this.lean += (leanTarget - this.lean) * (1 - Math.exp(-dt * 10));

    this.moving = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && this.slideT <= 0) {
      this.stepDist += this.moving * dt;
      if (this.stepDist > (this.sprinting ? 2.6 : 2.1)) { this.stepDist = 0; G.audio.step(this.sprinting); }
    }

    this.updateCamera();
  }

  updateCamera() {
    this.eye(eye);
    let off = this.lean * 0.6;
    if (Math.abs(off) > 0.01) {
      // Don't let lean push the camera through a wall.
      const side = right.clone().multiplyScalar(Math.sign(off));
      const hit = raycastWorld(eye, side, Math.abs(off) + 0.25);
      if (hit) off = Math.sign(off) * Math.max(0, hit.dist - 0.25);
    }
    this.camera.position.copy(eye).addScaledVector(right, off);
    this.camera.rotation.set(this.pitch + this.recoil, this.yaw, -this.lean * 0.15, 'YXZ');
  }
}
