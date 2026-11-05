// Giao diện chung của Kit. Mỗi Kit nhận tham số từ cấu hình khu và không biết tên điểm đến.
import type * as THREE from 'three';
import type { Env } from '../engine/SkySystem';
import type { Quality } from '../engine/Renderer';
import type { ZoneDef } from '../../shared/pack';
import type { Reflections } from './reflections';

export interface KitCtx {
  scene: THREE.Scene;
  quality: Quality;
  zone: ZoneDef;
  reflect: Reflections;
}

export interface SpectacleState {
  fire: boolean;
  water: boolean;
  burst: boolean; // vừa bắt đầu một đợt
}

export interface KitInstance {
  id?: string;
  update?(dt: number, env: Env, camera: THREE.Camera): void;
  /** Kit nhận lệnh trình diễn (vd: phun lửa) */
  spectacle?(s: SpectacleState, dt: number): void;
  /** Điểm thu hút để NPC và camera hướng về */
  focus?: THREE.Vector3;
  /** Vị trí sương nước bắn tới người xem */
  sprayAt?(p: THREE.Vector3): number;
  /** API riêng của kit (vd: ổ khóa) để giao diện gọi */
  api?: unknown;
}

export type KitFactory = (ctx: KitCtx, params: any) => KitInstance;
