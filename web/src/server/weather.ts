// Thời tiết thật từ Open-Meteo (miễn phí, không cần khóa), cache 15 phút cho mỗi điểm đến.
import type { WeatherNow } from '../shared/protocol';

const cache = new Map<string, WeatherNow>();
const TTL = 15 * 60_000;

function classify(code: number): { kind: WeatherNow['kind']; label: string } {
  if (code === 0) return { kind: 'clear', label: 'Trời quang' };
  if (code <= 2) return { kind: 'clear', label: 'Ít mây' };
  if (code === 3) return { kind: 'cloudy', label: 'Nhiều mây' };
  if (code === 45 || code === 48) return { kind: 'fog', label: 'Sương mù' };
  if (code >= 51 && code <= 57) return { kind: 'rain', label: 'Mưa phùn' };
  if (code >= 61 && code <= 67) return { kind: 'rain', label: code >= 65 ? 'Mưa to' : 'Mưa' };
  if (code >= 80 && code <= 82) return { kind: 'rain', label: 'Mưa rào' };
  if (code >= 95) return { kind: 'storm', label: 'Mưa giông' };
  return { kind: 'cloudy', label: 'Nhiều mây' };
}

function fallback(): WeatherNow {
  return { tempC: 27, code: 1, kind: 'clear', cloud: 20, wind: 8, isDay: true, label: 'Ít mây', fetchedAt: Date.now(), live: false };
}

export async function getWeather(key: string, lat: number, lon: number): Promise<WeatherNow> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < TTL) return hit;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,is_day&timezone=auto`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j: any = await res.json();
    const c = j.current;
    const { kind, label } = classify(c.weather_code);
    const w: WeatherNow = {
      tempC: Math.round(c.temperature_2m), code: c.weather_code, kind, label,
      cloud: c.cloud_cover, wind: c.wind_speed_10m, isDay: c.is_day === 1, fetchedAt: Date.now(), live: true,
    };
    cache.set(key, w);
    return w;
  } catch {
    const w = hit ?? fallback();
    cache.set(key, { ...w, fetchedAt: Date.now() - TTL + 60_000 }); // thử lại sau 1 phút
    return w;
  }
}
