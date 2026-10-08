// Everything is synthesized with WebAudio so the game ships with no sound assets.
const PROFILES = {
  rifle: { freq: 1900, body: 140, decay: 0.16, vol: 0.9 },
  carbine: { freq: 2300, body: 150, decay: 0.13, vol: 0.85 },
  smg: { freq: 2800, body: 170, decay: 0.09, vol: 0.7 },
  shotgun: { freq: 1200, body: 90, decay: 0.3, vol: 1.1 },
  lmg: { freq: 1500, body: 110, decay: 0.18, vol: 1 },
  sniper: { freq: 1000, body: 70, decay: 0.5, vol: 1.2 },
  dmr: { freq: 1300, body: 90, decay: 0.3, vol: 1 },
  pistol: { freq: 2600, body: 180, decay: 0.08, vol: 0.65 },
};

export class Sfx {
  constructor() { this.ctx = null; }

  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  burst({ freq, type = 'lowpass', q = 0.7, vol, decay, delay = 0 }) {
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.05);
  }

  tone({ freq, to = freq, dur, vol, type = 'sine', delay = 0 }) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  shot(def, dist = 0) {
    if (!this.ctx || dist > 160) return;
    const p = PROFILES[def.sound] ?? PROFILES.rifle;
    const near = 1 / (1 + dist * 0.05);
    const freq = p.freq * (0.35 + 0.65 * near) * (0.9 + Math.random() * 0.2);
    this.burst({ freq, vol: p.vol * near, decay: p.decay * (1 + dist * 0.01) });
    this.tone({ freq: p.body, to: 35, dur: 0.12, vol: 0.9 * near });
    if (def.mode === 'bolt' && dist === 0) this.bolt(0.45);
    if (def.mode === 'pump' && dist === 0) this.bolt(0.35);
  }

  bolt(delay) {
    this.burst({ freq: 3000, type: 'bandpass', q: 4, vol: 0.4, decay: 0.05, delay });
    this.burst({ freq: 2200, type: 'bandpass', q: 4, vol: 0.4, decay: 0.05, delay: delay + 0.25 });
  }

  hit(head) {
    if (!this.ctx) return;
    this.tone({ freq: head ? 1800 : 1200, dur: 0.06, vol: 0.25, type: 'triangle' });
  }

  kill() {
    if (!this.ctx) return;
    this.tone({ freq: 880, dur: 0.12, vol: 0.25, type: 'triangle' });
    this.tone({ freq: 1320, dur: 0.18, vol: 0.25, type: 'triangle', delay: 0.07 });
  }

  hurt() { if (this.ctx) this.tone({ freq: 160, to: 60, dur: 0.15, vol: 0.5 }); }
  click() { if (this.ctx) this.burst({ freq: 4000, type: 'highpass', vol: 0.3, decay: 0.03 }); }

  reload(dur) {
    if (!this.ctx) return;
    this.burst({ freq: 2500, type: 'bandpass', q: 3, vol: 0.35, decay: 0.06, delay: dur * 0.25 });
    this.burst({ freq: 1800, type: 'bandpass', q: 3, vol: 0.4, decay: 0.07, delay: dur * 0.6 });
    this.burst({ freq: 3200, type: 'bandpass', q: 3, vol: 0.4, decay: 0.05, delay: dur * 0.9 });
  }

  step(sprint) { if (this.ctx) this.burst({ freq: sprint ? 500 : 380, vol: 0.12, decay: 0.08 }); }
  swing() { if (this.ctx) this.burst({ freq: 1500, type: 'bandpass', q: 1.5, vol: 0.3, decay: 0.15 }); }
  slide() { if (this.ctx) this.burst({ freq: 700, vol: 0.25, decay: 0.6 }); }
  pin() { if (this.ctx) this.burst({ freq: 5000, type: 'bandpass', q: 6, vol: 0.3, decay: 0.08 }); }

  explosion(dist) {
    if (!this.ctx) return;
    const near = 1 / (1 + dist * 0.04);
    this.burst({ freq: 700, vol: 1.4 * near, decay: 1.2 });
    this.tone({ freq: 90, to: 25, dur: 0.6, vol: 1.2 * near });
  }
}
