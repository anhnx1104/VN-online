// Kit lối dạo ven sông: cột đèn, hàng dừa, ghế đá. Sắp theo hàng cấu hình được.
import * as THREE from 'three';
import type { KitFactory } from './types';
import { palms, shadeTrees } from './flora';

export const promenade: KitFactory = (ctx, p) => {
  const H = ctx.zone.ground.bankHeight;
  const rows = p.rows as { kind: string; x: number; z0: number; z1: number; spacing: number; skip?: [number, number]; yaw?: number; poolDx?: number }[];
  const points: Record<string, { x: number; z: number; yaw: number; dx: number }[]> = { lamp: [], palm: [], bench: [], tree: [] };
  for (const r of rows) {
    for (let z = r.z0; z <= r.z1; z += r.spacing) {
      if (r.skip && z > r.skip[0] && z < r.skip[1]) continue;
      const clear = (p.clear ?? []) as number[][]; // [x0, x1, z0, z1]: chừa lối vào cầu tàu, quảng trường...
      if (clear.some(([x0, x1, z0, z1]) => r.x >= x0 && r.x <= x1 && z >= z0 && z <= z1)) continue;
      points[r.kind]?.push({ x: r.x, z, yaw: r.yaw ?? 0, dx: r.poolDx ?? 0 });
    }
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);

  // Đèn
  const poleMat = new THREE.MeshStandardMaterial({ color: '#2c3138', metalness: 0.6, roughness: 0.4 });
  const globeMat = new THREE.MeshStandardMaterial({ color: '#fff1d0', emissive: '#ffd98a', emissiveIntensity: 0 });
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 4.2, 6); poleGeo.translate(0, 2.1, 0);
  const globeGeo = new THREE.SphereGeometry(0.28, 12, 8); globeGeo.translate(0, 4.35, 0);
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, points.lamp.length);
  const globes = new THREE.InstancedMesh(globeGeo, globeMat, points.lamp.length);
  points.lamp.forEach((pt, i) => {
    m.makeTranslation(pt.x, H, pt.z);
    poles.setMatrixAt(i, m); globes.setMatrixAt(i, m);
    ctx.reflect.add(pt.x + (pt.x > 0 ? -2.6 : 2.6), pt.z, '#ffcf7a', 1.6, 18, 0.55);
  });
  ctx.scene.add(poles, globes);

  // Quầng sáng đèn hắt xuống mặt đất về đêm (vẽ cộng sáng, không tốn đèn thật)
  const poolTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: '#000000', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(11, 11).rotateX(-Math.PI / 2), poolMat, points.lamp.length);
  points.lamp.forEach((pt, i) => { m.makeTranslation(pt.x + pt.dx, H + 0.04, pt.z); pools.setMatrixAt(i, m); });
  pools.renderOrder = 1;
  ctx.scene.add(pools);

  // Dừa và cây bóng mát (dùng chung kit flora)
  palms(ctx.scene, points.palm.map((pt) => ({ x: pt.x, y: H, z: pt.z })));
  shadeTrees(ctx.scene, points.tree.map((pt) => ({ x: pt.x, y: H, z: pt.z })));

  // Ghế đá
  const benchGeo = new THREE.BoxGeometry(2.2, 0.12, 0.6); benchGeo.translate(0, 0.5, 0);
  const benchLegGeo = new THREE.BoxGeometry(2.0, 0.45, 0.35); benchLegGeo.translate(0, 0.22, 0);
  const benchMat = new THREE.MeshStandardMaterial({ color: '#c9c3b5', roughness: 0.75 });
  const seats = new THREE.InstancedMesh(benchGeo, benchMat, points.bench.length);
  const legs = new THREE.InstancedMesh(benchLegGeo, benchMat, points.bench.length);
  points.bench.forEach((pt, i) => {
    q.setFromAxisAngle(Y, pt.yaw);
    m.compose(new THREE.Vector3(pt.x, H, pt.z), q, one);
    seats.setMatrixAt(i, m); legs.setMatrixAt(i, m);
  });
  ctx.scene.add(seats, legs);

  return {
    update(_dt, env) {
      globeMat.emissiveIntensity = env.night * 3.2;
      poolMat.color.setRGB(0.55, 0.4, 0.22).multiplyScalar(env.night);
      pools.visible = env.night > 0.05;
    },
  };
};
