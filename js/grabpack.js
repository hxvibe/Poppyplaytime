import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG, HAND_CLIPS, PACK_CLIPS } from './config.js';
import { Cable } from './cable.js';

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const ZERO_SCALE = new THREE.Vector3(1e-4, 1e-4, 1e-4);

const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _s1 = new THREE.Vector3();
const _qId = new THREE.Quaternion();

// 손 모델(원본 단위)의 손바닥 중심과 두께
const PALM_CENTER = new THREE.Vector3(-0.12, 0.36, 0);
const PALM_HALF_THICK = 0.14;

const smooth = (t) => t * t * (3 - 2 * t);

export class Grabpack {
  constructor({ scene, world, sfx, input, player, camera }) {
    this.scene = scene;
    this.world = world;
    this.sfx = sfx;
    this.input = input;
    this.player = player;
    this.camera = camera;
    this.sides = {};
    this.raycaster = new THREE.Raycaster();
    this.flashlightOn = false;
    this.flareCooldown = 0;
    this.time = 0;
    this._dockPos = new THREE.Vector3();
    this._dockQuat = new THREE.Quaternion();
    this._packScaleM = new THREE.Matrix4().makeScale(CONFIG.packScale, CONFIG.packScale, CONFIG.packScale);
    this._dockLocal = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 70 * DEG);
  }

  async load(onProgress = () => {}) {
    const loader = new GLTFLoader();
    const prog = { pack: 0, hand: 0 };
    const report = () => onProgress((prog.pack + prog.hand) / 2);
    const load = (url, key) => new Promise((res, rej) => loader.load(url, res, (e) => { if (e.total) { prog[key] = e.loaded / e.total; report(); } }, rej));
    const [packG, handG] = await Promise.all([
      load('models/grabpack.glb', 'pack'),
      load('models/grabpack_hand.glb', 'hand'),
    ]);
    this._setupPack(packG);
    this._setupHands(handG);
  }

  // ───────────────────────── 팩(런처) ─────────────────────────
  _setupPack(g) {
    const root = g.scene;
    root.name = 'GrabpackRoot';
    this.scene.add(root);
    this.packRoot = root;
    root.traverse((o) => {
      if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; }
      if (o.isMesh && o.material && o.material.name === 'BlackUnlitMaterial') {
        o.material = o.material.clone();
        o.material.color.set(0x111111);
        o.material.emissive = new THREE.Color(0xfff2d0);
        o.material.emissiveIntensity = 0;
        this.lensMat = o.material;
      }
    });
    root.updateMatrixWorld(true);
    const get = (n) => {
      const o = root.getObjectByName(n);
      if (!o) console.warn('[grabpack] node not found', n);
      return o;
    };

    const names = {
      L: { gun: 'JNT_L_Grabpack_Gun_018', trigger: 'JNT_L_Grabpack_Trigger_019', socket: 'SCT_L_HandAttachment_027' },
      R: { gun: 'JNT_R_Grabpack_Gun_05', trigger: 'JNT_R_Grabpack_Trigger_06', socket: 'SCT_R_HandAttachment_017' },
    };
    const hOff = new THREE.Vector3().fromArray(CONFIG.handleOffset);
    for (const side of ['L', 'R']) {
      const gun = get(names[side].gun);
      gun.updateMatrix();
      const trig = get(names[side].trigger).getWorldPosition(new THREE.Vector3());
      const handle = trig.add(hOff);
      const S = {
        side,
        gun,
        socket: get(names[side].socket),
        restPos: gun.position.clone(),
        restQuat: gun.quaternion.clone(),
        restScale: gun.scale.clone(),
        restLocalInv: gun.matrix.clone().invert(),
        // 손잡이를 원점으로 한 런처의 상대 위치
        gunOffset: new THREE.Matrix4().makeTranslation(-handle.x, -handle.y, -handle.z).multiply(gun.matrixWorld),
        aim: new THREE.Matrix4(),
        aimPos: new THREE.Vector3(),
        aimQuat: new THREE.Quaternion(),
        fwd: new THREE.Vector3(0, 0, 1),
        muzzle: new THREE.Vector3(),
        actions: {},
      };
      this.sides[side] = S;
    }
    this.gunParentInv = this.sides.R.gun.parent.matrixWorld.clone().invert();
    this.flashExt = get('JNT_R_Grabpack_FlashlightExtension_08');

    // 사용할 클립을 쪼개서 준비
    const mixer = new THREE.AnimationMixer(root);
    this.packMixer = mixer;
    const find = (n) => g.animations.find((c) => c.name === n || c.name.endsWith('|' + n));
    const build = (n, filter, label) => {
      const c = find(n);
      if (!c) { console.warn('[grabpack] pack clip missing', n); return null; }
      const tracks = c.tracks.filter((t) => filter(t.name) && !/JNT_Camera|SCT_Camera|GrabpackParent|Root_01/.test(t.name));
      return new THREE.AnimationClip(label, c.duration, tracks);
    };
    const once = (clip, clamp = false) => {
      if (!clip) return null;
      const a = mixer.clipAction(clip);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = clamp;
      return a;
    };
    const sideFilter = (side) => (n) => n.includes(side === 'L' ? '_L_' : '_R_') && !n.includes('Flashlight');
    for (const side of ['L', 'R']) {
      const A = this.sides[side].actions;
      const pick = (def) => (find(def[side]) ? def[side] : def.fallback);
      A.shootOut = once(build(pick(PACK_CLIPS.shootOut), sideFilter(side), 'shootOut_' + side));
      A.shootIn = once(build(pick(PACK_CLIPS.shootIn), sideFilter(side), 'shootIn_' + side));
    }
    this.sides.R.actions.flare = once(build(find(PACK_CLIPS.shootFlare.R) ? PACK_CLIPS.shootFlare.R : PACK_CLIPS.shootFlare.fallback, sideFilter('R'), 'flare_R'));
    // 손전등: 뚜껑/연장부(유지)와 런처 흔들림(한 번)으로 분리
    const isFlash = (n) => n.includes('Flashlight');
    const isGesture = (n) => n.includes('_R_') && !n.includes('Flashlight');
    this.flash = {
      onLid: once(build(PACK_CLIPS.flashlightOn, isFlash, 'flashOnLid'), true),
      onGesture: once(build(PACK_CLIPS.flashlightOn, isGesture, 'flashOnGesture')),
      offLid: once(build(PACK_CLIPS.flashlightOff, isFlash, 'flashOffLid'), true),
      offGesture: once(build(PACK_CLIPS.flashlightOff, isGesture, 'flashOffGesture')),
      timer: 0,
    };

    // 매 프레임 애니메이션 전 초기 자세로 되돌릴 노드들
    const animated = new Set();
    for (const a of mixer._actions) for (const t of a.getClip().tracks) animated.add(THREE.PropertyBinding.parseTrackName(t.name).nodeName);
    this.packRest = [];
    for (const n of animated) {
      const o = root.getObjectByName(n);
      if (o) this.packRest.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]);
    }

    // 손전등 빛
    const spot = new THREE.SpotLight(0xfff2d8, 0, 22, 0.42, 0.55, 1.4);
    spot.castShadow = false;
    this.scene.add(spot, spot.target);
    this.spot = spot;
  }

  // ───────────────────────── 손 ─────────────────────────
  _setupHands(g) {
    // 0초짜리 포즈 클립 보정 + 빠진 트랙을 기본 자세로 채워서 포즈 전환 시 잔상이 없게 함
    const base = g.scene;
    const clips = {};
    for (const [key, name] of Object.entries(HAND_CLIPS)) {
      const c = g.animations.find((a) => a.name.includes(name));
      if (!c) { console.warn('[grabpack] hand clip missing', name); continue; }
      clips[key] = c.clone();
    }
    const allTracks = new Map();
    for (const c of Object.values(clips)) for (const t of c.tracks) if (!allTracks.has(t.name)) allTracks.set(t.name, t);
    for (const c of Object.values(clips)) {
      const have = new Set(c.tracks.map((t) => t.name));
      for (const [name, ref] of allTracks) {
        if (have.has(name)) continue;
        const pb = THREE.PropertyBinding.parseTrackName(name);
        const node = base.getObjectByName(pb.nodeName);
        if (!node) continue;
        const val = node[pb.propertyName];
        if (!val || !val.toArray) continue;
        const T = ref.constructor;
        c.tracks.push(new T(name, [0], val.toArray()));
      }
      if (c.duration <= 0) c.duration = 1;
    }
    this.handClips = clips;
    this.handDuration = { fired: clips.fired?.duration ?? 0.2, retract: clips.retract?.duration ?? 0.3 };

    for (const side of ['L', 'R']) {
      const model = side === 'L' ? base : SkeletonUtils.clone(base);
      const holder = new THREE.Group();
      const inner = new THREE.Group();
      const mirror = side === 'R' && CONFIG.mirrorRightHand;
      inner.scale.set(CONFIG.handScale * (mirror ? -1 : 1), CONFIG.handScale, CONFIG.handScale);
      inner.add(model);
      holder.add(inner);
      this.scene.add(holder);
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        if (side === 'R') {
          const mat = o.material.clone();
          const tint = new THREE.Vector3().fromArray(CONFIG.rightHandTint);
          mat.onBeforeCompile = (sh) => {
            sh.uniforms.uTint = { value: tint };
            sh.fragmentShader = 'uniform vec3 uTint;\n' + sh.fragmentShader.replace(
              '#include <map_fragment>',
              '#include <map_fragment>\n\tdiffuseColor.rgb = diffuseColor.bgr * uTint;'
            );
          };
          mat.customProgramCacheKey = () => 'grabpack-red-hand';
          o.material = mat;
        }
      });
      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      for (const [key, clip] of Object.entries(clips)) {
        const a = mixer.clipAction(clip);
        if (key === 'fired' || key === 'retract') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
        actions[key] = a;
      }
      const cable = new Cable();
      this.scene.add(cable.mesh);
      const H = {
        holder, mixer, actions, current: null, mirror, cable,
        state: 'docked',
        pos: new THREE.Vector3(),
        quat: new THREE.Quaternion(),
        fromQuat: new THREE.Quaternion(),
        targetPos: new THREE.Vector3(),
        targetQuat: new THREE.Quaternion(),
        target: null,
        holdT: 0,
        flyT: 0,
        carried: null,
        carriedRel: new THREE.Matrix4(),
        returnPoseAt: -1,
      };
      this.sides[side].hand = H;
      this._pose(side, 'default', 0);
    }
  }

  _pose(side, key, fade = 0.12) {
    const H = this.sides[side].hand;
    const next = H.actions[key] || H.actions.straight;
    if (!next) return;
    if (H.current === next) {
      if (key === 'fired' || key === 'retract') next.reset().play();
      return;
    }
    next.reset();
    next.setEffectiveWeight(1);
    if (fade > 0 && H.current) {
      next.fadeIn(fade).play();
      H.current.fadeOut(fade);
    } else {
      if (H.current) H.current.stop();
      next.play();
    }
    H.current = next;
  }

  _playPack(action) {
    if (!action) return;
    action.reset();
    action.setEffectiveWeight(1);
    action.play();
  }

  _pan(side) { return side === 'L' ? -0.5 : 0.5; }

  // ───────────────────────── 동작 ─────────────────────────
  fire(side) {
    const S = this.sides[side], H = S.hand;
    if (H.state !== 'docked') return;
    const inp = this.input.sides[side];
    this._playPack(S.actions.shootOut);
    this._pose(side, 'fired', 0.04);
    this.sfx.fire(this._pan(side));
    inp.pulse?.(0.6, 60);

    // 들고 있는 물건이 있으면 던지기
    if (H.carried) {
      const b = H.carried;
      b.held = false; b.owner = null;
      b.vel.copy(S.fwd).multiplyScalar(CONFIG.throwSpeed).addScaledVector(UP, 1.2);
      b.spin.set(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
      H.carried = null;
      H.returnPoseAt = this.time + 0.25;
      return;
    }

    // 조준 방향으로 레이캐스트 (PC 미리보기에서는 화면 조준점으로 정확히)
    const dir = this.aimPoint ? _v2.subVectors(this.aimPoint, S.muzzle).normalize() : S.fwd;
    this.raycaster.set(_v1.copy(S.muzzle).addScaledVector(dir, -0.05), dir);
    this.raycaster.far = CONFIG.maxRange;
    const hits = this.raycaster.intersectObjects(this.world.rayTargets, true);
    let target = null;
    for (const h of hits) {
      let o = h.object;
      while (o && !(o.userData && o.userData.grab)) o = o.parent;
      if (!o) continue;
      if (o.userData.body && o.userData.body === this.sides[side === 'L' ? 'R' : 'L'].hand.carried) continue;
      const nWorld = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : S.fwd.clone().negate();
      if (nWorld.dot(S.fwd) > 0) nWorld.negate();
      o.updateMatrixWorld(true);
      const inv = _m1.copy(o.matrixWorld).invert();
      target = {
        obj: o,
        rec: o.userData,
        localPoint: o.worldToLocal(h.point.clone()),
        localNormal: nWorld.clone().transformDirection(inv),
        point: h.point.clone(),
        normal: nWorld,
        hit: true,
      };
      break;
    }
    if (!target) {
      target = { hit: false, point: S.muzzle.clone().addScaledVector(dir, CONFIG.maxRange), normal: dir.clone().negate() };
    }
    H.target = target;
    H.state = 'flying';
    H.flyFrom = H.pos.clone();
    H.fromQuat.copy(H.quat);
    H.flyT = 0;
    H.cable.mesh.visible = true;
  }

  _surfacePose(side, point, normal, key, outPos, outQuat) {
    const S = this.sides[side], H = S.hand;
    // 손가락 방향: 월드 위쪽을 표면에 투영 (바닥/천장이면 조준 방향 사용)
    const U = _v2.copy(UP).addScaledVector(normal, -UP.dot(normal));
    if (U.lengthSq() < 0.09) U.copy(S.fwd).addScaledVector(normal, -S.fwd.dot(normal));
    if (U.lengthSq() < 1e-6) U.set(0, 0, -1);
    U.normalize();
    const palm = _v3.copy(normal).negate();
    const X = _v4.crossVectors(U, palm).normalize();
    _m2.makeBasis(X, U, palm);
    outQuat.setFromRotationMatrix(_m2);
    const hs = CONFIG.handScale;
    const pc = _v1.set(PALM_CENTER.x * (H.mirror ? -1 : 1) * hs, PALM_CENTER.y * hs, 0).applyQuaternion(outQuat);
    const gap = PALM_HALF_THICK * hs + (key === 'straight' ? 0.004 : 0.02);
    outPos.copy(point).addScaledVector(normal, gap).sub(pc);
  }

  _targetWorld(H) {
    const t = H.target;
    if (t.hit) {
      t.obj.updateMatrixWorld(true);
      t.point.copy(t.localPoint).applyMatrix4(t.obj.matrixWorld);
      t.normal.copy(t.localNormal).transformDirection(t.obj.matrixWorld);
    }
    return t;
  }

  _arrive(side) {
    const S = this.sides[side], H = S.hand, t = H.target;
    const inp = this.input.sides[side];
    if (!t.hit) { this._startRetract(side); return; }
    H.state = 'attached';
    H.holdT = 0;
    const key = t.rec.grab === 'wall' ? 'straight' : t.rec.grab;
    t.poseKey = H.actions[key] ? key : 'straight';
    this._pose(side, t.poseKey, 0.08);
    this.sfx.hit(t.rec.grab === 'wall' ? 'wall' : 'grab', this._pan(side));
    inp.pulse?.(0.8, 40);
    if (t.rec.onTouch) t.rec.onTouch(side, t.poseKey);
    const b = t.rec.body;
    if (b && !b.locked) {
      // 반대 손이 들고 있던 물건이면 빼앗기
      const other = this.sides[side === 'L' ? 'R' : 'L'].hand;
      if (other.carried === b) other.carried = null;
      b.held = true; b.owner = side; b.vel.set(0, 0, 0);
    }
  }

  _startRetract(side) {
    const S = this.sides[side], H = S.hand, t = H.target;
    if (H.state === 'attached' && t && t.hit) {
      if (t.rec.onPull) t.rec.onPull(side);
      const b = t.rec.body;
      if (b && !b.locked && b.owner === side) {
        H.carried = b;
        _m1.compose(H.pos, H.quat, _s1.set(1, 1, 1)).invert();
        H.carriedRel.multiplyMatrices(_m1, b.mesh.matrixWorld);
      }
    }
    H.state = 'retracting';
    this._pose(side, 'retract', 0.06);
    this._playPack(S.actions.shootIn);
    this.sfx.retract(this._pan(side));
  }

  _dock(side) {
    const H = this.sides[side].hand;
    H.state = 'docked';
    H.target = null;
    H.cable.mesh.visible = false;
    this._pose(side, 'default', 0.15);
    this.sfx.dock(this._pan(side));
    this.input.sides[side].pulse?.(0.4, 30);
  }

  toggleFlashlight() {
    const F = this.flash;
    this.flashlightOn = !this.flashlightOn;
    if (this.flashlightOn) {
      F.offLid?.stop();
      this._playPack(F.onLid);
      this._playPack(F.onGesture);
      F.timer = 0.45;
    } else {
      F.onLid?.stop();
      this._playPack(F.offLid);
      this._playPack(F.offGesture);
      F.timer = 0.08;
    }
    this.sfx.click();
    this.input.sides.R.pulse?.(0.3, 25);
  }

  fireFlare() {
    if (this.flareCooldown > 0) return;
    this.flareCooldown = 1.2;
    const S = this.sides.R;
    this._playPack(S.actions.flare);
    this.world.spawnFlare(_v1.copy(S.muzzle).addScaledVector(S.fwd, 0.12), _v2.copy(S.fwd).multiplyScalar(13).addScaledVector(UP, 1.5));
    this.sfx.flare();
    this.input.sides.R.pulse?.(0.9, 80);
  }

  dropCarried(side) {
    const H = this.sides[side].hand;
    if (!H.carried) return;
    H.carried.held = false; H.carried.owner = null; H.carried.vel.set(0, 0.3, 0);
    H.carried = null;
  }

  // ───────────────────────── 매 프레임 ─────────────────────────
  update(dt) {
    this.time += dt;
    this.flareCooldown = Math.max(0, this.flareCooldown - dt);
    const input = this.input;

    // 1) 팩 애니메이션: 기본 자세로 리셋 후 믹서 적용
    for (const [o, p, q, s] of this.packRest) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); }
    this.packMixer.update(dt);

    // 2) 런처를 컨트롤러에 맞춤 (애니메이션 반동은 줄여서 더함)
    const rfix = _m3.makeRotationY(Math.PI).multiply(_m2.makeRotationX(CONFIG.gripPitchDeg * DEG));
    for (const side of ['L', 'R']) {
      const S = this.sides[side], inp = input.sides[side];
      const gun = S.gun;
      if (!inp.connected) {
        gun.position.set(0, -100, 0); gun.scale.copy(ZERO_SCALE);
        S.hidden = true;
        continue;
      }
      S.hidden = false;
      inp.gripObj.updateWorldMatrix(true, false);
      inp.rayObj.updateWorldMatrix(true, false);
      inp.gripObj.matrixWorld.decompose(_v1, _q1, _s1);
      inp.rayObj.matrixWorld.decompose(_v2, _q2, _s1);
      S.aim.compose(_v1, _q2, _s1.set(1, 1, 1)).multiply(rfix);
      S.aim.decompose(S.aimPos, S.aimQuat, _s1);
      S.fwd.set(0, 0, 1).applyQuaternion(S.aimQuat);

      // 반동 델타
      _m1.compose(gun.position, gun.quaternion, gun.scale);
      const D = _m1.premultiply(S.restLocalInv);
      D.decompose(_v3, _q1, _s1);
      _v3.multiplyScalar(CONFIG.recoilScale);
      _q1.copy(_qId).slerp(_q1, CONFIG.recoilScale);
      D.compose(_v3, _q1, _s1.set(1, 1, 1));

      const T = _m2.copy(S.aim)
        .multiply(this._packScaleM)
        .multiply(S.gunOffset)
        .multiply(D);
      T.premultiply(this.gunParentInv);
      T.decompose(gun.position, gun.quaternion, gun.scale);
    }
    this.packRoot.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      const S = this.sides[side];
      if (!S.hidden) S.socket.getWorldPosition(S.muzzle);
    }

    // 3) 입력
    for (const side of ['L', 'R']) {
      const inp = input.sides[side], H = this.sides[side].hand;
      if (!inp.connected) continue;
      if (inp.triggerDown) this.fire(side);
      if (inp.squeezeDown && H.state === 'docked' && H.carried) this.dropCarried(side);
    }
    if (input.sides.R.connected) {
      if (input.sides.R.aDown) this.toggleFlashlight();
      if (input.sides.R.bDown) this.fireFlare();
    }

    // 4) 손 상태
    const dockLocal = this._dockLocal;
    for (const side of ['L', 'R']) {
      const S = this.sides[side], H = S.hand, inp = input.sides[side];
      if (S.hidden) { H.holder.visible = false; H.cable.mesh.visible = false; continue; }
      H.holder.visible = true;

      const dockQuat = this._dockQuat.copy(S.aimQuat).multiply(dockLocal);
      const dockPos = this._dockPos.copy(S.muzzle).addScaledVector(S.fwd, 0.01);

      if (H.returnPoseAt > 0 && this.time >= H.returnPoseAt) { H.returnPoseAt = -1; if (H.state === 'docked') this._pose(side, 'default', 0.15); }

      if (H.state === 'docked') {
        H.pos.copy(dockPos);
        H.quat.copy(dockQuat);
      } else if (H.state === 'flying') {
        const t = this._targetWorld(H);
        const key = t.hit ? (t.rec.grab === 'wall' ? 'straight' : t.rec.grab) : 'straight';
        if (t.hit) this._surfacePose(side, t.point, t.normal, key, H.targetPos, H.targetQuat);
        else { H.targetPos.copy(t.point); H.targetQuat.copy(H.fromQuat); }
        const total = Math.max(0.001, H.flyFrom.distanceTo(H.targetPos));
        H.flyT = Math.min(1, H.flyT + (CONFIG.flySpeed * dt) / total);
        H.pos.lerpVectors(H.flyFrom, H.targetPos, H.flyT);
        H.quat.slerpQuaternions(H.fromQuat, H.targetQuat, smooth(Math.max(0, (H.flyT - 0.25) / 0.75)));
        if (H.flyT >= 1) this._arrive(side);
      } else if (H.state === 'attached') {
        const t = this._targetWorld(H);
        this._surfacePose(side, t.point, t.normal, t.poseKey, H.pos, H.quat);
        H.holdT += dt;
        if (!inp.trigger && H.holdT >= CONFIG.minHoldTime) this._startRetract(side);
        else if (S.muzzle.distanceTo(H.pos) > CONFIG.maxRange + CONFIG.tetherSlack) this._startRetract(side);
        else if (inp.squeeze && !(t.rec.body && !t.rec.body.locked)) this._reel(H.pos, dt);
      } else if (H.state === 'retracting') {
        const d = H.pos.distanceTo(dockPos);
        const step = CONFIG.retractSpeed * dt;
        if (d <= step || d < 0.03) {
          H.pos.copy(dockPos); H.quat.copy(dockQuat);
          this._dock(side);
        } else {
          H.pos.lerp(dockPos, step / d);
          H.quat.slerp(dockQuat, Math.min(1, dt * 12));
        }
      }

      H.holder.position.copy(H.pos);
      H.holder.quaternion.copy(H.quat);
      H.holder.updateMatrixWorld(true);

      // 들고 있는 물건은 손을 따라감 (소켓 등에 꽂히면 손에서 떨어짐)
      if (H.carried && H.carried.locked) H.carried = null;
      if (H.carried) {
        const b = H.carried;
        _m1.compose(H.pos, H.quat, _s1.set(1, 1, 1)).multiply(H.carriedRel);
        _m1.decompose(b.mesh.position, b.mesh.quaternion, _s1);
      }

      // 케이블
      if (H.state !== 'docked') {
        H.cable.mesh.visible = true;
        const len = S.muzzle.distanceTo(H.pos);
        const sag = H.state === 'attached' ? 0.004 * len : 0.02 * len;
        const wob = H.state === 'flying' ? 0.015 : 0;
        H.cable.update(S.muzzle, H.pos, sag, wob, this.time);
      } else {
        H.cable.mesh.visible = false;
      }
      H.mixer.update(dt);
    }

    // 5) 손전등
    const F = this.flash;
    if (F.timer > 0) {
      F.timer -= dt;
      if (F.timer <= 0) {
        this.spot.intensity = this.flashlightOn ? 45 : 0;
        if (this.lensMat) this.lensMat.emissiveIntensity = this.flashlightOn ? 4 : 0;
      }
    }
    const R = this.sides.R;
    if (!R.hidden) {
      this.flashExt.getWorldPosition(_v1);
      // 빛 시작점을 손 바로 앞쪽으로 옮겨서 장착된 빨간 손이 하얗게 날아가지 않게 함
      this.spot.position.copy(_v1).addScaledVector(R.fwd, 0.32);
      this.spot.target.position.copy(this.spot.position).addScaledVector(R.fwd, 8);
      this.spot.target.updateMatrixWorld();
    } else {
      this.spot.intensity = 0;
    }
  }

  // 붙잡은 지점 쪽으로 몸을 끌어당김 (수평 이동)
  _reel(anchor, dt) {
    const head = this.camera.getWorldPosition(_v1);
    const dir = _v2.set(anchor.x - head.x, 0, anchor.z - head.z);
    const d = dir.length();
    if (d < CONFIG.reelStopDistance) return;
    dir.multiplyScalar(Math.min(d - CONFIG.reelStopDistance, CONFIG.reelSpeed * dt) / d);
    this.player.position.add(dir);
  }
}
