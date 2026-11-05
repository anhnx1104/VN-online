// Bản đồ khu: bản nhỏ góc màn hình (xoay theo hướng nhìn) và bản lớn (hướng Bắc lên trên, chạm để chỉ đường).
// Vẽ từ dữ liệu khu: vùng đi bộ, lòng đường, sông/biển. Phong cách bản đồ giấy, khớp với hộ chiếu và bưu thiếp.
import type { WalkRect, ZoneDef } from '../../shared/pack';

export type MarkerKind = 'poi' | 'taxi' | 'bikes' | 'mybike' | 'player' | 'target';
export interface MapMarker { x: number; z: number; kind: MarkerKind; label?: string; done?: boolean }

const C = {
  land: '#dfe4d4',
  walk: '#fbfbf6',
  road: '#aab1bb',
  water: '#9fc7d3',
  sand: '#efe2bf',
  edge: '#12213d',
  red: '#c8102e',
  lantern: '#f2b705',
  jade: '#1fa39a',
  player: '#3b6fd8',
};

export class ZoneMap {
  private layer: HTMLCanvasElement;
  private x0: number;
  private z0: number;
  private ppm = 2; // điểm ảnh trên mét của lớp nền
  readonly w: number;
  readonly h: number;
  private oceanX: number | null = null;

  constructor(zone: ZoneDef) {
    const rects: WalkRect[] = [...zone.walk, ...(zone.ride ?? [])];
    const river = zone.kits.find((k) => k.kit === 'river')?.params;
    const ocean = zone.kits.find((k) => k.kit === 'ocean')?.params;
    const pad = 60;
    this.x0 = Math.min(...rects.map((r) => r.x0)) - pad;
    this.z0 = Math.min(...rects.map((r) => r.z0)) - pad;
    let x1 = Math.max(...rects.map((r) => r.x1)) + pad;
    const z1 = Math.max(...rects.map((r) => r.z1)) + pad;
    if (ocean) { x1 = Math.max(x1, ocean.shore + 160); this.oceanX = ocean.shore; }
    this.w = x1 - this.x0;
    this.h = z1 - this.z0;
    this.layer = document.createElement('canvas');
    this.layer.width = Math.ceil(this.w * this.ppm);
    this.layer.height = Math.ceil(this.h * this.ppm);
    const g = this.layer.getContext('2d')!;
    const X = (x: number) => (x - this.x0) * this.ppm, Z = (z: number) => (z - this.z0) * this.ppm;
    g.fillStyle = C.land;
    g.fillRect(0, 0, this.layer.width, this.layer.height);
    g.fillStyle = C.water;
    if (river) g.fillRect(X(river.x0), 0, (river.x1 - river.x0) * this.ppm, this.layer.height);
    if (ocean) g.fillRect(X(ocean.shore), 0, this.layer.width, this.layer.height);
    for (const r of zone.ride ?? []) { g.fillStyle = C.road; g.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * this.ppm, (r.z1 - r.z0) * this.ppm); }
    g.fillStyle = C.walk;
    for (const r of zone.walk) g.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * this.ppm, (r.z1 - r.z0) * this.ppm);
    // bãi cát: tô màu cát cho dễ phân biệt với vỉa hè
    const beach = zone.kits.find((k) => k.kit === 'beach')?.params;
    if (beach) {
      g.fillStyle = C.sand;
      g.fillRect(X(beach.promX1), 0, (Math.min(beach.sandX1, ocean?.shore ?? beach.sandX1) - beach.promX1) * this.ppm, this.layer.height);
    }
  }

  /** Bản nhỏ: tâm là người chơi, hướng nhìn của camera hướng lên trên */
  drawMini(cv: HTMLCanvasElement, px: number, pz: number, playerYaw: number, camYaw: number, markers: MapMarker[], radiusM = 80) {
    const dpr = Math.min(devicePixelRatio, 2);
    const size = cv.clientWidth;
    if (cv.width !== size * dpr) { cv.width = cv.height = size * dpr; }
    const g = cv.getContext('2d')!;
    const R = (size / 2) * dpr;
    const s = R / radiusM; // px/m
    const a = camYaw + Math.PI; // hướng nhìn
    const fx = Math.sin(a), fz = Math.cos(a), rx = -Math.cos(a), rz = Math.sin(a);
    const toC = (x: number, z: number) => {
      const dx = x - px, dz = z - pz;
      return [R + s * (dx * rx + dz * rz), R - s * (dx * fx + dz * fz)];
    };
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.save();
    g.beginPath(); g.arc(R, R, R - dpr, 0, Math.PI * 2); g.clip();
    const k = s / this.ppm;
    g.setTransform(k * rx, -k * fx, k * rz, -k * fz,
      R + s * (rx * (this.x0 - px) + rz * (this.z0 - pz)),
      R - s * (fx * (this.x0 - px) + fz * (this.z0 - pz)));
    g.fillStyle = C.land; g.fillRect(-1e4, -1e4, 3e4, 3e4);
    g.drawImage(this.layer, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const m of markers) {
      const [cx, cy] = toC(m.x, m.z);
      const d = Math.hypot(cx - R, cy - R);
      if (d > R - 8 * dpr) {
        if (m.kind !== 'target') continue;
        // đích nằm ngoài khung: ghim ở mép bản đồ
        const t = (R - 10 * dpr) / d;
        drawMarker(g, R + (cx - R) * t, R + (cy - R) * t, m, dpr * 0.9);
        continue;
      }
      drawMarker(g, cx, cy, m, dpr * 0.9);
    }
    // người chơi
    const pa = playerYaw;
    const [hx, hy] = [Math.sin(pa) * rx + Math.cos(pa) * rz, -(Math.sin(pa) * fx + Math.cos(pa) * fz)];
    drawArrow(g, R, R, Math.atan2(hx, -hy), dpr);
    g.restore();
    // chữ B chỉ hướng Bắc
    const [nx, ny] = [-rz, fz]; // hướng (0,-1) của thế giới
    const nr = R - 11 * dpr;
    g.fillStyle = C.red; g.font = `800 ${11 * dpr}px "Be Vietnam Pro", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('B', R + nx * nr, R + ny * nr);
  }

  /** Bản lớn: hướng Bắc lên trên, trả về hàm đổi tọa độ chạm → thế giới */
  drawFull(cv: HTMLCanvasElement, markers: MapMarker[], player: { x: number; z: number; yaw: number }, focus?: { x0: number; x1: number; z0: number; z1: number }) {
    const dpr = Math.min(devicePixelRatio, 2);
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d')!;
    let f = focus ?? { x0: this.x0, x1: this.x0 + this.w, z0: this.z0, z1: this.z0 + this.h };
    if (!focus) {
      // tập trung vào vùng có địa điểm (khu dài và hẹp như bãi biển sẽ không bị thu thành một vệt)
      const pts = [...markers.filter((m) => m.kind !== 'player'), { x: player.x, z: player.z }];
      const pad = 70;
      let fx0 = Math.min(...pts.map((p) => p.x)) - pad, fx1 = Math.max(...pts.map((p) => p.x)) + pad;
      let fz0 = Math.min(...pts.map((p) => p.z)) - pad, fz1 = Math.max(...pts.map((p) => p.z)) + pad;
      // giữ tỉ lệ khung hình của canvas
      const want = W / H, cx = (fx0 + fx1) / 2, cz = (fz0 + fz1) / 2;
      let fw = fx1 - fx0, fh = fz1 - fz0;
      if (fw / fh < want) fw = fh * want; else fh = fw / want;
      fx0 = cx - fw / 2; fx1 = cx + fw / 2; fz0 = cz - fh / 2; fz1 = cz + fh / 2;
      f = { x0: fx0, x1: fx1, z0: fz0, z1: fz1 };
    }
    const k = Math.min((W * dpr) / (f.x1 - f.x0), (H * dpr) / (f.z1 - f.z0));
    const ox = (W * dpr - (f.x1 - f.x0) * k) / 2 - f.x0 * k;
    const oy = (H * dpr - (f.z1 - f.z0) * k) / 2 - f.z0 * k;
    // ngoài lớp nền: khu có biển thì phía biển là nước
    g.fillStyle = C.land; g.fillRect(0, 0, cv.width, cv.height);
    if (this.oceanX !== null) { g.fillStyle = C.water; g.fillRect(ox + this.oceanX * k, 0, cv.width, cv.height); }
    g.setTransform(k / this.ppm, 0, 0, k / this.ppm, ox + this.x0 * k, oy + this.z0 * k);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.layer, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const toC = (x: number, z: number) => [ox + x * k, oy + z * k];
    const boxes: number[][] = [];
    for (const m of markers) {
      const [cx, cy] = toC(m.x, m.z);
      drawMarker(g, cx, cy, m, dpr * 1.25, false);
    }
    // nhãn: thử phải, trái, dưới, trên để không chồng lên nhau
    const sc = dpr * 1.25;
    g.font = `600 ${11 * sc}px "Be Vietnam Pro", sans-serif`;
    for (const m of markers) {
      if (!m.label || m.kind === 'player') continue;
      const [cx, cy] = toC(m.x, m.z);
      const tw = g.measureText(m.label).width, th = 14 * sc;
      const opts = [[cx + 10 * sc, cy - th / 2], [cx - 10 * sc - tw, cy - th / 2], [cx - tw / 2, cy + 9 * sc], [cx - tw / 2, cy - 9 * sc - th]];
      const pick = opts.find(([x, y]) => !boxes.some(([bx, by, bw, bh]) => x < bx + bw && x + tw > bx && y < by + bh && y + th > by)) ?? opts[0];
      boxes.push([pick[0], pick[1], tw, th]);
      g.textAlign = 'left'; g.textBaseline = 'top';
      g.lineWidth = 3 * sc; g.strokeStyle = 'rgba(251,251,246,.95)'; g.strokeText(m.label, pick[0], pick[1]);
      g.fillStyle = C.edge; g.fillText(m.label, pick[0], pick[1]);
    }
    const [px, py] = toC(player.x, player.z);
    drawArrow(g, px, py, Math.PI - player.yaw, dpr * 1.4);
    return (clientX: number, clientY: number) => {
      const r = cv.getBoundingClientRect();
      return { x: ((clientX - r.left) * dpr - ox) / k, z: ((clientY - r.top) * dpr - oy) / k };
    };
  }

  bounds() { return { x0: this.x0, x1: this.x0 + this.w, z0: this.z0, z1: this.z0 + this.h }; }
}

function drawArrow(g: CanvasRenderingContext2D, x: number, y: number, ang: number, dpr: number) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(0, -9 * dpr); g.lineTo(7 * dpr, 7 * dpr); g.lineTo(0, 3.5 * dpr); g.lineTo(-7 * dpr, 7 * dpr); g.closePath();
  g.fillStyle = C.edge; g.strokeStyle = '#fff'; g.lineWidth = 2 * dpr;
  g.stroke(); g.fill();
  g.restore();
}

function drawMarker(g: CanvasRenderingContext2D, x: number, y: number, m: MapMarker, s: number, labels = false) {
  g.save();
  g.lineWidth = 1.6 * s;
  const glyph = (bg: string, fg: string, text: string, r = 7) => {
    g.beginPath(); g.arc(x, y, r * s, 0, Math.PI * 2);
    g.fillStyle = bg; g.fill(); g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = fg; g.font = `800 ${r * 1.25 * s}px "Be Vietnam Pro", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, x, y + 0.5 * s);
  };
  if (m.kind === 'poi') {
    const r = 5 * s;
    g.fillStyle = m.done ? C.red : '#fff'; g.strokeStyle = C.red;
    g.fillRect(x - r, y - r, r * 2, r * 2); g.strokeRect(x - r, y - r, r * 2, r * 2);
  } else if (m.kind === 'taxi') glyph(C.lantern, C.edge, 'T');
  else if (m.kind === 'bikes') glyph(C.jade, '#fff', 'X');
  else if (m.kind === 'mybike') glyph('#fff', C.jade, 'X', 6);
  else if (m.kind === 'player') { g.beginPath(); g.arc(x, y, 3.6 * s, 0, Math.PI * 2); g.fillStyle = C.player; g.fill(); g.strokeStyle = '#fff'; g.stroke(); }
  else if (m.kind === 'target') {
    const p = 1 + 0.25 * Math.sin(performance.now() / 200);
    g.beginPath(); g.arc(x, y, 8 * s * p, 0, Math.PI * 2); g.strokeStyle = C.lantern; g.lineWidth = 3 * s; g.stroke();
    g.beginPath(); g.arc(x, y, 3 * s, 0, Math.PI * 2); g.fillStyle = C.lantern; g.fill();
  }
  if (labels && m.label) {
    g.font = `600 ${11 * s}px "Be Vietnam Pro", sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.lineWidth = 3 * s; g.strokeStyle = 'rgba(251,251,246,.95)'; g.strokeText(m.label, x + 10 * s, y);
    g.fillStyle = C.edge; g.fillText(m.label, x + 10 * s, y);
  }
  g.restore();
}
