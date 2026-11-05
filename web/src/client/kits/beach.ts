// Kit bãi biển: nền phố phía sau, lối dạo lát gạch, bãi cát dốc xuống biển (cát khô, cát ướt).
import * as THREE from 'three';
import type { KitFactory } from './types';
import { pbr } from '../engine/Materials';

export const beach: KitFactory = (ctx, p) => {
  const zLen = p.zLen as number;
  const g = new THREE.Group();
  ctx.scene.add(g);
  // nền phố phía sau
  const ground = new THREE.Mesh(new THREE.BoxGeometry(p.promX0 - p.cityX0, 8, zLen), pbr('granite_tile_03', 1.8, { tint: '#9d9a93', plane: 'box', macro: 0.22 }));
  ground.position.set((p.promX0 + p.cityX0) / 2, p.promY - 4, 0);
  ground.receiveShadow = true;
  // lối dạo
  const prom = new THREE.Mesh(new THREE.BoxGeometry(p.promX1 - p.promX0, 8, zLen), pbr('granite_tile', 2.3, { tint: '#efe4d2', plane: 'box', macro: 0.14 }));
  prom.position.set((p.promX0 + p.promX1) / 2, p.promY - 4, 0);
  prom.receiveShadow = true;
  g.add(ground, prom);

  // bãi cát: mặt dốc theo trục x, màu ướt dần khi gần nước
  const w = p.sandX1 - p.promX1;
  const sandGeo = new THREE.PlaneGeometry(w, zLen, Math.ceil(w / 2), 80).rotateX(-Math.PI / 2);
  const pos = sandGeo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  // màu đỉnh nhân với ảnh cát thật: khô sáng, gần mép nước sẫm và ướt
  const dry = new THREE.Color('#ffffff'), wet = new THREE.Color('#9c917c'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + p.promX1 + w / 2;
    const tt = (x - p.promX1) / w;
    const y = p.sandTop + (p.sandBottom - p.sandTop) * tt + Math.sin(pos.getZ(i) * 0.05 + x * 0.2) * 0.04;
    pos.setY(i, y);
    c.lerpColors(dry, wet, THREE.MathUtils.smoothstep(0.55, 0.0, y));
    const n = (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.03;
    col.set([c.r - n, c.g - n, c.b - n], i * 3);
  }
  sandGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sandGeo.computeVertexNormals();
  const sand = new THREE.Mesh(sandGeo, pbr('sand_01', 1.5, { vertexColors: true, tint: '#f3ead8', macro: 0.12, normalScale: 0.8 }));
  sand.position.x = p.promX1 + w / 2;
  sand.receiveShadow = true;
  g.add(sand);
  // bậc kè giữa lối dạo và cát
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, zLen), pbr('granite_tile_03', 1.8, { tint: '#d8d2c4', plane: 'box', macro: 0.1 }));
  step.position.set(p.promX1, p.promY - 0.2, 0);
  g.add(step);
  return {};
};
