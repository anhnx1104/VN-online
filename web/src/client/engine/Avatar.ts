// Nhân vật cách điệu: áo màu, nón lá tùy chọn, bảng tên, bong bóng chat, biểu cảm.
import * as THREE from 'three';
import { makeScooter } from './vehicles';

const SKIN = ['#f1cfae', '#e6b78f', '#d39b72', '#b97e57', '#f6dcc2'];
const PANTS = ['#2b3346', '#3d3a33', '#1f2a3a', '#4a4f5c', '#e8e2d2', '#5b6b52'];
const HAIR = ['#1c1714', '#2e2019', '#4a3022', '#1c1714', '#3a2a22'];
const SHOES = ['#f4f4f0', '#2a2a2e', '#8b5a3c', '#f4f4f0'];
export const HAIR_STYLES = ['Tóc ngắn', 'Tóc dài', 'Búi tóc', 'Đuôi ngựa'] as const;

// Thân áo: tiện tròn từ eo lên vai, dẹt theo chiều trước-sau
const torsoGeo = new THREE.LatheGeometry(
  [[0.001, 0.84], [0.2, 0.86], [0.215, 0.98], [0.245, 1.18], [0.26, 1.33], [0.22, 1.43], [0.12, 1.48], [0.001, 1.49]].map(([x, y]) => new THREE.Vector2(x, y)),
  20,
).scale(1, 1, 0.72);
const hipGeo = new THREE.CylinderGeometry(0.185, 0.19, 0.12, 18).scale(1, 1, 0.72);
const neckGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.12, 10);
const headGeo = new THREE.SphereGeometry(0.27, 28, 20).scale(1, 1.04, 0.97);
const legGeo = new THREE.CapsuleGeometry(0.095, 0.5, 4, 10).translate(0, -0.37, 0);
const shoeGeo = new THREE.CapsuleGeometry(0.075, 0.13, 4, 8).rotateX(Math.PI / 2).scale(1.15, 0.85, 1).translate(0, -0.76, 0.05);
const sleeveGeo = new THREE.CapsuleGeometry(0.085, 0.14, 4, 10).translate(0, -0.1, 0);
const foreGeo = new THREE.CapsuleGeometry(0.062, 0.24, 4, 8).translate(0, -0.33, 0);
const handGeo = new THREE.SphereGeometry(0.072, 10, 8).scale(1, 1.15, 0.8).translate(0, -0.52, 0);
// Mặt
const eyeGeo = new THREE.SphereGeometry(0.04, 12, 10).scale(0.85, 1.15, 0.45);
const glintGeo = new THREE.SphereGeometry(0.012, 6, 6);
const browGeo = new THREE.CapsuleGeometry(0.011, 0.05, 2, 6).rotateZ(Math.PI / 2);
const mouthGeo = new THREE.TorusGeometry(0.042, 0.011, 6, 14, Math.PI).rotateZ(Math.PI);
const cheekGeo = new THREE.CircleGeometry(0.038, 14);
// Tóc
const capGeo = new THREE.SphereGeometry(0.29, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.56).scale(1, 1.04, 1);
const fringeGeo = new THREE.SphereGeometry(0.285, 20, 8, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.3, Math.PI * 0.16);
const longGeo = new THREE.CapsuleGeometry(0.2, 0.32, 4, 12).scale(1.15, 1, 0.55);
const bunGeo = new THREE.SphereGeometry(0.11, 14, 10);
const tailGeo = new THREE.CapsuleGeometry(0.065, 0.28, 4, 8);
// Nón lá: chóp + vành + quai
const hatGeo = new THREE.ConeGeometry(0.5, 0.3, 28, 1, true);
const hatRimGeo = new THREE.TorusGeometry(0.5, 0.012, 6, 36).rotateX(Math.PI / 2);
const strapGeo = new THREE.TorusGeometry(0.24, 0.006, 4, 24, Math.PI).rotateZ(Math.PI);

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, rough = 0.8) {
  const k = color + rough;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough }));
  return matCache.get(k)!;
}
const hatMat = new THREE.MeshStandardMaterial({ color: '#e2cc92', roughness: 0.85, side: THREE.DoubleSide });
const eyeMat = new THREE.MeshStandardMaterial({ color: '#241812', roughness: 0.3 });
const glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const mouthMat = new THREE.MeshStandardMaterial({ color: '#9c3b3b', roughness: 0.6 });
const cheekMat = new THREE.MeshBasicMaterial({ color: '#ff8a8a', transparent: true, opacity: 0.35, depthWrite: false });

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

function textSprite(text: string, opts: { font: string; color: string; bg?: string; pad?: number; maxW?: number }) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const scale = 2;
  ctx.font = opts.font;
  const pad = opts.pad ?? 10;
  const lines: string[] = [];
  const maxW = opts.maxW ?? 9999;
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  lines.push(line);
  const lh = parseInt(opts.font.match(/(\d+)px/)?.[1] ?? '20') * 1.3;
  const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width))) + pad * 2;
  const h = lines.length * lh + pad * 1.4;
  c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
  ctx.scale(scale, scale);
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    const r = Math.min(12, h / 2);
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, r);
    ctx.fill();
  }
  ctx.font = opts.font;
  ctx.fillStyle = opts.color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, w / 2, pad * 0.7 + lh * (i + 0.5)));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, fog: false }));
  sp.scale.set(w / 110, h / 110, 1);
  sp.renderOrder = 10;
  return sp;
}

export const ANIM = { idle: 0, walk: 1, run: 2, sit: 3, dance: 4 } as const;

export class Avatar {
  root = new THREE.Group();
  private body: THREE.Group;
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private head = new THREE.Group();
  private eyes: THREE.Mesh[] = [];
  private nextBlink = performance.now() + 1500 + Math.random() * 3000;
  private label: THREE.Sprite | null = null;
  private bubble: THREE.Sprite | null = null;
  private bubbleUntil = 0;
  private fx: { obj: THREE.Object3D; until: number; kind: string } | null = null;
  private phase = Math.random() * 10;
  anim: number = ANIM.idle;
  emote: string | null = null;
  private emoteUntil = 0;
  // nội suy cho người chơi khác
  target = new THREE.Vector3();
  targetYaw = 0;
  /** 0 đi bộ, 1 lái xe máy, 2 ngồi sau, 3 trong taxi (ẩn) */
  vehicle = 0;
  partner = '';
  private bike: THREE.Group | null = null;
  private wheelSpin = 0;
  private lastPos = new THREE.Vector3();

  setVehicle(v: number, bikeColor = '#C8102E') {
    if (v === this.vehicle) return;
    this.vehicle = v;
    if (this.bike) { this.root.remove(this.bike); this.bike = null; }
    if (v === 1) {
      this.bike = makeScooter(bikeColor);
      this.bike.position.z = 0.05;
      this.root.add(this.bike);
    }
    this.root.visible = v !== 3;
    this.emote = null;
  }

  /** hair: kiểu tóc 0–3 (xem HAIR_STYLES); bỏ trống thì chọn theo id */
  constructor(public id: string, public name: string, color: string, hat: boolean, showLabel = true, hair?: number) {
    const h = hash(id);
    this.body = new THREE.Group();
    this.root.add(this.body);
    const skinC = SKIN[h % SKIN.length];
    const skin = mat(skinC, 0.65);
    const shirt = mat(color, 0.72);
    const pants = mat(PANTS[(h >> 3) % PANTS.length], 0.85);
    const hairM = mat(HAIR[(h >> 5) % HAIR.length], 0.55);
    const shoe = mat(SHOES[(h >> 7) % SHOES.length], 0.6);
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // thân
    add(this.body, torsoGeo, shirt);
    add(this.body, hipGeo, pants, 0, 0.83, 0);
    add(this.body, neckGeo, skin, 0, 1.53, 0);
    // chân (khớp ở hông)
    for (const [leg, x] of [[this.legL, -0.105], [this.legR, 0.105]] as [THREE.Group, number][]) {
      leg.position.set(x, 0.84, 0);
      add(leg, legGeo, pants);
      add(leg, shoeGeo, shoe);
      this.body.add(leg);
    }
    // tay (khớp ở vai): tay áo + cẳng tay + bàn tay
    for (const [arm, x] of [[this.armL, -0.29], [this.armR, 0.29]] as [THREE.Group, number][]) {
      arm.position.set(x, 1.4, 0);
      add(arm, sleeveGeo, shirt);
      add(arm, foreGeo, skin);
      add(arm, handGeo, skin);
      this.body.add(arm);
    }
    // đầu + mặt (mặt nhìn về +z)
    this.head.position.y = 1.76;
    this.body.add(this.head);
    add(this.head, headGeo, skin);
    for (const sx of [-1, 1]) {
      const eye = add(this.head, eyeGeo, eyeMat, sx * 0.095, 0.01, 0.245);
      add(eye, glintGeo, glintMat, 0.012 * -sx, 0.016, 0.02).castShadow = false;
      this.eyes.push(eye);
      const brow = add(this.head, browGeo, hairM, sx * 0.1, 0.085, 0.245);
      brow.rotation.z = sx * -0.12;
      const cheek = add(this.head, cheekGeo, cheekMat, sx * 0.155, -0.06, 0.218);
      cheek.rotation.y = sx * 0.55;
      cheek.castShadow = false;
    }
    add(this.head, mouthGeo, mouthMat, 0, -0.085, 0.255).rotation.x = -0.2;
    // tóc
    const style = hair ?? (h >> 9) % 4;
    const cap = add(this.head, capGeo, hairM, 0, 0.005, -0.012);
    cap.rotation.x = -0.32;
    add(this.head, fringeGeo, hairM, 0, 0.02, 0.0).rotation.x = -0.05;
    if (style === 1) add(this.head, longGeo, hairM, 0, -0.2, -0.13);
    if (style === 2) add(this.head, bunGeo, hairM, 0, 0.26, -0.1);
    if (style === 3) { const t = add(this.head, tailGeo, hairM, 0, -0.06, -0.31); t.rotation.x = 0.35; add(this.head, bunGeo, hairM, 0, 0.08, -0.26).scale.setScalar(0.55); }
    if (hat) {
      const hatG = new THREE.Group();
      hatG.position.set(0, 0.29, 0.01);
      hatG.rotation.x = -0.08;
      add(hatG, hatGeo, hatMat);
      add(hatG, hatRimGeo, hatMat, 0, -0.15, 0);
      add(hatG, strapGeo, mat('#e8e2d2', 0.8), 0, -0.2, 0.04).rotation.y = 0;
      this.head.add(hatG);
    }
    if (showLabel) this.setLabel(name);
  }

  setLabel(name: string) {
    if (this.label) this.root.remove(this.label);
    this.label = textSprite(name, { font: '600 22px "Be Vietnam Pro", sans-serif', color: '#e8eee4', bg: 'rgba(18,33,61,.72)', pad: 9 });
    (this.label.material as THREE.SpriteMaterial).color.setScalar(0.7);
    this.label.position.y = 2.55;
    this.root.add(this.label);
  }

  say(text: string) {
    if (this.bubble) this.root.remove(this.bubble);
    this.bubble = textSprite(text, { font: '24px "Patrick Hand", "Be Vietnam Pro", sans-serif', color: '#12213D', bg: 'rgba(232,238,228,.96)', pad: 12, maxW: 300 });
    (this.bubble.material as THREE.SpriteMaterial).color.setScalar(0.68); // tránh bị bloom làm chói
    this.bubble.position.y = 3.05 + this.bubble.scale.y / 2;
    this.root.add(this.bubble);
    this.bubbleUntil = performance.now() + 4000 + text.length * 70;
  }

  playEmote(e: string) {
    this.emote = e;
    this.emoteUntil = performance.now() + (e === 'sit' ? 1e9 : e === 'dance' ? 6000 : 2600);
    if (e === 'heart') this.spawnFx('heart', '❤', '#ff4d6d');
    if (e === 'photo') this.spawnFx('photo', '📸', '#fff');
  }
  stopEmote() { this.emote = null; }

  private spawnFx(kind: string, glyph: string, color: string) {
    if (this.fx) this.root.remove(this.fx.obj);
    const sp = textSprite(glyph, { font: '64px sans-serif', color, pad: 2 });
    sp.position.y = 2.6;
    this.root.add(sp);
    this.fx = { obj: sp, until: performance.now() + 2200, kind };
  }

  update(dt: number) {
    const now = performance.now();
    // chớp mắt
    if (now > this.nextBlink) {
      const k = now - this.nextBlink < 130 ? 0.12 : 1;
      for (const e of this.eyes) e.scale.y = k;
      if (k === 1) this.nextBlink = now + 2500 + Math.random() * 3500;
    }
    this.head.rotation.set(Math.sin(now / 1700 + this.phase) * 0.04, Math.sin(now / 2300 + this.phase) * 0.12, 0);
    if (this.emote && now > this.emoteUntil) this.emote = null;
    if (this.bubble && now > this.bubbleUntil) { this.root.remove(this.bubble); this.bubble = null; }
    if (this.fx) {
      const left = (this.fx.until - now) / 2200;
      this.fx.obj.position.y = 2.6 + (1 - left) * 1.2;
      (this.fx.obj as THREE.Sprite).material.opacity = Math.min(1, left * 3);
      if (left <= 0) { this.root.remove(this.fx.obj); this.fx = null; }
    }

    if (this.vehicle === 1 || this.vehicle === 2) {
      // tư thế ngồi trên xe: người lái nắm ghi đông, người ngồi sau ôm eo
      this.body.position.set(0, 0.05, 0);
      this.body.rotation.set(this.vehicle === 1 ? 0.08 : 0, 0, 0);
      this.legL.rotation.set(-1.3, 0, 0.14);
      this.legR.rotation.set(-1.3, 0, -0.14);
      if (this.vehicle === 1) { this.armL.rotation.set(-1.25, 0, 0.12); this.armR.rotation.set(-1.25, 0, -0.12); }
      else { this.armL.rotation.set(-0.8, 0, 0.55); this.armR.rotation.set(-0.8, 0, -0.55); }
      if (this.bike) {
        const moved = this.root.position.distanceTo(this.lastPos);
        this.wheelSpin += moved / 0.3;
        for (const w of this.bike.userData.wheels as THREE.Mesh[]) w.rotation.x = this.wheelSpin;
      }
      this.lastPos.copy(this.root.position);
      return;
    }
    const moving = this.anim === ANIM.walk || this.anim === ANIM.run;
    if (moving && this.emote && this.emote !== 'heart') this.emote = null;
    const speed = this.anim === ANIM.run ? 16 : 11; // nhịp bước chân khớp với tốc độ đi
    this.phase += dt * (moving ? speed : 1.6);
    const swing = moving ? Math.sin(this.phase) * (this.anim === ANIM.run ? 0.85 : 0.55) : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.set(-swing * 0.8, 0, 0.08);
    this.armR.rotation.set(swing * 0.8, 0, -0.08);
    this.body.position.y = moving ? Math.abs(Math.cos(this.phase)) * 0.06 : Math.sin(this.phase) * 0.012;
    this.body.rotation.set(0, 0, 0);

    const e = this.emote ?? (this.anim === ANIM.sit ? 'sit' : this.anim === ANIM.dance ? 'dance' : null);
    if (e === 'wave') {
      this.armR.rotation.set(0, 0, -2.6 + Math.sin(now / 110) * 0.35);
    } else if (e === 'dance') {
      const t = now / 260;
      this.body.position.y = Math.abs(Math.sin(t * 2)) * 0.14;
      this.body.rotation.y = Math.sin(t) * 0.5;
      this.armL.rotation.set(0, 0, 2.4 + Math.sin(t * 2) * 0.4);
      this.armR.rotation.set(0, 0, -2.4 - Math.sin(t * 2) * 0.4);
      this.legL.rotation.x = Math.sin(t * 2) * 0.3;
      this.legR.rotation.x = -Math.sin(t * 2) * 0.3;
    } else if (e === 'sit') {
      this.body.position.y = -0.45;
      this.legL.rotation.x = this.legR.rotation.x = -1.45;
      this.armL.rotation.x = this.armR.rotation.x = -0.4;
    } else if (e === 'photo') {
      this.armL.rotation.set(-1.5, 0, 0.25);
      this.armR.rotation.set(-1.5, 0, -0.25);
    } else if (e === 'heart') {
      this.armL.rotation.set(0, 0, 2.7);
      this.armR.rotation.set(0, 0, -2.7);
    }
  }

  /** Nội suy mượt tới trạng thái nhận từ mạng */
  follow(dt: number) {
    const k = 1 - Math.exp(-dt * 10);
    this.root.position.lerp(this.target, k);
    let dy = this.targetYaw - this.root.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.root.rotation.y += dy * k;
  }

  dispose() {
    this.root.traverse((o) => {
      const s = o as THREE.Sprite;
      if (s.isSprite) { s.material.map?.dispose(); s.material.dispose(); }
    });
  }
}

export { textSprite };
