import * as THREE from 'three';

// 런처와 날아간 손을 잇는 케이블. 매 프레임 정점만 갱신하는 가벼운 튜브.
export class Cable {
  constructor({ radius = 0.0065, segments = 32, radial = 6, color = 0x2a2a2e } = {}) {
    this.segments = segments;
    this.radial = radial;
    this.radius = radius;
    const vCount = (segments + 1) * radial;
    this.positions = new Float32Array(vCount * 3);
    this.normals = new Float32Array(vCount * 3);
    const idx = [];
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * radial + j;
        const b = i * radial + ((j + 1) % radial);
        const c = (i + 1) * radial + j;
        const d = (i + 1) * radial + ((j + 1) % radial);
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1 }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this._p = [];
    for (let i = 0; i <= segments; i++) this._p.push(new THREE.Vector3());
    this._t = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._ref = new THREE.Vector3();
  }

  // a: 런처 끝, b: 손목, sag: 처짐(m), wobble: 날아가는 동안의 흔들림
  update(a, b, sag = 0, wobble = 0, time = 0) {
    const S = this.segments, R = this.radial, p = this._p;
    const dist = a.distanceTo(b);
    for (let i = 0; i <= S; i++) {
      const t = i / S;
      p[i].lerpVectors(a, b, t);
      const bell = 4 * t * (1 - t);
      p[i].y -= sag * bell;
      if (wobble > 0) {
        const w = Math.sin(t * 18 - time * 30) * wobble * bell;
        p[i].x += w * 0.6;
        p[i].y += w;
      }
    }
    const pos = this.positions, nor = this.normals;
    for (let i = 0; i <= S; i++) {
      const prev = p[Math.max(0, i - 1)], next = p[Math.min(S, i + 1)];
      this._t.subVectors(next, prev);
      if (this._t.lengthSq() < 1e-10) this._t.set(0, 0, 1);
      this._t.normalize();
      this._ref.set(0, 1, 0);
      if (Math.abs(this._t.y) > 0.95) this._ref.set(1, 0, 0);
      this._n.crossVectors(this._t, this._ref).normalize();
      this._b.crossVectors(this._t, this._n);
      for (let j = 0; j < R; j++) {
        const ang = (j / R) * Math.PI * 2;
        const cx = Math.cos(ang), sx = Math.sin(ang);
        const nx = this._n.x * cx + this._b.x * sx;
        const ny = this._n.y * cx + this._b.y * sx;
        const nz = this._n.z * cx + this._b.z * sx;
        const k = (i * R + j) * 3;
        pos[k] = p[i].x + nx * this.radius;
        pos[k + 1] = p[i].y + ny * this.radius;
        pos[k + 2] = p[i].z + nz * this.radius;
        nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
      }
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    return dist;
  }
}
