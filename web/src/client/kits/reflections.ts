// Vệt phản chiếu đèn trên mặt nước (kéo dài về phía người nhìn). Một lần vẽ cho toàn bộ vệt.
import * as THREE from 'three';

export class Reflections {
  private data: number[] = [];
  mesh: THREE.Mesh | null = null;
  uniforms = { time: { value: 0 }, night: { value: 0 }, waterY: { value: 0.06 } };
  /** dynamic: chỉ số màu được cập nhật mỗi khung (vd LED cầu) */
  private dyn: { index: number; get: () => THREE.Color }[] = [];
  private colorAttr: THREE.InstancedBufferAttribute | null = null;

  add(x: number, z: number, color: THREE.ColorRepresentation, width: number, length: number, strength = 1, dynamic?: () => THREE.Color) {
    const c = new THREE.Color(color);
    const index = this.data.length / 8;
    this.data.push(x, z, c.r * strength, c.g * strength, c.b * strength, width, length, Math.random() * 10);
    if (dynamic) this.dyn.push({ index, get: dynamic });
  }

  build(scene: THREE.Scene) {
    const n = this.data.length / 8;
    if (!n) return;
    const base = new THREE.PlaneGeometry(1, 1, 1, 8);
    base.translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('uv', base.attributes.uv);
    const origin = new Float32Array(n * 2), color = new Float32Array(n * 3), size = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const d = this.data.slice(i * 8, i * 8 + 8);
      origin.set([d[0], d[1]], i * 2);
      color.set([d[2], d[3], d[4]], i * 3);
      size.set([d[5], d[6], d[7]], i * 3);
    }
    g.setAttribute('origin', new THREE.InstancedBufferAttribute(origin, 2));
    this.colorAttr = new THREE.InstancedBufferAttribute(color, 3);
    g.setAttribute('tint', this.colorAttr);
    g.setAttribute('size', new THREE.InstancedBufferAttribute(size, 3));
    g.instanceCount = n;
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        attribute vec2 origin; attribute vec3 tint; attribute vec3 size;
        uniform float waterY; varying vec2 vUv; varying vec3 vTint; varying float vSeed;
        void main(){
          vec2 dir = normalize(cameraPosition.xz - origin + vec2(0.0001));
          vec2 perp = vec2(-dir.y, dir.x);
          vec2 p = origin + perp * position.x * size.x + dir * position.y * size.y;
          vUv = vec2(position.x + 0.5, position.y); vTint = tint; vSeed = size.z;
          gl_Position = projectionMatrix * viewMatrix * vec4(p.x, waterY, p.y, 1.0);
        }`,
      fragmentShader: `
        uniform float time; uniform float night; varying vec2 vUv; varying vec3 vTint; varying float vSeed;
        void main(){
          float along = vUv.y;
          float across = abs(vUv.x - 0.5) * 2.0;
          float ripple = 0.55 + 0.45 * sin(along * 60.0 - time * 2.2 + vSeed + sin(along*13.0 + time)*2.0);
          float breakup = step(0.35, fract(sin(floor(along*40.0 + time*1.5 + vSeed) * 91.7) * 4375.5));
          float a = pow(clamp(1.0 - along, 0.0, 1.0), 1.4) * (1.0 - smoothstep(0.2, 1.0, across)) * ripple * mix(0.5, 1.0, breakup);
          gl_FragColor = vec4(vTint * a * night * 2.6, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }

  update(time: number, night: number) {
    this.uniforms.time.value = time;
    this.uniforms.night.value = night;
    if (this.colorAttr && this.dyn.length) {
      for (const d of this.dyn) {
        const c = d.get();
        this.colorAttr.setXYZ(d.index, c.r, c.g, c.b);
      }
      this.colorAttr.needsUpdate = true;
    }
  }
}
