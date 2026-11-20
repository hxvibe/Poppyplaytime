import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { CONFIG } from './config.js';
import { Sfx } from './audio.js';
import { buildWorld } from './world.js';
import { Input } from './input.js';
import { Grabpack } from './grabpack.js';

const UP = new THREE.Vector3(0, 1, 0);
const params = new URLSearchParams(location.search);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('debug') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.03, 60);
const player = new THREE.Group();
player.add(camera);
scene.add(player);
camera.position.set(0, 1.6, 0);

const sfx = new Sfx();
const world = buildWorld(scene, sfx);
player.position.copy(world.spawn);

const input = new Input(renderer, camera, player, renderer.domElement);
const grabpack = new Grabpack({ scene, world, sfx, input, player, camera });

// ───────── UI ─────────
const ui = {
  overlay: document.getElementById('overlay'),
  bar: document.getElementById('bar'),
  status: document.getElementById('status'),
  buttons: document.getElementById('buttons'),
  desktop: document.getElementById('desktop'),
  hud: document.getElementById('hud'),
};

grabpack.load((p) => { ui.bar.style.width = `${Math.round(p * 100)}%`; })
  .then(() => {
    ui.status.textContent = '준비 완료!';
    ui.bar.parentElement.style.display = 'none';
    ui.buttons.style.display = 'flex';
    const vrBtn = VRButton.createButton(renderer, { optionalFeatures: ['local-floor', 'bounded-floor'] });
    vrBtn.addEventListener('click', () => sfx.unlock());
    vrBtn.style.position = 'static';
    vrBtn.style.left = vrBtn.style.bottom = '';
    vrBtn.classList.add('vr-btn');
    ui.buttons.prepend(vrBtn);
    window.__ready = true;
  })
  .catch((err) => {
    console.error(err);
    ui.status.textContent = '모델을 불러오지 못했어요: ' + err.message;
  });

ui.desktop.addEventListener('click', () => {
  sfx.unlock();
  input.desktopActive = true;
  ui.overlay.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  renderer.domElement.requestPointerLock?.();
});
document.addEventListener('pointerlockchange', () => {
  if (!input.desktopActive || renderer.xr.isPresenting) return;
  const locked = document.pointerLockElement === renderer.domElement;
  ui.hud.classList.toggle('paused', !locked);
});

renderer.xr.addEventListener('sessionstart', () => {
  sfx.unlock();
  ui.overlay.classList.add('hidden');
  ui.hud.classList.add('hidden');
  camera.rotation.set(0, 0, 0);
});
renderer.xr.addEventListener('sessionend', () => {
  camera.position.set(0, 1.6, 0);
  camera.rotation.set(input.pitch, 0, 0);
  ui.overlay.classList.remove('hidden');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ───────── 이동 ─────────
const _head = new THREE.Vector3(), _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _mv = new THREE.Vector2(), _res = new THREE.Vector3();
let snapReady = true;

function locomotion(dt) {
  const inXR = renderer.xr.isPresenting;
  if (inXR) {
    // 왼쪽 스틱: 머리 방향 기준 이동
    _mv.copy(input.sides.L.stick);
    if (_mv.length() < 0.15) _mv.set(0, 0);
    // 오른쪽 스틱: 스냅 회전
    const tx = input.sides.R.stick.x;
    if (Math.abs(tx) > 0.7 && snapReady) {
      snapReady = false;
      const ang = -Math.sign(tx) * CONFIG.snapTurnDeg * Math.PI / 180;
      camera.getWorldPosition(_head);
      player.position.sub(_head).applyAxisAngle(UP, ang).add(_head);
      player.rotation.y += ang;
    } else if (Math.abs(tx) < 0.3) snapReady = true;
  } else {
    // 마우스 시점
    const sens = 0.0022;
    player.rotation.y -= input.look.x * sens;
    input.pitch = THREE.MathUtils.clamp(input.pitch - input.look.y * sens, -1.4, 1.4);
    camera.rotation.set(input.pitch, 0, 0);
    input.look.set(0, 0);
    input.desktopMove(_mv);
  }
  if (_mv.lengthSq() > 0) {
    camera.getWorldDirection(_fwd);
    _fwd.y = 0; _fwd.normalize();
    _right.crossVectors(_fwd, UP);
    const sp = CONFIG.moveSpeed * dt * Math.min(1, _mv.length());
    const m = _mv.clone().normalize();
    player.position.addScaledVector(_fwd, -m.y * sp).addScaledVector(_right, m.x * sp);
  }
  // 벽 충돌
  player.updateMatrixWorld(true);
  camera.getWorldPosition(_head);
  _res.copy(_head);
  world.resolvePlayer(_res, 0.25);
  player.position.x += _res.x - _head.x;
  player.position.z += _res.z - _head.z;
}

// PC 미리보기: 두 런처가 화면 가운데(조준점)를 향하도록
const _ray = new THREE.Raycaster(), _aim = new THREE.Vector3(), _sp = new THREE.Vector3(), _ctr = new THREE.Vector2(0, 0);
function aimDesktopLaunchers() {
  _ray.setFromCamera(_ctr, camera);
  _ray.far = 40;
  const hit = _ray.intersectObjects(world.rayTargets, true)[0];
  _aim.copy(hit ? hit.point : _ray.ray.at(20, _aim));
  grabpack.aimPoint = _aim;
  for (const s of ['L', 'R']) {
    const o = input.sim[s];
    o.getWorldPosition(_sp);
    o.lookAt(_sp.multiplyScalar(2).sub(_aim)); // -Z가 조준점을 향함
    o.updateMatrixWorld(true);
  }
}

// ───────── 루프 ─────────
const clock = new THREE.Clock();
let time = 0;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  input.update();
  if (window.__ready && (input.desktopActive || renderer.xr.isPresenting)) locomotion(dt);
  player.updateMatrixWorld(true);
  if (!renderer.xr.isPresenting) aimDesktopLaunchers();
  else grabpack.aimPoint = null;
  if (window.__ready) grabpack.update(dt);
  world.update(dt, time);
  renderer.render(scene, (!renderer.xr.isPresenting && window.__debugCam) || camera);
}
renderer.setAnimationLoop(loop);

// 디버그/테스트용
window.__game = { THREE, scene, camera, player, renderer, world, input, grabpack, sfx };
