// Kit cầu tàu treo ổ khóa: lan can có đèn trái tim, ổ khóa của người chơi thật (lưu trên server).
import * as THREE from 'three';
import type { KitFactory } from './types';
import { pbr } from '../engine/Materials';
import type { LockRecord } from '../../shared/protocol';

function heartShape(s: number) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.9 * s);
  sh.bezierCurveTo(-1.2 * s, -0.1 * s, -0.9 * s, 0.85 * s, 0, 0.35 * s);
  sh.bezierCurveTo(0.9 * s, 0.85 * s, 1.2 * s, -0.1 * s, 0, -0.9 * s);
  return sh;
}

export interface LockApi {
  setLocks(list: LockRecord[]): void;
  upsert(l: LockRecord): void;
  nearest(p: THREE.Vector3, maxDist: number): LockRecord | null;
  slotPos(slot: number): THREE.Vector3;
  highlight(id: string | null): void;
  onPier(p: THREE.Vector3): boolean;
  count(): number;
}

export const lockPier: KitFactory = (ctx, p) => {
  const g = new THREE.Group();
  ctx.scene.add(g);
  const deckMat = new THREE.MeshStandardMaterial({ color: '#8c6f55', roughness: 0.85 });
  const stoneMat = pbr('granite_tile', 2.3, { plane: 'box', tint: '#e8e0d2', macro: 0.12 });
  const railMat = new THREE.MeshStandardMaterial({ color: '#d8d6cf', metalness: 0.6, roughness: 0.3 });
  const y = p.y as number;

  const deck = new THREE.Mesh(new THREE.BoxGeometry(p.x1 - p.x0, 0.5, p.z1 - p.z0), deckMat);
  deck.position.set((p.x0 + p.x1) / 2, y - 0.25, (p.z0 + p.z1) / 2);
  deck.receiveShadow = true;
  const [px0, px1, pz0, pz1] = p.platform as number[];
  const plat = new THREE.Mesh(new THREE.CylinderGeometry((px1 - px0) / 2, (px1 - px0) / 2, 0.5, 40), stoneMat);
  plat.scale.z = (pz1 - pz0) / (px1 - px0);
  plat.position.set((px0 + px1) / 2, y - 0.25, (pz0 + pz1) / 2);
  plat.receiveShadow = true;
  g.add(deck, plat);
  // chân cầu tàu
  for (let x = p.x0 + 2; x < p.x1; x += 6) for (const z of [p.z0 + 0.5, p.z1 - 0.5]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, y + 2, 8), stoneMat);
    leg.position.set(x, (y - 2) / 2 - 0.5, z);
    g.add(leg);
  }

  // lan can + đèn trái tim đỏ
  const heartGeo = new THREE.ExtrudeGeometry(heartShape(0.42), { depth: 0.12, bevelEnabled: false });
  heartGeo.center();
  const heartMat = new THREE.MeshStandardMaterial({ color: '#c8102e', emissive: '#ff1e3c', emissiveIntensity: 0, roughness: 0.4 });
  const lamps: THREE.Vector3[] = [];
  for (const z of [p.z0 + 0.15, p.z1 - 0.15]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(p.x1 - p.x0, 0.07, 0.07), railMat);
    rail.position.set((p.x0 + p.x1) / 2, y + 1.05, z);
    const rail2 = rail.clone();
    rail2.position.y = y + 0.55;
    g.add(rail, rail2);
    for (let x = p.x0 + 1; x <= p.x1 - 1; x += 4.5) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), railMat);
      post.position.set(x, y + 1.15, z);
      const heart = new THREE.Mesh(heartGeo, heartMat);
      heart.position.set(x, y + 2.45, z);
      heart.rotation.y = Math.PI / 2;
      g.add(post, heart);
      lamps.push(heart.position);
      ctx.reflect.add(x, z + (z > (p.z0 + p.z1) / 2 ? 1 : -1) * 0.6, '#ff2a40', 1.2, 14, 0.8);
    }
  }

  // ổ khóa (instanced)
  const s = ctx.zone.lockSlots!;
  const perRail = Math.floor((s.x1 - s.x0) * s.perMeter) * s.rows;
  const total = perRail * s.zRails.length;
  const lockGeo = new THREE.BoxGeometry(0.1, 0.13, 0.05);
  const lockMat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.75, roughness: 0.3, emissive: '#000000' });
  const locks = new THREE.InstancedMesh(lockGeo, lockMat, total);
  locks.count = 0;
  g.add(locks);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#F2B705').multiplyScalar(3), transparent: true, opacity: 0.8 }));
  glow.visible = false;
  g.add(glow);

  const slotPos = (slot: number) => {
    const rail = Math.floor(slot / perRail) % s.zRails.length;
    const r = slot % perRail;
    const col = Math.floor(r / s.rows), row = r % s.rows;
    const jitter = ((slot * 9301 + 49297) % 233280) / 233280;
    return new THREE.Vector3(s.x0 + (col + 0.5) / s.perMeter, s.y - row * 0.17 - jitter * 0.05, s.zRails[rail] + (s.zRails[rail] > (p.z0 + p.z1) / 2 ? 0.05 : -0.05));
  };

  let records: LockRecord[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const redraw = () => {
    locks.count = records.length;
    records.forEach((l, i) => {
      const pos = slotPos(l.slot);
      q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), ((l.slot % 7) - 3) * 0.08);
      m.compose(pos, q, new THREE.Vector3(1, 1, 1));
      locks.setMatrixAt(i, m);
      locks.setColorAt(i, new THREE.Color(l.color));
    });
    locks.instanceMatrix.needsUpdate = true;
    if (locks.instanceColor) locks.instanceColor.needsUpdate = true;
  };

  const api: LockApi = {
    setLocks(list) { records = list.slice(-total); redraw(); },
    upsert(l) {
      records = records.filter((r) => r.id !== l.id && r.slot !== l.slot);
      records.push(l);
      redraw();
    },
    nearest(pt, maxDist) {
      let best: LockRecord | null = null, bd = maxDist;
      for (const l of records) {
        const d = slotPos(l.slot).distanceTo(pt);
        if (d < bd) { bd = d; best = l; }
      }
      return best;
    },
    slotPos,
    highlight(id) {
      const l = id ? records.find((r) => r.id === id) : null;
      glow.visible = !!l;
      if (l) glow.position.copy(slotPos(l.slot));
    },
    onPier(pt) {
      return pt.x >= p.x0 - 1 && pt.x <= p.x1 && pt.z >= p.z0 - 1 && pt.z <= p.z1 + 1;
    },
    count: () => records.length,
  };

  return {
    api,
    update(_dt, env) {
      heartMat.emissiveIntensity = 0.15 + env.night * 2.2;
      glow.scale.setScalar(1 + Math.sin(env.now / 200) * 0.2);
    },
  };
};
