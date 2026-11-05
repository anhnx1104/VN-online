// Vùng đi được + vật cản. Dữ liệu lấy hoàn toàn từ cấu hình khu.
import type { Obstacle, WalkRect } from '../../shared/pack';

export class WalkMap {
  constructor(private rects: WalkRect[], private obstacles: Obstacle[]) {}

  heightAt(x: number, z: number): number | null {
    let best: number | null = null;
    for (const r of this.rects) {
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      let h = r.h0;
      if (r.h0 !== r.h1) {
        const t = r.axis === 'z' ? (z - r.z0) / (r.z1 - r.z0) : (x - r.x0) / (r.x1 - r.x0);
        h = r.h0 + (r.h1 - r.h0) * t;
      }
      if (best === null || h > best) best = h;
    }
    return best;
  }

  /** Đi được tới (x,z) từ độ cao hiện tại không (không cho "nhảy" lên/xuống bậc cao). */
  canStand(x: number, z: number, fromY: number): number | null {
    for (const o of this.obstacles) {
      const dx = x - o.x, dz = z - o.z;
      if (dx * dx + dz * dz < o.r * o.r) return null;
    }
    // ưu tiên mặt phẳng gần độ cao hiện tại nhất (cầu chồng lên bờ)
    let best: number | null = null;
    for (const r of this.rects) {
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      let h = r.h0;
      if (r.h0 !== r.h1) {
        const t = r.axis === 'z' ? (z - r.z0) / (r.z1 - r.z0) : (x - r.x0) / (r.x1 - r.x0);
        h = r.h0 + (r.h1 - r.h0) * t;
      }
      if (Math.abs(h - fromY) > 0.9) continue;
      if (best === null || Math.abs(h - fromY) < Math.abs(best - fromY)) best = h;
    }
    return best;
  }

  /** Lấy một điểm đi được ngẫu nhiên gần (cx, cz) */
  randomPoint(cx: number, cz: number, radius: number, rnd = Math.random): { x: number; z: number; y: number } | null {
    for (let i = 0; i < 20; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * radius;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const y = this.heightAt(x, z);
      if (y !== null && y < 3) return { x, z, y };
    }
    return null;
  }
}
