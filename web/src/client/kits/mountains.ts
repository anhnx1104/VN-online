// Kit dãy núi xa làm phông nền: địa hình nhiễu nhiều tầng (sống núi, khe suối), phủ rừng xanh sẫm,
// sườn dốc lộ đá. Sương khí quyển (fog) làm núi xa nhạt dần như ngoài đời.
import * as THREE from 'three';
import type { KitFactory } from './types';

function noise2(seed: number) {
  const h = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const n = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  return (x: number, y: number) => {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < 6; i++) {
      // sống núi: 1 - |2n-1|
      const v = 1 - Math.abs(n(x * f, y * f) * 2 - 1);
      s += a * v * v;
      f *= 2.05; a *= 0.5;
    }
    return s;
  };
}

export const mountains: KitFactory = (ctx, p) => {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const seg = ctx.quality === 'low' ? 48 : 110;
  const forest = new THREE.Color('#2c4a2b'), forest2 = new THREE.Color('#3d5e32'), rock = new THREE.Color('#6b6a5e'), c = new THREE.Color();
  p.peaks.forEach((pk: { x: number; z: number; h: number; r: number }, idx: number) => {
    const size = pk.r * 2.4;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const nz = noise2(idx + 1);
    const sc = 3 / pk.r;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const d = Math.hypot(x, z * 1.15) / pk.r;
      const fall = Math.max(0, 1 - d * d) ** 1.4;
      const ridge = nz(x * sc + 10, z * sc + 3);
      const y = pk.h * fall * (0.45 + ridge * 0.9) - 4;
      pos.setY(i, y);
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const steep = 1 - nrm.getY(i);
      const t = Math.sin(pos.getX(i) * 0.05) * Math.cos(pos.getZ(i) * 0.04) * 0.5 + 0.5;
      c.lerpColors(forest, forest2, t);
      c.lerp(rock, THREE.MathUtils.smoothstep(steep, 0.35, 0.7) * 0.7);
      // chân núi hơi vàng (ruộng, bãi)
      if (pos.getY(i) < pk.h * 0.06) c.lerp(new THREE.Color('#6f7a4c'), 0.4);
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pk.x, 0, pk.z);
    ctx.scene.add(m);
  });
  return {
    update(_dt, env) { mat.color.setScalar(1 - env.night * 0.75); },
  };
};
