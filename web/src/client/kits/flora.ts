// Cây cối dùng chung: dừa (tàu lá có lá chét, thân vỏ thật) và cây bóng mát nhiệt đới (tán từ các tấm lá).
// Mọi hình học tạo một lần, dùng InstancedMesh để vẽ hàng trăm cây.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pbrUV } from '../engine/Materials';

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Tàu lá dừa: gân giữa + lá chét xiên hai bên, nền trong suốt */
function frondTexture() {
  return canvasTex(512, 128, (g) => {
    const mid = 64;
    g.strokeStyle = '#6d6a3a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, mid); g.lineTo(512, mid); g.stroke();
    for (let x = 14; x < 500; x += 7) {
      const t = x / 512;
      const len = 58 * Math.sin(Math.min(1, t * 1.15) * Math.PI) * (0.85 + Math.random() * 0.3);
      for (const side of [-1, 1]) {
        const shade = 70 + Math.random() * 40;
        g.strokeStyle = `rgb(${shade * 0.55 | 0},${shade + 30 | 0},${shade * 0.35 | 0})`;
        g.lineWidth = 3.2 - t * 1.5;
        g.beginPath(); g.moveTo(x, mid);
        g.quadraticCurveTo(x + len * 0.35, mid + side * len * 0.5, x + len * 0.55, mid + side * len);
        g.stroke();
      }
    }
  });
}

/** Chùm lá cây bóng mát: nhiều lá bầu dục nhỏ chồng lên nhau. flowers: tỉ lệ hoa (hoa giấy hồng) */
function leafClusterTexture(flowers = 0) {
  return canvasTex(256, 256, (g) => {
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 110;
      const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
      const l = 40 + Math.random() * 50;
      g.fillStyle = `hsl(${88 + Math.random() * 28},${38 + Math.random() * 25}%,${l * 0.5 + 8}%)`;
      g.save(); g.translate(x, y); g.rotate(Math.random() * Math.PI);
      g.beginPath(); g.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    for (let i = 0; i < 400 * flowers; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 104;
      g.fillStyle = `hsl(${325 + Math.random() * 20},${70 + Math.random() * 20}%,${48 + Math.random() * 18}%)`;
      g.beginPath(); g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 3 + Math.random() * 4, 0, Math.PI * 2); g.fill();
    }
  });
}

let palmParts: { trunk: THREE.BufferGeometry; crown: THREE.BufferGeometry; nuts: THREE.BufferGeometry; trunkMat: THREE.Material; leafMat: THREE.MeshStandardMaterial; depth: THREE.Material; nutMat: THREE.Material } | null = null;

function buildPalm() {
  // Thân: cong nhẹ, thuôn dần, có gờ vòng
  const trunk = new THREE.CylinderGeometry(0.15, 0.24, 7.2, 10, 24, true);
  trunk.translate(0, 3.6, 0);
  const tp = trunk.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const ring = 1 + Math.max(0, Math.sin(y * 9)) * 0.06;
    tp.setX(i, tp.getX(i) * ring + (y / 7.2) ** 2 * 0.9);
    tp.setZ(i, tp.getZ(i) * ring);
  }
  trunk.computeVertexNormals();

  // Tàu lá: dải cong rủ xuống, gập chữ V nhẹ
  const frond = (len: number, lift: number, droop: number) => {
    const seg = 10, pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const x = t * len;
      const y = lift * t - droop * t * t;
      const w = 0.62 * Math.sin(Math.min(1, t * 1.15) * Math.PI) + 0.04;
      pos.push(x, y - w * 0.18, -w, x, y + 0.02, 0, x, y - w * 0.18, w);
      uv.push(t, 0, t, 0.5, t, 1);
      if (i < seg) {
        const a = i * 3;
        idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const parts: THREE.BufferGeometry[] = [];
  const top = new THREE.Vector3(0.9, 7.15, 0);
  const n = 13;
  for (let k = 0; k < n; k++) {
    const young = k % 3 === 0;
    const f = frond(3.4 + (k % 4) * 0.25, young ? 1.6 : 0.9, young ? 1.2 : 2.6);
    f.rotateZ(young ? 0.35 : -0.05);
    f.rotateY((k / n) * Math.PI * 2 + (k % 2) * 0.2);
    f.translate(top.x, top.y, top.z);
    parts.push(f);
  }
  const crown = mergeGeometries(parts);
  const nuts = new THREE.SphereGeometry(0.16, 8, 6);
  const nutParts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) nutParts.push(nuts.clone().translate(top.x + Math.cos(k * 1.3) * 0.22, top.y - 0.25 - (k % 2) * 0.12, Math.sin(k * 1.3) * 0.22));
  const tex = frondTexture();
  const leafMat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: '#e4f0c8' });
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.45, side: THREE.DoubleSide });
  palmParts = {
    trunk, crown, nuts: mergeGeometries(nutParts),
    trunkMat: pbrUV('palm_tree_bark', 1.5, 5, { tint: '#d8cbb8' }),
    leafMat, depth,
    nutMat: new THREE.MeshStandardMaterial({ color: '#5d6b2a', roughness: 0.7 }),
  };
  return palmParts;
}

/** Hàng dừa. pts: vị trí gốc (y là cao độ mặt đất). */
export function palms(scene: THREE.Object3D, pts: { x: number; y: number; z: number }[]) {
  if (!pts.length) return [] as THREE.InstancedMesh[];
  const P = palmParts ?? buildPalm();
  const trunks = new THREE.InstancedMesh(P.trunk, P.trunkMat, pts.length);
  const crowns = new THREE.InstancedMesh(P.crown, P.leafMat, pts.length);
  const nuts = new THREE.InstancedMesh(P.nuts, P.nutMat, pts.length);
  crowns.customDepthMaterial = P.depth;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
  const tint = new THREE.Color();
  pts.forEach((pt, i) => {
    q.setFromAxisAngle(Y, (i * 2.399 + pt.x * 0.1) % 6.28);
    const k = 0.85 + ((i * 37) % 10) / 28;
    m.compose(v.set(pt.x, pt.y, pt.z), q, s.set(k, k * (0.92 + ((i * 13) % 7) / 30), k));
    trunks.setMatrixAt(i, m); crowns.setMatrixAt(i, m); nuts.setMatrixAt(i, m);
    crowns.setColorAt(i, tint.setHSL(0.2 + ((i * 7) % 5) / 100, 0.35, 0.75 + ((i * 3) % 5) / 40));
  });
  trunks.castShadow = crowns.castShadow = true;
  trunks.receiveShadow = crowns.receiveShadow = true;
  scene.add(trunks, crowns, nuts);
  return [trunks, crowns, nuts];
}

let treeParts: { trunk: THREE.BufferGeometry; canopy: THREE.BufferGeometry; trunkMat: THREE.Material; leafMat: THREE.Material; depth: THREE.Material } | null = null;

function buildTree() {
  // Thân + 3 cành chính
  const pieces: THREE.BufferGeometry[] = [];
  const base = new THREE.CylinderGeometry(0.22, 0.34, 3.2, 8).translate(0, 1.6, 0);
  pieces.push(base);
  for (let k = 0; k < 3; k++) {
    const b = new THREE.CylinderGeometry(0.1, 0.18, 2.4, 6).translate(0, 1.2, 0);
    b.rotateZ(0.55); b.rotateY(k * 2.1);
    b.translate(0, 3.0, 0);
    pieces.push(b);
  }
  const trunk = mergeGeometries(pieces);

  // Tán: các tấm lá cắt chéo nhau trong khối elip, pháp tuyến hướng ra ngoài tâm để ánh sáng mềm như tán thật
  const cards: THREE.BufferGeometry[] = [];
  const C = new THREE.Vector3(0, 5.6, 0);
  let seed = 3;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2, u = r() * 2 - 1, rad = Math.cbrt(r());
    const p = new THREE.Vector3(Math.sqrt(1 - u * u) * Math.cos(a) * 3.4 * rad, u * 1.9 * rad, Math.sqrt(1 - u * u) * Math.sin(a) * 3.4 * rad);
    const size = 2.2 + r() * 1.2;
    const card = new THREE.PlaneGeometry(size, size);
    card.rotateX(r() * Math.PI); card.rotateY(r() * Math.PI); card.rotateZ(r() * 0.6);
    card.translate(C.x + p.x, C.y + p.y, C.z + p.z);
    const nrm = card.attributes.normal as THREE.BufferAttribute, pos = card.attributes.position as THREE.BufferAttribute;
    for (let j = 0; j < nrm.count; j++) {
      const d = new THREE.Vector3(pos.getX(j) - C.x, (pos.getY(j) - C.y) * 1.6 + 0.6, pos.getZ(j) - C.z).normalize();
      nrm.setXYZ(j, d.x, d.y, d.z);
    }
    cards.push(card);
  }
  const canopy = mergeGeometries(cards);
  const tex = leafClusterTexture();
  treeParts = {
    trunk, canopy,
    trunkMat: new THREE.MeshStandardMaterial({ color: '#5e5446', roughness: 1 }),
    leafMat: new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 }),
    depth: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide }),
  };
  return treeParts;
}

/** Cây bóng mát (kiểu cây bàng, sao, lim xẹt trồng ven đường) */
export function shadeTrees(scene: THREE.Object3D, pts: { x: number; y: number; z: number }[]) {
  if (!pts.length) return;
  const T = treeParts ?? buildTree();
  const trunks = new THREE.InstancedMesh(T.trunk, T.trunkMat, pts.length);
  const canopy = new THREE.InstancedMesh(T.canopy, T.leafMat, pts.length);
  canopy.customDepthMaterial = T.depth;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
  const c = new THREE.Color();
  pts.forEach((pt, i) => {
    q.setFromAxisAngle(Y, i * 1.7);
    const k = 0.8 + ((i * 29) % 10) / 22;
    m.compose(v.set(pt.x, pt.y, pt.z), q, s.set(k, k, k));
    trunks.setMatrixAt(i, m); canopy.setMatrixAt(i, m);
    canopy.setColorAt(i, c.setHSL(0.24 + ((i * 11) % 7) / 120, 0.4, 0.82 + ((i * 5) % 6) / 40));
  });
  trunks.castShadow = canopy.castShadow = true;
  canopy.receiveShadow = true;
  scene.add(trunks, canopy);
}

/** Tán lá từ các tấm cắt chéo trong khối elip; pháp tuyến hướng ra ngoài để sáng mềm */
function cardCluster(count: number, rx: number, ry: number, cy: number, size: number, seed0: number) {
  const cards: THREE.BufferGeometry[] = [];
  let seed = seed0;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, u = r() * 2 - 1, rad = Math.cbrt(r());
    const px = Math.sqrt(1 - u * u) * Math.cos(a) * rx * rad, py = u * ry * rad, pz = Math.sqrt(1 - u * u) * Math.sin(a) * rx * rad;
    const sz = size * (0.8 + r() * 0.5);
    const card = new THREE.PlaneGeometry(sz, sz);
    card.rotateX(r() * Math.PI); card.rotateY(r() * Math.PI); card.rotateZ(r() * 0.6);
    card.translate(px, cy + py, pz);
    const nrm = card.attributes.normal as THREE.BufferAttribute, pos = card.attributes.position as THREE.BufferAttribute;
    for (let j = 0; j < nrm.count; j++) {
      const d = new THREE.Vector3(pos.getX(j), (pos.getY(j) - cy) * 1.6 + ry * 0.4, pos.getZ(j)).normalize();
      nrm.setXYZ(j, d.x, d.y, d.z);
    }
    cards.push(card);
  }
  return mergeGeometries(cards);
}

let bushParts: { geo: THREE.BufferGeometry; mats: THREE.MeshStandardMaterial[]; depth: THREE.Material[] } | null = null;

/** Khóm cây bụi / hoa giấy. kind 0: lá xanh, 1: hoa giấy hồng */
export function bushes(scene: THREE.Object3D, pts: { x: number; y: number; z: number; s: number; kind: number }[]) {
  if (!pts.length) return;
  if (!bushParts) {
    const texs = [leafClusterTexture(0), leafClusterTexture(0.9)];
    bushParts = {
      geo: cardCluster(14, 0.9, 0.55, 0.5, 1.0, 11),
      mats: texs.map((t) => new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 })),
      depth: texs.map((t) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.5, side: THREE.DoubleSide })),
    };
  }
  const B = bushParts;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const kind of [0, 1]) {
    const list = pts.filter((p) => p.kind === kind);
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(B.geo, B.mats[kind], list.length);
    mesh.customDepthMaterial = B.depth[kind];
    list.forEach((p, i) => {
      q.setFromAxisAngle(Y, p.s * 13.7);
      mesh.setMatrixAt(i, m.compose(v.set(p.x, p.y, p.z), q, sc.set(p.s * 1.3, p.s, p.s * 1.3)));
    });
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  }
}
