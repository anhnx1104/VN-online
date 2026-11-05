// Kit đường phố: mặt nhựa thật, vạch kẻ, bó vỉa, vạch qua đường; ô tô có dáng sedan/SUV và dòng xe máy
// chạy sát lề như đường phố Việt Nam. Đèn pha, đèn hậu sáng về đêm.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { KitFactory } from './types';
import { pbr } from '../engine/Materials';

/** Hình dáng ô tô từ mặt cắt dọc (z, y) đùn theo bề ngang. Đầu xe +z. */
export function carGeometries(kind: 'sedan' | 'suv') {
  const L = kind === 'suv' ? 4.6 : 4.5, W = kind === 'suv' ? 1.85 : 1.78;
  const lower: [number, number][] = kind === 'suv'
    ? [[-2.3, 0.32], [2.3, 0.32], [2.36, 0.62], [2.25, 0.98], [1.1, 1.08], [-2.2, 1.12], [-2.34, 0.8]]
    : [[-2.25, 0.3], [2.25, 0.3], [2.3, 0.58], [2.15, 0.8], [1.05, 0.9], [-1.95, 0.95], [-2.28, 0.78]];
  const cabin: [number, number][] = kind === 'suv'
    ? [[1.1, 1.06], [0.45, 1.66], [-2.05, 1.7], [-2.2, 1.1]]
    : [[1.05, 0.88], [0.25, 1.4], [-1.05, 1.43], [-1.9, 0.93]];
  const extrude = (pts: [number, number][], width: number, bevel: number) => {
    const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
    // shape nằm trên mặt (x=z, y=y), đùn theo z → xoay -90° để mũi xe về +z, bề ngang theo trục x
    g.translate(0, 0, -(width - bevel * 2) / 2);
    g.rotateY(-Math.PI / 2);
    return g.toNonIndexed();
  };
  const body = extrude(lower, W, 0.08);
  const glass = extrude(cabin, W - 0.12, 0.06);
  const wheel = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14).rotateZ(Math.PI / 2).toNonIndexed();
  const wheels = mergeGeometries([
    wheel.clone().translate(-W / 2 + 0.1, 0.33, L * 0.3), wheel.clone().translate(W / 2 - 0.1, 0.33, L * 0.3),
    wheel.clone().translate(-W / 2 + 0.1, 0.33, -L * 0.31), wheel.clone().translate(W / 2 - 0.1, 0.33, -L * 0.31),
  ]);
  const lamp = (z: number, y: number) => mergeGeometries([
    new THREE.BoxGeometry(0.36, 0.11, 0.05).translate(-W * 0.33, y, z).toNonIndexed(),
    new THREE.BoxGeometry(0.36, 0.11, 0.05).translate(W * 0.33, y, z).toNonIndexed(),
  ]);
  return { body, glass, wheels, head: lamp(L / 2 + 0.06, kind === 'suv' ? 0.85 : 0.7), tail: lamp(-L / 2 - 0.06, kind === 'suv' ? 0.92 : 0.8) };
}

/** Xe máy + người lái (ghép sẵn), đầu xe +z */
function bikeGeometries() {
  const bike = mergeGeometries([
    new THREE.TorusGeometry(0.26, 0.08, 6, 14).rotateY(Math.PI / 2).translate(0, 0.3, 0.62).toNonIndexed(),
    new THREE.TorusGeometry(0.26, 0.08, 6, 14).rotateY(Math.PI / 2).translate(0, 0.3, -0.62).toNonIndexed(),
    new THREE.BoxGeometry(0.34, 0.14, 0.7).translate(0, 0.38, 0.05).toNonIndexed(),
    new THREE.CapsuleGeometry(0.22, 0.6, 3, 8).rotateX(Math.PI / 2).translate(0, 0.58, -0.42).toNonIndexed(),
    new THREE.BoxGeometry(0.38, 0.62, 0.16).rotateX(-0.25).translate(0, 0.68, 0.48).toNonIndexed(),
    new THREE.BoxGeometry(0.62, 0.05, 0.05).translate(0, 1.08, 0.44).toNonIndexed(),
  ].map((g) => { g.deleteAttribute('uv'); return g; }));
  const rider = mergeGeometries([
    new THREE.CapsuleGeometry(0.19, 0.42, 3, 8).rotateX(0.15).translate(0, 1.18, -0.2).toNonIndexed(), // thân
    new THREE.SphereGeometry(0.15, 10, 8).translate(0, 1.66, -0.14).toNonIndexed(), // mũ bảo hiểm
    new THREE.CapsuleGeometry(0.06, 0.5, 2, 6).rotateX(1.2).translate(-0.2, 1.24, 0.12).toNonIndexed(), // tay
    new THREE.CapsuleGeometry(0.06, 0.5, 2, 6).rotateX(1.2).translate(0.2, 1.24, 0.12).toNonIndexed(),
    new THREE.CapsuleGeometry(0.08, 0.42, 2, 6).rotateX(1.35).translate(-0.17, 0.82, 0.08).toNonIndexed(), // đùi
    new THREE.CapsuleGeometry(0.08, 0.42, 2, 6).rotateX(1.35).translate(0.17, 0.82, 0.08).toNonIndexed(),
  ].map((g) => { g.deleteAttribute('uv'); return g; }));
  return { bike, rider, head: new THREE.SphereGeometry(0.07, 8, 6).translate(0, 0.98, 0.6) };
}

export const road: KitFactory = (ctx, p) => {
  const H = (p.y ?? ctx.zone.ground.bankHeight) as number;
  const zLen = (p.zLen ?? 860) as number;
  const W = p.width as number;
  const g = new THREE.Group();
  ctx.scene.add(g);

  const roadMat = pbr('asphalt_02', 3, { tint: '#9a9a9a', macro: 0.2, roughness: 1 });
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(W, zLen).rotateX(-Math.PI / 2), roadMat);
  surface.position.set(p.x, H + 0.02, 0);
  surface.receiveShadow = true;
  g.add(surface);

  // Vạch kẻ: tim đường vàng nét liền đôi, vạch chia làn trắng đứt, vạch mép trắng liền
  const paint = new THREE.MeshStandardMaterial({ color: '#e9e6dc', roughness: 0.7 });
  const yellow = new THREE.MeshStandardMaterial({ color: '#e0b43a', roughness: 0.7 });
  const lines: THREE.BufferGeometry[] = [], ylines: THREE.BufferGeometry[] = [];
  const flat = (w: number, l: number, x: number, z: number) => new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2).translate(x, H + 0.03, z);
  ylines.push(flat(0.12, zLen, p.x - 0.12, 0), flat(0.12, zLen, p.x + 0.12, 0));
  for (const e of [-1, 1]) lines.push(flat(0.15, zLen, p.x + e * (W / 2 - 0.5), 0));
  if (W >= 14) for (const e of [-1, 1]) for (let z = -zLen / 2; z < zLen / 2; z += 10) lines.push(flat(0.13, 4, p.x + e * W * 0.25, z));
  // vạch qua đường (vằn ngựa)
  for (const cz of (p.crossings ?? []) as number[]) {
    for (let x = -W / 2 + 0.8; x < W / 2 - 0.6; x += 1.1) lines.push(flat(0.55, 4, p.x + x, cz));
  }
  g.add(new THREE.Mesh(mergeGeometries(lines), paint), new THREE.Mesh(mergeGeometries(ylines), yellow));

  // Bó vỉa hai bên
  const curbMat = new THREE.MeshStandardMaterial({ color: '#c2bfb6', roughness: 0.85 });
  for (const e of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, zLen), curbMat);
    c.position.set(p.x + e * (W / 2 + 0.15), H + 0.08, 0);
    c.receiveShadow = true;
    g.add(c);
  }

  // ---------- Ô tô ----------
  const palette = ['#f2f2f2', '#1c1c1c', '#b8bcc4', '#8a8f98', '#7a1a22', '#2a4f8f', '#f2f2f2', '#d9d9d6', '#2f9e6f', '#464a50'].map((c) => new THREE.Color(c));
  const nCars = ctx.quality === 'low' ? 10 : (p.cars ?? 22);
  const kinds = [carGeometries('sedan'), carGeometries('suv')];
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.28, metalness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#141b22', roughness: 0.06, metalness: 0.85 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.9 });
  const headMat = new THREE.MeshBasicMaterial({ color: '#fff6dd' });
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ff2a1a' });
  type Mover = { x: number; z: number; v: number; kind: number; idx: number; wob: number };
  const cars: Mover[] = [];
  const perKind = [0, 0];
  for (let i = 0; i < nCars; i++) {
    const lane = i % 2 === 0 ? 1 : -1;
    const kind = i % 3 === 0 ? 1 : 0;
    // xe đi bên phải: hướng +z chạy ở bên +x khi nhìn theo chiều đi
    const laneOff = W >= 14 ? (i % 4 < 2 ? 0.14 : 0.33) : 0.22;
    cars.push({ x: p.x - lane * W * laneOff, z: (Math.random() - 0.5) * zLen, v: lane * (10 + Math.random() * 5), kind, idx: perKind[kind]++, wob: 0 });
  }
  const carMeshes = kinds.map((k, ki) => {
    const n = Math.max(1, perKind[ki]);
    const body = new THREE.InstancedMesh(k.body, bodyMat, n);
    const glass = new THREE.InstancedMesh(k.glass, glassMat, n);
    const wheels = new THREE.InstancedMesh(k.wheels, tyreMat, n);
    const head = new THREE.InstancedMesh(k.head, headMat, n);
    const tail = new THREE.InstancedMesh(k.tail, tailMat, n);
    body.castShadow = glass.castShadow = true;
    g.add(body, glass, wheels, head, tail);
    return [body, glass, wheels, head, tail];
  });
  cars.forEach((c, i) => carMeshes[c.kind][0].setColorAt(c.idx, palette[i % palette.length]));

  // ---------- Xe máy ----------
  const nBikes = ctx.quality === 'low' ? 14 : (p.bikes ?? 40);
  const BG = bikeGeometries();
  const bikeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.3 });
  const riderMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
  const bikesM = new THREE.InstancedMesh(BG.bike, bikeMat, nBikes);
  const ridersM = new THREE.InstancedMesh(BG.rider, riderMat, nBikes);
  const bHead = new THREE.InstancedMesh(BG.head, headMat, nBikes);
  bikesM.castShadow = ridersM.castShadow = true;
  g.add(bikesM, ridersM, bHead);
  const bikeCols = ['#c8102e', '#1c1c1c', '#f2f2f2', '#2a4f8f', '#e8c547', '#8a8f98', '#e87ba6'].map((c) => new THREE.Color(c));
  const shirtCols = ['#f4f4f0', '#2a4f8f', '#c8102e', '#3b3b3b', '#7fb3d5', '#e6c27a', '#5d8a5a', '#d97b9b'].map((c) => new THREE.Color(c));
  const bikes: Mover[] = [];
  for (let i = 0; i < nBikes; i++) {
    const lane = i % 2 === 0 ? 1 : -1;
    const off = W / 2 - 0.9 - Math.random() * Math.min(2.2, W * 0.15);
    bikes.push({ x: p.x - lane * off, z: (Math.random() - 0.5) * zLen, v: lane * (7 + Math.random() * 4), kind: 0, idx: i, wob: Math.random() * 10 });
    bikesM.setColorAt(i, bikeCols[i % bikeCols.length]);
    ridersM.setColorAt(i, shirtCols[(i * 3) % shirtCols.length]);
  }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3();
  const half = zLen / 2;
  // xe ở xa quá thì không vẽ: dồn các xe gần camera lên đầu bộ đệm
  const NEAR2 = 520 * 520;
  for (const mesh of [...carMeshes.flat(), bikesM, ridersM, bHead]) mesh.userData.dynamic = true;
  const carCol = cars.map((_, i) => palette[i % palette.length]);
  const bikeCol = bikes.map((_, i) => bikeCols[i % bikeCols.length]);
  const shirtCol = bikes.map((_, i) => shirtCols[(i * 3) % shirtCols.length]);
  const wrap = (c: Mover, dt: number) => {
    c.z += c.v * dt;
    if (c.z > half) c.z = -half;
    if (c.z < -half) c.z = half;
  };
  return {
    update(dt, env, camera) {
      headMat.color.setScalar(0.5 + env.night * 2.6);
      tailMat.color.setRGB(0.45 + env.night * 2.6, 0.06, 0.04);
      const cx = camera.position.x, cz = camera.position.z;
      const far = (x: number, z: number) => (x - cx) ** 2 + (z - cz) ** 2 > NEAR2;
      const slot = [0, 0];
      cars.forEach((c, i) => {
        wrap(c, dt);
        if (far(c.x, c.z)) return;
        const k = slot[c.kind]++;
        q.setFromAxisAngle(up, c.v > 0 ? 0 : Math.PI);
        m.compose(v.set(c.x, H + 0.02, c.z), q, one);
        for (const mesh of carMeshes[c.kind]) mesh.setMatrixAt(k, m);
        carMeshes[c.kind][0].setColorAt(k, carCol[i]);
      });
      carMeshes.forEach((meshes, ki) => {
        for (const mesh of meshes) { mesh.count = slot[ki]; mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
        if (meshes[0].instanceColor) meshes[0].instanceColor.needsUpdate = true;
      });
      let nb = 0;
      bikes.forEach((b, i) => {
        wrap(b, dt);
        if (far(b.x, b.z)) return;
        const idx = nb++;
        bikesM.setColorAt(idx, bikeCol[i]); ridersM.setColorAt(idx, shirtCol[i]);
        b.wob += dt;
        // xe máy len lỏi: lệch ngang nhẹ
        const sway = Math.sin(b.wob * 0.7) * 0.35;
        q.setFromAxisAngle(up, (b.v > 0 ? 0 : Math.PI) + Math.cos(b.wob * 0.7) * 0.04);
        m.compose(v.set(b.x + sway, H + 0.02, b.z), q, one);
        bikesM.setMatrixAt(idx, m); ridersM.setMatrixAt(idx, m); bHead.setMatrixAt(idx, m);
      });
      for (const mesh of [bikesM, ridersM, bHead]) { mesh.count = nb; mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
      bikesM.instanceColor!.needsUpdate = ridersM.instanceColor!.needsUpdate = true;
    },
  };
};
