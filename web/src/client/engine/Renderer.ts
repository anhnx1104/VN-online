// Renderer + hậu kỳ (bloom cho đèn đêm) + tự chọn mức chất lượng theo FPS đo được.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/** Chỉnh màu cuối cùng: tương phản, độ bão hoà, tối góc ảnh nhẹ như ống kính máy ảnh */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, contrast: { value: 1.06 }, saturation: { value: 1.1 }, vignette: { value: 0.22 }, warmth: { value: 0.0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float contrast, saturation, vignette, warmth; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = max((col - 0.3) * contrast + 0.3, col * 0.85);
      col += vec3(0.02, 0.005, -0.02) * warmth;
      vec2 d = vUv - 0.5;
      col *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

export type Quality = 'low' | 'medium' | 'high';
const QKEY = 'vno.quality';

export function initialQuality(): Quality {
  try {
    const q = localStorage.getItem(QKEY) as Quality | null;
    if (q === 'low' || q === 'medium' || q === 'high') return q;
  } catch { /* */ }
  const mobile = matchMedia('(pointer: coarse)').matches;
  return mobile ? 'medium' : 'high';
}

export class Renderer {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  grade: ShaderPass;
  camera = new THREE.PerspectiveCamera(60, 1, 0.3, 30000);
  quality: Quality;
  private frames = 0;
  private acc = 0;
  private autoChecks = 0;
  fps = 60;
  onQualityChange: ((q: Quality) => void) | null = null;

  constructor(private host: HTMLElement, public scene: THREE.Scene) {
    this.quality = initialQuality();
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = this.quality === 'high';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(this.renderer.domElement);

    // Khung hình trung gian có khử răng cưa (MSAA) để cạnh nhà, cột đèn không bị lởm chởm khi có hậu kỳ
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.quality === 'low' ? 0 : 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.5, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    this.applyQuality();
    addEventListener('resize', () => this.resize());
  }

  setQuality(q: Quality, remember = true) {
    this.quality = q;
    if (remember) try { localStorage.setItem(QKEY, q); } catch { /* */ }
    this.applyQuality();
    this.onQualityChange?.(q);
  }

  private applyQuality() {
    const dpr = Math.min(devicePixelRatio, 2);
    const pr = this.quality === 'high' ? dpr : this.quality === 'medium' ? Math.min(dpr, 1.25) : Math.min(dpr, 1) * 0.75;
    this.renderer.setPixelRatio(pr);
    this.bloom.enabled = this.quality !== 'low';
    this.grade.enabled = this.quality !== 'low';
    this.resize();
  }

  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 70 : 60;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    const half = this.quality === 'high' ? 0.5 : 0.35;
    this.bloom.resolution.set(w * half, h * half);
  }

  /** warmth: 1 lúc bình minh/hoàng hôn */
  setGrade(night: number, warmth: number, rain: number) {
    const u = this.grade.uniforms;
    u.contrast.value = 1.07 - night * 0.07 - rain * 0.05;
    u.saturation.value = 1.12 - night * 0.1 - rain * 0.12;
    u.vignette.value = 0.2 + night * 0.05;
    u.warmth.value = warmth;
  }

  render(dt: number, nightBloom: number) {
    // ban ngày gần như tắt bloom để không cháy sáng; ban đêm cho đèn tỏa
    // Ban ngày tắt hẳn bloom: bầu trời HDR rất sáng sẽ loang thành màn sương trắng phủ cả khung hình
    const post = this.quality !== 'low';
    this.bloom.enabled = post && nightBloom > 0.05;
    this.bloom.strength = nightBloom * 0.9;
    this.bloom.threshold = 0.98 - nightBloom * 0.2;
    if (post) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);

    // tự hạ chất lượng nếu FPS thấp trong những giây đầu
    this.frames++;
    this.acc += dt;
    if (this.acc >= 3) {
      this.fps = this.frames / this.acc;
      this.frames = 0;
      this.acc = 0;
      if (this.autoChecks < 4 && document.visibilityState === 'visible') {
        this.autoChecks++;
        if (this.fps < 26 && this.quality === 'high') this.setQuality('medium', false);
        else if (this.fps < 24 && this.quality === 'medium') this.setQuality('low', false);
      }
    }
  }

  /** Chụp khung hình hiện tại ở độ phân giải gấp đôi (cho bưu thiếp) */
  capture(scale = 2): HTMLCanvasElement {
    const r = this.renderer;
    const oldPr = r.getPixelRatio();
    const w = this.host.clientWidth, h = this.host.clientHeight;
    r.setPixelRatio(Math.min(oldPr * scale, 3));
    this.composer.setPixelRatio(r.getPixelRatio());
    this.composer.setSize(w, h);
    if (this.quality !== 'low') this.composer.render(0); else r.render(this.scene, this.camera);
    const out = document.createElement('canvas');
    out.width = r.domElement.width; out.height = r.domElement.height;
    out.getContext('2d')!.drawImage(r.domElement, 0, 0);
    r.setPixelRatio(oldPr);
    this.composer.setPixelRatio(oldPr);
    this.resize();
    return out;
  }
}
