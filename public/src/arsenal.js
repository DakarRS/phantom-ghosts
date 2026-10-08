import * as THREE from 'three';
import { GUNS } from './guns.js';
import { G } from './ctx.js';
import { fireBullet, castBullet } from './combat.js';

const origin = new THREE.Vector3(), dir = new THREE.Vector3(), quat = new THREE.Quaternion();
const muzzle = new THREE.Vector3();
const SWITCH_TIME = 0.35;

// The local player's loadout: primary, M9 sidearm, knife, plus frags.
export class Arsenal {
  constructor(player, vm) {
    this.player = player;
    this.vm = vm;
    this.slots = [];
    this.cur = 0;
    this.ads = 0;
    this.nextFire = 0;
    this.reloadT = 0;
    this.switchT = 0;
    this.nades = 2;
    this.wantAds = false;
    this.firing = false;
    this.spread = 0;
  }

  equip(primary) {
    this.slots = [primary, 'm9', 'knife'].map((k) => ({ def: GUNS[k], mag: GUNS[k].mag, reserve: GUNS[k].reserve, modeIdx: 0 }));
    this.nades = 2;
    this.switchTo(0, true);
  }

  get slot() { return this.slots[this.cur]; }
  get def() { return this.slot.def; }
  get mode() { return this.def.modes ? this.def.modes[this.slot.modeIdx] : this.def.mode; }
  walkMult() { return this.def.walk; }
  blocksSprint() { return this.wantAds || this.firing || this.reloadT > 0; }
  scoped() { return !!this.def.scope && this.ads > 0.92; }

  switchTo(i, force = false) {
    if (i === this.cur && !force) return;
    this.cur = i;
    this.reloadT = 0;
    this.ads = 0;
    this.switchT = SWITCH_TIME;
    this.nextFire = 0;
    this.vm.setGun(this.def);
    this.refreshHud();
  }

  update(dt, input) {
    const s = this.slot, d = s.def;

    let want = -1;
    ['Digit1', 'Digit2', 'Digit3'].forEach((k, i) => { if (input.hit(k)) want = i; });
    if (input.wheel) want = (this.cur + input.wheel + 3) % 3;
    if (want >= 0) this.switchTo(want);
    if (this.switchT > 0) this.switchT -= dt;

    if (input.hit('KeyV') && d.modes) {
      s.modeIdx = (s.modeIdx + 1) % d.modes.length;
      this.refreshHud();
    }
    if (input.hit('KeyG') && this.nades > 0 && this.switchT <= 0 && this.reloadT <= 0) {
      this.nades--;
      G.grenades.throw(this.player);
      this.refreshHud();
    }

    if (input.hit('KeyR')) this.startReload();
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }
    if (this.autoReload && G.time >= this.nextFire) { this.autoReload = false; this.startReload(); }

    this.wantAds = input.mouse.right && d.mode !== 'melee';
    const adsOn = this.wantAds && this.reloadT <= 0 && this.switchT <= 0;
    this.ads = Math.min(1, Math.max(0, this.ads + (adsOn ? 1 : -1) * dt / d.adsTime));

    this.firing = input.mouse.left;
    const trigger = this.mode === 'auto' ? input.mouse.left : input.mouse.leftPressed;
    if (trigger && this.switchT <= 0 && this.reloadT <= 0 && G.time >= this.nextFire) {
      if (d.mode === 'melee') this.melee();
      else if (s.mag > 0) this.shoot();
      else if (input.mouse.leftPressed) { G.audio.click(); this.startReload(); }
    }
    this.spread = this.currentSpread();
  }

  currentSpread() {
    const d = this.def, p = this.player;
    let spread = d.hip + (d.ads - d.hip) * this.ads + d.move * Math.min(p.moving / 6, 1) * (1 - this.ads * 0.5);
    if (!p.grounded) spread += 0.06;
    if (p.eyeH < 1.3) spread *= 0.75;
    if (d.scope && this.ads < 0.92) spread = Math.max(spread, d.hip); // no-scopes stay unreliable
    return spread;
  }

  shoot() {
    const s = this.slot, d = s.def, p = this.player, cam = G.camera;
    s.mag--;
    this.nextFire = G.time + 60 / d.rpm;
    const spread = this.currentSpread();
    cam.getWorldPosition(origin);
    cam.getWorldQuaternion(quat);
    this.vm.muzzleWorld(cam, muzzle);
    for (let i = 0; i < (d.pellets ?? 1); i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
      dir.set(Math.cos(a) * r, Math.sin(a) * r, -1).normalize().applyQuaternion(quat);
      fireBullet(p, origin, dir, d, this.scoped() ? null : muzzle);
    }
    p.addRecoil(d.recoil[0] * (1 - 0.35 * this.ads) * (0.8 + Math.random() * 0.4), (Math.random() - 0.5) * d.recoil[1] * 2);
    this.vm.kick(d);
    G.audio.shot(d, 0);
    G.effects.light(muzzle, 3, 0.05);
    if (d.mode === 'bolt' || d.mode === 'pump') this.vm.bolt(60 / d.rpm);
    if (s.mag === 0) this.autoReload = true;
    this.refreshHud();
  }

  melee() {
    this.nextFire = G.time + 60 / this.def.rpm;
    this.vm.stab();
    G.audio.swing();
    const cam = G.camera;
    cam.getWorldPosition(origin);
    cam.getWorldDirection(dir);
    const r = castBullet(this.player, origin, dir, this.def.range[1]);
    if (r.hit) {
      G.effects.blood(r.hit.point);
      G.match.damage(r.hit.entity, this.def.damage[0], this.player, this.def, r.hit.part === 'head');
    } else if (r.world) {
      G.effects.impact(r.world.point, r.world.normal);
    }
  }

  startReload() {
    const s = this.slot, d = s.def;
    if (this.reloadT > 0 || d.mode === 'melee' || s.mag >= d.mag || s.reserve <= 0) return;
    this.reloadT = d.reload * (s.mag === 0 ? 1.15 : 1);
    this.ads = 0;
    this.vm.reload(this.reloadT);
    G.audio.reload(this.reloadT);
  }

  finishReload() {
    const s = this.slot;
    const take = Math.min(s.def.mag - s.mag, s.reserve);
    s.mag += take;
    s.reserve -= take;
    this.refreshHud();
  }

  refreshHud() { G.hud.ammo(this.def, this.slot, this.mode, this.nades); }
}
