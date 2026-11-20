// 효과음은 파일 없이 WebAudio로 합성합니다.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
  }

  // 사용자 입력(클릭/VR 진입) 이후에 호출해야 소리가 납니다.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _out(pan) {
    if (!this.ctx) return null;
    if (this.ctx.createStereoPanner && pan) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(this.master);
      return p;
    }
    return this.master;
  }

  _noise(t0, dur, { type = 'bandpass', f0 = 1000, f1 = 1000, q = 1, gain = 0.5, pan = 0 } = {}) {
    const out = this._out(pan); if (!out) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = c.createBiquadFilter();
    filt.type = type; filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, t0);
    filt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.01, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(out);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }

  _tone(t0, dur, { type = 'sine', f0 = 440, f1 = 440, gain = 0.3, pan = 0 } = {}) {
    const out = this._out(pan); if (!out) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  fire(pan = 0) {
    if (!this.ctx) return; const t = this.now;
    this._tone(t, 0.12, { type: 'square', f0: 140, f1: 55, gain: 0.25, pan });
    this._noise(t, 0.25, { type: 'bandpass', f0: 2500, f1: 400, q: 0.8, gain: 0.5, pan });
  }
  hit(kind = 'wall', pan = 0) {
    if (!this.ctx) return; const t = this.now;
    if (kind === 'wall') {
      this._tone(t, 0.09, { type: 'triangle', f0: 220, f1: 90, gain: 0.35, pan });
      this._noise(t, 0.08, { type: 'lowpass', f0: 1800, f1: 300, gain: 0.35, pan });
    } else {
      this._tone(t, 0.07, { type: 'triangle', f0: 520, f1: 260, gain: 0.25, pan });
      this._noise(t, 0.05, { type: 'highpass', f0: 2000, f1: 1500, gain: 0.2, pan });
    }
  }
  retract(pan = 0) {
    if (!this.ctx) return; const t = this.now;
    this._noise(t, 0.35, { type: 'bandpass', f0: 500, f1: 3200, q: 2.5, gain: 0.35, pan });
    this._tone(t, 0.3, { type: 'sawtooth', f0: 90, f1: 260, gain: 0.07, pan });
  }
  dock(pan = 0) {
    if (!this.ctx) return; const t = this.now;
    this._tone(t, 0.06, { type: 'square', f0: 900, f1: 600, gain: 0.12, pan });
    this._noise(t, 0.06, { type: 'highpass', f0: 3000, f1: 2500, gain: 0.25, pan });
  }
  click() {
    if (!this.ctx) return; const t = this.now;
    this._noise(t, 0.04, { type: 'highpass', f0: 4000, f1: 3000, gain: 0.3, pan: 0.4 });
    this._tone(t + 0.05, 0.03, { type: 'square', f0: 1400, f1: 1200, gain: 0.06, pan: 0.4 });
  }
  flare() {
    if (!this.ctx) return; const t = this.now;
    this._tone(t, 0.18, { type: 'square', f0: 260, f1: 70, gain: 0.25, pan: 0.4 });
    this._noise(t, 1.2, { type: 'bandpass', f0: 3000, f1: 1500, q: 0.6, gain: 0.25, pan: 0.4 });
  }
  clunk() {
    if (!this.ctx) return; const t = this.now;
    this._tone(t, 0.25, { type: 'triangle', f0: 120, f1: 45, gain: 0.45 });
    this._noise(t, 0.2, { type: 'lowpass', f0: 900, f1: 120, gain: 0.4 });
  }
  beep(ok = true) {
    if (!this.ctx) return; const t = this.now;
    if (ok) {
      this._tone(t, 0.12, { type: 'sine', f0: 880, f1: 880, gain: 0.2 });
      this._tone(t + 0.13, 0.18, { type: 'sine', f0: 1320, f1: 1320, gain: 0.2 });
    } else {
      this._tone(t, 0.25, { type: 'square', f0: 180, f1: 160, gain: 0.12 });
    }
  }
  rumble(dur = 2.0) {
    if (!this.ctx) return; const t = this.now;
    this._noise(t, dur, { type: 'lowpass', f0: 300, f1: 120, gain: 0.35 });
    this._tone(t, dur, { type: 'sawtooth', f0: 50, f1: 42, gain: 0.08 });
  }
  powerUp() {
    if (!this.ctx) return; const t = this.now;
    this._tone(t, 1.0, { type: 'sawtooth', f0: 60, f1: 240, gain: 0.12 });
    this._tone(t + 0.9, 0.4, { type: 'sine', f0: 660, f1: 660, gain: 0.2 });
  }
}
