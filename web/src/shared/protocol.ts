// Giao thức WebSocket giữa client và game server.
/** v: phương tiện (0 đi bộ, 1 lái xe máy, 2 ngồi sau, 3 trong taxi); w: id người cùng xe */
/** bk: xe máy đang dựng của người này [x, y, z, yaw] (rỗng nếu không có) */
export interface PlayerState { x: number; y: number; z: number; yaw: number; anim: number; v?: number; w?: string; bk?: number[] }

export type RideKind = 'pillion' | 'taxi';
export type RideAct = 'ask' | 'yes' | 'no' | 'off';
export interface PlayerInfo { id: string; name: string; color: string; hat: boolean; hair?: number }

export type ClientMsg =
  | { t: 'join'; dest: string; zone: string; name: string; color: string; hat: boolean; hair?: number; party?: string }
  | { t: 's'; s: PlayerState }
  | { t: 'chat'; text: string }
  | { t: 'emote'; e: string }
  | { t: 'ride'; to: string; kind: RideKind; act: RideAct; dest?: string; party?: string };

export type ServerMsg =
  | { t: 'welcome'; id: string; room: string; players: (PlayerInfo & { s: PlayerState })[]; time: number }
  | { t: 'join'; p: PlayerInfo & { s: PlayerState } }
  | { t: 'leave'; id: string }
  | { t: 'states'; d: [string, number, number, number, number, number, number, string, number[]][] }
  | { t: 'ride'; from: string; name: string; kind: RideKind; act: RideAct; dest?: string; party?: string }
  | { t: 'chat'; id: string; name: string; text: string; at: number }
  | { t: 'emote'; id: string; e: string }
  | { t: 'lock'; lock: LockRecord }
  | { t: 'sys'; text: string };

export interface LockRecord {
  id: string;
  dest: string;
  zone: string;
  slot: number;
  name: string;
  to: string;
  text: string;
  color: string;
  likes: number;
  at: number;
}

export interface WeatherNow {
  tempC: number;
  code: number;
  kind: 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm';
  cloud: number;
  wind: number;
  isDay: boolean;
  label: string;
  fetchedAt: number;
  live: boolean;
}

export const EMOTES = ['wave', 'heart', 'dance', 'sit', 'photo'] as const;
