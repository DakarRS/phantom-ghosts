import * as THREE from 'three';
import { G } from './ctx.js';
import { lineOfSight, moveBody } from './physics.js';
import { fireBullet } from './combat.js';
import { BOUND } from './world.js';

const VIEW_DIST = 85, FOV_COS = Math.cos(1.25), TURN = 5, SPEED = 4.4;
const eye = new THREE.Vector3(), tgt = new THREE.Vector3(), dir = new THREE.Vector3(), muzzle = new THREE.Vector3();

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const approach = (cur, want, step) => cur + Math.max(-step, Math.min(step, wrap(want - cur)));

export function think(bot, dt) {
  const t = G.time;
  if (t >= bot.nextScan) {
    bot.nextScan = t + 0.2 + Math.random() * 0.15;
    scan(bot);
  }
  if (bot.reloadT > 0) {
    bot.reloadT -= dt;
    if (bot.reloadT <= 0) bot.mag = bot.def.mag;
  }

  bot.eye(eye);
  let wx = 0, wz = 0, speed = SPEED;
  const target = bot.target;
  if (target?.alive) {
    target.chest(tgt);
    dir.subVectors(tgt, eye);
    const dist = dir.length();
    // Aim error starts large on acquisition and settles, so the first shots of an engagement tend to miss.
    const wantYaw = Math.atan2(-dir.x, -dir.z) + bot.aimErr.x;
    const wantPitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) + bot.aimErr.y;
    bot.aimErr.multiplyScalar(Math.exp(-dt * 1.8));
    bot.yaw = approach(bot.yaw, wantYaw, TURN * dt);
    bot.pitch += (wantPitch - bot.pitch) * Math.min(1, dt * 8);

    if (t > bot.strafeUntil) {
      bot.strafe = [-1, 0, 1][Math.floor(Math.random() * 3)];
      bot.strafeUntil = t + 0.5 + Math.random() * 1.2;
    }
    const push = dist > 40 ? 1 : dist < 8 ? -0.6 : 0;
    wx = Math.cos(bot.yaw) * bot.strafe - Math.sin(bot.yaw) * push;
    wz = -Math.sin(bot.yaw) * bot.strafe - Math.cos(bot.yaw) * push;
    speed = SPEED * 0.65;

    if (t >= bot.reactUntil && Math.abs(wrap(wantYaw - bot.yaw)) < 0.12) tryFire(bot, t, dist);
  } else {
    if (target) bot.target = null;
    if (!bot.goal || t > bot.goalUntil || Math.hypot(bot.goal.x - bot.pos.x, bot.goal.z - bot.pos.z) < 2) pickGoal(bot);
    dir.subVectors(bot.goal, bot.pos);
    const len = Math.hypot(dir.x, dir.z) || 1;
    wx = dir.x / len;
    wz = dir.z / len;
    bot.yaw = approach(bot.yaw, Math.atan2(-wx, -wz), TURN * 0.6 * dt);
    bot.pitch *= 1 - Math.min(1, dt * 4);
    if (bot.mag < bot.def.mag * 0.4 && bot.reloadT <= 0) bot.reloadT = bot.def.reload;
  }

  if (t > bot.stuckCheck) {
    if ((wx || wz) && bot.pos.distanceTo(bot.lastPos) < 0.8) {
      if (bot.grounded) bot.vel.y = 7;
      if (target) bot.strafe = -bot.strafe;
      else pickGoal(bot, true);
    }
    bot.lastPos.copy(bot.pos);
    bot.stuckCheck = t + 1;
  }

  const k = 1 - Math.exp(-dt * 10);
  bot.vel.x += (wx * speed - bot.vel.x) * k;
  bot.vel.z += (wz * speed - bot.vel.z) * k;
  bot.vel.y -= 22 * dt;
  bot.grounded = moveBody(bot.pos, bot.vel, dt, 0.35, 1.8);
  bot.speed = Math.hypot(bot.vel.x, bot.vel.z);
}

function scan(bot) {
  bot.eye(eye);
  const fx = -Math.sin(bot.yaw), fz = -Math.cos(bot.yaw);
  let best = null, bestD = VIEW_DIST;
  for (const e of G.entities) {
    if (!e.alive || e.team === bot.team) continue;
    e.chest(tgt);
    dir.subVectors(tgt, eye);
    const d = dir.length();
    if (d > bestD) continue;
    const facing = (dir.x * fx + dir.z * fz) / (Math.hypot(dir.x, dir.z) || 1);
    const alerted = bot.alertedBy === e && G.time - bot.alertT < 3;
    if (facing < FOV_COS && !alerted && d > 5 && e !== bot.target) continue;
    if (!lineOfSight(eye, tgt) && !lineOfSight(eye, e.eye(tgt))) continue;
    best = e;
    bestD = d;
  }
  if (best === bot.target) return;
  if (best) {
    bot.reactUntil = G.time + 0.3 + Math.random() * 0.4 + (bot.def.scope ? 0.4 : 0);
    bot.aimErr.set((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.1);
  } else if (bot.target?.alive) {
    // Lost sight: go check where they were last seen.
    bot.goal = bot.target.pos.clone();
    bot.goalUntil = G.time + 8;
  }
  bot.target = best;
}

function pickGoal(bot, wander = false) {
  const enemies = G.entities.filter((e) => e.alive && e.team !== bot.team);
  const hunt = !wander && enemies.length && Math.random() < 0.5;
  const base = hunt ? enemies[Math.floor(Math.random() * enemies.length)].pos : G.world.pois[Math.floor(Math.random() * G.world.pois.length)];
  const spread = hunt ? 8 : 3;
  const lim = BOUND - 2;
  bot.goal = new THREE.Vector3(
    Math.max(-lim, Math.min(lim, base.x + (Math.random() - 0.5) * 2 * spread)), 0,
    Math.max(-lim, Math.min(lim, base.z + (Math.random() - 0.5) * 2 * spread)),
  );
  bot.goalUntil = G.time + 12 + Math.random() * 8;
}

function tryFire(bot, t, dist) {
  const d = bot.def;
  if (bot.reloadT > 0 || t < bot.nextShot) return;
  if (bot.mag <= 0) { bot.reloadT = d.reload; return; }
  bot.mag--;

  let gap = 60 / d.rpm;
  if ((d.modes?.[0] ?? d.mode) === 'auto') {
    if (--bot.burst <= 0) { bot.burst = 3 + Math.floor(Math.random() * 5); gap += 0.25 + Math.random() * 0.4; }
  } else {
    gap += 0.15 + Math.random() * 0.3 + (d.scope ? 0.6 : 0);
  }
  bot.nextShot = t + gap;

  const spread = Math.max(d.ads, 0.004) * 2 + 0.012 + (bot.speed > 1 ? 0.01 : 0) + (dist > 50 && !d.scope ? 0.006 : 0);
  const cp = Math.cos(bot.pitch);
  const fx = -Math.sin(bot.yaw) * cp, fy = Math.sin(bot.pitch), fz = -Math.cos(bot.yaw) * cp;
  bot.eye(eye);
  muzzle.set(eye.x + fx * 0.9 + Math.cos(bot.yaw) * 0.1, eye.y - 0.2, eye.z + fz * 0.9 - Math.sin(bot.yaw) * 0.1);
  for (let i = 0; i < (d.pellets ?? 1); i++) {
    dir.set(fx + (Math.random() - 0.5) * 2 * spread, fy + (Math.random() - 0.5) * 2 * spread, fz + (Math.random() - 0.5) * 2 * spread).normalize();
    fireBullet(bot, eye, dir, d, muzzle);
  }
  bot.muzzleFlash();
  G.audio.shot(d, bot.pos.distanceTo(G.camera.position));
}
