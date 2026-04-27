

import './style.css';
import * as THREE from 'three';

// 初期画面：開始ボタンのみ
document.querySelector('#app').innerHTML = `
  <div id="start-screen" style="width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:#001d2e;">
    <button id="start-btn" style="font-size:2rem;padding:1.2em 2.5em;border-radius:1.5em;border:none;background:#44ddee;color:#fff;box-shadow:0 4px 16px #0008;cursor:pointer;">リラックスを始める</button>
  </div>
  <audio id="bgm" loop></audio>
`;

document.getElementById('start-btn').addEventListener('click', () => {
  // 画面を3D空間に切り替え
  document.querySelector('#app').innerHTML = `<div id="three-container" style="width:100vw;height:100vh;"></div><audio id="bgm" loop controls style="position:fixed;bottom:16px;left:16px;z-index:1000;"></audio>`;

  // Three.jsセットアップ
  const container = document.getElementById('three-container');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x001d2e); // 深海色

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 10;

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  // 簡単な海の生き物（球体）を複数配置
  const creatures = [];
  for (let i = 0; i < 5; i++) {
    const geometry = new THREE.SphereGeometry(0.7 + Math.random(), 32, 32);
    const material = new THREE.MeshPhongMaterial({ color: 0x44ddee, transparent: true, opacity: 0.7 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 6
    );
    scene.add(mesh);
    creatures.push({ mesh, speed: 0.005 + Math.random() * 0.01 });
  }

  // ライト
  const ambientLight = new THREE.AmbientLight(0x226688, 1.2);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0x88ccff, 1, 100);
  pointLight.position.set(0, 5, 10);
  scene.add(pointLight);

  // アニメーション
  function animate() {
    requestAnimationFrame(animate);
    creatures.forEach((c, i) => {
      c.mesh.position.x += Math.sin(Date.now() * 0.0005 + i) * c.speed;
      c.mesh.position.y += Math.cos(Date.now() * 0.0007 + i) * c.speed * 0.5;
    });
    renderer.render(scene, camera);
  }
  animate();

  // BGM再生
  let bgm = document.getElementById('bgm');
  if (!bgm) {
    bgm = document.createElement('audio');
    bgm.id = 'bgm';
    bgm.loop = true;
    document.body.appendChild(bgm);
  }
  bgm.src = 'https://cdn.pixabay.com/audio/2022/10/16/audio_12b6b1b7b7.mp3'; // フリーの海の音
  bgm.volume = 0.5;
  // controls付きなので、ユーザーが再生ボタンを押せば音が流れます
  bgm.play().catch(e => {
    console.warn('BGM再生はユーザー操作が必要です。再生ボタンを押してください。', e);
  });
});
