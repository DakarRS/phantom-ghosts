import { G, r2 } from './ctx.js';

const KILL_LIMIT = 50;
const MATCH_TIME = 600;

export class Match {
  constructor() {
    this.onEnd = null;
    this.reset();
  }

  reset() {
    this.score = { phantoms: 0, ghosts: 0 };
    this.limit = KILL_LIMIT;
    this.time = MATCH_TIME;
    this.over = false;
  }

  damage(target, amount, attacker, def, head) {
    if (!target.alive || this.over) return;
    target.health -= amount;
    target.lastHit = G.time;
    target.damagers.add(attacker);
    target.onDamaged?.(attacker);
    const kill = target.health <= 0;
    if (attacker !== target) G.direct(attacker, 'hm', head ? 1 : 0, kill ? 1 : 0);
    G.direct(target, 'dmg', r2(attacker.pos.x), r2(attacker.pos.z));
    if (kill) this.kill(target, attacker, def, head);
  }

  kill(victim, killer, def, head) {
    victim.health = 0;
    victim.die(killer);
    victim.deaths++;
    if (killer !== victim) {
      const pts = head ? 125 : 100;
      killer.kills++;
      killer.score += pts;
      this.score[killer.team]++;
      G.direct(killer, 'nt', head ? 'HEADSHOT KILL' : 'ENEMY KILLED', pts);
    }
    G.emit('kf', killer.id, victim.id, def.name, head ? 1 : 0);
    for (const d of victim.damagers) {
      if (d === killer || d.team === victim.team) continue;
      d.score += 25;
      G.direct(d, 'nt', 'ASSIST', 25);
    }
    victim.damagers.clear();
    G.direct(victim, 'died', killer.id);
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

  // Prefer spawn points far from living enemies, with some randomness so spawns don't become predictable.
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
