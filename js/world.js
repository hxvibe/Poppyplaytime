import * as THREE from 'three';

// 그랩팩 테스트용 방. 모든 grab 포즈를 시험할 수 있게 오브젝트를 배치합니다.
// userData.grab 값 = 손이 닿았을 때 사용할 포즈 이름 (config.js HAND_CLIPS 키)

const UP = new THREE.Vector3(0, 1, 0);

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const tex = {
  floor: () => canvasTex(256, 256, (g, w, h) => {
    const s = w / 2;
    const cols = ['#2f6f73', '#e8dcc0'];
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = cols[(x + y) % 2]; g.fillRect(x * s, y * s, s, s);
    }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3;
    for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }),
  wall: (base, band) => canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = band; g.fillRect(0, h * 0.78, w, h * 0.22);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, h * 0.77, w, 6);
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(2, 0); g.lineTo(2, h); g.stroke();
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.07})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 3); }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(40,25,10,0.08)'; g.fillRect(Math.random() * w, h * 0.6 + Math.random() * h * 0.4, 3, 60 + Math.random() * 90); }
  }),
  ceiling: () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#3b3a3f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2a292d'; g.lineWidth = 4; g.strokeRect(0, 0, w, h);
  }),
  hazard: () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e0b21c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1c1c1c';
    for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 64, h); g.lineTo(i * 64 + 32, h); g.lineTo(i * 64 + 32 + h, 0); g.lineTo(i * 64 + h, 0); g.fill(); }
  }),
  wood: () => canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#9a6a3c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(60,30,10,${0.1 + Math.random() * 0.2})`; g.lineWidth = 1 + Math.random() * 2; const y = Math.random() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 4, w, y + 2); g.stroke(); }
  }),
  letter: (ch, bg) => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#fff'; g.font = 'bold 84px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, w / 2, h / 2 + 4);
  }, false),
  scanner: (color, active) => canvasTex(128, 192, (g, w, h) => {
    g.fillStyle = active ? '#0b2a12' : '#0c0f18'; g.fillRect(0, 0, w, h);
    g.strokeStyle = active ? '#39ff6a' : color; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = active ? '#39ff6a' : color;
    // 단순한 손바닥 실루엣
    g.beginPath(); g.ellipse(w / 2, h * 0.64, 30, 34, 0, 0, Math.PI * 2); g.fill();
    const fingers = [[-24, 0.42, 34], [-8, 0.36, 44], [8, 0.36, 46], [24, 0.4, 38]];
    for (const [dx, fy, len] of fingers) { g.beginPath(); g.roundRect(w / 2 + dx - 7, h * fy - len * 0.5, 14, len, 7); g.fill(); }
    g.beginPath(); g.roundRect(w / 2 - 44, h * 0.6, 14, 34, 7); g.fill();
    if (active) { g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText('OK', w / 2, h - 18); }
  }, false),
  sign: (lines, fg, bg, w = 512, h = 256, size = 34) => canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lh = (h - 40) / lines.length;
    lines.forEach((l, i) => {
      g.font = `${i === 0 ? 'bold ' : ''}${i === 0 ? size * 1.15 : size}px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif`;
      g.fillText(l, w / 2, 20 + lh * (i + 0.5));
    });
  }, false),
};

// 박스 UV를 실제 크기에 맞춰 늘려서 타일이 늘어나 보이지 않게 함
function boxGeo(w, h, d, tile = 1) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
  }
  return geo;
}

export function buildWorld(scene, sfx) {
  const W = {
    colliders: [],   // { box: Box3, obj?: Object3D (움직이면 매 프레임 갱신) }
    rayTargets: [],  // 손이 맞을 수 있는 오브젝트
    bodies: [],      // 물리로 움직이는 물건
    updaters: [],
    state: { lightsOn: false, scanners: { L: false, R: false }, doorOpen: false, powered: false },
    lights: {},
    spawn: new THREE.Vector3(0, 0, 1.5),
  };

  scene.background = new THREE.Color(0x050507);
  scene.fog = new THREE.Fog(0x050507, 8, 30);

  const M = {
    floor: new THREE.MeshLambertMaterial({ map: tex.floor() }),
    wallA: new THREE.MeshLambertMaterial({ map: tex.wall('#6d8fa6', '#2c4b63') }),
    wallB: new THREE.MeshLambertMaterial({ map: tex.wall('#a6705a', '#5a2f2a') }),
    ceiling: new THREE.MeshLambertMaterial({ map: tex.ceiling() }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.45, metalness: 0.6 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.5 }),
    pipe: new THREE.MeshStandardMaterial({ color: 0xb04a2a, roughness: 0.5, metalness: 0.4 }),
    wood: new THREE.MeshLambertMaterial({ map: tex.wood() }),
    hazard: new THREE.MeshLambertMaterial({ map: tex.hazard() }),
    cabinet: new THREE.MeshLambertMaterial({ color: 0x4d6b4f }),
    rubberRed: new THREE.MeshStandardMaterial({ color: 0xc8302a, roughness: 0.7 }),
  };

  function addBox({ w, h, d, x, y, z, mat, tile = 1, grab = 'wall', collide = true, ray = true, parent = scene, ry = 0 }) {
    const m = new THREE.Mesh(boxGeo(w, h, d, tile), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.userData.grab = grab;
    parent.add(m);
    m.updateMatrixWorld(true);
    if (collide) W.colliders.push({ box: new THREE.Box3().setFromObject(m), obj: null });
    if (ray) W.rayTargets.push(m);
    return m;
  }

  // ───────── 방 A (x -6..6, z -12..4, 높이 4.5) ─────────
  const HA = 4.5;
  addBox({ w: 12.8, h: 0.2, d: 16.8, x: 0, y: -0.1, z: -4, mat: M.floor, tile: 1.2 });
  addBox({ w: 12.8, h: 0.2, d: 16.8, x: 0, y: HA + 0.1, z: -4, mat: M.ceiling, tile: 1.5 });
  addBox({ w: 12.8, h: HA, d: 0.4, x: 0, y: HA / 2, z: 4.2, mat: M.wallA, tile: 2 });
  addBox({ w: 0.4, h: HA, d: 16.8, x: -6.2, y: HA / 2, z: -4, mat: M.wallA, tile: 2 });
  addBox({ w: 0.4, h: HA, d: 16.8, x: 6.2, y: HA / 2, z: -4, mat: M.wallA, tile: 2 });
  // 앞벽 (가운데 문 구멍 x -1.5..1.5, 높이 3)
  addBox({ w: 4.9, h: HA, d: 0.4, x: -3.95, y: HA / 2, z: -12.2, mat: M.wallA, tile: 2 });
  addBox({ w: 4.9, h: HA, d: 0.4, x: 3.95, y: HA / 2, z: -12.2, mat: M.wallA, tile: 2 });
  addBox({ w: 3.0, h: HA - 3, d: 0.4, x: 0, y: 3 + (HA - 3) / 2, z: -12.2, mat: M.wallA, tile: 2 });
  // 문틀
  addBox({ w: 0.15, h: 3, d: 0.5, x: -1.57, y: 1.5, z: -12.2, mat: M.hazard, tile: 0.6 });
  addBox({ w: 0.15, h: 3, d: 0.5, x: 1.57, y: 1.5, z: -12.2, mat: M.hazard, tile: 0.6 });

  // 문 (양쪽 스캐너를 모두 켜면 위로 열림)
  const door = addBox({ w: 3.0, h: 3.0, d: 0.2, x: 0, y: 1.5, z: -12.2, mat: M.hazard, tile: 1.2, collide: false });
  const doorCol = { box: new THREE.Box3().setFromObject(door), obj: door };
  W.colliders.push(doorCol);
  W.door = door;

  // ───────── 방 B (x -3..3, z -20..-12.4, 높이 3.5) ─────────
  const HB = 3.5;
  addBox({ w: 6.8, h: 0.2, d: 8.2, x: 0, y: -0.1, z: -16.3, mat: M.floor, tile: 1.2 });
  addBox({ w: 6.8, h: 0.2, d: 8.2, x: 0, y: HB + 0.1, z: -16.3, mat: M.ceiling, tile: 1.5 });
  addBox({ w: 0.4, h: HB, d: 8.2, x: -3.2, y: HB / 2, z: -16.3, mat: M.wallB, tile: 2 });
  addBox({ w: 0.4, h: HB, d: 8.2, x: 3.2, y: HB / 2, z: -16.3, mat: M.wallB, tile: 2 });
  addBox({ w: 6.8, h: HB, d: 0.4, x: 0, y: HB / 2, z: -20.2, mat: M.wallB, tile: 2 });

  // ───────── 조명 ─────────
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x302820, 0.18);
  scene.add(hemi);
  const lampA = new THREE.PointLight(0xfff1dd, 0, 0, 2);
  lampA.position.set(0, 4.1, -4);
  scene.add(lampA);
  const emergency = new THREE.PointLight(0xff3a1a, 5, 14, 2);
  emergency.position.set(0, 3.6, -11.4);
  scene.add(emergency);
  const lampB = new THREE.PointLight(0xffe2b0, 0, 0, 2);
  lampB.position.set(0, 3.1, -16.5);
  scene.add(lampB);
  W.lights = { hemi, lampA, emergency, lampB };

  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff1dd, emissiveIntensity: 0.05 });
  for (const [x, z] of [[-3, -1], [3, -1], [-3, -7], [3, -7]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.12, 16), lampMat);
    l.position.set(x, HA - 0.06, z); scene.add(l);
  }
  const emerMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2200, emissiveIntensity: 2 });
  const emerMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), emerMat);
  emerMesh.position.copy(emergency.position).add(new THREE.Vector3(0, 0.25, 0.3)); scene.add(emerMesh);
  const lampBMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe2b0, emissiveIntensity: 0.02 });
  const lampBMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.1, 16), lampBMat);
  lampBMesh.position.set(0, HB - 0.05, -16.5); scene.add(lampBMesh);

  function setLights(on) {
    W.state.lightsOn = on;
    hemi.intensity = on ? 0.85 : 0.18;
    lampA.intensity = on ? 70 : 0;
    lampMat.emissiveIntensity = on ? 1.6 : 0.05;
    emergency.intensity = on ? 1.5 : 5;
  }
  W.setLights = setLights;

  // ───────── 천장 파이프 (grab: half) ─────────
  for (const x of [-2.5, 2.5]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 14, 12), M.pipe);
    p.rotation.x = Math.PI / 2; p.position.set(x, 3.85, -4.5);
    p.userData.grab = 'half'; scene.add(p); W.rayTargets.push(p);
    for (let z = 2; z > -11; z -= 3) {
      const brk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), M.darkMetal);
      brk.position.set(x, 4.2, z); scene.add(brk);
    }
  }

  // ───────── 레버 (왼쪽 벽, grab: handle) — 당기면 조명 ON/OFF ─────────
  {
    const base = addBox({ w: 0.1, h: 0.6, d: 0.35, x: -5.95, y: 1.45, z: -1.5, mat: M.darkMetal, collide: false });
    const pivot = new THREE.Group();
    pivot.position.set(-5.88, 1.45, -1.5);
    scene.add(pivot);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8), M.metal);
    arm.position.y = 0.225; pivot.add(arm);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 12), M.rubberRed);
    handle.rotation.x = Math.PI / 2; handle.position.y = 0.45; pivot.add(handle);
    const UPA = -0.55, DOWNA = -2.55;
    pivot.rotation.z = UPA;
    let target = UPA;
    const lever = { grab: 'handle' };
    lever.onPull = () => {
      const on = !W.state.lightsOn;
      target = on ? DOWNA : UPA;
      sfx.clunk();
      setTimeout(() => setLights(on), 250);
    };
    arm.userData = lever; handle.userData = lever;
    W.rayTargets.push(arm, handle);
    W.updaters.push((dt) => { pivot.rotation.z += (target - pivot.rotation.z) * Math.min(1, dt * 8); });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshBasicMaterial({ map: tex.sign(['조명', '레버를 당기세요'], '#ffd23a', '#1d1d22', 512, 256, 44) }));
    sign.position.set(-5.98, 2.1, -1.5); sign.rotation.y = Math.PI / 2; scene.add(sign);
    void base;
  }

  // ───────── 서랍장 (오른쪽 벽, 손잡이 grab: handle_half) ─────────
  {
    addBox({ w: 0.6, h: 1.0, d: 1.2, x: 5.7, y: 0.5, z: -4, mat: M.cabinet });
    const drawer = new THREE.Group();
    drawer.position.set(5.38, 0.7, -4);
    scene.add(drawer);
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 1.05), new THREE.MeshLambertMaterial({ color: 0x6b8f6d }));
    drawer.add(front);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 1.0), new THREE.MeshLambertMaterial({ color: 0x3d553f }));
    tray.position.set(0.27, -0.03, 0); drawer.add(tray);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.07, 10), M.metal);
    knob.rotation.z = Math.PI / 2; knob.position.x = -0.05; drawer.add(knob);
    const knobEnd = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), M.metal);
    knobEnd.position.x = -0.09; drawer.add(knobEnd);
    let open = false, x0 = 5.38;
    const rec = { grab: 'handle_half' };
    rec.onPull = () => { open = !open; sfx.clunk(); };
    for (const m of [knob, knobEnd]) { m.userData = rec; W.rayTargets.push(m); }
    front.userData = { grab: 'wall' }; W.rayTargets.push(front);
    W.updaters.push((dt) => {
      const tx = open ? x0 - 0.45 : x0;
      drawer.position.x += (tx - drawer.position.x) * Math.min(1, dt * 7);
    });
  }

  // ───────── 벽 선반 (grab: smallstraightedge) ─────────
  addBox({ w: 0.3, h: 0.05, d: 1.6, x: 5.85, y: 1.6, z: -7.5, mat: M.wood, tile: 0.6, grab: 'smallstraightedge' });
  // ───────── 작업대 (grab: straightedge) ─────────
  addBox({ w: 1.0, h: 0.08, d: 2.4, x: -3, y: 0.78, z: -6, mat: M.wood, tile: 0.8, grab: 'straightedge' });
  for (const [dx, dz] of [[-0.42, -1.1], [0.42, -1.1], [-0.42, 1.1], [0.42, 1.1]]) {
    addBox({ w: 0.07, h: 0.74, d: 0.07, x: -3 + dx, y: 0.37, z: -6 + dz, mat: M.darkMetal, collide: false });
  }

  // ───────── 핸드 스캐너 (앞벽) — 파란 손은 파란 스캐너, 빨간 손은 빨간 스캐너 ─────────
  const scanners = {};
  for (const [side, x, color] of [['L', -2.6, '#3d7bff'], ['R', 2.6, '#ff3d3d']]) {
    const idle = tex.scanner(color, false), act = tex.scanner(color, true);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.86, 0.06), M.darkMetal);
    frame.position.set(x, 1.5, -11.97); scene.add(frame);
    const mat = new THREE.MeshStandardMaterial({ map: idle, emissiveMap: idle, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.3 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75), mat);
    screen.position.set(x, 1.5, -11.935); scene.add(screen);
    const rec = { grab: 'wall', scanner: side };
    rec.onTouch = (handSide) => {
      if (W.state.scanners[side]) return;
      if (handSide !== side) { sfx.beep(false); return; }
      W.state.scanners[side] = true;
      mat.map = act; mat.emissiveMap = act; mat.needsUpdate = true;
      sfx.beep(true);
      if (W.state.scanners.L && W.state.scanners.R) openDoor();
    };
    screen.userData = rec; frame.userData = rec;
    W.rayTargets.push(screen, frame);
    scanners[side] = screen;
  }
  W.scanners = scanners;

  let doorT = 0;
  function openDoor() {
    if (W.state.doorOpen) return;
    W.state.doorOpen = true;
    sfx.rumble(2.2);
  }
  W.openDoor = openDoor;
  W.updaters.push((dt) => {
    if (!W.state.doorOpen || doorT >= 1) return;
    doorT = Math.min(1, doorT + dt / 2.2);
    const e = doorT * doorT * (3 - 2 * doorT);
    door.position.y = 1.5 + e * 3.0;
    door.updateMatrixWorld(true);
    doorCol.box.setFromObject(door);
  });

  // ───────── 배터리 소켓 (방 B) ─────────
  addBox({ w: 0.5, h: 1.0, d: 0.5, x: 0, y: 0.5, z: -18.6, mat: M.darkMetal });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 20), M.metal);
  ring.rotation.x = Math.PI / 2; ring.position.set(0, 1.01, -18.6); scene.add(ring);
  const socketPoint = new THREE.Vector3(0, 1.15, -18.6);
  const powerTexOff = tex.sign(['POWER', '배터리를 꽂으세요'], '#555', '#111', 512, 256, 40);
  const powerTexOn = tex.sign(['POWER ON', '테스트 완료!'], '#39ff6a', '#06210d', 512, 256, 40);
  const powerMat = new THREE.MeshBasicMaterial({ map: powerTexOff });
  const powerSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), powerMat);
  powerSign.position.set(0, 2.2, -19.98); scene.add(powerSign);

  // ───────── 안내판 ─────────
  {
    const t = tex.sign([
      '그랩팩 테스트',
      '트리거: 손 발사 (누르고 있으면 붙잡기)',
      '트리거 떼기: 회수 / 물건 끌어오기',
      '물건 든 채 트리거: 던지기',
      '그립: 붙잡은 곳으로 몸 끌어당기기 / 내려놓기',
      'A: 손전등   B: 플레어',
      '왼쪽 스틱: 이동   오른쪽 스틱: 회전',
    ], '#f4e7c5', '#1b2430', 1024, 640, 40);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ map: t }));
    board.position.set(2.4, 1.6, 0.4); board.rotation.y = -0.6; scene.add(board);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), M.darkMetal);
    post.position.set(2.4, 0.55, 0.4); scene.add(post);
  }

  // ───────── 움직이는 물건 ─────────
  function addBody(mesh, { r, grab, kind = grab, mass = 1 }) {
    mesh.userData.grab = grab;
    const body = { mesh, r, vel: new THREE.Vector3(), held: false, locked: false, grounded: false, kind, mass, spin: new THREE.Vector3() };
    mesh.userData.body = body;
    scene.add(mesh);
    W.rayTargets.push(mesh);
    W.bodies.push(body);
    return body;
  }

  // 공 (grab: sphere)
  for (const [x, z, c] of [[1.4, -3, 0xd8352a], [2.2, -5, 0xf2c230], [0.6, -6.5, 0x3fae4a]]) {
    const ballTex = canvasTex(128, 64, (g, w, h) => {
      g.fillStyle = '#' + c.toString(16).padStart(6, '0'); g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, h * 0.42, w, h * 0.16);
    }, false);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.45 }));
    m.position.set(x, 0.14, z);
    addBody(m, { r: 0.14, grab: 'sphere' });
  }
  // 장난감 블록 (grab: cornerbox)
  for (const [x, z, ch, bg] of [[-1.2, -4, 'A', '#c0392b'], [-1.7, -4.6, 'B', '#2471a3']]) {
    const t = tex.letter(ch, bg);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshLambertMaterial({ map: t }));
    m.position.set(x, 0.17, z); m.rotation.y = Math.random();
    addBody(m, { r: 0.17, grab: 'cornerbox' });
  }
  // 긴 판자 (grab: straightedge)
  {
    const m = new THREE.Mesh(boxGeo(0.18, 0.05, 0.9, 0.5), M.wood);
    m.position.set(-3.1, 0.85, -5.3);
    addBody(m, { r: 0.06, grab: 'straightedge' });
  }
  // 비디오테이프 같은 납작한 물건 (grab: smallstraightedge)
  {
    const t = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#151515'; g.fillRect(0, 0, w, h); g.fillStyle = '#e9e2cf'; g.fillRect(14, 14, w - 28, h - 28); g.fillStyle = '#333'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText('TEST', w / 2, h / 2 + 6); }, false);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.025, 0.105), [M.darkMetal, M.darkMetal, new THREE.MeshLambertMaterial({ map: t }), M.darkMetal, M.darkMetal, M.darkMetal]);
    m.position.set(-2.8, 0.84, -6.6); m.rotation.y = 0.4;
    addBody(m, { r: 0.04, grab: 'smallstraightedge' });
  }
  // 작은 부품 (grab: fingertips)
  {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 12), new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.4, metalness: 0.3 }));
    m.position.set(5.85, 1.67, -7.6);
    addBody(m, { r: 0.04, grab: 'fingertips' });
  }
  // 배터리 (grab: handle) — 방 B 소켓에 넣으면 전원 ON
  {
    const g = new THREE.Group();
    const bodyM = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 16), new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.35, metalness: 0.2, emissive: 0x0a3d1d }));
    g.add(bodyM);
    const cap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.03, 16), M.metal); cap1.position.y = 0.135; g.add(cap1);
    const cap2 = cap1.clone(); cap2.position.y = -0.135; g.add(cap2);
    const nub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 10), M.metal); nub.position.y = 0.165; g.add(nub);
    g.position.set(-2.75, 0.89, -6.95); g.rotation.z = Math.PI / 2;
    const b = addBody(g, { r: 0.07, grab: 'handle', kind: 'battery' });
    W.battery = b;
  }

  // ───────── 플레어 ─────────
  const flareLight = new THREE.PointLight(0xff3a1a, 0, 12, 1.6);
  scene.add(flareLight);
  const flareMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff3010, emissiveIntensity: 3 }));
  flareMesh.visible = false; scene.add(flareMesh);
  const flare = { active: false, life: 0, vel: new THREE.Vector3(), r: 0.03 };
  W.spawnFlare = (pos, vel) => {
    flare.active = true; flare.life = 18;
    flareMesh.position.copy(pos); flare.vel.copy(vel);
    flareMesh.visible = true;
  };
  W.flareLight = flareLight;

  // ───────── 물리 ─────────
  const _cp = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _axis = new THREE.Vector3();

  function collideSphere(pos, vel, r, restitution = 0.35) {
    let grounded = false;
    for (const c of W.colliders) {
      const b = c.box;
      if (pos.x < b.min.x - r || pos.x > b.max.x + r || pos.y < b.min.y - r || pos.y > b.max.y + r || pos.z < b.min.z - r || pos.z > b.max.z + r) continue;
      b.clampPoint(pos, _cp);
      _d.subVectors(pos, _cp);
      let dist = _d.length();
      if (dist >= r) continue;
      if (dist < 1e-6) { _d.set(0, 1, 0); dist = 0; } else _d.divideScalar(dist);
      pos.addScaledVector(_d, r - dist);
      const vn = vel.dot(_d);
      if (vn < 0) vel.addScaledVector(_d, -(1 + restitution) * vn);
      if (_d.y > 0.6) grounded = true;
    }
    return grounded;
  }
  W.collideSphere = collideSphere;

  function stepBodies(dt) {
    for (const b of W.bodies) {
      if (b.held || b.locked) continue;
      b.vel.y -= 9.8 * dt;
      if (b.vel.length() > 25) b.vel.setLength(25);
      const p = b.mesh.position;
      p.addScaledVector(b.vel, dt);
      b.grounded = collideSphere(p, b.vel, b.r, b.kind === 'sphere' ? 0.55 : 0.2);
      if (b.grounded) {
        const f = Math.max(0, 1 - (b.kind === 'sphere' ? 0.8 : 6) * dt);
        b.vel.x *= f; b.vel.z *= f;
        if (Math.abs(b.vel.y) < 0.2) b.vel.y = 0;
      }
      if (b.kind === 'sphere') {
        const sp = Math.hypot(b.vel.x, b.vel.z);
        if (sp > 0.01) {
          _axis.set(b.vel.z, 0, -b.vel.x).normalize();
          _q.setFromAxisAngle(_axis, (sp / b.r) * dt);
          b.mesh.quaternion.premultiply(_q);
        }
      } else if (b.grounded) {
        // 바닥에 닿으면 천천히 눕혀서 안정된 자세로
        _e.setFromQuaternion(b.mesh.quaternion, 'YXZ');
        const snap = (a) => Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
        _q.setFromEuler(new THREE.Euler(snap(_e.x), _e.y, snap(_e.z), 'YXZ'));
        b.mesh.quaternion.slerp(_q, Math.min(1, dt * 6));
      } else if (b.spin.lengthSq() > 0) {
        _q.setFromEuler(new THREE.Euler(b.spin.x * dt, b.spin.y * dt, b.spin.z * dt));
        b.mesh.quaternion.multiply(_q);
      }
      if (p.y < -5) { p.copy(W.spawn).add(new THREE.Vector3(0, 1, -1)); b.vel.set(0, 0, 0); }
    }
    // 물건끼리 겹치지 않게 밀어냄
    const bs = W.bodies;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], c = bs[j];
      if ((a.held || a.locked) && (c.held || c.locked)) continue;
      _d.subVectors(c.mesh.position, a.mesh.position);
      const dist = _d.length(), min = a.r + c.r;
      if (dist >= min || dist < 1e-6) continue;
      _d.divideScalar(dist);
      const push = min - dist;
      const wa = (a.held || a.locked) ? 0 : (c.held || c.locked) ? 1 : 0.5;
      const wc = 1 - wa;
      a.mesh.position.addScaledVector(_d, -push * wa);
      c.mesh.position.addScaledVector(_d, push * wc);
      const rv = _d.dot(_cp.subVectors(c.vel, a.vel));
      if (rv < 0) { a.vel.addScaledVector(_d, rv * wa); c.vel.addScaledVector(_d, -rv * wc); }
    }
  }

  W.update = (dt, time) => {
    stepBodies(dt);
    for (const u of W.updaters) u(dt, time);

    // 배터리 소켓
    const bat = W.battery;
    const bd = bat.mesh.position.distanceTo(socketPoint);
    if (!W.state.powered && bd < 0.5) {
      bat.held = false; bat.owner = null;
      W.state.powered = true;
      bat.locked = true; bat.vel.set(0, 0, 0);
      bat.mesh.position.copy(socketPoint);
      bat.mesh.quaternion.identity();
      powerMat.map = powerTexOn; powerMat.needsUpdate = true;
      lampB.intensity = 35; lampBMat.emissiveIntensity = 1.5;
      sfx.powerUp();
    }

    // 플레어
    if (flare.active) {
      flare.life -= dt;
      flare.vel.y -= 9.8 * dt;
      flareMesh.position.addScaledVector(flare.vel, dt);
      if (collideSphere(flareMesh.position, flare.vel, flare.r, 0.3)) { flare.vel.x *= 0.9; flare.vel.z *= 0.9; }
      flareMesh.rotation.x += dt * 6;
      flareLight.position.copy(flareMesh.position).y += 0.08;
      const fade = Math.min(1, flare.life / 2);
      flareLight.intensity = (14 + Math.sin(time * 37) * 3 + Math.sin(time * 13) * 2) * fade;
      if (flare.life <= 0) { flare.active = false; flareMesh.visible = false; flareLight.intensity = 0; }
    }
  };

  // 플레이어 몸통 충돌 (XZ 평면 원)
  W.resolvePlayer = (pos, r = 0.25) => {
    for (const c of W.colliders) {
      const b = c.box;
      if (b.max.y < 0.3 || b.min.y > 1.8) continue;
      const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
      const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      const d = Math.sqrt(d2);
      if (d < 1e-6) {
        // 박스 안쪽: 가장 가까운 면으로 밀어냄
        const opts = [[b.min.x - r - pos.x, 0], [b.max.x + r - pos.x, 0], [0, b.min.z - r - pos.z], [0, b.max.z + r - pos.z]];
        opts.sort((a, c2) => Math.hypot(...a) - Math.hypot(...c2));
        pos.x += opts[0][0]; pos.z += opts[0][1];
      } else {
        pos.x += (dx / d) * (r - d);
        pos.z += (dz / d) * (r - d);
      }
    }
  };

  setLights(false);
  return W;
}

export { UP };
