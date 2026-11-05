// Kit sông: mặt nước phản chiếu bầu trời, sóng lăn tăn trôi theo dòng.
import * as THREE from 'three';
import type { KitFactory } from './types';

export function waterNormals(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const waves: [number, number, number, number][] = [];
  for (let i = 0; i < 14; i++) waves.push([Math.ceil(Math.random() * 6) * (Math.random() < 0.5 ? -1 : 1), Math.ceil(Math.random() * 9), Math.random() * 6.28, 1 / (1 + i * 0.4)]);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let dx = 0, dy = 0;
    for (const [fx, fy, ph, a] of waves) {
      const t = (fx * x + fy * y) / size * Math.PI * 2 + ph;
      const c0 = Math.cos(t) * a;
      dx += c0 * fx; dy += c0 * fy;
    }
    const n = new THREE.Vector3(-dx * 0.05, -dy * 0.05, 1).normalize();
    const o = (y * size + x) * 4;
    img.data[o] = (n.x * 0.5 + 0.5) * 255; img.data[o + 1] = (n.y * 0.5 + 0.5) * 255; img.data[o + 2] = (n.z * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export const river: KitFactory = (ctx, p) => {
  const w = p.x1 - p.x0;
  const nA = waterNormals();
  nA.repeat.set(w / 22, p.length / 22);
  const mat = new THREE.MeshStandardMaterial({
    color: p.color, roughness: 0.06, metalness: 0.05, normalMap: nA, normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 1.1,
  });
  const geo = new THREE.PlaneGeometry(w, p.length);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((p.x0 + p.x1) / 2, 0, 0);
  mesh.receiveShadow = true;
  ctx.scene.add(mesh);
  // biển phía bắc (cửa sông) cho cảm giác xa
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 3000).rotateX(-Math.PI / 2), mat);
  sea.position.set(0, -0.02, -p.length / 2 - 1500);
  ctx.scene.add(sea);
  const deep = new THREE.Color(p.deep), base = new THREE.Color(p.color);
  return {
    update(dt, env) {
      nA.offset.x += (p.flow?.[0] ?? 0) * dt * 0.02;
      nA.offset.y += (p.flow?.[1] ?? -0.3) * dt * 0.02;
      mat.color.lerpColors(base, deep, env.night * 0.85);
      mat.normalScale.setScalar(0.45 + env.rain * 0.4 + (env.weather?.wind ?? 8) / 80);
    },
  };
};
