import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Room, TEAM_SIZE } from '../room.js';
import { G } from '../sim/ctx.js';
import { GUNS } from '../../public/src/shared/guns.js';

let room;
beforeEach(() => { room = new Room('Test'); });

const team = (t) => G.entities.filter((e) => e.team === t);
const humanOf = (cid) => room.clients.get(cid).entity;
const messages = (out, cid) => out.filter(([c]) => c === cid).map(([, s]) => JSON.parse(s));
const events = (out, cid, type) => messages(out, cid).flatMap((m) => m.ev ?? []).filter((e) => e[0] === type);

// Joins, spawns, and parks the player at a known spot so shots are deterministic.
function player(cid, at = [0, 0, -30], gun = 'ak12') {
  room.handle(cid, { t: 'join', name: `p${cid}` });
  room.handle(cid, { t: 'spawn', gun });
  const h = humanOf(cid);
  h.pos.set(...at);
  return h;
}

function enemyBotOf(h, at) {
  const b = G.entities.find((e) => e.isBot && e.team !== h.team);
  b.pos.set(...at);
  b.health = 100;
  b.alive = true;
  return b;
}

const aimAt = (h, target, dy = 1.2) => {
  const o = h.eye();
  const d = target.pos.clone().setY(target.pos.y + dy).sub(o).normalize();
  return { o: o.toArray(), d: [d.toArray()] };
};

test('an empty room is full of bots, 6 per team', () => {
  assert.equal(team('phantoms').length, TEAM_SIZE);
  assert.equal(team('ghosts').length, TEAM_SIZE);
  assert.ok(G.entities.every((e) => e.isBot && e.alive));
});

test('joining players are balanced across teams and each replaces a bot', () => {
  room.handle(1, { t: 'join', name: 'a' });
  room.handle(2, { t: 'join', name: 'b' });
  assert.notEqual(humanOf(1).team, humanOf(2).team);
  assert.equal(team('phantoms').length, TEAM_SIZE);
  assert.equal(team('ghosts').length, TEAM_SIZE);
  const welcome = messages(room.flush(), 1).find((m) => m.t === 'welcome');
  assert.equal(welcome.id, humanOf(1).id);
});

test('a bot comes back when a player leaves', () => {
  room.handle(1, { t: 'join', name: 'a' });
  const t = humanOf(1).team;
  room.handle(1, { t: 'leave' });
  assert.equal(team(t).length, TEAM_SIZE);
  assert.ok(team(t).every((e) => e.isBot));
});

test('the room refuses players past 12', () => {
  for (let i = 1; i <= 13; i++) room.handle(i, { t: 'join', name: `p${i}` });
  assert.equal(room.humans().length, 12);
  assert.ok(messages(room.flush(), 13).some((m) => m.t === 'full'));
});

test('spawning with a gun that is not a primary falls back to the default', () => {
  const h = player(1, undefined, 'knife');
  assert.equal(h.alive, true);
  assert.deepEqual(h.loadout, ['ak12', 'm9', 'knife']);
});

test('a headshot kills, scores for the team, and tells the shooter', () => {
  const h = player(1, [0, 0, -30], 'intervention');
  const bot = enemyBotOf(h, [0, 0, -24]);
  room.handle(1, { t: 'shoot', gun: 'intervention', ...aimAt(h, bot, 1.72) });
  const out = room.flush();
  assert.equal(bot.alive, false);
  assert.equal(h.kills, 1);
  assert.equal(G.match.score[h.team], 1);
  assert.deepEqual(events(out, 1, 'hm')[0].slice(1), [1, 1]);
  assert.equal(events(out, 1, 'kf')[0][2], bot.id);
});

test('fire rate is capped at the gun RPM', () => {
  const h = player(1, [0, 0, -30], 'intervention');
  enemyBotOf(h, [0, 0, -24]);
  const shot = { t: 'shoot', gun: 'intervention', o: h.eye().toArray(), d: [[0, 0, 1]] };
  room.handle(1, shot);
  room.handle(1, shot);
  assert.equal(G.events.filter((e) => e[0] === 'sh').length, 1);
});

test('shots from a gun not in the loadout, or from far away, are ignored', () => {
  const h = player(1, [0, 0, -30], 'ak12');
  const bot = enemyBotOf(h, [0, 0, -24]);
  room.handle(1, { t: 'shoot', gun: 'intervention', ...aimAt(h, bot) });
  room.handle(1, { t: 'shoot', gun: 'ak12', o: [0, 1.6, -25], d: [[0, 0, 1]] });
  assert.equal(bot.health, 100);
});

test('teammates cannot be hurt', () => {
  const h = player(1, [0, 0, -30], 'intervention');
  const mate = G.entities.find((e) => e.isBot && e.team === h.team);
  mate.pos.set(0, 0, -24);
  room.handle(1, { t: 'shoot', gun: 'intervention', ...aimAt(h, mate) });
  assert.equal(mate.health, 100);
});

test('lag compensation hits where the target was on the shooter screen', () => {
  const h = player(1, [0, 0, -30], 'm9');
  const bot = enemyBotOf(h, [0, 0, -24]);
  bot.record();
  const seen = G.time;
  const aim = aimAt(h, bot);
  G.time += 0.2;
  bot.pos.x = 3;
  bot.record();

  room.handle(1, { t: 'shoot', gun: 'm9', ...aim });
  assert.equal(bot.health, 100, 'without rewind the target has moved out of the way');
  room.handle(1, { t: 'shoot', gun: 'm9', ...aim, rt: seen });
  assert.ok(bot.health < 100, 'rewound to what the shooter saw, it is a hit');
});

test('rewind is capped so a laggy shooter cannot reach far into the past', () => {
  const h = player(1, [0, 0, -30], 'm9');
  const bot = enemyBotOf(h, [0, 0, -24]);
  bot.record();
  const old = G.time;
  const aim = aimAt(h, bot);
  for (let i = 0; i < 20; i++) { G.time += 0.05; bot.pos.x = 3; bot.record(); }
  room.handle(1, { t: 'shoot', gun: 'm9', ...aim, rt: old });
  assert.equal(bot.health, 100);
});

test('teleporting is rejected and the client is corrected', () => {
  const h = player(1);
  room.flush();
  G.time += 0.05;
  room.handle(1, { t: 'state', p: [40, 0, 40], yaw: 0, pitch: 0, eh: 1.62, w: 'ak12' });
  assert.deepEqual(h.pos.toArray(), [0, 0, -30]);
  assert.equal(events(room.flush(), 1, 'pos').length, 1);
});

test('normal movement updates position, look and stance', () => {
  const h = player(1);
  G.time += 0.05;
  room.handle(1, { t: 'state', p: [0.3, 0, -30], yaw: 1, pitch: 0.2, eh: 1.05, s: 1, w: 'm9' });
  assert.deepEqual([h.pos.x, h.yaw, h.eyeH, h.sprint, h.gunKey], [0.3, 1, 1.05, true, 'm9']);
});

test('the shooter does not get their own tracers back, others do', () => {
  const h = player(1, [0, 0, -30], 'ak12');
  player(2, [0, 0, 30], 'ak12');
  room.handle(1, { t: 'shoot', gun: 'ak12', o: h.eye().toArray(), d: [[1, 0, 0]] });
  const out = room.flush();
  assert.equal(events(out, 1, 'tr').length, 0);
  assert.equal(events(out, 2, 'tr').length, 1);
});

test('hitting the kill limit ends the match, then it resets', () => {
  G.match.limit = 1;
  const h = player(1, [0, 0, -30], 'intervention');
  const bot = enemyBotOf(h, [0, 0, -24]);
  room.handle(1, { t: 'shoot', gun: 'intervention', ...aimAt(h, bot, 1.72) });
  assert.equal(G.match.over, true);
  assert.ok(events(room.flush(), 1, 'end').length);

  let reset = false;
  for (let i = 0; i < 300 && !reset; i++) reset = events(room.tick(), 1, 'reset').length > 0;
  assert.ok(reset);
  assert.equal(G.match.over, false);
  assert.deepEqual(G.match.score, { phantoms: 0, ghosts: 0 });
  assert.equal(h.kills, 0);
});

test('a full minute of bots fighting runs cleanly and produces kills', () => {
  let kills = 0;
  for (let i = 0; i < 60 / 0.05; i++) {
    room.tick();
    kills = G.match.score.phantoms + G.match.score.ghosts;
  }
  assert.ok(kills > 0, `expected some kills, got ${kills}`);
  assert.ok(G.entities.every((e) => Number.isFinite(e.pos.x) && Number.isFinite(e.pos.z)));
});

test('grenades are limited to two per life', () => {
  const h = player(1);
  const nade = { t: 'nade', o: h.eye().toArray(), v: [0, 5, 10] };
  for (let i = 0; i < 4; i++) room.handle(1, nade);
  assert.equal(G.grenades.list.length, 2);
  assert.equal(GUNS.knife.mode, 'melee');
});
