import * as THREE from 'three';
import { G } from './ctx.js';
import { buildMap } from './shared/map.js';
import { setColliders } from './shared/physics.js';
import { buildWorld } from './world.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { Effects } from './effects.js';
import { Hud, scoreboardHtml } from './hud.js';
import { Player } from './player.js';
import { ViewModel } from './viewmodel.js';
import { Arsenal } from './arsenal.js';
import { Menu } from './menu.js';
import { Net } from './net.js';
import { Remotes } from './remotes.js';
import { handleEvent } from './events.js';

const BASE_FOV = 80;
const DEATH_CAM = 3;
const STATE_INTERVAL = 1 / 20;
const round = (n) => Math.round(n * 1000) / 1000;

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

const map = buildMap();
setColliders(map.colliders);
buildWorld(scene, map);

Object.assign(G, {
  scene, camera, audio: new Sfx(), effects: new Effects(scene), hud: new Hud(), net: new Net(), remotes: new Remotes(scene),
});
const input = new Input(renderer.domElement);
const vm = new ViewModel(innerWidth / innerHeight);
const player = new Player(camera);
const arsenal = new Arsenal(player, vm);
Object.assign(G, { player, arsenal });

let room = null, killer = null, dyingT = 0, ended = false, stateT = 0;
const endEl = document.getElementById('end');

const game = {
  killedWith: '',
  spawned(pos, yaw) {
    player.spawn(pos, yaw);
    killer = null;
    G.hud.deathMsg(undefined);
  },
  died(killerId) {
    player.die();
    killer = killerId === G.myId ? null : G.remotes.get(killerId) ?? null;
    dyingT = DEATH_CAM;
    G.hud.scope(false);
    G.hud.deathMsg(killerId === G.myId ? null : G.roster.get(killerId), this.killedWith);
  },
  ended(winner) {
    ended = true;
    player.die();
    document.exitPointerLock();
    menu.hide();
    G.hud.show(false);
    const title = winner === null ? 'DRAW' : winner === G.team ? 'VICTORY' : 'DEFEAT';
    endEl.innerHTML = `<div class="menu-inner"><h1>${title}</h1><div class="stats">Next match starts shortly…</div>` +
      `<div id="scoreboard" style="position:static;transform:none;margin-top:24px;display:flex;gap:18px;justify-content:center">${scoreboardHtml()}</div></div>`;
    endEl.classList.remove('hidden');
  },
  reset() {
    ended = false;
    player.die();
    endEl.classList.add('hidden');
    menu.showLoadout('DEPLOY');
  },
};

function leaveRoom(msg) {
  room = null;
  ended = false;
  killer = null;
  player.die();
  G.remotes.clear();
  G.roster.clear();
  G.myId = null;
  endEl.classList.add('hidden');
  G.hud.show(false);
  document.exitPointerLock();
  menu.showBrowser();
  menu.error(msg);
  refreshServers();
}

const menu = new Menu({
  async onJoin(roomId, name) {
    G.audio.init();
    try {
      const w = await G.net.connect(roomId, name);
      Object.assign(G, { myId: w.id, team: w.team });
      player.team = w.team;
      room = w.room;
      menu.showLoadout('DEPLOY', w.room);
    } catch (e) {
      menu.error(e.message);
    }
  },
  onDeploy(gun) {
    if (!room || ended) return;
    if (!player.alive) {
      arsenal.equip(gun);
      G.net.send({ t: 'spawn', gun });
    }
    input.lock();
  },
  onLeave() {
    G.net.leave();
    leaveRoom('');
  },
});

G.net.onClose = () => leaveRoom('Disconnected from server');
G.net.onMessage = (m) => {
  if (m.t !== 's') return;
  G.net.sync(m.st);
  if (m.ro) {
    G.roster = new Map(m.ro.map(([id, name, team, kills, deaths, score, bot]) => [id, { id, name, team, kills, deaths, score, bot }]));
  }
  G.score = m.sc;
  G.timeLeft = m.tm;
  if (player.alive) player.health = m.hp;
  G.remotes.apply(m.st, m.e, m.g, G.roster, G.myId, G.team);
  for (const ev of m.ev) handleEvent(ev, game);
};

async function refreshServers() {
  try {
    menu.setServers(await G.net.rooms());
  } catch {
    menu.setServers([]);
  }
}
refreshServers();
setInterval(() => { if (menu.browsing) refreshServers(); }, 2000);

input.onLockChange = (locked) => {
  if (locked) {
    menu.hide();
    G.hud.show(true);
  } else if (room && !ended) {
    menu.showLoadout(player.alive ? 'RESUME' : 'DEPLOY');
    if (!player.alive) G.hud.show(false);
  }
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

function setFov(fov) {
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

function updateCamera(dt, now) {
  if (player.alive) {
    const d = arsenal.def;
    setFov(arsenal.scoped() ? d.adsFov : BASE_FOV + (Math.min(d.adsFov, BASE_FOV) - BASE_FOV) * ease(arsenal.ads) * (d.scope ? 0.3 : 1));
    if (G.shake > 0) {
      camera.rotation.x += (Math.random() - 0.5) * 0.05 * G.shake;
      camera.rotation.y += (Math.random() - 0.5) * 0.05 * G.shake;
      G.shake = Math.max(0, G.shake - dt * 1.5);
    }
    return;
  }
  setFov(BASE_FOV);
  if (dyingT > 0) {
    // Death cam: slump down and turn to face whoever got you.
    camera.position.y += (player.pos.y + 0.5 - camera.position.y) * Math.min(1, dt * 3);
    if (killer) {
      lookM.lookAt(camera.position, killer.eye(kEye), camera.up);
      lookQ.setFromRotationMatrix(lookM);
      camera.quaternion.slerp(lookQ, Math.min(1, dt * 4));
    }
    return;
  }
  const a = now / 1000 * 0.05;
  camera.position.set(Math.sin(a) * 58, 30, Math.cos(a) * 58);
  camera.lookAt(0, 2, 0);
}

function sendState(dt) {
  if (!player.alive || (stateT += dt) < STATE_INTERVAL) return;
  stateT = 0;
  G.net.send({
    t: 'state', p: player.pos.toArray().map(round), yaw: round(player.yaw), pitch: round(player.pitch),
    eh: round(player.eyeH), s: player.sprinting ? 1 : 0, w: arsenal.slot.key,
  });
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
  last = now;
  G.time += dt;

  if (player.alive && input.locked) {
    arsenal.update(dt, input);
    player.update(dt, input, arsenal);
  }
  sendState(dt);
  G.remotes.update(dt, G.net.renderTime());
  G.effects.update(dt);
  if (dyingT > 0 && (dyingT -= dt) <= 0) {
    killer = null;
    if (input.locked) document.exitPointerLock();
  }

  updateCamera(dt, now);
  if (player.alive) {
    vm.update(input.locked ? dt : 0, {
      ads: arsenal.ads, sprint: player.sprinting, speed: player.moving, grounded: player.grounded,
      dx: input.mouse.dx, dy: input.mouse.dy, scoped: arsenal.scoped(), time: G.time,
    });
    G.hud.health(player.health);
    const gap = arsenal.spread / Math.tan(camera.fov * Math.PI / 360) * innerHeight / 2 + 4;
    G.hud.crosshair(gap, arsenal.ads > 0.5 || player.sprinting);
    G.hud.scope(arsenal.scoped());
  }
  G.hud.update(G.score, G.timeLeft);
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
