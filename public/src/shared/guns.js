// damage is [close, far] interpolated across range [start, end] metres; spreads are radians.
export const GUNS = {
  ak12: {
    name: 'AK-12', model: 'rifle', modes: ['auto', 'semi'], rpm: 700, damage: [34, 22], range: [45, 90], headMult: 1.4,
    mag: 30, reserve: 150, reload: 2.4, hip: 0.045, ads: 0.004, move: 0.02, recoil: [0.014, 0.007],
    adsFov: 52, adsTime: 0.2, walk: 1, sound: 'rifle',
  },
  m4a1: {
    name: 'M4A1', model: 'carbine', modes: ['auto', 'semi'], rpm: 800, damage: [30, 20], range: [50, 100], headMult: 1.4,
    mag: 30, reserve: 150, reload: 2.2, hip: 0.04, ads: 0.003, move: 0.018, recoil: [0.011, 0.006],
    adsFov: 54, adsTime: 0.18, walk: 1.02, sound: 'carbine',
  },
  mp5k: {
    name: 'MP5K', model: 'smg', modes: ['auto', 'semi'], rpm: 900, damage: [28, 14], range: [20, 60], headMult: 1.5,
    mag: 30, reserve: 180, reload: 1.9, hip: 0.035, ads: 0.008, move: 0.012, recoil: [0.009, 0.008],
    adsFov: 60, adsTime: 0.14, walk: 1.08, sound: 'smg',
  },
  ksg: {
    name: 'KSG-12', model: 'shotgun', mode: 'pump', rpm: 75, pellets: 8, damage: [26, 8], range: [10, 35], headMult: 1.2,
    mag: 7, reserve: 28, reload: 3.0, hip: 0.07, ads: 0.055, move: 0.01, recoil: [0.06, 0.02],
    adsFov: 62, adsTime: 0.18, walk: 1.05, sound: 'shotgun',
  },
  m60: {
    name: 'M60', model: 'lmg', mode: 'auto', rpm: 550, damage: [38, 26], range: [60, 120], headMult: 1.4,
    mag: 100, reserve: 200, reload: 5.2, hip: 0.06, ads: 0.006, move: 0.03, recoil: [0.016, 0.01],
    adsFov: 54, adsTime: 0.3, walk: 0.88, sound: 'lmg',
  },
  intervention: {
    name: 'INTERVENTION', model: 'sniper', mode: 'bolt', rpm: 45, damage: [100, 80], range: [120, 250], headMult: 3,
    mag: 5, reserve: 30, reload: 3.3, hip: 0.12, ads: 0, move: 0.05, recoil: [0.09, 0.01],
    adsFov: 18, adsTime: 0.32, walk: 0.9, sound: 'sniper', scope: true,
  },
  svd: {
    name: 'DRAGUNOV SVD', model: 'dmr', mode: 'semi', rpm: 300, damage: [62, 48], range: [80, 160], headMult: 2,
    mag: 10, reserve: 50, reload: 2.8, hip: 0.08, ads: 0.001, move: 0.04, recoil: [0.04, 0.012],
    adsFov: 30, adsTime: 0.28, walk: 0.94, sound: 'dmr', scope: true,
  },
  m9: {
    name: 'M9', model: 'pistol', mode: 'semi', rpm: 600, damage: [30, 18], range: [20, 60], headMult: 1.5,
    mag: 15, reserve: 60, reload: 1.6, hip: 0.02, ads: 0.006, move: 0.008, recoil: [0.02, 0.006],
    adsFov: 62, adsTime: 0.12, walk: 1.1, sound: 'pistol',
  },
  knife: {
    name: 'KNIFE', model: 'knife', mode: 'melee', rpm: 110, damage: [100, 100], range: [0, 2.8], headMult: 1,
    mag: 0, reserve: 0, reload: 0, hip: 0, ads: 0, move: 0, recoil: [0, 0], adsFov: 80, adsTime: 0.1, walk: 1.18,
  },
};

export const CLASSES = [
  { name: 'ASSAULT', guns: ['ak12', 'm4a1'] },
  { name: 'SCOUT', guns: ['mp5k', 'ksg'] },
  { name: 'SUPPORT', guns: ['m60'] },
  { name: 'RECON', guns: ['intervention', 'svd'] },
];

export const FRAG = { name: 'M67 FRAG' };

export function damageAt(def, dist) {
  const [d0, d1] = def.damage;
  const [r0, r1] = def.range;
  if (dist <= r0) return d0;
  if (dist >= r1) return d1;
  return d0 + (d1 - d0) * (dist - r0) / (r1 - r0);
}
