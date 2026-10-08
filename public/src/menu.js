import { CLASSES, GUNS } from './shared/guns.js';

const GUN_KEY = 'pf-primary';
const NAME_KEY = 'pf-callsign';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function stored(key, fallback, valid = () => true) {
  try {
    const v = localStorage.getItem(key);
    return v && valid(v) ? v : fallback;
  } catch { return fallback; }
}

function store(key, v) {
  try { localStorage.setItem(key, v); } catch { /* storage blocked; the choice just won't persist */ }
}

// Two screens: the server browser, then loadout + deploy once you're in a room.
export class Menu {
  constructor({ onJoin, onDeploy, onLeave }) {
    this.el = $('menu');
    this.selected = stored(GUN_KEY, 'ak12', (v) => !!GUNS[v]);
    $('callsign').value = stored(NAME_KEY, '');

    for (const cls of CLASSES) {
      const card = document.createElement('div');
      card.className = 'cls';
      card.innerHTML = `<h2>${cls.name}</h2>` + cls.guns.map((k) => {
        const g = GUNS[k];
        return `<button class="gun" data-gun="${k}">${g.name}<small>${g.rpm} RPM · ${g.damage[0]}–${g.damage[1]} DMG · ${g.mag} RND</small></button>`;
      }).join('');
      $('classes').append(card);
    }
    $('classes').addEventListener('click', (e) => {
      const b = e.target.closest('.gun');
      if (!b) return;
      this.selected = b.dataset.gun;
      store(GUN_KEY, this.selected);
      this.highlight();
    });
    this.highlight();

    $('servers').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-room]');
      if (!b) return;
      const name = $('callsign').value.trim();
      store(NAME_KEY, name);
      this.error('');
      onJoin(Number(b.dataset.room), name);
    });
    $('deploy').addEventListener('click', () => onDeploy(this.selected));
    $('leave').addEventListener('click', () => onLeave());
  }

  highlight() {
    this.el.querySelectorAll('.gun').forEach((b) => b.classList.toggle('sel', b.dataset.gun === this.selected));
  }

  get browsing() { return !this.el.classList.contains('hidden') && !$('browser').classList.contains('hidden'); }

  showBrowser() {
    $('browser').classList.remove('hidden');
    $('loadout').classList.add('hidden');
    this.el.classList.remove('hidden');
  }

  showLoadout(label, roomName) {
    $('deploy').textContent = label;
    if (roomName) $('room-name').textContent = `SERVER · ${roomName.toUpperCase()}`;
    $('browser').classList.add('hidden');
    $('loadout').classList.remove('hidden');
    this.el.classList.remove('hidden');
  }

  hide() { this.el.classList.add('hidden'); }
  error(msg) { $('menu-error').textContent = msg; }

  // Rows are updated in place: rebuilding them every refresh would swallow clicks that land mid-refresh.
  setServers(list) {
    const box = $('servers');
    if (!list.length) {
      box.innerHTML = '<div class="srv-empty">No servers online</div>';
      return;
    }
    box.querySelector('.srv-empty')?.remove();
    const rows = new Map([...box.querySelectorAll('.srv')].map((el) => [el.dataset.room, el]));
    for (const r of list) {
      let row = rows.get(String(r.id));
      if (!row) {
        row = document.createElement('div');
        row.className = 'srv';
        row.dataset.room = r.id;
        row.innerHTML = `<b>${esc(r.name)}</b><span class="pl"></span><span class="st"></span><button data-room="${r.id}"></button>`;
        box.append(row);
      }
      rows.delete(String(r.id));
      const full = r.players >= r.max;
      const t = Math.max(0, r.time);
      row.querySelector('.pl').textContent = `${r.players}/${r.max}`;
      row.querySelector('.st').textContent = `${r.score[0]} – ${r.score[1]} · ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      const btn = row.querySelector('button');
      btn.disabled = full;
      btn.textContent = full ? 'FULL' : 'JOIN';
    }
    for (const stale of rows.values()) stale.remove();
  }
}
