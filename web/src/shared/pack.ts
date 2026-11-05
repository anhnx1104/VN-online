// Kiểu dữ liệu của Gói điểm đến (Destination Pack). Engine và Kit chỉ đọc qua các kiểu này,
// không bao giờ biết tên điểm đến cụ thể.
export type L10n = { vi: string; en?: string };

export interface RegistryEntry {
  code: string;
  name: string;
  status: 'open' | 'soon';
  lat: number;
  lon: number;
  utcOffsetMin: number;
  airport: string;
  tagline: string;
  label: 'left' | 'right' | 'bottom';
}

export interface Manifest {
  code: string;
  version: string;
  name: L10n;
  location: { lat: number; lon: number; utcOffsetMin: number };
  entryZone: string;
  zones: ZoneEntry[];
}

/** Khu trong manifest: tọa độ thật để tính quãng đường taxi, cảnh hai bên đường khi tới nơi */
export interface ZoneEntry {
  id: string;
  name: L10n;
  file?: string;
  status: 'open' | 'soon';
  lat: number;
  lon: number;
  scenery?: 'city' | 'river' | 'coast' | 'mountain';
}

export interface WalkRect { x0: number; x1: number; z0: number; z1: number; h0: number; h1: number; axis?: 'x' | 'z' }
export interface Obstacle { x: number; z: number; r: number }
export interface KitUse { kit: string; params: any }

export interface SpectacleStep { type: string; start: number; end: number; every?: number; burst?: number }
export interface SpectacleDef {
  id: string;
  target: string;
  name: L10n;
  schedule: { weekdays: number[]; time: string; durationSec: number };
  sequence: SpectacleStep[];
  countdownMin: number;
  note?: L10n;
  pitch?: { live: L10n; today: L10n; later: L10n };
}

export interface StampDef {
  id: string;
  name: L10n;
  kind: 'arrive' | 'place' | 'spectacle' | 'sun' | 'weather';
  x?: number; z?: number; r?: number;
  spectacle?: string;
  altMin?: number; altMax?: number;
  weather?: string;
  rare?: boolean;
  icon?: string;
  /** dấu mặt trời: buổi sáng (bình minh) hay buổi chiều (hoàng hôn) */
  period?: 'morning' | 'evening';
}

export interface StoryDef { id: string; x: number; z: number; r: number; title: L10n; text: L10n }

export interface ZoneDef {
  id: string;
  name: L10n;
  social: { shardCapacity: number; comfortable: number; npcFillTo: number };
  spawn: { x: number; z: number; yaw: number };
  ground: { bankHeight: number; color: string; pavement: string };
  walk: WalkRect[];
  /** Vùng chỉ phương tiện đi được (lòng đường) */
  ride?: WalkRect[];
  /** Điểm đón taxi, bãi thuê xe máy */
  transport?: { taxi?: { x: number; z: number; yaw: number; carX?: number }; bikes?: { x: number; z: number; yaw: number } };
  obstacles: Obstacle[];
  kits: KitUse[];
  spectacles: SpectacleDef[];
  stamps: StampDef[];
  stories: StoryDef[];
  lockSlots?: { x0: number; x1: number; zRails: number[]; y: number; perMeter: number; rows: number };
}

export const l = (s: L10n | undefined, lang: string = 'vi') => (s ? (s as any)[lang] ?? s.vi : '');
