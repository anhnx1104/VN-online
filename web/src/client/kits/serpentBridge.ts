// Kit cầu thân rồng: mặt cầu, dốc dẫn, thân uốn lượn có LED đổi màu, đầu rồng có thể phun lửa / phun nước.
// Tham số hóa hoàn toàn (số nhịp, độ cao, màu, bảng màu LED) để dùng cho các cầu biểu tượng khác.
import * as THREE from 'three';
import type { KitFactory, SpectacleState } from './types';
import { pbr } from '../engine/Materials';

const MAX_P = 2600;

function particleMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { scale: { value: 600 } },
    vertexShader: `
      attribute float life; attribute float kind; attribute float seed;
      uniform float scale; varying float vLife; varying float vKind;
      void main(){
        vLife = life; vKind = kind;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float s = kind < 0.5 ? mix(3.2, 1.0, life) : mix(1.0, 2.6, life);
        gl_PointSize = life > 0.999 ? 0.0 : s * scale / -mv.z * (0.7 + seed*0.6);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vLife; varying float vKind;
      void main(){
        float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        float soft = 1.0 - d * 2.0;
        vec3 c; float a;
        if (vKind < 0.5) {
          c = mix(vec3(1.0, 0.9, 0.55) * 1.5, vec3(1.0, 0.38, 0.06) * 1.0, smoothstep(0.0, 0.35, vLife));
          c = mix(c, vec3(0.25, 0.08, 0.04), smoothstep(0.55, 1.0, vLife));
          a = soft * (1.0 - vLife) * 0.55;
        } else {
          c = vec3(0.75, 0.88, 1.0) * 0.9; a = soft * (1.0 - vLife) * 0.35;
        }
        gl_FragColor = vec4(c * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

export const serpentBridge: KitFactory = (ctx, p) => {
  const g = new THREE.Group();
  ctx.scene.add(g);
  const Y = p.deckY as number, W = p.deckWidth as number;
  const deckMat = pbr('asphalt_02', 3, { plane: 'box', tint: '#8f8f8f', macro: 0.15 });
  const sideMat = pbr('concrete_wall_008', 2.7, { plane: 'box', tint: '#e4e0d6', macro: 0.12 });
  const pierMat = pbr('concrete_wall_008', 2.7, { plane: 'box', tint: '#c9c4b8', macro: 0.25 });

  // mặt cầu
  const len = p.x1 - p.x0;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 1.4, W), deckMat);
  deck.position.set((p.x0 + p.x1) / 2, Y - 0.7, 0);
  deck.receiveShadow = true;
  g.add(deck);
  for (const sz of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(len, 1.6, 0.4), sideMat);
    side.position.set((p.x0 + p.x1) / 2, Y - 0.6, sz * (W / 2 + 0.2));
    g.add(side);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: '#e7e5df', metalness: 0.5, roughness: 0.3 }));
    rail.position.set((p.x0 + p.x1) / 2, Y + 1.0, sz * (W / 2 + 0.1));
    g.add(rail);
  }
  // dốc dẫn hai đầu
  for (const end of [-1, 1]) {
    const x0 = end > 0 ? p.x1 : p.x0;
    const drop = Y - 2;
    const L = Math.hypot(p.approach, drop);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(L, 1.4, W), deckMat);
    ramp.position.set(x0 + (end * p.approach) / 2, Y - drop / 2 - 0.7, 0);
    ramp.rotation.z = end * -Math.atan2(drop, p.approach);
    ramp.receiveShadow = true;
    g.add(ramp);
    for (const sz of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(L, 1.6, 0.4), sideMat);
      wall.position.set(ramp.position.x, ramp.position.y + 0.1, sz * (W / 2 + 0.2));
      wall.rotation.z = ramp.rotation.z;
      g.add(wall);
    }
  }
  // trụ cầu
  const pierGeo = new THREE.CylinderGeometry(1.6, 2, Y + 4, 16);
  for (let x = p.x0 + 14; x < p.x1 - 6; x += 28) {
    const pier = new THREE.Mesh(pierGeo, pierMat);
    pier.position.set(x, (Y - 4) / 2 - 1.5, 0);
    g.add(pier);
  }

  // đường cong thân rồng
  const pts: THREE.Vector3[] = [];
  const humps = p.humps as [number, number][];
  pts.push(new THREE.Vector3(p.x0 - 4, Y - 0.6, 0));
  for (const [a, b] of humps) {
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = a + (b - a) * t;
      if (i === 0 && pts.length > 1) continue;
      pts.push(new THREE.Vector3(x, Y + 0.3 + Math.sin(Math.PI * t) * p.humpHeight, Math.sin(Math.PI * 2 * t) * 0.6));
    }
  }
  const last = humps[humps.length - 1][1];
  const hx = p.headX as number;
  pts.push(new THREE.Vector3(last + (hx - last) * 0.35, Y + 3.5, 0));
  pts.push(new THREE.Vector3(last + (hx - last) * 0.7, Y + 7.5, 0));
  pts.push(new THREE.Vector3(hx, Y + 9.5, 0));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const SEG = 420, RAD = 14;
  const bodyGeo = new THREE.TubeGeometry(curve, SEG, p.bodyRadius, RAD, false);
  // thon dần về đuôi
  const pos = bodyGeo.attributes.position as THREE.BufferAttribute;
  const center = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    curve.getPointAt(t, center);
    const k = THREE.MathUtils.smoothstep(t, 0, 0.12) * 0.75 + 0.25;
    for (let j = 0; j <= RAD; j++) {
      const idx = i * (RAD + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(center).multiplyScalar(k).add(center);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  bodyGeo.computeVertexNormals();
  const gold = new THREE.MeshStandardMaterial({ color: p.color, metalness: 0.65, roughness: 0.35 });
  const body = new THREE.Mesh(bodyGeo, gold);
  body.castShadow = true;
  g.add(body);

  // lớp LED phủ ngoài (vertex color, phát sáng ban đêm)
  const ledGeo = bodyGeo.clone();
  const ledPos = ledGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i <= SEG; i++) {
    curve.getPointAt(i / SEG, center);
    for (let j = 0; j <= RAD; j++) {
      const idx = i * (RAD + 1) + j;
      v.fromBufferAttribute(ledPos, idx).sub(center).multiplyScalar(1.04).add(center);
      ledPos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  const ledColors = new Float32Array(ledPos.count * 3);
  ledGeo.setAttribute('color', new THREE.BufferAttribute(ledColors, 3));
  const ledMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const led = new THREE.Mesh(ledGeo, ledMat);
  g.add(led);
  const palette = (p.ledPalette as string[]).map((c) => new THREE.Color(c));

  // vây lưng
  const spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.28, 1.1, 5), gold, 70);
  const tan = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), mtx = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < spikes.count; i++) {
    const t = 0.06 + (i / spikes.count) * 0.88;
    curve.getPointAt(t, center);
    curve.getTangentAt(t, tan);
    const normal = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 0, 1)).normalize();
    if (normal.y < 0) normal.negate();
    q.setFromUnitVectors(up, normal);
    const k = THREE.MathUtils.smoothstep(t, 0, 0.12) * 0.75 + 0.25;
    mtx.compose(center.clone().addScaledVector(normal, p.bodyRadius * k + 0.3), q, new THREE.Vector3(k, k, k));
    spikes.setMatrixAt(i, mtx);
  }
  g.add(spikes);

  // đầu rồng
  const head = new THREE.Group();
  const tip = curve.getPointAt(1);
  head.position.copy(tip);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1.7, 20, 14), gold);
  skull.scale.set(1.3, 1, 1);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 3.2, 14), gold);
  snout.rotation.z = -Math.PI / 2;
  snout.position.set(2.2, -0.2, 0);
  const jaw = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.0, 2.8, 12), gold);
  jaw.rotation.z = -Math.PI / 2 - 0.35;
  jaw.position.set(1.9, -1.15, 0);
  head.add(skull, snout, jaw);
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.3, 3.4, 8), gold);
    horn.position.set(-0.9, 1.6, s * 0.8);
    horn.rotation.set(s * -0.35, 0, 0.9);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3a1a').multiplyScalar(2.5) }));
    eye.position.set(0.9, 0.6, s * 1.15);
    const whisker = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.07, 6, 20, 1.3), gold);
    whisker.position.set(2.8, -0.5, s * 0.9);
    whisker.rotation.set(Math.PI / 2, s * 0.3, -0.6);
    const mane = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.4, 6), gold);
    mane.position.set(-1.6, 0.2, s * 1.0);
    mane.rotation.set(s * -1.2, 0, 1.4);
    head.add(horn, eye, whisker, mane);
  }
  head.rotation.z = 0.12;
  head.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  g.add(head);
  const mouth = new THREE.Vector3(tip.x + 3.8, tip.y - 0.5, 0);

  // ánh lửa
  const fireLight = new THREE.PointLight('#ff7a2a', 0, 90, 1.6);
  fireLight.position.copy(mouth).add(new THREE.Vector3(4, 0, 0));
  g.add(fireLight);

  // hạt lửa / nước
  const pPos = new Float32Array(MAX_P * 3), pVel = new Float32Array(MAX_P * 3), pLife = new Float32Array(MAX_P).fill(1), pKind = new Float32Array(MAX_P), pSeed = new Float32Array(MAX_P), pMax = new Float32Array(MAX_P).fill(1);
  for (let i = 0; i < MAX_P; i++) pSeed[i] = Math.random();
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pg.setAttribute('life', new THREE.BufferAttribute(pLife, 1));
  pg.setAttribute('kind', new THREE.BufferAttribute(pKind, 1));
  pg.setAttribute('seed', new THREE.BufferAttribute(pSeed, 1));
  const pts3 = new THREE.Points(pg, particleMaterial());
  pts3.frustumCulled = false;
  g.add(pts3);
  let cursor = 0;
  const emit = (kind: number, n: number) => {
    for (let k = 0; k < n; k++) {
      const i = cursor; cursor = (cursor + 1) % MAX_P;
      pPos.set([mouth.x + Math.random() * 0.4, mouth.y + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4], i * 3);
      const sp = kind === 0 ? 26 + Math.random() * 10 : 18 + Math.random() * 8;
      const spread = kind === 0 ? 0.16 : 0.3;
      const pitch = kind === 0 ? 0.12 : 0.35;
      pVel.set([sp, sp * (pitch + (Math.random() - 0.5) * spread), sp * (Math.random() - 0.5) * spread * 1.6], i * 3);
      pLife[i] = 0; pKind[i] = kind; pMax[i] = kind === 0 ? 0.9 + Math.random() * 0.5 : 2.6 + Math.random() * 1.2;
    }
  };

  // vệt phản chiếu LED trên sông
  const reflColors: THREE.Color[] = [];
  for (let x = p.x0 + 8; x < p.x1 - 2; x += 9) {
    const c = new THREE.Color();
    reflColors.push(c);
    for (const sz of [-1, 1]) ctx.reflect.add(x, sz * (W / 2 + 1), '#ffffff', 4.5, 42, 0.9, () => c);
  }
  const fireRefl = new THREE.Color(0, 0, 0);
  ctx.reflect.add(mouth.x - 4, 7, '#ffffff', 10, 60, 1, () => fireRefl);
  ctx.reflect.add(mouth.x - 4, -7, '#ffffff', 10, 60, 1, () => fireRefl);

  let fireOn = false, waterOn = false, fireLevel = 0;
  const tmpC = new THREE.Color();
  const focus = new THREE.Vector3(mouth.x + 12, 2, 0);

  return {
    id: p.id,
    focus,
    spectacle(s: SpectacleState) {
      fireOn = s.fire;
      waterOn = s.water;
    },
    sprayAt(pt: THREE.Vector3) {
      if (!waterOn) return 0;
      const dx = pt.x - mouth.x, dz = pt.z;
      if (dx < 0 || dx > 60) return 0;
      return Math.max(0, 1 - Math.abs(dz) / 16) * Math.max(0, 1 - dx / 60);
    },
    update(dt, env) {
      const t = env.now / 1000;
      // LED chạy dọc thân, chỉ sáng khi trời tối
      const night = env.night;
      ledMat.opacity = night * 0.95;
      if (night > 0.02) {
        const phase = Math.floor(t / 12) % palette.length;
        const mix = (t % 12) / 12;
        for (let i = 0; i <= SEG; i++) {
          const u = i / SEG;
          const wave = 0.55 + 0.45 * Math.sin(u * 40 - t * 3);
          tmpC.lerpColors(palette[phase], palette[(phase + 1) % palette.length], THREE.MathUtils.smoothstep(mix * 1.4 - u * 0.4, 0, 1)).multiplyScalar(wave * 1.6);
          for (let j = 0; j <= RAD; j++) {
            const idx = (i * (RAD + 1) + j) * 3;
            ledColors[idx] = tmpC.r; ledColors[idx + 1] = tmpC.g; ledColors[idx + 2] = tmpC.b;
          }
        }
        (ledGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
        reflColors.forEach((c, k) => {
          const u = k / reflColors.length;
          c.lerpColors(palette[phase], palette[(phase + 1) % palette.length], THREE.MathUtils.smoothstep(mix * 1.4 - u * 0.4, 0, 1)).multiplyScalar(0.8);
        });
      }

      if (fireOn) emit(0, Math.ceil(dt * 520));
      if (waterOn) emit(1, Math.ceil(dt * 500));
      fireLevel += ((fireOn ? 1 : 0) - fireLevel) * Math.min(1, dt * 8);
      fireLight.intensity = fireLevel * (260 + Math.random() * 140);
      fireRefl.setRGB(1.6, 0.6, 0.15).multiplyScalar(fireLevel / Math.max(0.2, night));

      for (let i = 0; i < MAX_P; i++) {
        if (pLife[i] >= 1) continue;
        pLife[i] = Math.min(1, pLife[i] + dt / pMax[i]);
        const o = i * 3;
        if (pKind[i] === 0) { pVel[o] *= 1 - dt * 1.6; pVel[o + 1] += dt * 6; pVel[o + 2] *= 1 - dt * 0.8; }
        else { pVel[o] *= 1 - dt * 0.4; pVel[o + 1] -= dt * 9.8; if (pPos[o + 1] < 2.1) { pVel[o + 1] = 0; pLife[i] = Math.min(1, pLife[i] + dt * 2); } }
        pPos[o] += pVel[o] * dt; pPos[o + 1] += pVel[o + 1] * dt; pPos[o + 2] += pVel[o + 2] * dt;
      }
      pg.attributes.position.needsUpdate = true;
      pg.attributes.life.needsUpdate = true;
      pg.attributes.kind.needsUpdate = true;
    },
  };
};
