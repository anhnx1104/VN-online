// Kit biển: mặt nước có sóng lừng chạy vào bờ (dịch đỉnh trong shader), màu nông-sâu, vệt bọt sóng ở mép nước.
import * as THREE from 'three';
import type { KitFactory } from './types';
import { waterNormals } from './river';

export const ocean: KitFactory = (ctx, p) => {
  const shore = p.shore as number; // x nơi nước gặp cát (biển nằm phía +x)
  const uniforms = { uTime: { value: 0 }, uShore: { value: shore } };
  const normals = waterNormals();
  normals.repeat.set(30, 60);
  const mat = new THREE.MeshStandardMaterial({ color: p.shallow, roughness: 0.12, metalness: 0.05, normalMap: normals, normalScale: new THREE.Vector2(0.35, 0.35), vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uShore;
        float waveH(vec2 p, out vec2 grad) {
          float d = max(0.0, p.x - uShore);
          float amp = mix(0.12, 0.55, smoothstep(0.0, 140.0, d));
          vec2 k1 = vec2(-0.16, 0.02), k2 = vec2(-0.27, -0.12), k3 = vec2(-0.11, 0.09);
          float a1 = dot(k1, p) + uTime * 1.25, a2 = dot(k2, p) + uTime * 1.9, a3 = dot(k3, p) + uTime * 0.9;
          float h = sin(a1) * amp + sin(a2) * amp * 0.35 + sin(a3) * amp * 0.5;
          grad = k1 * cos(a1) * amp + k2 * cos(a2) * amp * 0.35 + k3 * cos(a3) * amp * 0.5;
          return h;
        }`)
      .replace('#include <beginnormal_vertex>', `vec2 wp0 = (modelMatrix * vec4(position, 1.0)).xz; vec2 gw; waveH(wp0, gw);
        vec3 objectNormal = normalize(vec3(-gw.x, 1.0, -gw.y));`)
      .replace('#include <begin_vertex>', `vec2 gw2; vec3 transformed = vec3(position); transformed.y += waveH(wp0, gw2);`);
  };
  // lưới dày gần bờ để sóng mượt, phần xa thưa
  const zLen = (p.zLen ?? 1400) as number;
  const near = new THREE.PlaneGeometry(420, zLen, 140, Math.round(120 * zLen / 1400)).rotateX(-Math.PI / 2);
  const far = new THREE.PlaneGeometry(9000, 9000, 40, 40).rotateX(-Math.PI / 2);
  const shallow = new THREE.Color(p.shallow), deep = new THREE.Color(p.deep);
  const paint = (geo: THREE.BufferGeometry, ox: number) => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      c.lerpColors(shallow, deep, THREE.MathUtils.smoothstep(pos.getX(i) + ox - shore, 0, 160));
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  };
  paint(near, shore - 10 + 210);
  paint(far, shore + 4700);
  const nearMesh = new THREE.Mesh(near, mat);
  nearMesh.position.set(shore - 10 + 210, 0, 0);
  const farMesh = new THREE.Mesh(far, mat);
  farMesh.position.set(shore + 4700 - 280, -0.15, 0);
  ctx.scene.add(nearMesh, farMesh);

  // bọt sóng vỗ bờ
  const foamU = { uTime: { value: 0 }, uNight: { value: 0 } };
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(26, zLen, 1, 1).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: foamU,
      vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTime; uniform float uNight; varying vec2 vW;
        float n(float x){ return fract(sin(x*12.9898)*43758.5453); }
        void main(){
          float x = vW.x - ${shore.toFixed(1)};
          float wob = sin(vW.y*0.08 + uTime*0.7)*1.2 + sin(vW.y*0.31)*0.6;
          float band = 0.0;
          for (int i = 0; i < 3; i++) {
            float fi = float(i);
            float ph = fract(uTime*0.11 + fi/3.0);           // sóng chạy từ ngoài vào bờ
            float pos = mix(12.0, -3.0, ph) + wob;
            float w = smoothstep(1.6, 0.0, abs(x - pos)) * (1.0 - ph) ;
            band = max(band, w * (0.55 + 0.45*n(floor(vW.y*0.5)+fi)));
          }
          float edge = smoothstep(2.5, 0.0, abs(x + 1.0 - wob*0.4)) * 0.5;
          float a = clamp(band + edge, 0.0, 1.0) * mix(0.8, 0.4, uNight);
          gl_FragColor = vec4(vec3(mix(1.0, 0.32, uNight)), a);
        }`,
      transparent: true, depthWrite: false,
    }),
  );
  foam.position.set(shore + 4, 0.25, 0);
  foam.renderOrder = 2;
  ctx.scene.add(foam);

  return {
    update(dt, env) {
      uniforms.uTime.value += dt;
      foamU.uTime.value += dt;
      foamU.uNight.value = env.night;
      normals.offset.x -= dt * 0.01;
      mat.color.setScalar(1 - env.night * 0.7);
    },
  };
};
