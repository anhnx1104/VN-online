// Kit tượng đài phun nước (kiểu cá chép hóa rồng): bệ, tượng cách điệu, tia nước có hạt.
import * as THREE from 'three';
import type { KitFactory } from './types';
import { pbr } from '../engine/Materials';

export const statueFountain: KitFactory = (ctx, p) => {
  const g = new THREE.Group();
  g.position.set(p.x, p.y, p.z);
  ctx.scene.add(g);
  const stone = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.55 });
  const basinMat = pbr('granite_tile_03', 1.2, { plane: 'box', tint: '#d9d2c4', macro: 0.08 });

  const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.8, 40, 1, true), basinMat);
  basin.position.y = 0.4;
  const water = new THREE.Mesh(new THREE.CircleGeometry(3.5, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2b6f80', roughness: 0.05, metalness: 0.1 }));
  water.position.y = 0.6;
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 2.2, 24), basinMat);
  ped.position.y = 1.4;
  g.add(basin, water, ped);

  // thân cá cong vút lên
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.4, 2.4, 0), new THREE.Vector3(0.4, 3.6, 0), new THREE.Vector3(0.3, 5.2, 0),
    new THREE.Vector3(-0.4, 6.6, 0), new THREE.Vector3(0.3, 7.7, 0),
  ]);
  const geo = new THREE.TubeGeometry(curve, 60, 0.85, 16, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    curve.getPointAt(t, c);
    const k = 0.35 + Math.sin(Math.min(1, t * 1.2) * Math.PI) * 0.75;
    for (let j = 0; j <= 16; j++) {
      const idx = i * 17 + j;
      v.fromBufferAttribute(pos, idx).sub(c);
      v.x *= k; v.z *= k * 0.8; v.y *= k;
      v.add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, stone);
  body.castShadow = true;
  g.add(body);
  // đuôi xòe dưới, vây, đầu
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.6, 4, 1, true), stone);
  tail.position.set(-0.5, 2.0, 0); tail.rotation.z = Math.PI;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), stone);
  head.scale.set(1.3, 0.9, 0.9);
  head.position.set(0.55, 7.9, 0);
  head.rotation.z = -0.6;
  g.add(tail, head);
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 3), stone);
    fin.position.set(0, 4.6, s * 0.8);
    fin.rotation.set(s * 1.1, 0, -0.3);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.2, 6), stone);
    horn.position.set(0.2, 8.6, s * 0.35);
    horn.rotation.set(s * -0.3, 0, 0.5);
    g.add(fin, horn);
  }
  g.rotation.y = Math.PI; // hướng miệng ra sông

  // tia nước
  const N = 500;
  const pp = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
  for (let i = 0; i < N; i++) life[i] = Math.random();
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pm = new THREE.PointsMaterial({ color: '#d6ecff', size: 0.16, transparent: true, opacity: 0.75, depthWrite: false });
  const spray = new THREE.Points(pg, pm);
  spray.frustumCulled = false;
  g.add(spray);
  const mouth = new THREE.Vector3(1.3, 7.9, 0);
  const reset = (i: number) => {
    pp.set([mouth.x, mouth.y, mouth.z], i * 3);
    vel.set([3.2 + Math.random() * 0.6, 2.2 + Math.random() * 0.8, (Math.random() - 0.5) * 0.3], i * 3);
    life[i] = 0;
  };
  for (let i = 0; i < N; i++) reset(i);

  return {
    update(dt, env) {
      pm.color.setScalar(0.7 + env.night * 0.6);
      for (let i = 0; i < N; i++) {
        life[i] += dt;
        const o = i * 3;
        vel[o + 1] -= 9.8 * dt;
        pp[o] += vel[o] * dt; pp[o + 1] += vel[o + 1] * dt; pp[o + 2] += vel[o + 2] * dt;
        if (pp[o + 1] < 0.6) reset(i);
      }
      pg.attributes.position.needsUpdate = true;
    },
  };
};
