import * as THREE from 'three';

const unit = new THREE.BoxGeometry(1, 1, 1);
const cache = new Map();

export function lambert(color) {
  if (!cache.has(color)) cache.set(color, new THREE.MeshLambertMaterial({ color }));
  return cache.get(color);
}

export function part(parent, color, w, h, d, x, y, z) {
  const m = new THREE.Mesh(unit, typeof color === 'number' ? lambert(color) : color);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// A box stretched between two points, used for limbs.
const Z = new THREE.Vector3(0, 0, 1);
export function limb(parent, color, from, to, thick) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const m = part(parent, color, thick, thick, dir.length(), 0, 0, 0);
  m.position.copy(from).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(Z, dir.normalize());
  return m;
}

const BLACK = 0x1b1c1f, METAL = 0x3b4046, WOOD = 0x734b2a, TAN = 0x9b8763, STEEL = 0xb8bcc2;
const RED_DOT = new THREE.MeshBasicMaterial({ color: 0xff2020 });

// Front post tip sits exactly at height y, which is the aim point when ADS.
function irons(g, frontZ, rearZ, y) {
  part(g, BLACK, 0.01, 0.03, 0.01, 0, y - 0.015, frontZ);
  part(g, BLACK, 0.008, 0.035, 0.02, -0.016, y - 0.012, rearZ);
  part(g, BLACK, 0.008, 0.035, 0.02, 0.016, y - 0.012, rearZ);
}

function scope(g, y) {
  part(g, BLACK, 0.045, 0.045, 0.3, 0, y, 0);
  part(g, BLACK, 0.06, 0.06, 0.06, 0, y, 0.15);
  part(g, BLACK, 0.065, 0.065, 0.07, 0, y, -0.16);
  part(g, METAL, 0.02, y - 0.04, 0.03, 0, (y + 0.04) / 2, -0.07);
  part(g, METAL, 0.02, y - 0.04, 0.03, 0, (y + 0.04) / 2, 0.08);
}

const BUILDERS = {
  rifle(g) {
    part(g, METAL, 0.06, 0.08, 0.42, 0, 0, 0);
    part(g, BLACK, 0.07, 0.075, 0.26, 0, 0.003, -0.33);
    part(g, BLACK, 0.024, 0.024, 0.22, 0, 0.015, -0.57);
    part(g, BLACK, 0.036, 0.036, 0.05, 0, 0.015, -0.69);
    part(g, BLACK, 0.045, 0.1, 0.075, 0, -0.08, -0.07).rotation.x = 0.15;
    part(g, BLACK, 0.045, 0.1, 0.075, 0, -0.16, -0.1).rotation.x = 0.45;
    part(g, BLACK, 0.04, 0.1, 0.05, 0, -0.08, 0.13).rotation.x = -0.35;
    part(g, BLACK, 0.05, 0.085, 0.26, 0, -0.015, 0.33);
    part(g, BLACK, 0.03, 0.012, 0.4, 0, 0.046, -0.05);
    irons(g, -0.42, 0.12, 0.075);
    return { sightY: 0.075, muzzleZ: -0.72, grip: [0, -0.1, 0.14], fore: [0, -0.03, -0.32] };
  },
  carbine(g) {
    part(g, BLACK, 0.055, 0.085, 0.36, 0, 0, 0);
    part(g, BLACK, 0.07, 0.07, 0.24, 0, 0.005, -0.3);
    part(g, BLACK, 0.022, 0.022, 0.2, 0, 0.015, -0.52);
    part(g, BLACK, 0.03, 0.03, 0.05, 0, 0.015, -0.64);
    part(g, BLACK, 0.04, 0.16, 0.075, 0, -0.11, -0.06).rotation.x = 0.1;
    part(g, BLACK, 0.04, 0.1, 0.05, 0, -0.08, 0.12).rotation.x = -0.35;
    part(g, BLACK, 0.03, 0.03, 0.18, 0, 0.0, 0.26);
    part(g, BLACK, 0.05, 0.09, 0.14, 0, -0.02, 0.38);
    part(g, BLACK, 0.03, 0.012, 0.36, 0, 0.048, -0.04);
    // red dot: hollow frame so the camera can look through it
    part(g, BLACK, 0.03, 0.02, 0.06, 0, 0.062, 0);
    part(g, BLACK, 0.006, 0.05, 0.05, -0.024, 0.09, 0);
    part(g, BLACK, 0.006, 0.05, 0.05, 0.024, 0.09, 0);
    part(g, BLACK, 0.054, 0.006, 0.05, 0, 0.117, 0);
    part(g, RED_DOT, 0.003, 0.003, 0.003, 0, 0.09, -0.02);
    return { sightY: 0.09, muzzleZ: -0.67, grip: [0, -0.1, 0.13], fore: [0, -0.03, -0.3] };
  },
  smg(g) {
    part(g, BLACK, 0.055, 0.08, 0.3, 0, 0, 0);
    part(g, BLACK, 0.022, 0.022, 0.12, 0, 0.012, -0.2);
    part(g, BLACK, 0.035, 0.1, 0.04, 0, -0.09, -0.12);
    part(g, BLACK, 0.035, 0.14, 0.06, 0, -0.1, -0.03).rotation.x = 0.25;
    part(g, BLACK, 0.04, 0.1, 0.05, 0, -0.08, 0.1).rotation.x = -0.3;
    part(g, BLACK, 0.045, 0.06, 0.04, 0, -0.01, 0.17);
    irons(g, -0.13, 0.11, 0.065);
    return { sightY: 0.065, muzzleZ: -0.27, grip: [0, -0.1, 0.11], fore: [0, -0.12, -0.12] };
  },
  shotgun(g) {
    part(g, BLACK, 0.07, 0.1, 0.6, 0, 0, -0.05);
    part(g, BLACK, 0.03, 0.03, 0.42, -0.018, -0.065, -0.2);
    part(g, BLACK, 0.03, 0.03, 0.42, 0.018, -0.065, -0.2);
    part(g, METAL, 0.075, 0.06, 0.14, 0, -0.06, -0.32);
    part(g, BLACK, 0.026, 0.026, 0.12, 0, 0.02, -0.4);
    part(g, BLACK, 0.04, 0.1, 0.05, 0, -0.1, -0.02).rotation.x = -0.3;
    part(g, BLACK, 0.03, 0.012, 0.4, 0, 0.056, -0.1);
    irons(g, -0.3, 0.05, 0.08);
    return { sightY: 0.08, muzzleZ: -0.47, grip: [0, -0.11, -0.01], fore: [0, -0.07, -0.32] };
  },
  lmg(g) {
    part(g, BLACK, 0.08, 0.1, 0.45, 0, 0, 0);
    part(g, METAL, 0.075, 0.08, 0.25, 0, 0, -0.34);
    part(g, BLACK, 0.035, 0.035, 0.32, 0, 0.015, -0.6);
    part(g, METAL, 0.02, 0.02, 0.3, -0.03, -0.05, -0.55);
    part(g, METAL, 0.02, 0.02, 0.3, 0.03, -0.05, -0.55);
    part(g, 0x3d4430, 0.1, 0.12, 0.12, -0.06, -0.1, -0.05);
    part(g, BLACK, 0.04, 0.11, 0.05, 0, -0.09, 0.14).rotation.x = -0.35;
    part(g, BLACK, 0.06, 0.09, 0.28, 0, -0.02, 0.36);
    part(g, BLACK, 0.02, 0.05, 0.08, 0, 0.08, -0.2);
    irons(g, -0.66, 0.12, 0.08);
    return { sightY: 0.08, muzzleZ: -0.78, grip: [0, -0.11, 0.15], fore: [0, -0.04, -0.34] };
  },
  sniper(g) {
    part(g, METAL, 0.06, 0.08, 0.4, 0, 0, 0);
    part(g, TAN, 0.07, 0.11, 0.34, 0, -0.03, 0.32);
    part(g, TAN, 0.07, 0.07, 0.3, 0, -0.01, -0.3);
    part(g, BLACK, 0.028, 0.028, 0.45, 0, 0.012, -0.62);
    part(g, BLACK, 0.04, 0.04, 0.05, 0, 0.012, -0.86);
    part(g, METAL, 0.06, 0.015, 0.015, 0.05, 0.02, 0.1);
    part(g, TAN, 0.04, 0.1, 0.05, 0, -0.09, 0.14).rotation.x = -0.35;
    scope(g, 0.095);
    return { sightY: 0.095, muzzleZ: -0.9, grip: [0, -0.1, 0.15], fore: [0, -0.05, -0.3], adsZ: -0.32 };
  },
  dmr(g) {
    part(g, METAL, 0.06, 0.08, 0.4, 0, 0, 0);
    part(g, WOOD, 0.06, 0.12, 0.3, 0, -0.03, 0.32);
    part(g, WOOD, 0.075, 0.075, 0.3, 0, 0, -0.33);
    part(g, BLACK, 0.026, 0.026, 0.4, 0, 0.012, -0.66);
    part(g, BLACK, 0.045, 0.15, 0.07, 0, -0.1, -0.06).rotation.x = 0.15;
    part(g, WOOD, 0.04, 0.1, 0.05, 0, -0.09, 0.14).rotation.x = -0.35;
    scope(g, 0.095);
    return { sightY: 0.095, muzzleZ: -0.88, grip: [0, -0.1, 0.15], fore: [0, -0.04, -0.33], adsZ: -0.32 };
  },
  pistol(g) {
    part(g, METAL, 0.034, 0.04, 0.2, 0, 0.02, -0.02);
    part(g, BLACK, 0.032, 0.03, 0.15, 0, -0.01, -0.01);
    part(g, BLACK, 0.034, 0.12, 0.05, 0, -0.07, 0.06).rotation.x = -0.25;
    irons(g, -0.1, 0.07, 0.055);
    return { sightY: 0.055, muzzleZ: -0.13, grip: [0, -0.08, 0.06], fore: [0, -0.1, 0.03], hip: [0.17, -0.17, -0.38] };
  },
  knife(g) {
    part(g, BLACK, 0.03, 0.035, 0.11, 0, 0, 0.02);
    part(g, METAL, 0.05, 0.012, 0.012, 0, 0, -0.04);
    part(g, STEEL, 0.008, 0.035, 0.19, 0, 0.004, -0.14);
    return { sightY: 0, muzzleZ: -0.25, grip: [0, 0, 0.02], hip: [0.2, -0.2, -0.36] };
  },
};

export function buildGun(kind) {
  const g = new THREE.Group();
  g.userData = { adsZ: -0.3, hip: [0.2, -0.21, -0.5], ...BUILDERS[kind](g) };
  return g;
}

const SKIN = 0xc8976d, PANTS = 0x3c4232, BOOT = 0x1d1d1d, SHIRT = 0x434a3a;

export function buildSoldier(teamColor) {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  const dark = new THREE.Color(teamColor).multiplyScalar(0.5).getHex();

  const leg = (x) => {
    const g = new THREE.Group();
    g.position.set(x, 0.9, 0);
    part(g, PANTS, 0.2, 0.8, 0.24, 0, -0.4, 0);
    part(g, BOOT, 0.22, 0.14, 0.3, 0, -0.83, -0.03);
    root.add(g);
    return g;
  };
  const legL = leg(-0.12), legR = leg(0.12);

  const upper = new THREE.Group();
  upper.position.y = 0.9;
  root.add(upper);
  part(upper, SHIRT, 0.5, 0.6, 0.28, 0, 0.3, 0);
  part(upper, teamColor, 0.56, 0.42, 0.34, 0, 0.32, 0);
  part(upper, SKIN, 0.26, 0.28, 0.26, 0, 0.74, 0);
  part(upper, dark, 0.32, 0.14, 0.32, 0, 0.9, 0);
  part(upper, 0x111111, 0.2, 0.05, 0.02, 0, 0.77, -0.135);
  limb(upper, SHIRT, new THREE.Vector3(0.3, 0.52, 0), new THREE.Vector3(0.12, 0.38, -0.3), 0.13);
  limb(upper, SHIRT, new THREE.Vector3(-0.3, 0.52, 0), new THREE.Vector3(0.0, 0.43, -0.55), 0.13);

  const gunHolder = new THREE.Group();
  gunHolder.position.set(0.08, 0.47, -0.3);
  upper.add(gunHolder);

  return {
    root, upper, legL, legR,
    setGun(model) {
      gunHolder.clear();
      gunHolder.add(buildGun(model));
    },
  };
}

export function makeLabel(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = 'bold 34px Rajdhani, sans-serif';
  x.textAlign = 'center';
  x.lineWidth = 6;
  x.strokeStyle = 'rgba(0,0,0,0.8)';
  x.strokeText(text, 128, 44);
  x.fillStyle = color;
  x.fillText(text, 128, 44);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(1.4, 0.35, 1);
  s.renderOrder = 10;
  return s;
}
