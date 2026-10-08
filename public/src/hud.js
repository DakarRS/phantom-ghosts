import { G } from './ctx.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export class Hud {
  constructor() {
    this.root = $('hud');
    this.cross = $('crosshair');
    this.hm = $('hitmarker');
    this.vignette = $('vignette');
  }

  show(on) { this.root.classList.toggle('hidden', !on); }

  ammo(def, slot, mode, nades) {
    $('wname').textContent = def.name;
    const melee = def.mode === 'melee';
    $('mag').textContent = melee ? '—' : slot.mag;
    $('mag').classList.toggle('low', !melee && slot.mag <= def.mag * 0.25);
    $('reserve').textContent = melee ? '' : `/ ${slot.reserve}`;
    $('wmode').textContent = mode.toUpperCase();
    $('nades').textContent = `FRAG x${nades}`;
  }

  health(h) {
    const v = Math.max(0, Math.round(h));
    $('health-fill').style.width = `${v}%`;
    $('health-num').textContent = v;
    this.vignette.style.opacity = Math.max(0, (70 - v) / 70).toFixed(2);
  }

  crosshair(gapPx, hidden) {
    this.cross.style.setProperty('--gap', `${Math.min(gapPx, 120).toFixed(1)}px`);
    this.cross.classList.toggle('off', hidden);
  }

  scope(on) { $('scope').classList.toggle('on', on); }

  hitmarker(head, kill) {
    this.hm.className = '';
    void this.hm.offsetWidth; // restart the CSS animation
    this.hm.className = `show${kill ? ' kill' : head ? ' head' : ''}`;
  }

  killfeed(killer, victim, weapon, head) {
    const el = document.createElement('div');
    el.className = 'kf';
    el.innerHTML = `<span class="c-${killer.team}">${esc(killer.name)}</span><span class="w">[${esc(weapon)}]</span>` +
      `<span class="c-${victim.team}">${esc(victim.name)}</span>${head ? '<span class="hs">HS</span>' : ''}`;
    const feed = $('killfeed');
    feed.prepend(el);
    while (feed.children.length > 6) feed.lastChild.remove();
    setTimeout(() => el.remove(), 7000);
  }

  notify(text, pts) {
    const el = document.createElement('div');
    el.className = 'nt';
    el.innerHTML = `<b>+${pts}</b>${esc(text)}`;
    $('notify').append(el);
    setTimeout(() => el.remove(), 2200);
  }

  // Angle of the attacker relative to where the player is facing, 0 = straight ahead.
  damageFrom(src) {
    const p = G.player;
    const dx = src.x - p.pos.x, dz = src.z - p.pos.z;
    const fwd = -Math.sin(p.yaw) * dx + -Math.cos(p.yaw) * dz;
    const right = Math.cos(p.yaw) * dx + -Math.sin(p.yaw) * dz;
    const el = document.createElement('div');
    el.className = 'ind';
    el.style.transform = `rotate(${Math.atan2(right, fwd)}rad)`;
    $('indicators').append(el);
    setTimeout(() => el.remove(), 1200);
  }

  deathMsg(killer, weapon) {
    const el = $('deathmsg');
    if (killer === undefined) { el.classList.add('hidden'); return; }
    el.innerHTML = killer
      ? `KILLED BY <span class="c-${killer.team}">${esc(killer.name)}</span><small>${esc(weapon ?? '')}</small>`
      : 'YOU KILLED YOURSELF';
    el.classList.remove('hidden');
  }

  update(score, timeLeft) {
    $('score-p').textContent = score[0];
    $('score-g').textContent = score[1];
    const t = Math.max(0, timeLeft);
    $('timer').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }

  scoreboard(show) {
    const el = $('scoreboard');
    el.classList.toggle('hidden', !show);
    if (show) el.innerHTML = scoreboardHtml();
  }
}

export function scoreboardHtml() {
  const col = (team, label, score) => {
    const rows = [...G.roster.values()].filter((e) => e.team === team).sort((a, b) => b.score - a.score)
      .map((e) => `<tr class="${e.id === G.myId ? 'me' : ''}"><td>${esc(e.name)}${e.bot ? ' <small>BOT</small>' : ''}</td><td>${e.kills}</td><td>${e.deaths}</td><td>${e.score}</td></tr>`)
      .join('');
    return `<div class="col"><h3 class="c-${team}">${label} · ${score}</h3>` +
      `<table><tr><th>PLAYER</th><th>K</th><th>D</th><th>SCORE</th></tr>${rows}</table></div>`;
  };
  return col('phantoms', 'PHANTOMS', G.score[0]) + col('ghosts', 'GHOSTS', G.score[1]);
}
