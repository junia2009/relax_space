import * as THREE from 'three';

let renderer = null;
let scene = null;
let camera = null;
let animId = null;
let clock = null;
let updaters = [];

export function initScene(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);
}

export function startThemeScene(theme) {
  stopScene();
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  updaters = [];
  clock.start();

  if (theme === 'ocean') buildOcean();
  else if (theme === 'forest') buildForest();
  else if (theme === 'space') buildSpace();
  else if (theme === 'fire') buildFire();

  tick();
}

export function stopScene() {
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  updaters = [];
  if (scene) {
    scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    scene.clear();
  }
}

function onResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function tick() {
  animId = requestAnimationFrame(tick);
  const t = clock.getElapsedTime();
  updaters.forEach(fn => fn(t));
  renderer.render(scene, camera);
}

// ─── helpers ──────────────────────────────────────────────────────────────
function addLight(color, intensity, x, y, z, range) {
  const l = new THREE.PointLight(color, intensity, range ?? 0);
  l.position.set(x, y, z);
  scene.add(l);
  return l;
}

function particleSystem(count, spread, color, size, blend = THREE.AdditiveBlending) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * spread.x;
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread.y;
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.8, blending: blend, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  return { pts, geo, mat, pos };
}

// ─── Ocean ────────────────────────────────────────────────────────────────
function buildOcean() {
  scene.background = new THREE.Color(0x000c1a);
  scene.fog = new THREE.FogExp2(0x000c1a, 0.04);
  camera.position.set(0, 0, 18);

  scene.add(new THREE.AmbientLight(0x0a1a33, 1));
  const l1 = addLight(0x0055cc, 2, 0, 6, 6, 40);
  const l2 = addLight(0x00ccee, 1, -6, -3, 4, 30);

  updaters.push(t => {
    l1.intensity = 2 + Math.sin(t * 0.6) * 0.4;
    l2.intensity = 1 + Math.cos(t * 0.4) * 0.3;
  });

  // Rising plankton particles
  const { geo, pos, mat } = particleSystem(400, { x: 35, y: 25, z: 22 }, 0x33aaff, 0.07);
  const baseY = pos.slice();
  updaters.push(t => {
    for (let i = 0; i < 400; i++) {
      pos[i * 3 + 1] += 0.008;
      if (pos[i * 3 + 1] > 12.5) pos[i * 3 + 1] = -12.5;
      pos[i * 3]     += Math.sin(t * 0.3 + i * 0.17) * 0.002;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = 0.55 + Math.sin(t * 0.5) * 0.1;
  });

  // Jellyfish
  for (let j = 0; j < 5; j++) {
    const grp = new THREE.Group();
    const r = 0.6 + Math.random() * 0.5;
    const bodyGeo = new THREE.SphereGeometry(r, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x33aaff, emissive: 0x002244, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    grp.add(new THREE.Mesh(bodyGeo, bodyMat));

    for (let k = 0; k < 6; k++) {
      const tGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.2 + Math.random() * 0.8, 4);
      const tMat = new THREE.MeshBasicMaterial({ color: 0x44bbff, transparent: true, opacity: 0.18 });
      const t = new THREE.Mesh(tGeo, tMat);
      const a = (k / 6) * Math.PI * 2;
      t.position.set(Math.sin(a) * r * 0.5, -r - 0.7, Math.cos(a) * r * 0.5);
      grp.add(t);
    }

    grp.position.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    const baseY = grp.position.y;
    const sp = 0.25 + Math.random() * 0.25;
    const ph = Math.random() * Math.PI * 2;
    scene.add(grp);
    updaters.push(t => {
      grp.position.y = baseY + Math.sin(t * sp + ph) * 0.6;
      grp.rotation.y = t * 0.08 + ph;
    });
  }
}

// ─── Forest ───────────────────────────────────────────────────────────────
function buildForest() {
  scene.background = new THREE.Color(0x020804);
  scene.fog = new THREE.FogExp2(0x020804, 0.03);
  camera.position.set(0, 1, 18);

  scene.add(new THREE.AmbientLight(0x0a1a0a, 0.6));
  addLight(0x334422, 0.4, 0, 8, 4);

  // Firefly particles
  const FC = 220;
  const { geo, pos, mat } = particleSystem(FC, { x: 28, y: 14, z: 18 }, 0x99ffaa, 0.14);
  const fPhase = Array.from({ length: FC }, () => Math.random() * Math.PI * 2);
  const fSpeed = Array.from({ length: FC }, () => 0.6 + Math.random() * 1.2);
  updaters.push(t => {
    for (let i = 0; i < FC; i++) {
      pos[i * 3]     += Math.sin(t * fSpeed[i] * 0.18 + fPhase[i]) * 0.012;
      pos[i * 3 + 1] += Math.cos(t * fSpeed[i] * 0.14 + fPhase[i]) * 0.008;
      pos[i * 3 + 2] += Math.sin(t * fSpeed[i] * 0.09 + fPhase[i] * 1.4) * 0.005;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = 0.55 + Math.sin(t * 1.8) * 0.25;
  });

  // Tree silhouettes
  const trunkMat = new THREE.MeshPhongMaterial({ color: 0x0d0a06 });
  const foliageMat = new THREE.MeshPhongMaterial({ color: 0x071407, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 10; i++) {
    const grp = new THREE.Group();
    const h = 3.5 + Math.random() * 4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, h, 6), trunkMat);
    trunk.position.y = h / 2;
    grp.add(trunk);
    for (let k = 0; k < 3; k++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3 - k * 0.2, 2.2, 7), foliageMat);
      cone.position.y = h + k * 1.3;
      grp.add(cone);
    }
    const x = (Math.random() - 0.5) * 32;
    const z = -6 - Math.random() * 18;
    grp.position.set(x, -5, z);
    scene.add(grp);
    const ph = Math.random() * Math.PI * 2;
    updaters.push(t => { grp.rotation.z = Math.sin(t * 0.28 + ph) * 0.018; });
  }
}

// ─── Space ────────────────────────────────────────────────────────────────
function buildSpace() {
  scene.background = new THREE.Color(0x000008);
  camera.position.set(0, 0, 15);

  scene.add(new THREE.AmbientLight(0x0a0820, 0.5));
  addLight(0x5533ff, 0.6, 0, 0, 8, 60);

  // Star field
  const SC = 2500;
  const { pts: starPts, geo: sGeo, mat: sMat } = particleSystem(SC, { x: 120, y: 120, z: 80 }, 0xffffff, 0.09);
  const sPos = sGeo.attributes.position.array;
  for (let i = 0; i < SC; i++) sPos[i * 3 + 2] = -10 - Math.random() * 110;
  sGeo.attributes.position.needsUpdate = true;

  updaters.push(t => {
    starPts.rotation.y = t * 0.008;
    starPts.rotation.x = t * 0.003;
    sMat.opacity = 0.75 + Math.sin(t * 0.4) * 0.1;
  });

  // Nebula clouds
  [0x3300ff, 0xcc0055, 0x0033ff, 0x550088].forEach((color, i) => {
    const geo = new THREE.SphereGeometry(3 + Math.random() * 3, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 12, -18 - Math.random() * 20);
    scene.add(mesh);
    updaters.push(t => {
      mesh.rotation.x = t * 0.04 + i;
      mesh.rotation.y = t * 0.025 + i;
      mat.opacity = 0.025 + Math.sin(t * 0.18 + i) * 0.012;
    });
  });

  // Bright twinkling stars
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.SphereGeometry(0.06, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const s = new THREE.Mesh(geo, mat);
    s.position.set((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 12, -4 - Math.random() * 12);
    scene.add(s);
    const ph = Math.random() * Math.PI * 2;
    updaters.push(t => { mat.opacity = 0.5 + Math.sin(t * 1.4 + ph) * 0.4; });
  }
}

// ─── Fire ─────────────────────────────────────────────────────────────────
function buildFire() {
  scene.background = new THREE.Color(0x060200);
  scene.fog = new THREE.FogExp2(0x060200, 0.04);
  camera.position.set(0, 2, 14);
  camera.lookAt(0, 0.5, 0);

  scene.add(new THREE.AmbientLight(0x220a00, 0.4));

  // Ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshPhongMaterial({ color: 0x100600 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.2;
  scene.add(ground);

  // Logs
  const logMat = new THREE.MeshPhongMaterial({ color: 0x251008 });
  [[-0.55, 40], [0.55, -40]].forEach(([x, rot]) => {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 7), logMat);
    log.rotation.z = (rot * Math.PI) / 180;
    log.position.set(x * 0.5, -2, 0);
    scene.add(log);
  });

  // Flickering fire light
  const fireLight = addLight(0xff5500, 4, 0, 0.5, 0, 18);
  updaters.push(t => {
    fireLight.intensity = 3.5 + Math.sin(t * 9) * 0.7 + Math.sin(t * 14.3) * 0.4;
    fireLight.color.setHSL(0.06 + Math.sin(t * 6) * 0.02, 1, 0.5);
  });

  // Fire particles
  const FC = 180;
  const fPos = new Float32Array(FC * 3);
  const fLife = new Float32Array(FC);
  const fSpd = new Float32Array(FC);
  const resetFire = i => {
    fPos[i * 3]     = (Math.random() - 0.5) * 1.0;
    fPos[i * 3 + 1] = -1.8 + Math.random() * 0.4;
    fPos[i * 3 + 2] = (Math.random() - 0.5) * 0.9;
    fLife[i] = 0;
    fSpd[i] = 0.022 + Math.random() * 0.04;
  };
  for (let i = 0; i < FC; i++) resetFire(i);
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  const fMat = new THREE.PointsMaterial({ color: 0xff4400, size: 0.22, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(fGeo, fMat));

  // Ember particles (tiny, high-rising)
  const EC = 70;
  const ePos = new Float32Array(EC * 3);
  const eLife = new Float32Array(EC);
  const eSpd = new Float32Array(EC);
  const eDrift = new Float32Array(EC * 2);
  const resetEmber = i => {
    ePos[i * 3]     = (Math.random() - 0.5) * 0.6;
    ePos[i * 3 + 1] = -1.5 + Math.random() * 0.3;
    ePos[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    eLife[i] = 0;
    eSpd[i] = 0.012 + Math.random() * 0.02;
    eDrift[i * 2]     = (Math.random() - 0.5) * 0.008;
    eDrift[i * 2 + 1] = (Math.random() - 0.5) * 0.008;
  };
  for (let i = 0; i < EC; i++) resetEmber(i);
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  const eMat = new THREE.PointsMaterial({ color: 0xffaa00, size: 0.07, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(eGeo, eMat));

  updaters.push(t => {
    for (let i = 0; i < FC; i++) {
      fPos[i * 3 + 1] += fSpd[i];
      fPos[i * 3]     += Math.sin(t * 2.8 + i * 0.4) * 0.003;
      fLife[i] += fSpd[i] * 0.45;
      if (fLife[i] > 1 || fPos[i * 3 + 1] > 2.5) resetFire(i);
    }
    fGeo.attributes.position.needsUpdate = true;
    fMat.color.setHSL(0.06 + Math.sin(t * 4) * 0.025, 1, 0.5);

    for (let i = 0; i < EC; i++) {
      ePos[i * 3]     += eDrift[i * 2] + Math.sin(t * 1.5 + i) * 0.003;
      ePos[i * 3 + 1] += eSpd[i];
      ePos[i * 3 + 2] += eDrift[i * 2 + 1];
      eLife[i] += eSpd[i] * 0.3;
      if (eLife[i] > 1 || ePos[i * 3 + 1] > 6) resetEmber(i);
    }
    eGeo.attributes.position.needsUpdate = true;
  });
}
