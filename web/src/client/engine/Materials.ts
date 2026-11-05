// Vật liệu PBR từ ảnh chụp thật (Poly Haven, CC0) trải theo toạ độ thế giới (mét), có biến thiên
// màu ở thang lớn để không lộ mảng lặp. Kit chỉ cần gọi pbr('granite_tile', 2.3).
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();
let lowQuality = false;
let maxAniso = 8;

export function configureMaterials(renderer: THREE.WebGLRenderer, low: boolean) {
  lowQuality = low;
  maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
}

function tex(file: string, srgb: boolean) {
  const k = file;
  let t = texCache.get(k);
  if (!t) {
    t = loader.load(`/textures/${file}.webp`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(k, t);
  }
  return t;
}

export interface PbrOpts {
  /** Màu nhân với ảnh (chỉnh tông) */
  tint?: string;
  roughness?: number;
  metalness?: number;
  normalScale?: number;
  /** Mặt phẳng chiếu: 'xz' cho mặt đất, 'x'/'z' cho tường hướng theo trục đó, 'box' tự chọn theo pháp tuyến */
  plane?: 'xz' | 'x' | 'z' | 'box';
  /** Mức loang màu ở thang lớn (0..0.4) */
  macro?: number;
  /** Dùng màu đỉnh (vertexColors) */
  vertexColors?: boolean;
  side?: THREE.Side;
  /** Độ nhám tối thiểu: mặt đá ngoài trời không bóng như gương (mặc định 0.6) */
  minRough?: number;
}

const NOISE = /* glsl */ `
float vnoH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vno(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(vnoH(i), vnoH(i+vec2(1,0)), f.x), mix(vnoH(i+vec2(0,1)), vnoH(i+vec2(1,1)), f.x), f.y); }
`;

/**
 * Vật liệu đất/tường phủ ảnh thật. `size` là kích thước thật (mét) của một ô ảnh.
 * UV được tính lại từ toạ độ thế giới nên mọi mảnh hình học đều khớp nhau.
 */
export function pbr(name: string, size: number, o: PbrOpts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    map: tex(`${name}_diff`, true),
    normalMap: lowQuality ? null : tex(`${name}_nor`, false),
    roughnessMap: lowQuality ? null : tex(`${name}_rough`, false),
    roughness: o.roughness ?? 1,
    metalness: o.metalness ?? 0,
    color: o.tint ?? '#ffffff',
    vertexColors: o.vertexColors ?? false,
    side: o.side ?? THREE.FrontSide,
  });
  if (mat.normalMap) mat.normalScale.setScalar(o.normalScale ?? 1);
  const plane = o.plane ?? 'xz';
  const macro = o.macro ?? 0.18;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWorldScale = { value: 1 / size };
    sh.uniforms.uMacro = { value: macro };
    sh.uniforms.uMinRough = { value: o.minRough ?? 0.6 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uWorldScale; varying vec3 vWp;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        vec4 wp4 = modelMatrix * vec4(position, 1.0);
        #ifdef USE_INSTANCING
          wp4 = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #endif
        vWp = wp4.xyz;
        vec3 wn = normalize(mat3(modelMatrix) * normal);
        vec2 wuv = ${plane === 'xz' ? 'wp4.xz' : plane === 'x' ? 'vec2(wp4.z, wp4.y)' : plane === 'z' ? 'vec2(wp4.x, wp4.y)'
          : '(abs(wn.y) > 0.6 ? wp4.xz : (abs(wn.x) > abs(wn.z) ? vec2(wp4.z, wp4.y) : vec2(wp4.x, wp4.y)))'} * uWorldScale;
        #ifdef USE_MAP
          vMapUv = wuv;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = wuv;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = wuv;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uMacro; uniform float uMinRough; varying vec3 vWp;\n${NOISE}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n roughnessFactor = max(roughnessFactor, uMinRough);`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float mN = vno(vWp.xz * 0.045) * 0.65 + vno(vWp.xz * 0.19 + 7.0) * 0.35;
        diffuseColor.rgb *= mix(1.0 - uMacro, 1.0 + uMacro * 0.6, mN);`);
  };
  mat.customProgramCacheKey = () => `pbr|${plane}|${lowQuality}`;
  return mat;
}

/** Ảnh nền dùng chung (không trải theo thế giới), ví dụ vỏ thân dừa */
export function pbrUV(name: string, repeatX: number, repeatY: number, o: { tint?: string; roughness?: number } = {}) {
  const own = (file: string, srgb: boolean) => {
    const t = loader.load(`/textures/${file}.webp`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.repeat.set(repeatX, repeatY);
    return t;
  };
  return new THREE.MeshStandardMaterial({
    map: own(`${name}_diff`, true),
    normalMap: lowQuality ? null : own(`${name}_nor`, false),
    roughnessMap: lowQuality ? null : own(`${name}_rough`, false),
    roughness: o.roughness ?? 1,
    color: o.tint ?? '#ffffff',
  });
}
