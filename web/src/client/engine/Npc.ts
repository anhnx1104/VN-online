// NPC du khách để khu không bao giờ vắng. Không có bảng tên, để không bị nhầm là người thật.
import * as THREE from 'three';
import { Avatar, ANIM } from './Avatar';
import type { WalkMap } from './Walk';

const COLORS = ['#e2574c', '#f2c14e', '#4fb0a5', '#5b7bd5', '#f7f3e8', '#9b6bd3', '#ef8a5b', '#7fb069'];

interface Npc { a: Avatar; target: THREE.Vector3 | null; wait: number; home: THREE.Vector3; seed: number }

export class Crowd {
  list: Npc[] = [];
  constructor(private scene: THREE.Scene, private walk: WalkMap, private anchors: { x: number; z: number }[]) {}

  setCount(n: number) {
    while (this.list.length < n) this.spawn();
    while (this.list.length > n) {
      const x = this.list.pop()!;
      this.scene.remove(x.a.root);
      x.a.dispose();
    }
  }

  private spawn() {
    const i = this.list.length;
    const anchor = this.anchors[i % this.anchors.length];
    const p = this.walk.randomPoint(anchor.x, anchor.z, 18);
    if (!p) return;
    const a = new Avatar('npc' + i + Math.random(), '', COLORS[i % COLORS.length], Math.random() < 0.3, false);
    a.root.position.set(p.x, p.y, p.z);
    a.root.rotation.y = Math.random() * 6.28;
    this.scene.add(a.root);
    this.list.push({ a, target: null, wait: Math.random() * 6, home: new THREE.Vector3(p.x, p.y, p.z), seed: Math.random() });
  }

  /** watchPoint: khi có sự kiện, NPC kéo về xem */
  update(dt: number, watchPoint: THREE.Vector3 | null) {
    for (const n of this.list) {
      const r = n.a.root;
      if (!n.target) {
        n.wait -= dt;
        n.a.anim = ANIM.idle;
        if (watchPoint) {
          const dx = watchPoint.x - r.position.x, dz = watchPoint.z - r.position.z;
          const want = Math.atan2(dx, dz);
          r.rotation.y += Math.atan2(Math.sin(want - r.rotation.y), Math.cos(want - r.rotation.y)) * Math.min(1, dt * 3);
          if (Math.random() < dt * 0.05) n.a.playEmote(Math.random() < 0.5 ? 'photo' : 'heart');
        }
        if (n.wait <= 0) {
          const c = watchPoint && n.seed < 0.8 ? watchPoint : n.home;
          const p = this.walk.randomPoint(c.x, c.z, watchPoint ? 12 : 22);
          if (p) n.target = new THREE.Vector3(p.x, p.y, p.z);
          n.wait = 3 + Math.random() * 10;
          if (!watchPoint && Math.random() < 0.15) { n.a.playEmote(['wave', 'photo', 'sit'][Math.floor(Math.random() * 3)]); n.target = null; n.wait = 8; }
        }
      } else {
        const dx = n.target.x - r.position.x, dz = n.target.z - r.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.4) { n.target = null; continue; }
        const step = Math.min(d, dt * 1.6);
        const nx = r.position.x + (dx / d) * step, nz = r.position.z + (dz / d) * step;
        const h = this.walk.canStand(nx, nz, r.position.y);
        if (h === null) { n.target = null; continue; }
        r.position.set(nx, h, nz);
        const want = Math.atan2(dx, dz);
        r.rotation.y += Math.atan2(Math.sin(want - r.rotation.y), Math.cos(want - r.rotation.y)) * Math.min(1, dt * 6);
        n.a.anim = ANIM.walk;
        if (n.a.emote === 'sit') n.a.stopEmote();
      }
      n.a.update(dt);
    }
  }
}
