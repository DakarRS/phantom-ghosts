// Remote players are drawn this far in the past so there are always two snapshots to interpolate between.
const INTERP = 0.1;

export class Net {
  constructor() {
    this.ws = null;
    this.offset = null;
    this.onMessage = null;
    this.onClose = null;
  }

  async rooms() {
    const r = await fetch('/api/rooms', { cache: 'no-store' });
    if (!r.ok) throw new Error('Server list unavailable');
    return r.json();
  }

  connect(room, name) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      let joined = false;
      this.ws = ws;
      this.offset = null;
      ws.onopen = () => ws.send(JSON.stringify({ t: 'join', room, name }));
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.t === 'welcome') { joined = true; resolve(m); }
        else if (m.t === 'full') { ws.close(); reject(new Error('That server is full')); }
        else this.onMessage?.(m);
      };
      ws.onclose = () => {
        if (this.ws === ws) this.ws = null;
        if (joined) this.onClose?.();
        else reject(new Error('Could not connect to the server'));
      };
    });
  }

  leave() {
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }

  send(m) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }

  // Smoothed estimate of server time; snapping on big jumps (tab was asleep, server restarted).
  sync(st) {
    const sample = st - performance.now() / 1000;
    if (this.offset == null || Math.abs(sample - this.offset) > 1) this.offset = sample;
    else this.offset += (sample - this.offset) * 0.05;
  }

  renderTime() { return performance.now() / 1000 + (this.offset ?? 0) - INTERP; }
}
