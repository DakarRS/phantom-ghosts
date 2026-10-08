// Shared runtime state so systems can reach each other without threading every dependency through constructors.
export const G = {
  time: 0,
  entities: [],
  scene: null,
  camera: null,
  player: null,
  arsenal: null,
  effects: null,
  audio: null,
  hud: null,
  match: null,
  grenades: null,
  world: null,
};
