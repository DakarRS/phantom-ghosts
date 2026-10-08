import * as THREE from 'three';

const unit = new THREE.BoxGeometry(1, 1, 1);
const mats = new Map();
let ribTex = null;

function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

function speckle(x, s, n, base) {
  x.fillStyle = base;
  x.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) {
    const v = Math.random() * 60 - 30;
    x.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 300})`;
    x.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
}

function mat(color, kind) {
  const key = `${color}:${kind}`;
  if (!mats.has(key)) {
    const m = new THREE.MeshLambertMaterial({ color });
    if (kind === 'rib') {
      ribTex ??= canvasTex(128, (x, s) => {
        x.fillStyle = '#fff'; x.fillRect(0, 0, s, s);
        for (let i = 0; i < 16; i++) {
          const g = x.createLinearGradient(i * 8, 0, i * 8 + 8, 0);
          g.addColorStop(0, '#9a9a9a'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#b5b5b5');
          x.fillStyle = g; x.fillRect(i * 8, 0, 8, s);
        }
      });
      m.map = ribTex;
    }
    mats.set(key, m);
  }
  return mats.get(key);
}

// Renders the shared map data and sets up sky, lighting and ground.
export function buildWorld(scene, map) {
  scene.background = new THREE.Color(0xa9c4dc);
  scene.fog = new THREE.Fog(0xa9c4dc, 70, 200);

  scene.add(new THREE.HemisphereLight(0xe2efff, 0x6b6250, 1.4));
  const sun = new THREE.DirectionalLight(0xfff0d4, 2.6);
  sun.position.set(40, 70, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 1, far: 200 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  const groundTex = canvasTex(256, (x, s) => {
    speckle(x, s, 5000, '#8f8d86');
    x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 3; x.strokeRect(0, 0, s, s);
  }, 50);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshLambertMaterial({ map: groundTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  for (const b of map.boxes) {
    const m = new THREE.Mesh(unit, mat(b.color, b.kind));
    m.scale.set(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
    m.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
}
