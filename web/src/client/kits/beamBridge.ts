// Kit cầu dầm: mặt cầu, dải đèn hai bên, tùy chọn trụ tháp dây văng.
import * as THREE from 'three';
import type { KitFactory } from './types';
import { pbr } from '../engine/Materials';

export const beamBridge: KitFactory = (ctx, p) => {
  const g = new THREE.Group();
  ctx.scene.add(g);
  const len = p.x1 - p.x0 + 40;
  const cx = (p.x0 + p.x1) / 2;
  const concrete = pbr('concrete_wall_008', 2.7, { plane: 'box', tint: '#d4cfc4', macro: 0.2 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 1.6, 16), concrete);
  deck.position.set(cx, p.deckY - 0.8, p.z);
  g.add(deck);
  for (let x = p.x0 + 18; x < p.x1; x += 36) {
    const pier = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2, p.deckY + 3, 12), concrete);
    pier.position.set(x, (p.deckY - 3) / 2 - 1.6, p.z);
    g.add(pier);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.light) });
  const base = new THREE.Color(p.light);
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(len, 0.2, 0.2), lightMat);
    strip.position.set(cx, p.deckY + 0.1, p.z + s * 8.1);
    g.add(strip);
    for (let x = p.x0 + 4; x < p.x1; x += 10) ctx.reflect.add(x, p.z + s * 9, p.light, 3, 40, 0.6);
  }
  let pylonMat: THREE.MeshStandardMaterial | null = null;
  if (p.pylons) {
    pylonMat = new THREE.MeshStandardMaterial({ color: '#f1f0ea', roughness: 0.5, emissive: '#cfe6ff', emissiveIntensity: 0 });
    const shape = new THREE.Shape();
    shape.moveTo(-3, 0); shape.lineTo(3, 0); shape.quadraticCurveTo(4, p.pylonHeight * 0.6, -1, p.pylonHeight); shape.quadraticCurveTo(-2, p.pylonHeight * 0.5, -3, 0);
    const pylon = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false }), pylonMat);
    pylon.position.set(cx - 12, p.deckY, p.z - 1);
    g.add(pylon);
    const pts: number[] = [];
    for (let i = 1; i <= 10; i++) {
      const top = new THREE.Vector3(cx - 12 - 0.5 + i * 0.05, p.deckY + p.pylonHeight * (0.45 + i * 0.05), p.z);
      for (const s of [-1, 1]) pts.push(top.x, top.y, top.z, cx - 12 + s * (8 + i * 5.5), p.deckY + 0.5, p.z);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: '#e8e8e0' })));
    ctx.reflect.add(cx - 12, p.z + 4, '#dff0ff', 5, 80, 0.7);
  }
  return {
    update(_dt, env) {
      lightMat.color.copy(base).multiplyScalar(0.3 + env.night * 2.4);
      if (pylonMat) pylonMat.emissiveIntensity = env.night * 0.9;
    },
  };
};
