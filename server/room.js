import { performance } from 'node:perf_hooks';
import { G, r2 } from './sim/ctx.js';
import { Match } from './sim/match.js';
import { Bot } from './sim/bot.js';
import { Human, toVec } from './sim/human.js';
import { Grenades } from './sim/grenades.js';
import { fireBullet, castBullet } from './sim/combat.js';
import { buildMap } from '../public/src/shared/map.js';
import { setColliders } from '../public/src/shared/physics.js';
import { GUNS } from '../public/src/shared/guns.js';

export const TICK = 0.05;
export const TEAM_SIZE = 6;
const RESET_DELAY = 12;
const TEAMS = ['phantoms', 'ghosts'];
const BOT_NAMES = [
  'ToastyBread', 'LitBeagle', 'NoScopeNana', 'xXGhostedXx', 'KiwiKommando', 'Blox_Reaper', 'Pr0Camper', 'SlideMaster',
  'OofLord', 'CraneGoblin', 'Kevin', 'SgtPickles', 'TacticalTaco', 'LagSwitch', 'MrHeadglitch', 'Spawnpeeker',
];

export class Room {
  constructor(name) {
    this.name = name;
    Object.assign(G, { time: 0, entities: [], events: [] });
    G.world = buildMap();
    setColliders(G.world.colliders);
    G.match = new Match();
    G.grenades = new Grenades();
    G.match.onEnd = (winner) => {
      G.emit('end', winner ?? '');
      this.resetAt = G.time + RESET_DELAY;
    };
    this.clients = new Map();
    this.pending = [];
    this.nextId = 1;
    this.resetAt = 0;
    this.rosterAt = 0;
    this.rebalance();
  }

  humans(team) { return G.entities.filter((e) => e.client && (!team || e.team === team)); }

  // Bots fill each team up to TEAM_SIZE and make room as people join.
  rebalance() {
    for (const team of TEAMS) {
      const bots = G.entities.filter((e) => e.isBot && e.team === team);
      const want = Math.max(0, TEAM_SIZE - this.humans(team).length);
      for (let i = bots.length; i < want; i++) {
        const b = new Bot(this.nextId++, team, this.botName());
        G.entities.push(b);
        G.match.respawn(b);
      }
      bots.sort((a, b) => a.alive - b.alive).slice(0, Math.max(0, bots.length - want)).forEach((b) => this.remove(b));
    }
    this.rosterAt = 0;
  }

  botName() {
    const used = new Set(G.entities.map((e) => e.name));
    return BOT_NAMES.find((n) => !used.has(n)) ?? `Bot${this.nextId}`;
  }

  remove(e) {
    G.entities.splice(G.entities.indexOf(e), 1);
    G.emit('rm', e.id);
  }

  handle(cid, m) {
    if (m.t === 'join') return this.join(cid, m.name);
    const c = this.clients.get(cid);
    if (!c) return;
    const h = c.entity;
    switch (m.t) {
      case 'leave': return this.leave(cid);
      case 'spawn': if (!h.alive && !G.match.over) { h.equip(m.gun); G.match.respawn(h); } return;
      case 'state': return h.applyState(m);
      case 'shoot': return this.shoot(h, m);
      case 'melee': return this.melee(h, m);
      case 'nade': return this.nade(h, m);
    }
  }

  join(cid, name) {
    if (this.clients.has(cid)) return;
    if (this.humans().length >= TEAM_SIZE * 2) {
      this.pending.push([cid, JSON.stringify({ t: 'full' })]);
      return;
    }
    const [p, g] = TEAMS.map((t) => this.humans(t).length);
    const team = p <= g ? 'phantoms' : 'ghosts';
    const client = { cid, queue: [] };
    const h = new Human(this.nextId++, team, name, client);
    client.entity = h;
    this.clients.set(cid, client);
    G.entities.push(h);
    this.rebalance();
    this.pending.push([cid, JSON.stringify({ t: 'welcome', id: h.id, team, room: this.name })]);
  }

  leave(cid) {
    const c = this.clients.get(cid);
    if (!c) return;
    this.clients.delete(cid);
    this.remove(c.entity);
    this.rebalance();
  }

  // The client's origin must be near where the server thinks their eyes are; lean and latency get some slack.
  aim(h, m) {
    const o = toVec(m.o);
    return o && o.distanceTo(h.eye()) < 2.5 ? o : null;
  }

  shoot(h, m) {
    const def = GUNS[m.gun];
    if (!def || def.mode === 'melee' || !Array.isArray(m.d) || !h.canFire(m.gun, performance.now() / 1000)) return;
    const o = this.aim(h, m);
    if (!o) return;
    const rewind = Number.isFinite(m.rt) ? m.rt : null;
    const dirs = m.d.slice(0, def.pellets ?? 1).map((raw) => toVec(raw, 2)).filter((d) => d && d.length() > 0.5);
    for (const d of dirs) fireBullet(h, o, d.normalize(), def, o, rewind);
    if (dirs.length) G.emit('sh', h.id, m.gun);
  }

  melee(h, m) {
    const def = GUNS.knife;
    const o = this.aim(h, m), d = toVec(m.d, 2);
    if (!o || !d || d.length() < 0.5 || !h.canFire('knife', performance.now() / 1000)) return;
    const r = castBullet(h, o, d.normalize(), def.range[1], Number.isFinite(m.rt) ? m.rt : null);
    if (r.hit) {
      G.emit('bl', r2(r.hit.point.x), r2(r.hit.point.y), r2(r.hit.point.z));
      G.match.damage(r.hit.entity, def.damage[0], h, def, r.hit.part === 'head');
    }
  }

  nade(h, m) {
    const o = this.aim(h, m), v = toVec(m.v, 30);
    if (!o || !v || !h.alive || h.nades <= 0) return;
    h.nades--;
    G.grenades.throw(h, o, v);
  }

  tick() {
    G.time += TICK;
    if (!G.match.over) {
      for (const e of [...G.entities]) e.update(TICK);
      G.grenades.update(TICK);
      G.match.update(TICK);
    } else if (G.time >= this.resetAt) {
      this.resetMatch();
    }
    for (const e of G.entities) e.record();
    return this.flush();
  }

  resetMatch() {
    G.match.reset();
    G.grenades.list = [];
    for (const e of G.entities) {
      e.kills = e.deaths = e.score = 0;
      if (e.isBot) G.match.respawn(e);
      else e.alive = false;
    }
    G.emit('reset');
    this.rosterAt = 0;
  }

  // One message per client per tick: shared world state plus that client's own events.
  flush() {
    const out = this.pending;
    this.pending = [];
    const e = G.entities.map((x) => [x.id, r2(x.pos.x), r2(x.pos.y), r2(x.pos.z), r2(x.yaw), r2(x.pitch), x.alive ? 1 : 0, x.gunKey, r2(x.eyeH), x.sprint ? 1 : 0]);
    const base = { t: 's', st: r2(G.time), e, g: G.grenades.snapshot(), sc: [G.match.score.phantoms, G.match.score.ghosts], tm: Math.ceil(G.match.time) };
    if (G.time >= this.rosterAt) {
      this.rosterAt = G.time + 1;
      base.ro = G.entities.map((x) => [x.id, x.name, x.team, x.kills, x.deaths, x.score, x.isBot ? 1 : 0]);
    }
    for (const [cid, c] of this.clients) {
      const me = c.entity.id;
      // Shooters already drew their own tracers and heard their own shots locally.
      const ev = G.events.filter((x) => !((x[0] === 'tr' || x[0] === 'sh') && x[1] === me)).concat(c.queue);
      out.push([cid, JSON.stringify({ ...base, hp: Math.ceil(c.entity.health), ev })]);
      c.queue = [];
    }
    G.events = [];
    return out;
  }

  info() {
    return {
      name: this.name, players: this.humans().length, max: TEAM_SIZE * 2,
      score: [G.match.score.phantoms, G.match.score.ghosts], time: Math.ceil(G.match.time),
    };
  }
}
