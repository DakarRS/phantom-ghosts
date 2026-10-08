import { CLASSES, GUNS } from './guns.js';

const KEY = 'pf-primary';

function load() {
  try { return GUNS[localStorage.getItem(KEY)] ? localStorage.getItem(KEY) : 'ak12'; } catch { return 'ak12'; }
}

export class Menu {
  constructor(onDeploy) {
    this.el = document.getElementById('menu');
    this.btn = document.getElementById('deploy');
    this.selected = load();
    const wrap = document.getElementById('classes');
    for (const cls of CLASSES) {
      const card = document.createElement('div');
      card.className = 'cls';
      card.innerHTML = `<h2>${cls.name}</h2>` + cls.guns.map((k) => {
        const g = GUNS[k];
        return `<button class="gun" data-gun="${k}">${g.name}<small>${g.rpm} RPM · ${g.damage[0]}–${g.damage[1]} DMG · ${g.mag} RND</small></button>`;
      }).join('');
      wrap.append(card);
    }
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('.gun');
      if (!b) return;
      this.selected = b.dataset.gun;
      try { localStorage.setItem(KEY, this.selected); } catch {}
      this.highlight();
    });
    this.highlight();
    this.btn.addEventListener('click', () => onDeploy(this.selected));
  }

  highlight() {
    this.el.querySelectorAll('.gun').forEach((b) => b.classList.toggle('sel', b.dataset.gun === this.selected));
  }

  show(label) {
    this.btn.textContent = label;
    this.el.classList.remove('hidden');
  }

  hide() { this.el.classList.add('hidden'); }
}
