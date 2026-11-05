// Mô hình phương tiện cách điệu: xe tay ga (xe máy) và taxi. Hướng đầu xe là +z.
import * as THREE from 'three';

const cache = new Map<string, THREE.MeshStandardMaterial>();
const mat = (color: string, rough = 0.5, metal = 0.2) => {
  const k = `${color}|${rough}|${metal}`;
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return cache.get(k)!;
};
const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4d6').multiplyScalar(2.4) });
const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(2.2) });

const wheelGeo = new THREE.TorusGeometry(0.26, 0.09, 8, 18).rotateY(Math.PI / 2);

/** Xe tay ga. Yên cao khoảng 0.78 m, người lái ngồi ở z≈-0.05, người ngồi sau ở z≈-0.5 */
export function makeScooter(color: string) {
  const g = new THREE.Group();
  const body = mat(color, 0.35, 0.3);
  const dark = mat('#1d1f24', 0.8, 0.1);
  const chrome = mat('#cfd3d8', 0.25, 0.8);
  const w1 = new THREE.Mesh(wheelGeo, dark); w1.position.set(0, 0.3, 0.62);
  const w2 = new THREE.Mesh(wheelGeo, dark); w2.position.set(0, 0.3, -0.62);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.7), body); floor.position.set(0, 0.36, 0.05);
  const rear = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.6, 4, 10).rotateX(Math.PI / 2), body); rear.position.set(0, 0.56, -0.42);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.86), dark); seat.position.set(0, 0.78, -0.32);
  const front = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.62, 0.16), body); front.position.set(0, 0.68, 0.48); front.rotation.x = -0.25;
  const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 6), chrome); fork.position.set(0, 0.62, 0.6); fork.rotation.x = -0.3;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.66, 6).rotateZ(Math.PI / 2), chrome); bar.position.set(0, 1.08, 0.44);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), lightMat); head.position.set(0, 0.98, 0.58);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.03), tailMat); tail.position.set(0, 0.66, -0.84);
  for (const m of [w1, w2, floor, rear, seat, front, fork, bar]) m.castShadow = true;
  g.add(w1, w2, floor, rear, seat, front, fork, bar, head, tail);
  g.userData.wheels = [w1, w2];
  return g;
}

/** Taxi 4 chỗ màu xanh trắng (không theo hãng nào), biển "TAXI" trên nóc */
export function makeTaxi() {
  const g = new THREE.Group();
  const paint = mat('#2f9e6f', 0.35, 0.4);
  const white = mat('#f2f2ee', 0.4, 0.2);
  const glass = new THREE.MeshStandardMaterial({ color: '#1c2a38', roughness: 0.08, metalness: 0.6 });
  const dark = mat('#191a1d', 0.8, 0.1);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 4.3), paint); lower.position.y = 0.62;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.12, 4.0), white); stripe.position.y = 0.78;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.56, 2.2), glass); cabin.position.set(0, 1.2, -0.2);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.07, 2.0), white); roof.position.set(0, 1.5, -0.25);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.22), new THREE.MeshStandardMaterial({ color: '#ffe36b', emissive: '#ffd21a', emissiveIntensity: 0.9 }));
  sign.position.set(0, 1.64, -0.2);
  g.add(lower, stripe, cabin, roof, sign);
  for (const [x, z] of [[-0.82, 1.35], [0.82, 1.35], [-0.82, -1.35], [0.82, -1.35]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16).rotateZ(Math.PI / 2), dark);
    w.position.set(x, 0.34, z);
    g.add(w);
  }
  for (const s of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.04), lightMat); hl.position.set(s, 0.72, 2.16);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.04), tailMat); tl.position.set(s, 0.72, -2.16);
    g.add(hl, tl);
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}
