// Mưa quanh camera, mật độ theo thời tiết thật.
import * as THREE from 'three';

export class Rain {
  mesh: THREE.LineSegments;
  private pos: Float32Array;
  private N = 2400;
  constructor(scene: THREE.Scene) {
    this.pos = new Float32Array(this.N * 6);
    for (let i = 0; i < this.N; i++) this.reset(i, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#c8d4e6', transparent: true, opacity: 0.35, depthWrite: false }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }
  private reset(i: number, any = false) {
    const x = (Math.random() - 0.5) * 60, z = (Math.random() - 0.5) * 60;
    const y = any ? Math.random() * 30 : 30;
    this.pos.set([x, y, z, x + 0.05, y + 0.9, z], i * 6);
  }
  update(dt: number, amount: number, center: THREE.Vector3) {
    this.mesh.visible = amount > 0.01;
    if (!this.mesh.visible) return;
    this.mesh.position.set(center.x, center.y - 5, center.z);
    const n = Math.floor(this.N * amount);
    this.mesh.geometry.setDrawRange(0, n * 2);
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      this.pos[o + 1] -= dt * 28; this.pos[o + 4] -= dt * 28;
      this.pos[o] += dt * 1.5; this.pos[o + 3] += dt * 1.5;
      if (this.pos[o + 1] < 0) this.reset(i);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}
