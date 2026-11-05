// Hồ sơ khách và hộ chiếu, lưu trên trình duyệt (bản v1 chưa có tài khoản).
export interface Profile { name: string; color: string; hat: boolean; hair?: number; device: string }
export interface StampRecord { dest: string; id: string; at: number; with?: string[] }

const KEY = 'vno.profile.v1';
const STAMPS = 'vno.passport.v1';
const WAIT = 'vno.waitlist.v1';

function read<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function write(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* chế độ riêng tư */ }
}

export const SHIRTS = ['#C8102E', '#F2B705', '#1FA39A', '#3B6FD8', '#E87BA6', '#F4F4F0', '#2E3A2F'];

export function getProfile(): Profile | null {
  return read<Profile | null>(KEY, null);
}
export function saveProfile(p: Omit<Profile, 'device'>) {
  const old = getProfile();
  const device = old?.device ?? (crypto.randomUUID?.() ?? String(Math.random()).slice(2));
  write(KEY, { ...p, device });
}
export function deviceId() {
  return getProfile()?.device ?? '';
}

export function getStamps(): StampRecord[] { return read<StampRecord[]>(STAMPS, []); }
export function hasStamp(dest: string, id: string) { return getStamps().some((s) => s.dest === dest && s.id === id); }
export function addStamp(dest: string, id: string): boolean {
  if (hasStamp(dest, id)) return false;
  const all = getStamps();
  all.push({ dest, id, at: Date.now() });
  write(STAMPS, all);
  return true;
}

export function waitlisted(): string[] { return read<string[]>(WAIT, []); }
export function markWaitlisted(code: string) { write(WAIT, [...new Set([...waitlisted(), code])]); }
