import * as THREE from 'three';

// 메타 퀘스트 컨트롤러 + 데스크톱(마우스/키보드) 입력을 같은 형태로 정리
function makeSide(name) {
  return {
    name,
    connected: false,
    gripObj: null,
    rayObj: null,
    gamepad: null,
    trigger: false, triggerDown: false, triggerUp: false,
    squeeze: false, squeezeDown: false,
    a: false, aDown: false,
    b: false, bDown: false,
    stick: new THREE.Vector2(),
    pulse: null,
  };
}

export class Input {
  constructor(renderer, camera, player, dom) {
    this.renderer = renderer;
    this.camera = camera;
    this.player = player;
    this.dom = dom;
    this.sides = { L: makeSide('L'), R: makeSide('R') };
    this.xr = { L: null, R: null };
    this.keys = new Set();
    this.mouse = { L: false, R: false };
    this.look = new THREE.Vector2();
    this.pitch = 0;
    this.desktopActive = false;

    // XR 컨트롤러
    for (let i = 0; i < 2; i++) {
      const ctrl = renderer.xr.getController(i);
      const grip = renderer.xr.getControllerGrip(i);
      player.add(ctrl, grip);
      ctrl.addEventListener('connected', (e) => {
        const src = e.data;
        if (!src || src.hand) return; // 핸드트래킹은 사용 안 함
        const side = src.handedness === 'left' ? 'L' : 'R';
        this.xr[side] = { ctrl, grip, source: src };
      });
      ctrl.addEventListener('disconnected', () => {
        for (const s of ['L', 'R']) if (this.xr[s] && this.xr[s].ctrl === ctrl) this.xr[s] = null;
      });
    }

    // 데스크톱용 가상 컨트롤러 (카메라에 붙어있음)
    this.sim = {};
    for (const [s, x] of [['L', -0.2], ['R', 0.2]]) {
      const o = new THREE.Object3D();
      o.position.set(x * 1.15, -0.3, -0.42);
      o.rotation.y = s === 'L' ? -0.06 : 0.06;
      camera.add(o);
      this.sim[s] = o;
    }

    // 데스크톱 입력
    window.addEventListener('keydown', (e) => { this.keys.add(e.code); if (['Space', 'KeyF', 'KeyG'].includes(e.code)) e.preventDefault(); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.L = this.mouse.R = false; });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('mousedown', (e) => {
      if (!this.desktopActive) return;
      if (document.pointerLockElement !== dom) { dom.requestPointerLock?.(); return; }
      if (e.button === 0) this.mouse.L = true;
      if (e.button === 2) this.mouse.R = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.L = false;
      if (e.button === 2) this.mouse.R = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== dom) return;
      this.look.x += e.movementX;
      this.look.y += e.movementY;
    });
  }

  get inXR() { return this.renderer.xr.isPresenting; }

  update() {
    const xr = this.inXR;
    for (const s of ['L', 'R']) {
      const S = this.sides[s];
      const prev = { t: S.trigger, sq: S.squeeze, a: S.a, b: S.b };
      if (xr) {
        const c = this.xr[s];
        S.connected = !!c;
        if (c) {
          S.gripObj = c.grip; S.rayObj = c.ctrl;
          const gp = c.source.gamepad;
          S.gamepad = gp;
          if (gp) {
            const btn = (i) => gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.6);
            S.trigger = btn(0); S.squeeze = btn(1); S.a = btn(4); S.b = btn(5);
            const ax = gp.axes.length >= 4 ? [gp.axes[2], gp.axes[3]] : [gp.axes[0] || 0, gp.axes[1] || 0];
            S.stick.set(ax[0], ax[1]);
          }
          S.pulse = (intensity, ms) => {
            const h = gp && gp.hapticActuators && gp.hapticActuators[0];
            if (h && h.pulse) h.pulse(intensity, ms).catch(() => {});
          };
        } else {
          S.trigger = S.squeeze = S.a = S.b = false;
          S.stick.set(0, 0);
        }
      } else {
        S.connected = true;
        S.gripObj = S.rayObj = this.sim[s];
        S.pulse = null;
        const k = this.keys;
        S.trigger = s === 'L' ? (this.mouse.L || k.has('KeyQ')) : (this.mouse.R || k.has('KeyE'));
        S.squeeze = k.has('Space') || k.has(s === 'L' ? 'KeyZ' : 'KeyX');
        S.a = s === 'R' && k.has('KeyF');
        S.b = s === 'R' && k.has('KeyG');
        S.stick.set(0, 0);
      }
      S.triggerDown = S.trigger && !prev.t;
      S.triggerUp = !S.trigger && prev.t;
      S.squeezeDown = S.squeeze && !prev.sq;
      S.aDown = S.a && !prev.a;
      S.bDown = S.b && !prev.b;
    }
  }

  // 데스크톱 이동 입력 (-1..1)
  desktopMove(out) {
    const k = this.keys;
    out.set((k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0));
    return out;
  }
}
