import { G } from './ctx.js';

const KILL_LIMIT = 50;
const MATCH_TIME = 600;

export class Match {
  constructor() {
    this.score = { phantoms: 0, ghosts: 0 };
    this.limit = KILL_LIMIT;
    this.time = MATCH_TIME;
    this.over = false;
    this.onEnd = null;
  }

  damage(target, amount, attacker, def, head) {
    if (!target.alive || this.over) return;
    target.health -= amount;
    target.lastHit = G.time;
    target.damagers ??= new Set();
    target.damagers.add(attacker);
    target.onDamaged?.(attacker);
    if (attacker.isPlayer && target !== attacker) {
      G.hud.hitmarker(head, target.health <= 0);
      G.audio.hit(head);
    }
    if (target.isPlayer) {
      G.hud.damageFrom(attacker.pos);
      G.audio.hurt();
    }
    if (target.health <= 0) this.kill(target, attacker, def, head);
  }

  kill(victim, killer, def, head) {
    victim.health = 0;
    victim.die(killer);
    victim.deaths++;
    const suicide = killer === victim;
    if (!suicide) {
      killer.kills++;
      killer.score += head ? 125 : 100;
      this.score[killer.team]++;
    }
    G.hud.killfeed(killer, victim, def.name, head);

    if (killer.isPlayer && !suicide) {
      G.hud.notify(head ? 'HEADSHOT KILL' : 'ENEMY KILLED', head ? 125 : 100);
      G.audio.kill();
    }
    const p = G.player;
    if (!killer.isPlayer && victim.team !== p.team && victim.damagers?.has(p)) {
      p.score += 25;
      G.hud.notify('ASSIST', 25);
    }
    victim.damagers?.clear();
    if (victim.isPlayer) G.onPlayerDeath?.(killer);
    if (this.score[killer.team] >= this.limit) this.end();
  }

  update(dt) {
    if (this.over) return;
    this.time -= dt;
    if (this.time <= 0) { this.time = 0; this.end(); }
  }

  end() {
    if (this.over) return;
    this.over = true;
    const { phantoms, ghosts } = this.score;
    this.onEnd?.(phantoms === ghosts ? null : phantoms > ghosts ? 'phantoms' : 'ghosts');
  }

  // Prefer spawn points far from living enemies, with a little randomness so spawns don't become predictable.
  respawn(e) {
    const points = G.world.spawns[e.team];
    let best = points[0], bestScore = -Infinity;
    for (const p of points) {
      let nearest = Infinity;
      for (const o of G.entities) {
        if (o.alive && o.team !== e.team) nearest = Math.min(nearest, o.pos.distanceTo(p));
      }
      const s = Math.min(nearest, 60) + Math.random() * 15;
      if (s > bestScore) { bestScore = s; best = p; }
    }
    const pos = best.clone();
    pos.x += (Math.random() - 0.5) * 4;
    e.spawn(pos, e.team === 'phantoms' ? Math.PI : 0);
  }
}
