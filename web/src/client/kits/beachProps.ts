// Kit đồ vật bãi biển: ô dù, ghế nằm, chòi cứu hộ, thúng chai của ngư dân.
import * as THREE from 'three';
import type { KitFactory } from './types';

export const beachProps: KitFactory = (ctx, p) => {
  const sandY = (x: number) => p.sandTop + (p.sandBottom - p.sandTop) * ((x - p.sandX0) / (p.sandX1 - p.sandX0));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3();
  const colors = ['#C8102E', '#F2B705', '#1FA39A', '#3B6FD8', '#F4F4F0', '#E87BA6', '#ef8a5b'].map((c) => new THREE.Color(c));

  // ô dù + ghế nằm
  const spots: { x: number; z: number }[] = [];
  for (const r of p.umbrellas) for (let z = r.z0; z <= r.z1; z += r.spacing) for (let x = r.x0; x <= r.x1; x += r.dx) {
    if ((Math.sin(x * 3.1 + z * 0.7) + 1) / 2 < 0.25) continue;
    spots.push({ x: x + Math.sin(z) * 1.5, z });
  }
  const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6).translate(0, 1.2, 0);
  const capGeo = new THREE.ConeGeometry(1.6, 0.6, 12, 1, true).translate(0, 2.45, 0);
  const lounger = new THREE.BoxGeometry(0.7, 0.12, 1.9).translate(0, 0.32, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: '#efefe8' }), spots.length);
  const caps = new THREE.InstancedMesh(capGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, side: THREE.DoubleSide }), spots.length);
  const chairs = new THREE.InstancedMesh(lounger, new THREE.MeshStandardMaterial({ color: '#f1ece0', roughness: 0.7 }), spots.length * 2);
  spots.forEach((sp, i) => {
    const y = sandY(sp.x);
    m.makeTranslation(sp.x, y, sp.z);
    poles.setMatrixAt(i, m);
    q.setFromAxisAngle(up, i * 0.7);
    caps.setMatrixAt(i, m.compose(v.set(sp.x, y, sp.z), q, s));
    caps.setColorAt(i, colors[i % colors.length]);
    q.setFromAxisAngle(up, Math.PI / 2 + 0.2);
    chairs.setMatrixAt(i * 2, m.compose(v.set(sp.x + 0.6, sandY(sp.x + 0.6), sp.z - 1.1), q, s));
    chairs.setMatrixAt(i * 2 + 1, m.compose(v.set(sp.x + 0.6, sandY(sp.x + 0.6), sp.z + 1.1), q, s));
  });
  caps.castShadow = poles.castShadow = true;
  ctx.scene.add(poles, caps, chairs);

  // chòi cứu hộ
  const t = p.tower;
  const tower = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#e04a3a', roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.7 });
  for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3, 0.15), white);
    leg.position.set(dx, 1.5, dz);
    tower.add(leg);
  }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 2), wood); cabin.position.y = 3.6;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.8, 4), white); roof.position.y = 4.7; roof.rotation.y = Math.PI / 4;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshStandardMaterial({ color: '#c8102e', side: THREE.DoubleSide }));
  flag.position.set(0.4, 5.7, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4), white); mast.position.y = 5.5;
  tower.add(cabin, roof, flag, mast);
  tower.position.set(t.x, sandY(t.x), t.z);
  tower.rotation.y = -Math.PI / 2;
  tower.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  ctx.scene.add(tower);

  // thúng chai
  const b = p.boats;
  const boatGeo = new THREE.SphereGeometry(1.1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.55, 1);
  const rimGeo = new THREE.TorusGeometry(1.1, 0.06, 6, 24).rotateX(Math.PI / 2);
  const boats = new THREE.InstancedMesh(boatGeo, new THREE.MeshStandardMaterial({ color: '#3b2f22', roughness: 0.9, side: THREE.DoubleSide }), b.count);
  const rims = new THREE.InstancedMesh(rimGeo, new THREE.MeshStandardMaterial({ color: '#6d5a3e' }), b.count);
  for (let i = 0; i < b.count; i++) {
    const x = b.x + Math.sin(i * 2.3) * 4, z = b.z + Math.cos(i * 1.7) * 7;
    const y = sandY(x) + 0.55;
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0.3).normalize(), Math.sin(i) * 0.25);
    m.compose(v.set(x, y, z), q, s);
    boats.setMatrixAt(i, m); rims.setMatrixAt(i, m);
  }
  ctx.scene.add(boats, rims);

  return {
    update(_dt, env) { flag.rotation.y = Math.sin(env.now / 300) * 0.4; },
  };
};
