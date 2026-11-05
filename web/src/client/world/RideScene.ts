// Cảnh đi taxi giữa hai khu: ngồi ghế sau nhìn qua kính chắn gió, phố xá lùi lại, gần tới nơi thì thấy biển/sông.
// Cảnh này che thời gian dựng khu tiếp theo (tài liệu 01 – 4.3d).
import * as THREE from 'three';
import { SkySystem } from '../engine/SkySystem';
import { Avatar } from '../engine/Avatar';
import type { WeatherNow } from '../../shared/protocol';
import { h } from '../ui/dom';
import { pbrUV } from '../engine/Materials';
import { facadeMaterial, buildingBox, type Style } from '../kits/cityscape';
import { palms } from '../kits/flora';
import { carGeometries } from '../kits/road';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface RideOpts {
  lat: number;
  lon: number;
  now: () => number;
  weather: () => WeatherNow | null;
  toName: string;
  km: number;
  seconds: number;
  scenery: 'city' | 'river' | 'coast' | 'mountain';
  companions: { name: string; color: string; hat: boolean; hair?: number }[];
  host: HTMLElement;
}

export function startRide(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, o: RideOpts) {
  const scene = new THREE.Scene();
  const sky = new SkySystem(scene, renderer, o.lat, o.lon, false);
  const SPEED = 15; // m/s cảnh lướt qua cửa kính
  const FAR = 420;

  // mặt đường nhựa thật + vỉa hè đá; vân ảnh trôi theo tốc độ xe
  const roadMat = pbrUV('asphalt_02', 14 / 3, (FAR + 40) / 3, { tint: '#9a9a9a' });
  const walkMat = pbrUV('granite_tile', 6 / 2.3, (FAR + 40) / 2.3, { tint: '#e6ddcf' });
  const scrollers = [roadMat, walkMat].flatMap((mm) => [mm.map, mm.normalMap, mm.roughnessMap]).filter(Boolean) as THREE.Texture[];
  const scrollLen = [3, 3, 3, 2.3, 2.3, 2.3].slice(0, scrollers.length);
  const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, FAR + 40).rotateX(-Math.PI / 2), roadMat);
  roadMesh.position.z = -FAR / 2 + 20;
  const roadTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#d8ad3c'; g.fillRect(124, 0, 2, 256); g.fillRect(130, 0, 2, 256);
    g.fillStyle = '#e9e6dc'; g.fillRect(6, 0, 3, 256); g.fillRect(247, 0, 3, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, FAR / 12);
    return t;
  })();
  const lines = new THREE.Mesh(new THREE.PlaneGeometry(13, FAR + 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: roadTex, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1 }));
  lines.position.set(0, 0.01, -FAR / 2 + 20);
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, FAR + 40), walkMat); sideL.position.set(-10, 0.15, -FAR / 2 + 20);
  const sideR = sideL.clone(); sideR.position.x = 10;
  scene.add(roadMesh, lines, sideL, sideR);

  // nước bên phải (biển/sông), hiện ra ở đoạn cuối
  const water = new THREE.Mesh(new THREE.PlaneGeometry(800, FAR + 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: o.scenery === 'coast' ? '#1f6f86' : '#1d4f63', roughness: 0.08, metalness: 0.1 }));
  water.position.set(413, -0.6, -FAR / 2);
  scene.add(water);

  // nhà hai bên đường: dùng chung mặt tiền với thành phố trong khu (nhà ống, chung cư, văn phòng, tháp kính)
  const styles: Style[] = ['shophouse', 'shophouse', 'balcony', 'ribbon', 'glass'];
  const fMats = new Map<Style, THREE.MeshStandardMaterial>();
  for (const st of new Set(styles)) fMats.set(st, facadeMaterial(st, 256, 17 + st.length));
  const roofMat = new THREE.MeshStandardMaterial({ color: '#8d8a84', roughness: 0.95 });
  const NB = 40;
  const bData: { side: number; z: number; w: number; obj: THREE.Group }[] = [];
  const zAcc = [0, 0];
  for (let i = 0; i < NB; i++) {
    const side = i % 2 ? 1 : -1;
    const st = styles[Math.floor(Math.random() * styles.length)];
    const w = st === 'shophouse' ? 8 + Math.random() * 8 : 12 + Math.random() * 10;
    const d = 10 + Math.random() * 8;
    const hgt = st === 'shophouse' ? 9 + Math.floor(Math.random() * 3) * 3 : 15 + Math.floor(Math.random() ** 2 * 14) * 3;
    const geo = buildingBox(d, w, hgt, Math.floor(Math.random() * 4) * 0.25, 0);
    const obj = new THREE.Group();
    obj.add(new THREE.Mesh(geo.sides, fMats.get(st)!), new THREE.Mesh(geo.roof, roofMat));
    const k = side > 0 ? 1 : 0;
    zAcc[k] -= w + 0.5;
    bData.push({ side, z: zAcc[k], w, obj });
    obj.position.set(side * (13.2 + d / 2), 0, zAcc[k]);
    scene.add(obj);
  }
  const span = Math.min(zAcc[0], zAcc[1]) * -1;
  const NP = 30;
  const poleMat = new THREE.MeshStandardMaterial({ color: '#2c3138', metalness: 0.5 });
  const lampMat = new THREE.MeshBasicMaterial({ color: '#ffd98a' });
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 6).translate(0, 3, 0), poleMat, NP);
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 8, 6).translate(0, 6.1, 0), lampMat, NP);
  const pData = Array.from({ length: NP }, (_, i) => ({ side: i % 2 ? 1 : -1, z: -(i / NP) * FAR }));
  scene.add(poles, lamps);
  const palmMeshes = palms(scene, pData.map(() => ({ x: 0, y: 0, z: 0 })));
  // xe ngược chiều
  const NC = 8;
  const CG = carGeometries('sedan');
  const carBody = new THREE.InstancedMesh(CG.body, new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.55, roughness: 0.28 }), NC);
  const carParts: THREE.InstancedMesh[] = [carBody,
    new THREE.InstancedMesh(CG.glass, new THREE.MeshStandardMaterial({ color: '#141b22', roughness: 0.06, metalness: 0.85 }), NC),
    new THREE.InstancedMesh(CG.wheels, new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.9 }), NC)];
  const heads = new THREE.InstancedMesh(CG.head, new THREE.MeshBasicMaterial({ color: '#fff6dd' }), NC);
  carParts.push(heads);
  const cData = Array.from({ length: NC }, () => ({ z: -Math.random() * FAR, x: -3.2 + (Math.random() < 0.5 ? 0 : -0.3) }));
  ['#f2f2f2', '#1c1c1c', '#7a1a22', '#2a4f8f', '#b8bcc4', '#8a8f98', '#2f9e6f', '#f2f2f2'].forEach((c, i) => carBody.setColorAt(i, new THREE.Color(c)));
  scene.add(...carParts);

  // nội thất xe
  const cab = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: '#1a1c20', roughness: 0.8 });
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.35, 0.6), dark); dash.position.set(0, 0.95, -1.15);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 2.0), dark); roof.position.set(0, 1.86, 0.1);
  const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), dark); pillarL.position.set(-0.8, 1.4, -1.0); pillarL.rotation.x = -0.45;
  const pillarR = pillarL.clone(); pillarR.position.x = 0.8;
  const seatL = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.4, 0.13, 3, 0.05), new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.95 })); seatL.position.set(-0.42, 0.95, -0.45);
  const seatR = seatL.clone(); seatR.position.x = 0.42;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 6, 20), dark); wheel.position.set(-0.4, 1.12, -0.95); wheel.rotation.x = -0.5;
  // đồng hồ quãng đường trên taplo
  const meterCanvas = document.createElement('canvas');
  meterCanvas.width = 256; meterCanvas.height = 64;
  const meterTex = new THREE.CanvasTexture(meterCanvas);
  const meter = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.065), new THREE.MeshBasicMaterial({ map: meterTex }));
  meter.position.set(0.05, 1.16, -0.86); meter.rotation.x = -0.35;
  cab.add(dash, roof, pillarL, pillarR, seatL, seatR, wheel, meter);
  const driver = new Avatar('driver', '', '#2f9e6f', false, false);
  driver.setVehicle(2); // tư thế ngồi
  driver.root.position.set(-0.42, 0.3, -0.62);
  driver.root.scale.setScalar(0.85);
  driver.root.rotation.y = Math.PI;
  cab.add(driver.root);
  const riders = [driver];
  // bạn đi cùng ngồi cạnh
  o.companions.slice(0, 2).forEach((c, i) => {
    const a = new Avatar('c' + i, '', c.color, c.hat, false, c.hair);
    a.setVehicle(2);
    a.root.position.set(i === 0 ? -0.5 : 0.62, 0.3, 0.75);
    a.root.rotation.y = Math.PI;
    a.root.scale.setScalar(0.85);
    cab.add(a.root);
    riders.push(a);
  });
  riders.forEach((a) => a.update(0));
  scene.add(cab);
  // xe chạy làn bên phải (lệch khỏi tim đường 3,2 m)
  const LANE = 3.2;
  cab.position.x = LANE;
  const camBase = new THREE.Vector3(0.12 + LANE, 1.5, 0.95);
  camera.position.copy(camBase);
  camera.lookAt(0.05 + LANE, 1.3, -8);

  // HUD
  const remain = h('span', { class: 'ride-t' });
  const bar = h('i');
  const skip = h('button', { type: 'button', class: 'link-btn', disabled: true }, 'Tới nhanh');
  const card = h('div', { class: 'ride panel', role: 'status' },
    h('div', {}, h('b', {}, `Taxi tới ${o.toName}`), h('span', {}, `${o.km.toFixed(1).replace('.', ',')} km`), remain),
    h('div', { class: 'ride-bar' }, bar),
    skip,
  );
  const rainFx = h('div', { class: 'ride-rain' });
  o.host.append(rainFx, card);

  const start = performance.now();
  const total = o.seconds * 1000;
  let ready = false;
  let skipped = false;
  let raf = 0;
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));
  skip.addEventListener('click', () => (skipped = true));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  let last = performance.now();
  let lastMeter = '';

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const t = performance.now();
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    const prog = Math.min(1, (t - start) / total);
    const coastal = o.scenery !== 'city' && prog > 0.62;
    sky.update(o.now(), o.weather(), new THREE.Vector3(), camera);
    const env = sky.env;
    const step = SPEED * dt;
    roadTex.offset.y += step / 12;
    scrollers.forEach((tx, i) => (tx.offset.y += step / scrollLen[i]));
    for (const mm of fMats.values()) mm.emissiveIntensity = env.night * 1.1;
    lampMat.color.setScalar(0.3 + env.night * 2.4);
    (heads.material as THREE.MeshBasicMaterial).color.setScalar(0.5 + env.night * 2.5);
    water.visible = coastal;

    for (const b of bData) {
      b.z += step;
      if (b.z > 40) { b.z -= span; b.obj.visible = !(coastal && b.side > 0); }
      b.obj.position.z = b.z;
    }
    pData.forEach((p, i) => {
      p.z += step;
      if (p.z > 30) p.z -= FAR;
      m.makeTranslation(p.side * 7.2, 0.3, p.z);
      poles.setMatrixAt(i, m); lamps.setMatrixAt(i, m);
      const showPalm = coastal || i % 3 === 0;
      q.setFromAxisAngle(up, i * 2.4);
      m.compose(v.set(p.side * 8.6, 0.3, p.z - 6), q, showPalm ? one : sc.set(0.001, 0.001, 0.001));
      for (const pm of palmMeshes) pm.setMatrixAt(i, m);
    });
    poles.instanceMatrix.needsUpdate = lamps.instanceMatrix.needsUpdate = true;
    for (const pm of palmMeshes) pm.instanceMatrix.needsUpdate = true;
    cData.forEach((c, i) => {
      c.z += step * 2.2;
      if (c.z > 30) c.z -= FAR;
      q.setFromAxisAngle(up, Math.PI);
      m.compose(v.set(c.x, 0, c.z), q, one);
      for (const cp of carParts) cp.setMatrixAt(i, m);
    });
    for (const cp of carParts) cp.instanceMatrix.needsUpdate = true;

    // xe rung nhẹ
    camera.position.set(camBase.x, camBase.y + Math.sin(t / 90) * 0.006 + Math.sin(t / 37) * 0.003, camBase.z);
    camera.lookAt(0.05 + LANE + Math.sin(t / 2100) * 0.5, 1.3, -8);

    const km = (o.km * prog).toFixed(1).replace('.', ',');
    if (km !== lastMeter) {
      lastMeter = km;
      const g = meterCanvas.getContext('2d')!;
      g.fillStyle = '#100'; g.fillRect(0, 0, 256, 64);
      g.fillStyle = '#ff4a2a'; g.font = 'bold 40px monospace'; g.textAlign = 'right';
      g.fillText(`${km} km`, 244, 46);
      meterTex.needsUpdate = true;
    }
    const left = Math.max(0, Math.ceil((total - (t - start)) / 1000));
    remain.textContent = prog >= 1 && !ready ? 'đang tới…' : `còn ${left} giây`;
    bar.style.width = `${prog * 100}%`;
    if (ready && t - start > 4000) skip.removeAttribute('disabled');
    rainFx.style.opacity = String(env.rain);

    renderer.render(scene, camera);
    if (ready && (prog >= 1 || skipped)) finish();
  };

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    card.remove();
    rainFx.remove();
    scene.traverse((ob) => {
      const mesh = ob as THREE.Mesh;
      mesh.geometry?.dispose?.();
    });
    resolveDone();
  };
  frame();
  return {
    /** Báo khu đích đã dựng xong; cảnh sẽ kết thúc khi đủ thời gian hoặc người dùng bấm "Tới nhanh" */
    setReady() { ready = true; },
    done,
  };
}
