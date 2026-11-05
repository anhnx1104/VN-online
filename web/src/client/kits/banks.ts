// Kit bờ kè: nền hai bờ, lối đi bộ lát đá granite, kè đá, lan can, thảm cỏ có viền bó vỉa và bồn hoa.
import * as THREE from 'three';
import type { KitFactory } from './types';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pbr } from '../engine/Materials';
import { bushes } from './flora';

export const banks: KitFactory = (ctx, p) => {
  const H = p.height as number;
  const zLen = p.zLen as number;
  const group = new THREE.Group();
  ctx.scene.add(group);

  const paveMat = pbr('granite_tile', 2.3, { tint: '#e6ddcf', macro: 0.16 });
  const groundMat = pbr('granite_tile_03', 1.8, { tint: '#a6a29a', macro: 0.22, plane: 'box' });
  const wallMat = pbr('rock_wall_08', 1.8, { plane: 'x', tint: '#c9c2b4', macro: 0.25 });
  const railMat = new THREE.MeshStandardMaterial({ color: '#dcdcd4', roughness: 0.35, metalness: 0.6 });
  const grassMat = pbr('leafy_grass', 2, { tint: '#b9d39a', macro: 0.3 });
  const curbMat = new THREE.MeshStandardMaterial({ color: '#cfccc4', roughness: 0.8 });

  const sides: { edge: number; far: number; dir: 1 | -1 }[] = [
    { edge: p.east[0], far: p.east[1], dir: 1 },
    { edge: p.west[1], far: p.west[0], dir: -1 },
  ];

  for (const s of sides) {
    const width = Math.abs(s.far - s.edge);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(width, H + 6, zLen), groundMat);
    ground.position.set((s.edge + s.far) / 2, H / 2 - 3 - 0.02, 0);
    ground.receiveShadow = true;
    group.add(ground);

    const pw = p.promenadeWidth + 70;
    const pave = new THREE.Mesh(new THREE.PlaneGeometry(pw, zLen).rotateX(-Math.PI / 2), paveMat);
    pave.position.set(s.edge + (s.dir * pw) / 2, H + 0.01, 0);
    pave.receiveShadow = true;
    group.add(pave);

    // mặt kè đá
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(zLen, H + 6), wallMat);
    wall.rotation.y = s.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
    wall.position.set(s.edge - s.dir * 0.01, H / 2 - 3, 0);
    group.add(wall);
    // gờ đá đỉnh kè
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, zLen), curbMat);
    cap.position.set(s.edge + s.dir * 0.3, H + 0.06, 0);
    cap.receiveShadow = true;
    group.add(cap);

    // lan can: tay vịn, thanh giữa, cột
    for (const [y, r] of [[H + 1.05, 0.05], [H + 0.55, 0.025]] as const) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(r, r, zLen, 6).rotateX(Math.PI / 2), railMat);
      rail.position.set(s.edge + s.dir * 0.25, y, 0);
      group.add(rail);
    }
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.04, 1.05, 6), railMat, Math.floor(zLen / 2.5));
    const m = new THREE.Matrix4();
    for (let i = 0; i < posts.count; i++) {
      m.makeTranslation(s.edge + s.dir * 0.25, H + 0.52, -zLen / 2 + i * 2.5);
      posts.setMatrixAt(i, m);
    }
    group.add(posts);
  }

  // Thảm cỏ phẳng mặt đường (đi lên được), viền đá bó vỉa, khóm hoa giấy/hoa bụi
  const lawns = (p.lawns ?? []) as [number, number, number, number][];
  if (lawns.length) {
    const curbs: THREE.BufferGeometry[] = [];
    const grass: THREE.BufferGeometry[] = [];
    const flowers: { x: number; z: number; s: number; c: number }[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [x0, x1, z0, z1] of lawns) {
      const w = x1 - x0, d = z1 - z0;
      grass.push(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, H + 0.03, (z0 + z1) / 2));
      for (const [cx, cz, cw, cd] of [[(x0 + x1) / 2, z0, w + 0.3, 0.3], [(x0 + x1) / 2, z1, w + 0.3, 0.3], [x0, (z0 + z1) / 2, 0.3, d], [x1, (z0 + z1) / 2, 0.3, d]]) {
        curbs.push(new THREE.BoxGeometry(cw, 0.16, cd).translate(cx, H + 0.06, cz));
      }
      const n = Math.floor((w * d) / 120);
      for (let i = 0; i < n; i++) {
        // bồn hoa dọc mép cỏ nhiều hơn ở giữa
        const edge = rnd() < 0.7;
        const x = edge ? (rnd() < 0.5 ? x0 + 1 + rnd() * 2 : x1 - 1 - rnd() * 2) : x0 + 3 + rnd() * (w - 6);
        flowers.push({ x, z: z0 + 1.5 + rnd() * (d - 3), s: 0.6 + rnd() * 0.8, c: Math.floor(rnd() * 4) });
      }
    }
    const grassMesh = new THREE.Mesh(mergeGeometries(grass), grassMat);
    grassMesh.receiveShadow = true;
    group.add(grassMesh);
    const curbMesh = new THREE.Mesh(mergeGeometries(curbs), curbMat);
    curbMesh.receiveShadow = true;
    group.add(curbMesh);

    bushes(group, flowers.map((f) => ({ x: f.x, y: H + 0.02, z: f.z, s: f.s, kind: f.c % 2 })));
  }

  return {};
};

