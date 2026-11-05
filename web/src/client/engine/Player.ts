// Điều khiển nhân vật của người chơi + camera ngôi thứ ba / thứ nhất.
import * as THREE from 'three';
import { Avatar, ANIM } from './Avatar';
import type { Input } from './Input';
import type { WalkMap } from './Walk';

/** Tốc độ di chuyển (m/s). Chỉnh ở đây. */
export const SPEED = { walk: 6, run: 11, auto: 6.5, bike: 14, bikeFast: 17, reverse: 3 };

export type Mode = 'walk' | 'bike' | 'pillion';

export class Player {
  pos = new THREE.Vector3();
  yaw = 0; // hướng nhân vật
  camYaw = 0;
  camPitch = 0.28;
  camDist = 7;
  firstPerson = false;
  speed = 0;
  /** Tự đi: điểm cần đi tới (do chỉ đường cung cấp). Bấm phím/cần gạt là hủy. */
  auto: THREE.Vector3 | null = null;
  onAutoCancel: (() => void) | null = null;
  mode: Mode = 'walk';
  /** Khi ngồi sau: trả về vị trí và hướng của xe người lái */
  private pillionOf: (() => { pos: THREE.Vector3; yaw: number } | null) | null = null;
  private lastLook = 0;
  private camPos = new THREE.Vector3();
  private lookAt = new THREE.Vector3();

  /** vehicleWalk: vùng đi được cho xe (vỉa hè + lòng đường) */
  constructor(public avatar: Avatar, private input: Input, private walk: WalkMap, public camera: THREE.PerspectiveCamera, private vehicleWalk: WalkMap = walk) {}

  mountBike(color: string) {
    this.mode = 'bike';
    this.speed = 0;
    this.auto = null;
    this.avatar.setVehicle(1, color);
    this.camDist = Math.max(this.camDist, 8);
  }

  startPillion(get: () => { pos: THREE.Vector3; yaw: number } | null) {
    this.mode = 'pillion';
    this.pillionOf = get;
    this.speed = 0;
    this.auto = null;
    this.avatar.setVehicle(2);
  }

  /** Lên lại chiếc xe đang dựng ở (x, y, z) */
  mountAt(x: number, y: number, z: number, yaw: number, color: string) {
    this.pos.set(x, y, z);
    this.yaw = yaw;
    this.mountBike(color);
  }

  /** Về chế độ đi bộ ở một điểm cho trước (khi không xuống xe tại chỗ được) */
  forceWalk(x: number, z: number) {
    this.mode = 'walk';
    this.pillionOf = null;
    this.speed = 0;
    this.avatar.setVehicle(0);
    this.place(x, z, this.yaw);
  }

  /** Xuống xe tại chỗ (hoặc lệch sang bên phải 1,2 m). false nếu chỗ đó không đi bộ được. */
  dismount(): boolean {
    // bước xuống bên phải xe trước (xe dựng ở chỗ cũ), không được thì bên trái
    const side = [[Math.cos(this.yaw) * -1.1, Math.sin(this.yaw) * 1.1], [Math.cos(this.yaw) * 1.1, Math.sin(this.yaw) * -1.1]];
    for (const [ox, oz] of side) {
      const h = this.walk.heightAt(this.pos.x + ox, this.pos.z + oz);
      if (h !== null && Math.abs(h - this.pos.y) < 1.2) {
        this.pos.set(this.pos.x + ox, h, this.pos.z + oz);
        this.mode = 'walk';
        this.pillionOf = null;
        this.speed = 0;
        this.avatar.setVehicle(0);
        return true;
      }
    }
    return false;
  }

  place(x: number, z: number, yaw: number) {
    const y = this.walk.heightAt(x, z) ?? 2;
    this.pos.set(x, y, z);
    this.yaw = yaw;
    this.camYaw = yaw + Math.PI;
    this.avatar.root.position.copy(this.pos);
    this.avatar.root.rotation.y = yaw;
    this.snapCamera();
  }

  toggleView() {
    this.firstPerson = !this.firstPerson;
    this.avatar.root.visible = !this.firstPerson;
  }

  update(dt: number) {
    const look = this.input.consumeLook();
    const sens = this.input.touch ? 0.006 : 0.005;
    this.camYaw -= look.x * sens;
    if (look.x || look.y) this.lastLook = performance.now();
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + look.y * sens, this.firstPerson ? -1.2 : -0.15, 1.25);
    this.camDist = THREE.MathUtils.clamp(this.camDist + look.zoom, 2.5, 22);
    if (this.input.keys.has('KeyQ')) this.camYaw += dt * 1.8;

    const ax = this.input.axis();
    if (this.mode !== 'walk') {
      if (this.mode === 'bike') this.drive(dt, ax);
      else this.ridePillion();
      this.followCamYaw(dt, 2.2);
      this.avatar.anim = ANIM.idle;
      this.avatar.root.position.copy(this.pos);
      this.avatar.root.rotation.y = this.yaw;
      this.avatar.update(dt);
      this.updateCamera(dt);
      return;
    }
    const moving = Math.hypot(ax.x, ax.y) > 0.08;
    if (moving && this.auto) { this.auto = null; this.onAutoCancel?.(); }
    let autoDir: { x: number; z: number } | null = null;
    if (!moving && this.auto) {
      const dx = this.auto.x - this.pos.x, dz = this.auto.z - this.pos.z;
      const dd = Math.hypot(dx, dz);
      if (dd > 0.4) autoDir = { x: dx / dd, z: dz / dd };
    }
    const target = moving ? (ax.run ? SPEED.run : SPEED.walk) : autoDir ? SPEED.auto : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 8);

    if (moving) {
      // hướng đi theo camera: camYaw là hướng từ nhân vật nhìn về camera
      const fwd = this.camYaw + Math.PI;
      const dirX = Math.sin(fwd) * ax.y + Math.sin(fwd - Math.PI / 2) * ax.x;
      const dirZ = Math.cos(fwd) * ax.y + Math.cos(fwd - Math.PI / 2) * ax.x;
      const want = Math.atan2(dirX, dirZ);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 12);
      const len = Math.hypot(dirX, dirZ) || 1;
      this.tryMove((dirX / len) * this.speed * dt, (dirZ / len) * this.speed * dt);
      if (this.avatar.emote === 'sit') this.avatar.stopEmote();
    } else if (autoDir) {
      const want = Math.atan2(autoDir.x, autoDir.z);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 6);
      this.tryMove(autoDir.x * this.speed * dt, autoDir.z * this.speed * dt);
      // camera từ từ xoay ra sau lưng
      let c = this.yaw + Math.PI - this.camYaw;
      c = Math.atan2(Math.sin(c), Math.cos(c));
      this.camYaw += c * Math.min(1, dt * 1.5);
      if (this.avatar.emote === 'sit') this.avatar.stopEmote();
    } else if (this.speed > 0.05) {
      this.tryMove(Math.sin(this.yaw) * this.speed * dt, Math.cos(this.yaw) * this.speed * dt);
    }

    this.avatar.anim = this.speed > (SPEED.walk + SPEED.run) / 2 ? ANIM.run : this.speed > 0.6 ? ANIM.walk : ANIM.idle;
    this.avatar.root.position.copy(this.pos);
    this.avatar.root.rotation.y = this.yaw;
    this.avatar.update(dt);
    this.updateCamera(dt);
  }

  private drive(dt: number, ax: { x: number; y: number; run: boolean }) {
    const max = ax.run ? SPEED.bikeFast : SPEED.bike;
    if (ax.y > 0.1) this.speed = Math.min(max, this.speed + ax.y * 6 * dt);
    else if (ax.y < -0.1) this.speed = Math.max(-SPEED.reverse, this.speed - (this.speed > 0.5 ? 12 : 3) * -ax.y * dt);
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 2.5 * dt);
    if (this.speed > max) this.speed -= 8 * dt;
    // rẽ: chỉ quay được khi xe đang chạy, càng nhanh quay càng mượt
    this.yaw -= ax.x * 1.7 * THREE.MathUtils.clamp(this.speed / 4, -1, 1) * dt;
    const dx = Math.sin(this.yaw) * this.speed * dt, dz = Math.cos(this.yaw) * this.speed * dt;
    const h = this.vehicleWalk.canStand(this.pos.x + dx, this.pos.z + dz, this.pos.y);
    if (h !== null) { this.pos.x += dx; this.pos.z += dz; this.pos.y = h; }
    else this.speed *= -0.25; // chạm lề thì bật nhẹ lại
  }

  private ridePillion() {
    const d = this.pillionOf?.();
    if (!d) return;
    this.yaw = d.yaw;
    this.pos.set(d.pos.x - Math.sin(d.yaw) * 0.48, d.pos.y, d.pos.z - Math.cos(d.yaw) * 0.48);
  }

  /** Camera tự xoay ra sau lưng khi đang đi xe (trừ lúc người dùng vừa xoay tay) */
  private followCamYaw(dt: number, rate: number) {
    if (performance.now() - this.lastLook < 1500) return;
    let c = this.yaw + Math.PI - this.camYaw;
    c = Math.atan2(Math.sin(c), Math.cos(c));
    this.camYaw += c * Math.min(1, dt * rate);
  }

  private tryMove(dx: number, dz: number) {
    const tryAt = (x: number, z: number) => this.walk.canStand(x, z, this.pos.y);
    let h = tryAt(this.pos.x + dx, this.pos.z + dz);
    if (h !== null) { this.pos.x += dx; this.pos.z += dz; }
    else if ((h = tryAt(this.pos.x + dx, this.pos.z)) !== null) { this.pos.x += dx; }
    else if ((h = tryAt(this.pos.x, this.pos.z + dz)) !== null) { this.pos.z += dz; }
    else { this.speed *= 0.5; return; }
    this.pos.y = h;
  }

  private desiredCamera(out: THREE.Vector3) {
    if (this.firstPerson) {
      out.set(this.pos.x, this.pos.y + 1.7, this.pos.z);
      this.lookAt.set(
        out.x - Math.sin(this.camYaw) * Math.cos(this.camPitch),
        out.y - Math.sin(this.camPitch),
        out.z - Math.cos(this.camYaw) * Math.cos(this.camPitch),
      );
      return;
    }
    const d = this.camDist;
    out.set(
      this.pos.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * d,
      this.pos.y + 1.6 + Math.sin(this.camPitch) * d,
      this.pos.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * d,
    );
    out.y = Math.max(out.y, 0.6);
    this.lookAt.set(this.pos.x, this.pos.y + 1.55, this.pos.z);
  }

  private snapCamera() {
    this.desiredCamera(this.camPos);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.lookAt);
  }

  private updateCamera(dt: number) {
    const want = new THREE.Vector3();
    this.desiredCamera(want);
    const k = this.firstPerson ? 1 : 1 - Math.exp(-dt * 14);
    this.camPos.lerp(want, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.lookAt);
  }
}
