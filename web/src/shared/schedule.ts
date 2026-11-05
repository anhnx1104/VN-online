// Tính lịch sự kiện theo giờ địa phương của điểm đến (dùng chung client và server).
import type { SpectacleDef } from './pack';

const DAY = 86400_000;

/** Thời điểm (ms UTC) bắt đầu lần diễn gần nhất đã qua hoặc đang diễn, và lần kế tiếp. */
export function spectacleWindow(def: SpectacleDef, nowMs: number, utcOffsetMin: number) {
  const [hh, mm] = def.schedule.time.split(':').map(Number);
  const local = nowMs + utcOffsetMin * 60_000;
  const dayStartLocal = Math.floor(local / DAY) * DAY;
  let current: number | null = null;
  let next: number | null = null;
  for (let d = -1; d <= 8; d++) {
    const startLocal = dayStartLocal + d * DAY + (hh * 60 + mm) * 60_000;
    const weekday = new Date(startLocal).getUTCDay();
    if (!def.schedule.weekdays.includes(weekday)) continue;
    const startUtc = startLocal - utcOffsetMin * 60_000;
    const endUtc = startUtc + def.schedule.durationSec * 1000;
    if (startUtc <= nowMs && nowMs < endUtc) current = startUtc;
    if (startUtc > nowMs && next === null) next = startUtc;
  }
  return { current, next };
}

/** Giờ địa phương dạng {h, m, weekday} */
export function localParts(nowMs: number, utcOffsetMin: number) {
  const d = new Date(nowMs + utcOffsetMin * 60_000);
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(), weekday: d.getUTCDay(), date: d };
}

export function fmtClock(nowMs: number, utcOffsetMin: number) {
  const p = localParts(nowMs, utcOffsetMin);
  return `${String(p.h).padStart(2, '0')}:${String(p.m).padStart(2, '0')}`;
}

export function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} ngày ${h} giờ`;
  if (h > 0) return `${h} giờ ${m} phút`;
  if (m >= 10) return `${m} phút`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
