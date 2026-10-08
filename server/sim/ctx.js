// Per-room simulation state. Each room runs in its own worker thread, so every room gets its own copy of this module.
export const G = {
  time: 0,
  entities: [],
  world: null,
  match: null,
  grenades: null,
  events: [],
  emit(...ev) { this.events.push(ev); },
  // An event only one human should see: hitmarkers, damage direction, their own death.
  direct(entity, ...ev) { entity.client?.queue.push(ev); },
};

export const r2 = (n) => Math.round(n * 100) / 100;
