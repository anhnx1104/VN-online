// Chỉ đường: tìm đường trên lưới vùng đi được (BFS), vẽ chấm sáng dẫn đường + cột sáng ở đích.
import * as THREE from 'three';
import type { WalkRect } from '../../shared/pack';
import type { WalkMap } from './Walk';

const CELL = 2;
const SHOW = 28; // số chấm hiển thị phía trước

export class Guide {
  path: THREE.Vector3[] = [];
  target: { x: number; z: number; name: string } | null = null;
  private idx = 0;
  private x0: number;
  private z0: number;
  private nx: number;
  private nz: number;
  private dots: THREE.InstancedMesh;
  private beacon: THREE.Mesh;
  private dotMat: THREE.MeshBasicMaterial;
  private lastReroute = 0;

  constructor(scene: THREE.Scene, private walk: WalkMap, rects: WalkRect[]) {
    this.x0 = Math.min(...rects.map((r) => r.x0));
    this.z0 = Math.min(...rects.map((r) => r.z0));
    this.nx = Math.ceil((Math.max(...rects.map((r) => r.x1)) - this.x0) / CELL);
    this.nz = Math.ceil((Math.max(...rects.map((r) => r.z1)) - this.z0) / CELL);

    this.dotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#F2B705').multiplyScalar(1.6), transparent: true, opacity: 0.9, depthWrite: false });
    this.dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.32, 16).rotateX(-Math.PI / 2), this.dotMat, SHOW);
    this.dots.count = 0;
    this.dots.frustumCulled = false;
    this.dots.renderOrder = 3;
    scene.add(this.dots);

    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 60, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#F2B705').multiplyScalar(1.4), transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.beacon.visible = false;
    scene.add(this.beacon);
  }

  private cx(i: number) { return this.x0 + (i + 0.5) * CELL; }
  private cz(j: number) { return this.z0 + (j + 0.5) * CELL; }

  /** Tìm đường từ vị trí hiện tại tới đích. Trả về false nếu không có đường. */
  route(from: THREE.Vector3, to: { x: number; z: number; name: string }): boolean {
    const { nx, nz } = this;
    const hs = new Float32Array(nx * nz).fill(NaN);
    const prev = new Int32Array(nx * nz).fill(-1);
    const si = Math.floor((from.x - this.x0) / CELL), sj = Math.floor((from.z - this.z0) / CELL);
    if (si < 0 || sj < 0 || si >= nx || sj >= nz) return false;
    const start = sj * nx + si;
    hs[start] = from.y;
    const queue = [start];
    let goal = -1;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let q = 0; q < queue.length; q++) {
      const c = queue[q];
      const i = c % nx, j = (c - i) / nx;
      const x = this.cx(i), z = this.cz(j), h = hs[c];
      if (Math.hypot(x - to.x, z - to.z) < 4) { goal = c; break; }
      for (const [di, dj] of dirs) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
        const n = nj * nx + ni;
        if (!Number.isNaN(hs[n])) continue;
        // đi chéo chỉ khi cả hai ô cạnh đều đi được (không cắt góc tường)
        if (di && dj && (this.walk.canStand(this.cx(ni), z, h) === null || this.walk.canStand(x, this.cz(nj), h) === null)) continue;
        const mx = (x + this.cx(ni)) / 2, mz = (z + this.cz(nj)) / 2;
        const hm = this.walk.canStand(mx, mz, h); // kiểm tra điểm giữa để không "nhảy" qua khe tường
        if (hm === null) continue;
        const hn = this.walk.canStand(this.cx(ni), this.cz(nj), hm);
        if (hn === null) continue;
        hs[n] = hn;
        prev[n] = c;
        queue.push(n);
      }
    }
    if (goal < 0) return false;
    const pts: THREE.Vector3[] = [];
    for (let c = goal; c !== -1; c = prev[c]) {
      const i = c % nx, j = (c - i) / nx;
      pts.push(new THREE.Vector3(this.cx(i), hs[c], this.cz(j)));
    }
    pts.reverse();
    this.path = pts;
    this.idx = 0;
    this.target = to;
    const ty = this.walk.heightAt(to.x, to.z) ?? pts[pts.length - 1].y;
    this.beacon.position.set(to.x, ty + 30, to.z);
    this.beacon.visible = true;
    return true;
  }

  clear() {
    this.path = [];
    this.target = null;
    this.dots.count = 0;
    this.beacon.visible = false;
  }

  /** Cập nhật mỗi khung. Trả về hướng (so với camera, độ) và khoảng cách còn lại, hoặc null nếu không chỉ đường. */
  update(player: THREE.Vector3, camera: THREE.Camera, now: number): { angle: number; dist: number; next: THREE.Vector3 } | null {
    if (!this.target || !this.path.length) return null;
    // tiến độ: điểm gần nhất trong cửa sổ phía trước
    let best = this.idx, bd = Infinity;
    for (let k = this.idx; k < Math.min(this.path.length, this.idx + 30); k++) {
      const d = this.path[k].distanceToSquared(player);
      if (d < bd) { bd = d; best = k; }
    }
    this.idx = best;
    // lạc đường thì tìm lại
    if (Math.sqrt(bd) > 10 && now - this.lastReroute > 1500) {
      this.lastReroute = now;
      if (!this.route(player, this.target)) return null;
    }
    // chấm sáng phía trước, cách nhau 2 ô
    const m = new THREE.Matrix4();
    let n = 0;
    for (let k = this.idx + 1; k < this.path.length && n < SHOW; k += 2) {
      const p = this.path[k];
      const s = 0.8 + 0.35 * Math.sin(now / 180 - k * 0.6);
      m.makeScale(s, 1, s).setPosition(p.x, p.y + 0.06, p.z);
      this.dots.setMatrixAt(n++, m);
    }
    this.dots.count = n;
    this.dots.instanceMatrix.needsUpdate = true;
    (this.beacon.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.1 * Math.sin(now / 300);

    // mũi tên chỉ tới điểm phía trước ~6 m
    let look = this.path[this.path.length - 1];
    for (let k = this.idx; k < this.path.length; k++) if (this.path[k].distanceTo(player) > 6) { look = this.path[k]; break; }
    // điểm bám cho chế độ tự đi: gần hơn để ôm cua theo đường
    const next = this.path[Math.min(this.idx + 1, this.path.length - 1)];
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const a = Math.atan2(fwd.x, fwd.z), b = Math.atan2(look.x - player.x, look.z - player.z);
    let rel = a - b;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    // khoảng cách còn lại theo đường đi
    let dist = 0;
    let last = player;
    for (let k = this.idx + 1; k < this.path.length; k++) { dist += last.distanceTo(this.path[k]); last = this.path[k]; }
    return { angle: THREE.MathUtils.radToDeg(rel), dist, next };
  }
}
