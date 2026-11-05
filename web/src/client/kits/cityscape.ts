// Kit thành phố nền: nhà sinh theo seed với 4 kiểu mặt tiền (tháp kính, văn phòng dải cửa ngang,
// khách sạn/chung cư có ban công, nhà ống mặt phố). Kính phản chiếu bầu trời, đêm sáng đèn từng ô cửa,
// trên mái có bồn nước, cục nóng điều hoà; đèn báo máy bay trên nhà cao.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { KitFactory } from './types';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
}

/** Một ô mặt tiền 12 m × 12 m (4 tầng × 4 gian) lặp lại được */
const TILE = 12;
export type Style = 'glass' | 'ribbon' | 'balcony' | 'shophouse';
interface Facade { map: THREE.Texture; orm: THREE.Texture; lit: THREE.Texture }

export function facade(style: Style, px: number, r: () => number): Facade {
  const S = px, m = S / TILE; // điểm ảnh mỗi mét
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')!] as const; };
  const [cA, A] = mk(); // màu
  const [cR, R] = mk(); // G = độ nhám, B = độ kim loại
  const [cL, L] = mk(); // cửa sáng đèn ban đêm
  L.fillStyle = '#000'; L.fillRect(0, 0, S, S);
  const wall = (x: number, y: number, w: number, h: number, shade: string, rough = 0.85) => {
    A.fillStyle = shade; A.fillRect(x * m, y * m, w * m, h * m);
    R.fillStyle = `rgb(0,${rough * 255 | 0},0)`; R.fillRect(x * m, y * m, w * m, h * m);
  };
  const glass = (x: number, y: number, w: number, h: number, tone: [number, number, number], litP = 0.5) => {
    const g = A.createLinearGradient(0, y * m, 0, (y + h) * m);
    g.addColorStop(0, `rgb(${tone[0] + 40},${tone[1] + 45},${tone[2] + 50})`);
    g.addColorStop(1, `rgb(${tone[0]},${tone[1]},${tone[2]})`);
    A.fillStyle = g; A.fillRect(x * m, y * m, w * m, h * m);
    R.fillStyle = 'rgb(0,26,150)'; R.fillRect(x * m, y * m, w * m, h * m);
    if (r() < litP) {
      const warm = r() < 0.72;
      const k = 0.55 + r() * 0.45;
      L.fillStyle = warm ? `rgba(255,${200 + r() * 30 | 0},${130 + r() * 50 | 0},${k})` : `rgba(${190 + r() * 30 | 0},${215 + r() * 25 | 0},255,${k})`;
      L.fillRect(x * m + 1, y * m + 1, w * m - 2, h * m - 2);
      // rèm che một phần
      if (r() < 0.4) { L.fillStyle = 'rgba(0,0,0,0.55)'; L.fillRect(x * m, y * m, w * m * (0.3 + r() * 0.5), h * m); }
    }
  };
  const FLOOR = 3;
  if (style === 'glass') {
    const tone: [number, number, number] = ([[52, 66, 70], [60, 64, 70], [46, 62, 66], [70, 72, 70]] as [number, number, number][])[Math.floor(r() * 4)];
    wall(0, 0, TILE, TILE, '#8a949a', 0.4);
    for (let f = 0; f < 4; f++) for (let b = 0; b < 8; b++) glass(b * 1.5 + 0.06, f * FLOOR + 0.06, 1.38, FLOOR - 0.75, tone, 0.45);
    // dải che tầng (spandrel) kính mờ
    for (let f = 0; f < 4; f++) wall(0, f * FLOOR + FLOOR - 0.69, TILE, 0.63, '#4f5d68', 0.25);
  } else if (style === 'ribbon') {
    wall(0, 0, TILE, TILE, '#e3e0d8');
    for (let f = 0; f < 4; f++) {
      for (let b = 0; b < 6; b++) glass(b * 2 + 0.08, f * FLOOR + 0.9, 1.84, 1.6, [52, 66, 74], 0.4);
      wall(0, f * FLOOR + 2.55, TILE, 0.12, '#c7c3b9');
    }
  } else if (style === 'balcony') {
    wall(0, 0, TILE, TILE, '#ece8de');
    for (let f = 0; f < 4; f++) for (let b = 0; b < 4; b++) {
      const x = b * 3, y = f * FLOOR;
      glass(x + 0.5, y + 0.55, 2.0, 2.0, [58, 68, 72], 0.5);
      // lan can ban công + tấm sàn
      wall(x + 0.25, y + 1.75, 2.5, 0.08, '#b9b6ad');
      A.fillStyle = 'rgba(40,44,48,0.55)';
      for (let k = 0; k < 12; k++) A.fillRect((x + 0.3 + k * 0.2) * m, (y + 1.8) * m, 1, 0.8 * m);
      wall(x + 0.2, y + 2.6, 2.6, 0.18, '#cfcac0');
      // cục nóng điều hoà
      if (r() < 0.6) wall(x + (r() < 0.5 ? 0.3 : 2.1), y + 2.05, 0.7, 0.5, '#d9d9d6', 0.6);
    }
  } else {
    // nhà ống: mỗi gian 3–4 m một màu sơn, tầng trệt cửa cuốn/biển hiệu, tầng trên cửa sổ chớp
    const paints = ['#e9d8a6', '#f1e7d0', '#d9e4dc', '#e8c9b7', '#c9d6e3', '#efe3c2', '#e6b8a2', '#d4dfc4'];
    let x = 0;
    while (x < TILE - 0.01) {
      const w = Math.min(TILE - x, [3, 4, 4, 5][Math.floor(r() * 4)]);
      wall(x, 0, w, TILE, paints[Math.floor(r() * paints.length)]);
      // tầng trệt (y lớn ở dưới trong canvas → vẽ đảo: canvas y=0 là đỉnh ô)
      wall(x + 0.15, TILE - 3, w - 0.3, 2.7, r() < 0.5 ? '#9aa0a6' : '#5a5f66', 0.5);
      const signs = ['#c8102e', '#1f6fb2', '#f2b705', '#1fa39a', '#e85d2a', '#ffffff'];
      wall(x + 0.2, TILE - 3.55, w - 0.4, 0.55, signs[Math.floor(r() * signs.length)], 0.5);
      for (let f = 1; f < 4; f++) {
        const y = TILE - 3 - f * FLOOR;
        glass(x + w * 0.2, y + 0.7, w * 0.6, 1.7, [60, 70, 74], 0.55);
        wall(x + w * 0.2, y + 0.55, w * 0.6, 0.12, '#b5ada0');
        if (r() < 0.5) wall(x + w * 0.12, y + 2.25, w * 0.76, 0.1, '#3b3f44'); // mái hiên
      }
      A.fillStyle = 'rgba(0,0,0,0.25)'; A.fillRect((x + w) * m - 1, 0, 2, S);
      x += w;
    }
  }
  // bẩn, vệt nước mưa chảy dọc tường
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, h = 20 + r() * 120;
    const g = A.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(60,55,45,0.14)'); g.addColorStop(1, 'rgba(60,55,45,0)');
    A.fillStyle = g; A.fillRect(x, y, 1 + r() * 3, h);
  }
  for (let i = 0; i < 1600; i++) {
    A.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.05})`;
    A.fillRect(r() * S, r() * S, 2, 2);
  }
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.flipY = true;
    return t;
  };
  return { map: tex(cA, true), orm: tex(cR, false), lit: tex(cL, true) };
}

/** Vật liệu mặt tiền (dùng chung cho cảnh taxi) */
export function facadeMaterial(style: Style, px: number, seed: number) {
  const f = facade(style, px, rng(seed));
  return new THREE.MeshStandardMaterial({
    map: f.map, roughnessMap: f.orm, metalnessMap: f.orm, roughness: 1, metalness: 1,
    vertexColors: false, emissive: '#ffffff', emissiveMap: f.lit, emissiveIntensity: 0,
  });
}

/** Hộp nhà gốc toạ độ ở tâm đáy, UV theo mét (gốc v ở mặt đất), kèm mái */
export function buildingBox(w: number, d: number, h: number, uOff = 0, vOff = 0) {
  const sides: THREE.BufferGeometry[] = [];
  for (const [fx, fz, rot, fw, uo] of [[0, d / 2, 0, w, 0], [w / 2, 0, Math.PI / 2, d, 0.25], [0, -d / 2, Math.PI, w, 0.5], [-w / 2, 0, -Math.PI / 2, d, 0.75]] as const) {
    const pl = new THREE.PlaneGeometry(fw, h);
    const uv = pl.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uOff + uo + uv.getX(i) * fw / TILE, vOff + uv.getY(i) * h / TILE);
    pl.rotateY(rot);
    pl.translate(fx, h / 2, fz);
    sides.push(pl);
  }
  return { sides: mergeGeometries(sides), roof: new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(0, h, 0) };
}

export const cityscape: KitFactory = (ctx, p) => {
  const r = rng(p.seed ?? 1);
  const H = ctx.zone.ground.bankHeight;
  const styles: Style[] = ['glass', 'ribbon', 'balcony', 'shophouse'];
  // Chia nhà theo đoạn dọc trục z để camera/bóng đổ bỏ qua các đoạn ngoài tầm nhìn (khu dài vài km)
  const CHUNK = 400;
  const chunks = new Map<number, { geos: Record<Style, THREE.BufferGeometry[]>; roofs: THREE.BufferGeometry[]; stuff: THREE.BufferGeometry[] }>();
  const chunkOf = (z: number) => {
    const k = Math.floor(z / CHUNK);
    let c = chunks.get(k);
    if (!c) chunks.set(k, (c = { geos: { glass: [], ribbon: [], balcony: [], shophouse: [] }, roofs: [], stuff: [] }));
    return c;
  };
  const beacons: THREE.Vector3[] = [];
  const tints: Record<Style, string[]> = {
    glass: ['#ffffff', '#e6eef2', '#f2f2ee'],
    ribbon: ['#ffffff', '#f3ece0', '#e7ecef', '#efe6d6'],
    balcony: ['#ffffff', '#f5efe2', '#e8eef0', '#f3e4d6', '#e4ece4'],
    shophouse: ['#ffffff'],
  };
  const lowQ = ctx.quality === 'low';
  const col = new THREE.Color();

  /** Hộp nhà: 4 mặt đứng có UV theo mét (gốc v ở mặt đất), mái riêng */
  const addBuilding = (cx: number, cz: number, w: number, d: number, h: number, style: Style) => {
    const sides: THREE.BufferGeometry[] = [];
    const { geos, roofs, stuff: roofStuff } = chunkOf(cz);
    const faces: [number, number, number, number, number][] = [
      // [tâm x, tâm z, góc xoay, bề rộng, offset u]
      [cx, cz + d / 2, 0, w, 0], [cx + w / 2, cz, Math.PI / 2, d, 0.25], [cx, cz - d / 2, Math.PI, w, 0.5], [cx - w / 2, cz, -Math.PI / 2, d, 0.75],
    ];
    const uOff = Math.floor(r() * 4) * 0.25, vOff = style === 'shophouse' ? 0 : Math.floor(r() * 4) * 0.25;
    for (const [fx, fz, rot, fw, uo] of faces) {
      const pl = new THREE.PlaneGeometry(fw, h);
      const uv = pl.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uOff + uo + uv.getX(i) * fw / TILE, vOff + uv.getY(i) * h / TILE);
      pl.rotateY(rot);
      pl.translate(fx, H + h / 2, fz);
      sides.push(pl);
    }
    const g = mergeGeometries(sides);
    col.set(tints[style][Math.floor(r() * tints[style].length)]);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) colors.set([col.r, col.g, col.b], i);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geos[style].push(g);
    roofs.push(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(cx, H + h, cz));
    // gờ tường mái
    roofStuff.push(new THREE.BoxGeometry(w + 0.2, 0.9, 0.25).translate(cx, H + h + 0.45, cz + d / 2), new THREE.BoxGeometry(w + 0.2, 0.9, 0.25).translate(cx, H + h + 0.45, cz - d / 2));
    roofStuff.push(new THREE.BoxGeometry(0.25, 0.9, d).translate(cx + w / 2, H + h + 0.45, cz), new THREE.BoxGeometry(0.25, 0.9, d).translate(cx - w / 2, H + h + 0.45, cz));
    // bồn nước inox, cục nóng, tum thang
    if (!lowQ) {
      const n = 1 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const x = cx + (r() - 0.5) * (w - 3), z = cz + (r() - 0.5) * (d - 3);
        roofStuff.push(r() < 0.5
          ? new THREE.CylinderGeometry(0.6, 0.6, 1.4, 10).rotateZ(Math.PI / 2).translate(x, H + h + 1.0, z).toNonIndexed()
          : new THREE.BoxGeometry(1 + r(), 0.8, 0.7).translate(x, H + h + 0.4, z));
      }
      if (h > 20) roofStuff.push(new THREE.BoxGeometry(3.5, 3, 4).translate(cx + (r() - 0.5) * (w - 5), H + h + 1.5, cz + (r() - 0.5) * (d - 5)));
    }
  };

  for (const b of p.blocks) {
    const step = lowQ ? 34 : 26;
    for (let x = b.x0; x < b.x1; x += step) for (let z = b.z0; z < b.z1; z += step) {
      if (r() > b.density) continue;
      const w = 10 + r() * 14, d = 10 + r() * 14;
      const near = 1 - Math.min(1, Math.abs(x - b.tallBias) / Math.abs(b.x1 - b.x0));
      let h = b.hMin + Math.pow(r(), 2.2 - near * 1.4) * (b.hMax - b.hMin);
      if (Math.abs(z) < 30 && near > 0.8) h *= 0.6; // chừa tầm nhìn ra cầu
      const style: Style = h > 60 ? (['glass', 'ribbon', 'balcony'] as Style[])[Math.floor(r() * 3)] : h > 22 ? (['ribbon', 'balcony', 'balcony', 'glass'] as Style[])[Math.floor(r() * 4)] : (r() < 0.65 ? 'shophouse' : 'balcony');
      if (style === 'shophouse') h = Math.min(h, 15);
      h = Math.max(6, Math.round(h / 3) * 3); // chiều cao đúng bội số tầng 3 m
      const bx = x + r() * 6, bz = z + r() * 6;
      addBuilding(bx, bz, w, d, h, style);
      if (h > 60) beacons.push(new THREE.Vector3(bx, H + h + 1, bz));
      // phản chiếu cửa sổ của nhà gần sông
      if (p.waterEdge && Math.abs(x) < p.waterEdge + 150 && r() < 0.5) {
        const edge = Math.sign(x) * p.waterEdge;
        ctx.reflect.add(edge + (x > 0 ? -6 : 6), z, '#ffc98a', w * 0.5, Math.min(70, h * 0.7), 0.22);
      }
    }
  }

  const px = lowQ ? 256 : 512;
  const mats: THREE.MeshStandardMaterial[] = [];
  const styleMat = new Map<Style, THREE.MeshStandardMaterial>();
  for (const s of styles) {
    const f = facade(s, px, r);
    const mat = new THREE.MeshStandardMaterial({
      map: f.map, roughnessMap: f.orm, metalnessMap: f.orm, roughness: 1, metalness: 1,
      vertexColors: true, emissive: '#ffffff', emissiveMap: f.lit, emissiveIntensity: 0,
    });
    mats.push(mat);
    styleMat.set(s, mat);
  }
  const roofMat = new THREE.MeshStandardMaterial({ color: '#8d8a84', roughness: 0.95 });
  const stuffMat = new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.6, metalness: 0.3 });
  /** Chi tiết mái nhỏ: ẩn khi ở xa để đỡ tải */
  const details: THREE.Mesh[] = [];
  for (const c of chunks.values()) {
    for (const s of styles) {
      if (!c.geos[s].length) continue;
      const mesh = new THREE.Mesh(mergeGeometries(c.geos[s]), styleMat.get(s)!);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      ctx.scene.add(mesh);
    }
    if (c.roofs.length) ctx.scene.add(new THREE.Mesh(mergeGeometries(c.roofs), roofMat));
    const stuff = c.stuff.length ? mergeGeometries(c.stuff.map((g) => (g.index ? g.toNonIndexed() : g))) : null;
    if (stuff) {
      const m = new THREE.Mesh(stuff, stuffMat);
      stuff.computeBoundingSphere();
      details.push(m);
      ctx.scene.add(m);
    }
  }

  const beaconMat = new THREE.MeshBasicMaterial({ color: '#ff2a1a' });
  const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.6, 8, 6), beaconMat, Math.max(1, beacons.length));
  bm.count = beacons.length;
  beacons.forEach((b, i) => bm.setMatrixAt(i, new THREE.Matrix4().makeTranslation(b.x, b.y, b.z)));
  ctx.scene.add(bm);

  return {
    update(_dt, env, camera) {
      for (const d of details) d.visible = d.geometry.boundingSphere!.center.distanceTo(camera.position) < d.geometry.boundingSphere!.radius + 350;
      for (const m of mats) m.emissiveIntensity = env.night * 1.1 + env.rain * 0.08;
      const blink = Math.sin(env.now / 400) > 0.3 ? 3 : 0.3;
      beaconMat.color.setRGB(blink * Math.max(0.3, env.night), 0.05, 0.03);
    },
  };
};
