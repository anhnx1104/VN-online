// Bầu trời theo giờ thật: vị trí mặt trời, mặt trăng (SunCalc theo tọa độ điểm đến), sao, sương, ánh sáng, mây theo thời tiết.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import * as SunCalc from 'suncalc';
import type { WeatherNow } from '../../shared/protocol';

export interface Env {
  now: number;
  sunAlt: number; // độ
  night: number; // 0 ngày → 1 đêm
  dusk: number; // 0..1 mức "giờ vàng"
  sunDir: THREE.Vector3;
  weather: WeatherNow | null;
  rain: number;
}

const tmp = new THREE.Color();
const C = (h: string) => new THREE.Color(h);
const FOG_DAY = C('#b4c6d6'), FOG_DUSK = C('#d39a7a'), FOG_NIGHT = C('#18223a');
const HEMI_DAY = C('#e1e8ef'), HEMI_NIGHT = C('#5a74b8');
const GROUND_DAY = C('#8a7f6a'), GROUND_NIGHT = C('#3a3428');

function dirFromSunCalc(azDeg: number, altDeg: number, out: THREE.Vector3) {
  // SunCalc 2.x: độ, azimuth tính theo chiều kim đồng hồ từ hướng Bắc. Thế giới: +x Đông, -z Bắc.
  const az = THREE.MathUtils.degToRad(azDeg), alt = THREE.MathUtils.degToRad(altDeg);
  return out.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt)).normalize();
}

export class SkySystem {
  sky = new Sky();
  sun = new THREE.DirectionalLight('#fff4e0', 2.5);
  moonLight = new THREE.DirectionalLight('#9fb6ff', 0.0);
  hemi = new THREE.HemisphereLight('#cfe3ff', '#7a6f5c', 1);
  stars: THREE.Points;
  moon: THREE.Mesh;
  clouds: THREE.Mesh;
  env: Env;
  private pmrem: THREE.PMREMGenerator;
  private envScene = new THREE.Scene();
  private envSky = new Sky();
  private envRT: THREE.WebGLRenderTarget | null = null;
  private lastEnvAt = -1e9;
  private lastEnvAlt = 999;

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer, private lat: number, private lon: number, shadows: boolean) {
    this.sky.scale.setScalar(20000);
    this.envSky.scale.setScalar(1000);
    this.envScene.add(this.envSky);
    scene.add(this.sky, this.sun, this.sun.target, this.moonLight, this.moonLight.target, this.hemi);
    this.pmrem = new THREE.PMREMGenerator(renderer);

    if (shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 2048);
      const cam = this.sun.shadow.camera;
      cam.left = cam.bottom = -45; cam.right = cam.top = 45; cam.near = 1; cam.far = 400;
      this.sun.shadow.bias = -0.0004;
    }

    // Sao
    const n = 1800, pos = new Float32Array(n * 3), size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.random(), v = Math.random() * 0.95;
      const th = u * Math.PI * 2, ph = Math.acos(1 - v);
      pos.set([Math.sin(ph) * Math.cos(th) * 9000, Math.cos(ph) * 9000, Math.sin(ph) * Math.sin(th) * 9000], i * 3);
      size[i] = Math.random() < 0.06 ? 3.2 : 1.2 + Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    this.stars = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { opacity: { value: 0 }, time: { value: 0 } },
      vertexShader: `attribute float size; varying float vTw; uniform float time;
        void main(){ vTw = 0.7 + 0.3*sin(time*1.7 + position.x*0.013 + position.z*0.007);
          gl_PointSize = size; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float opacity; varying float vTw;
        void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor = vec4(vec3(0.9,0.93,1.0), opacity*vTw*(1.0-d*2.0)); }`,
      transparent: true, depthWrite: false, fog: false,
    }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // Mặt trăng
    this.moon = new THREE.Mesh(
      new THREE.CircleGeometry(160, 48),
      new THREE.ShaderMaterial({
        uniforms: { phase: { value: 0.5 }, opacity: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `uniform float phase; uniform float opacity; varying vec2 vUv;
          void main(){ vec2 p = vUv*2.0-1.0; float r = length(p); if(r>1.0) discard;
            float z = sqrt(1.0-r*r); float k = cos(phase*6.2831853); float edge = k*sqrt(max(0.0,1.0-p.y*p.y));
            float lit = phase < 0.5 ? smoothstep(edge-0.04, edge+0.04, p.x) : smoothstep(edge-0.04, edge+0.04, -p.x);
            vec3 col = mix(vec3(0.08,0.09,0.13), vec3(1.0,0.98,0.9) * (0.85+0.15*z), lit);
            gl_FragColor = vec4(col*1.6, opacity*smoothstep(1.0,0.96,r)); }`,
        transparent: true, depthWrite: false, fog: false,
      }),
    );
    scene.add(this.moon);

    // Mây: vòm bán cầu theo camera, nhiễu fbm chiếu lên mặt phẳng trời, độ phủ theo thời tiết thật
    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(9000, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 }, coverage: { value: 0.4 }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
          lit: { value: new THREE.Color(1, 1, 1) }, shade: { value: new THREE.Color(0.6, 0.65, 0.72) }, opacity: { value: 1 },
        },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform float time, coverage, opacity; uniform vec3 sunDir, lit, shade; varying vec3 vDir;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
          float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
          float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<6;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
          void main(){
            vec3 d = normalize(vDir);
            if (d.y < 0.0) discard;
            vec2 uv = d.xz / (d.y + 0.12) * 1.6 + vec2(time*0.004, time*0.0016);
            float base = fbm(uv);
            float detail = fbm(uv*3.1 + 4.0);
            float v = base*0.75 + detail*0.25;
            float th = 1.0 - coverage;
            float dens = smoothstep(th - 0.02, th + 0.28, v);
            if (dens < 0.003) discard;
            // mặt dưới tối hơn, mép phía mặt trời sáng viền bạc
            float thick = smoothstep(th, th + 0.45, v);
            float toward = pow(max(dot(d, normalize(sunDir)), 0.0), 6.0);
            vec3 col = mix(lit, shade, thick*0.85) + lit*toward*(1.0-thick)*0.6;
            float horizon = smoothstep(0.0, 0.18, d.y);
            gl_FragColor = vec4(col, dens*opacity*horizon);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        transparent: true, depthWrite: false, fog: false, side: THREE.BackSide,
      }),
    );
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -1;
    scene.add(this.clouds);

    this.env = { now: Date.now(), sunAlt: 45, night: 0, dusk: 0, sunDir: new THREE.Vector3(0, 1, 0), weather: null, rain: 0 };
    scene.fog = new THREE.FogExp2(FOG_DAY.clone(), 0.0016);
  }

  update(now: number, weather: WeatherNow | null, focus: THREE.Vector3, camera: THREE.Camera) {
    const date = new Date(now);
    const sp = SunCalc.getPosition(date, this.lat, this.lon);
    const mp = SunCalc.getMoonPosition(date, this.lat, this.lon);
    const mi = SunCalc.getMoonIllumination(date);
    const sunDir = dirFromSunCalc(sp.azimuth, sp.altitude, this.env.sunDir);
    const altDeg = sp.altitude;
    const night = THREE.MathUtils.smoothstep(-altDeg, -1, 9); // sau khi mặt trời lặn 9° là tối hẳn
    const dusk = Math.max(0, 1 - Math.abs(altDeg - 1.5) / 8);
    const cloud = (weather?.cloud ?? 20) / 100;
    const rain = weather && (weather.kind === 'rain' || weather.kind === 'storm') ? (weather.kind === 'storm' ? 1 : 0.65) : 0;

    Object.assign(this.env, { now, sunAlt: altDeg, night, dusk, weather, rain });

    const u = this.sky.material.uniforms;
    u.turbidity.value = 2 + cloud * 3 + rain * 6;
    u.rayleigh.value = 1.7 + dusk * 1.2 - rain * 0.8;
    u.mieCoefficient.value = 0.003 + cloud * 0.004 + rain * 0.006;
    u.mieDirectionalG.value = 0.82;
    // Chạng vạng: thư viện bầu trời tối sầm ngay khi mặt trời xuống dưới chân trời, trong khi ngoài đời
    // trời còn sáng thêm 20–30 phút. Nén độ cao âm để vầng sáng nhạt dần theo thời gian.
    const skyAlt = altDeg >= -1 ? altDeg : -1 + (altDeg + 1) * 0.15;
    u.sunPosition.value.copy(dirFromSunCalc(sp.azimuth, skyAlt, new THREE.Vector3())).multiplyScalar(10000);
    this.sky.position.copy(camera.position);

    // Ánh sáng mặt trời
    const sunUp = THREE.MathUtils.smoothstep(altDeg, -2, 6);
    // Nắng nhiệt đới: ánh trực tiếp mạnh hơn hẳn ánh trời để có bóng đổ rõ; trời nhiều mây thì dịu bớt
    this.sun.intensity = sunUp * Math.max(0.7, 3.4 - cloud * 1.3 - rain * 1.6);
    this.sun.color.setRGB(1, 0.78 + 0.22 * THREE.MathUtils.smoothstep(altDeg, 2, 25), 0.55 + 0.45 * THREE.MathUtils.smoothstep(altDeg, 2, 30));
    this.sun.position.copy(focus).addScaledVector(sunDir, 200);
    this.sun.target.position.copy(focus);

    // Mặt trăng
    const moonDir = dirFromSunCalc(mp.azimuth, mp.altitude, new THREE.Vector3());
    const moonUp = THREE.MathUtils.smoothstep(mp.altitude, -2, 4);
    this.moon.position.copy(camera.position).addScaledVector(moonDir, 8000);
    this.moon.lookAt(camera.position);
    const mm = this.moon.material as THREE.ShaderMaterial;
    mm.uniforms.phase.value = mi.phase;
    mm.uniforms.opacity.value = moonUp * (night * 0.95 + 0.25) * (1 - cloud * 0.6);
    this.moonLight.intensity = night * moonUp * mi.fraction * 0.6 * (1 - cloud * 0.7);
    this.moonLight.position.copy(focus).addScaledVector(moonDir, 200);
    this.moonLight.target.position.copy(focus);

    // Bầu trời ban đêm: Sky.js gần như đen, giữ lại một chút màu xanh thẫm
    (this.stars.material as THREE.ShaderMaterial).uniforms.opacity.value = night * (1 - cloud * 0.85) * (1 - rain);
    (this.stars.material as THREE.ShaderMaterial).uniforms.time.value = now / 1000;
    this.stars.position.copy(camera.position);

    this.hemi.color.lerpColors(HEMI_DAY, HEMI_NIGHT, night);
    this.hemi.groundColor.lerpColors(GROUND_DAY, GROUND_NIGHT, night);
    // chạng vạng: trời còn sáng tán xạ dù mặt trời đã thấp
    this.hemi.intensity = (THREE.MathUtils.lerp(0.38 + cloud * 0.15, 1.5, night) + dusk * 0.5) * (1 - rain * 0.2);

    // Mây
    const cu = (this.clouds.material as THREE.ShaderMaterial).uniforms;
    cu.time.value = now / 1000;
    cu.coverage.value = THREE.MathUtils.clamp(0.22 + cloud * 0.5 + rain * 0.2, 0.15, 0.9);
    cu.sunDir.value.copy(sunDir.y > -0.1 ? sunDir : moonDir);
    const day = 1 - night;
    const warm = dusk * day;
    (cu.lit.value as THREE.Color).setRGB(
      (1.25 + warm * 0.4) * day + 0.07 * night, (1.22 - warm * 0.15) * day + 0.08 * night, (1.2 - warm * 0.45) * day + 0.11 * night,
    ).multiplyScalar(1 - rain * 0.35);
    (cu.shade.value as THREE.Color).setRGB(0.66 * day + 0.03 * night, 0.7 * day + 0.035 * night, (0.78 - warm * 0.1) * day + 0.05 * night)
      .multiplyScalar(1 - rain * 0.4);
    cu.opacity.value = 0.95;
    this.clouds.position.copy(camera.position);

    const fog = this.scene.fog as THREE.FogExp2;
    tmp.lerpColors(FOG_DAY, FOG_DUSK, dusk * (1 - night));
    tmp.lerp(FOG_NIGHT, night);
    if (rain) tmp.lerp(C('#6d7682'), rain * 0.5 * (1 - night));
    fog.color.copy(tmp);
    fog.density = 0.00045 + night * 0.0005 + cloud * 0.0002 + rain * 0.0022 + (weather?.kind === 'fog' ? 0.006 : 0);

    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(0.6, 0.85, night) * (1 - rain * 0.12);

    // Môi trường phản chiếu (nước, kính) cập nhật khi mặt trời đổi đáng kể
    if (Math.abs(altDeg - this.lastEnvAlt) > 1.5 || performance.now() - this.lastEnvAt > 120_000) this.refreshEnv();
  }

  private refreshEnv() {
    this.lastEnvAt = performance.now();
    this.lastEnvAlt = this.env.sunAlt;
    const a = this.sky.material.uniforms, b = this.envSky.material.uniforms;
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) b[k].value = a[k].value;
    b.sunPosition.value.copy(a.sunPosition.value);
    const old = this.envRT;
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 2000);
    this.scene.environment = this.envRT.texture;
    // ban đêm env gần như đen; bù bằng cường độ môi trường
    this.scene.environmentIntensity = THREE.MathUtils.lerp(0.42, 0.5, this.env.night);
    old?.dispose();
  }
}
