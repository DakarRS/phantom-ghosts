// Shared runtime state so systems can reach each other without threading every dependency through constructors.
export const G = {
  time: 0,
  scene: null,
  camera: null,
  player: null,
  arsenal: null,
  effects: null,
  audio: null,
  hud: null,
  net: null,
  remotes: null,
  myId: null,
  team: null,
  roster: new Map(),
  score: [0, 0],
  timeLeft: 600,
  shake: 0,
};
