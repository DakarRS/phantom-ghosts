import * as THREE from 'three';
import { G } from './ctx.js';
import { buildWorld } from './world.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { Effects } from './effects.js';
import { Hud, scoreboardHtml } from './hud.js';
import { Match } from './match.js';
import { Player } from './player.js';
import { ViewModel } from './viewmodel.js';
import { Arsenal } from './arsenal.js';
import { Bot } from './bot.js';
import { Grenades } from './grenades.js';
import { Menu } from './menu.js';

const BASE_FOV = 80;
const DEATH_CAM = 3;
const NAMES = {
  phantoms: ['ToastyBread', 'LitBeagle', 'NoScopeNana', 'xXGhostedXx', 'KiwiKommando'],
  ghosts: ['Blox_Reaper', 'Pr0Camper', 'SlideMaster', 'OofLord', 'CraneGoblin', 'Kevin'],
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(BASE_FOV, innerWidth / innerHeight, 0.05, 500);
camera.rotation.order = 'YXZ';

Object.assign(G, { scene, camera, audio: new Sfx(), effects: new Effects(scene), hud: new Hud(), match: new Match(), shake: 0 });
G.world = buildWorld(scene);
G.grenades = new Grenades(scene);

const input = new Input(renderer.domElement);
const vm = new ViewModel(innerWidth / innerHeight);
const player = new Player(camera);
const arsenal = new Arsenal(player, vm);
Object.assign(G, { player, arsenal });
G.entities.push(player);
for (const team of ['phantoms', 'ghosts']) {
  for (const name of NAMES[team]) G.entities.push(new Bot(team, name));
}
G.entities.forEach((e) => { if (!e.isPlayer) G.match.respawn(e); });

let killer = null, deathT = 0;

const menu = new Menu((gun) => {
  G.audio.init();
  if (G.match.over) return;
  if (!player.alive) {
    arsenal.equip(gun);
    G.match.respawn(player);
    G.hud.deathMsg(null);
    killer = null;
  }
  input.lock();
});

input.onLockChange = (locked) => {
  if (locked) {
    menu.hide();
    G.hud.show(true);
  } else if (!G.match.over) {
    menu.show(player.alive ? 'RESUME' : 'DEPLOY');
    if (!player.alive) G.hud.show(false);
  }
};

G.onPlayerDeath = (k) => {
  killer = k;
  deathT = 0;
  G.hud.scope(false);
  G.hud.deathMsg(k);
};

G.match.onEnd = (winner) => {
  document.exitPointerLock();
  menu.hide();
  G.hud.show(false);
  const end = document.getElementById('end');
  const title = winner === null ? 'DRAW' : winner === player.team ? 'VICTORY' : 'DEFEAT';
  end.innerHTML = `<div class="menu-inner"><h1>${title}</h1>` +
    `<div class="stats">${player.kills} KILLS · ${player.deaths} DEATHS · ${player.score} SCORE</div>` +
    `<div id="scoreboard" style="position:static;transform:none;margin-top:24px;display:flex;gap:18px;justify-content:center">${scoreboardHtml()}</div>` +
    `<button id="again">PLAY AGAIN</button></div>`;
  end.classList.remove('hidden');
  document.getElementById('again').onclick = () => location.reload();
};

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  for (const c of [camera, vm.camera]) {
    c.aspect = innerWidth / innerHeight;
    c.updateProjectionMatrix();
  }
});

const lookM = new THREE.Matrix4(), lookQ = new THREE.Quaternion(), kEye = new THREE.Vector3();
const ease = (a) => a * a * (3 - 2 * a);

function updateCamera(dt, now) {
  if (player.alive) {
    const d = arsenal.def;
    const fov = arsenal.scoped() ? d.adsFov : BASE_FOV + (Math.min(d.adsFov, BASE_FOV) - BASE_FOV) * ease(arsenal.ads) * (d.scope ? 0.3 : 1);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    if (G.shake > 0) {
      camera.rotation.x += (Math.random() - 0.5) * 0.05 * G.shake;
      camera.rotation.y += (Math.random() - 0.5) * 0.05 * G.shake;
      G.shake = Math.max(0, G.shake - dt * 1.5);
    }
    return;
  }
  if (camera.fov !== BASE_FOV) { camera.fov = BASE_FOV; camera.updateProjectionMatrix(); }
  if (killer && deathT < DEATH_CAM) {
    // Death cam: slump down and turn to face whoever got you.
    camera.position.y += (player.pos.y + 0.5 - camera.position.y) * Math.min(1, dt * 3);
    killer.eye(kEye);
    lookM.lookAt(camera.position, kEye, camera.up);
    lookQ.setFromRotationMatrix(lookM);
    camera.quaternion.slerp(lookQ, Math.min(1, dt * 4));
    return;
  }
  const a = now / 1000 * 0.05;
  camera.position.set(Math.sin(a) * 58, 30, Math.cos(a) * 58);
  camera.lookAt(0, 2, 0);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
  last = now;
  const paused = player.alive && !input.locked;

  if (!paused && !G.match.over) {
    G.time += dt;
    if (player.alive) {
      arsenal.update(dt, input);
      player.update(dt, input, arsenal);
    }
    for (const e of G.entities) if (!e.isPlayer) e.update(dt);
    G.grenades.update(dt);
    G.match.update(dt);
    G.effects.update(dt);
    if (!player.alive && killer) {
      deathT += dt;
      if (deathT >= DEATH_CAM) {
        killer = null;
        if (input.locked) document.exitPointerLock();
      }
    }
  }

  updateCamera(dt, now);

  if (player.alive) {
    vm.update(paused ? 0 : dt, {
      ads: arsenal.ads, sprint: player.sprinting, speed: player.moving, grounded: player.grounded,
      dx: input.mouse.dx, dy: input.mouse.dy, scoped: arsenal.scoped(), time: G.time,
    });
    G.hud.health(player.health);
    const gap = arsenal.spread / Math.tan(camera.fov * Math.PI / 360) * innerHeight / 2 + 4;
    G.hud.crosshair(gap, arsenal.ads > 0.5 || player.sprinting);
    G.hud.scope(arsenal.scoped());
  }
  G.hud.update(G.match);
  G.hud.scoreboard(input.down('Tab') && input.locked);

  renderer.clear();
  renderer.render(scene, camera);
  if (player.alive) {
    renderer.clearDepth();
    renderer.render(vm.scene, vm.camera);
  }
  input.endFrame();
}
requestAnimationFrame(frame);
