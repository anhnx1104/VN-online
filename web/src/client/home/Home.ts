// Màn hình chính: bản đồ Việt Nam, ghim điểm đến (đang mở / sắp mở), giờ và thời tiết thật, đăng ký chờ.
import { geoMercator } from 'd3-geo';
import { h } from '../ui/dom';
import { MAP_W, MAP_H, MAP_SCALE, MAP_TRANSLATE, VN_PATH, NEIGHBOR_PATH } from './vn-map.generated';
import { getJSON, postJSON, serverNow } from '../api';
import { fmtClock, fmtCountdown, localParts, spectacleWindow } from '../../shared/schedule';
import { l, type Manifest, type RegistryEntry, type SpectacleDef, type ZoneDef } from '../../shared/pack';
import type { WeatherNow } from '../../shared/protocol';
import { deviceId, getProfile, markWaitlisted, waitlisted } from '../profile';
import { openBoarding } from '../ui/boarding';
import { navigate } from '../main';

type Dest = RegistryEntry & { online: number; waitlist: number; weather: WeatherNow };

const proj = geoMercator().scale(MAP_SCALE).translate(MAP_TRANSLATE);
const DAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

// Quần đảo Hoàng Sa, Trường Sa của Việt Nam (vị trí gần đúng, đủ để thể hiện trên bản đồ tổng quan)
const HOANG_SA: [number, number][] = [[111.6, 16.5], [111.75, 16.45], [112.0, 16.95], [112.3, 16.9], [112.2, 16.8], [112.55, 16.55], [112.73, 16.67], [111.5, 15.8], [112.1, 16.3]];
const TRUONG_SA: [number, number][] = [[114.33, 11.43], [114.28, 11.05], [114.4, 10.38], [114.53, 10.2], [113.85, 10.2], [114.8, 10.8], [115.25, 10.2], [114.08, 9.9], [112.9, 9.4], [113.2, 8.85], [114.2, 8.85], [111.92, 8.64], [114.9, 9.5], [115.5, 9.9], [116.0, 10.7], [113.7, 8.1]];

function pt(lon: number, lat: number) {
  const p = proj([lon, lat])!;
  return { x: p[0], y: p[1], px: (p[0] / MAP_W) * 100, py: (p[1] / MAP_H) * 100 };
}

function mapSvg() {
  const isl = (list: [number, number][]) => list.map(([lo, la]) => { const p = pt(lo, la); return `<circle class="map-island" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.7"/>`; }).join('');
  const hs = pt(112.1, 16.6), ts = pt(114.2, 9.9), sea = pt(112.0, 13.6);
  return `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="Bản đồ Việt Nam, gồm quần đảo Hoàng Sa và Trường Sa">
    <defs><radialGradient id="nb-fade" cx="45%" cy="50%" r="60%"><stop offset="55%" stop-color="#fff"/><stop offset="100%" stop-color="#000"/></radialGradient>
      <mask id="nb-mask"><rect x="0" y="0" width="${MAP_W}" height="${MAP_H}" fill="url(#nb-fade)"/></mask></defs>
    <path class="map-neighbor" mask="url(#nb-mask)" d="${NEIGHBOR_PATH}"/>
    <path class="map-land" d="${VN_PATH}"/>
    ${isl(HOANG_SA)}${isl(TRUONG_SA)}
    <text class="map-label" x="${hs.x + 10}" y="${hs.y - 14}">QĐ. Hoàng Sa</text>
    <text class="map-label" x="${ts.x - 40}" y="${ts.y + 34}">QĐ. Trường Sa</text>
    <text class="map-sea" x="${sea.x}" y="${sea.y}" text-anchor="middle">Biển Đông</text>
  </svg>`;
}

export function mountHome(root: HTMLElement) {
  let dests: Dest[] = [];
  let selected = 'danang';
  let spectacle: { def: SpectacleDef; zoneName: string } | null = null;
  const timers: number[] = [];

  const mapBox = h('div', { class: 'map-box', html: mapSvg() });
  const left = h('div', { class: 'home-left' });
  const page = h('main', { class: 'home' }, left, h('div', { class: 'map-wrap' }, mapBox));
  root.append(page);

  const brand = h('div', { class: 'brand', html: `<svg class="brand-mark" viewBox="0 0 30 36" aria-hidden="true"><rect x="1" y="1" width="28" height="34" rx="1.5" fill="#C8102E"/><path d="M15 9l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L15 21.4 10 24.2l1.2-5.6L7 14.8l5.6-.6z" fill="#F2B705"/></svg><span>Việt Nam Online<small>bản web thử nghiệm</small></span>` });
  const hero = h('section', { class: 'hero' });
  const live = h('div', { class: 'live', 'aria-live': 'polite' });
  const card = h('section', { class: 'dest-card stamp', 'aria-live': 'polite' });
  const foot = h('p', { class: 'home-foot' }, 'Thế giới 3D trong bản này được dựng mô phỏng, chưa phải dữ liệu quét từ địa điểm thật. Giờ, mặt trời, mặt trăng và thời tiết lấy theo thời gian thực.');
  left.append(brand, hero, live, card, foot);

  const fly = (d: Dest | RegistryEntry) => {
    openBoarding(d, () => navigate(`/d/${d.code}`), () => {});
  };

  function renderPins() {
    mapBox.querySelectorAll('.pin').forEach((p) => p.remove());
    for (const d of dests) {
      const p = pt(d.lon, d.lat);
      const pin = h('button', {
        class: `pin ${d.status} ${d.label} ${d.code === selected ? 'sel' : ''}`,
        style: `left:${p.px}%;top:${p.py}%`,
        'aria-label': `${d.name}, ${d.status === 'open' ? 'đang mở' : 'sắp mở'}`,
        'aria-pressed': String(d.code === selected),
      }, h('span', { class: 'pin-dot' }), h('span', { class: 'pin-name' }, d.name, d.status === 'open' && d.online ? h('span', { class: 'pin-live' }, ` ${d.online} người`) : null));
      pin.addEventListener('click', () => { selected = d.code; render(); });
      mapBox.append(pin);
    }
  }

  function heroCopy(d: Dest | undefined) {
    const open = dests.find((x) => x.status === 'open') ?? d;
    if (!open) return { title: 'Đi khắp Việt Nam từ một màn hình.', sub: '' };
    const now = serverNow();
    let title = `${open.name} đang chờ bạn.`;
    if (spectacle?.def.pitch) {
      const w = spectacleWindow(spectacle.def, now, open.utcOffsetMin);
      const time = spectacle.def.schedule.time.replace(':00', ' giờ');
      if (w.current) title = l(spectacle.def.pitch.live);
      else if (w.next) {
        const a = localParts(now, open.utcOffsetMin), b = localParts(w.next, open.utcOffsetMin);
        const sameDay = a.date.getUTCDate() === b.date.getUTCDate() && w.next - now < 86400_000;
        title = (sameDay ? l(spectacle.def.pitch.today) : l(spectacle.def.pitch.later)).replace('{time}', time).replace('{day}', DAYS[b.weekday]);
      }
    }
    const sub = `Đứng bên ${spectacle?.zoneName ?? open.name} cùng những người đang online. Giờ, nắng và mưa ở đây chạy theo ${open.name} thật.`;
    return { title, sub, open };
  }

  function render() {
    const d = dests.find((x) => x.code === selected);
    const { title, sub, open } = heroCopy(d);
    hero.replaceChildren(
      h('h1', {}, title),
      h('p', {}, sub),
      open ? h('div', { class: 'cta-row' },
        h('button', { class: 'btn btn-primary', onclick: () => fly(open) }, `Bay tới ${open.name}`),
        getProfile() ? h('span', { class: 'muted', style: 'color:var(--mist)' }, `Bạn sẽ xuất hiện với tên ${getProfile()!.name}`) : '',
      ) : '',
    );
    renderLive(open as Dest | undefined);
    renderCard(d);
    renderPins();
  }

  function renderLive(d: Dest | undefined) {
    if (!d) { live.replaceChildren(); return; }
    const now = serverNow();
    const facts: (HTMLElement | null)[] = [
      h('span', {}, h('b', {}, `${d.weather.tempC}°`), ` ${d.weather.label.toLowerCase()}`, d.weather.live ? null : h('span', { class: 'muted' }, ' (ước tính)')),
      h('span', {}, h('i', { class: 'dot-live', 'aria-hidden': 'true' }), d.online ? h('b', {}, `${d.online} người`) : 'Chưa có ai', d.online ? ' đang ở đó' : ', hãy là người đầu tiên'),
    ];
    if (spectacle) {
      const w = spectacleWindow(spectacle.def, now, d.utcOffsetMin);
      if (w.current) facts.push(h('span', {}, h('b', { style: 'color:var(--lantern)' }, 'Đang diễn ra')));
      else if (w.next) facts.push(h('span', { class: 'muted' }, `Phun lửa sau `, h('b', { style: 'color:var(--paper)' }, fmtCountdown(w.next - now))));
    }
    live.replaceChildren(
      h('div', { class: 'live-clock' }, fmtClock(now, d.utcOffsetMin), h('span', {}, `Giờ ${d.name} lúc này`)),
      h('div', { class: 'live-facts' }, ...facts),
    );
  }

  function renderCard(d: Dest | undefined) {
    if (!d || d.status === 'open') { card.style.display = 'none'; return; }
    card.style.display = '';
    const done = waitlisted().includes(d.code);
    const btn = h('button', { class: 'btn btn-ink', ...(done ? { disabled: true } : {}) }, done ? 'Bạn đã bình chọn' : 'Tôi muốn đi');
    const count = h('span', { class: 'count' }, d.waitlist ? `${d.waitlist} người muốn đi` : 'Chưa ai bình chọn');
    btn.addEventListener('click', async () => {
      btn.setAttribute('disabled', '');
      try {
        const r = await postJSON<{ count: number }>('/api/waitlist', { code: d.code, device: deviceId() });
        markWaitlisted(d.code);
        d.waitlist = r.count;
        btn.textContent = 'Bạn đã bình chọn';
        count.textContent = `${r.count} người muốn đi`;
      } catch (e) {
        btn.removeAttribute('disabled');
        count.textContent = (e as Error).message;
      }
    });
    card.replaceChildren(h('div', { class: 'stamp-in' },
      h('h2', {}, d.name), h('span', { class: 'code' }, d.airport),
      h('p', {}, d.tagline),
      h('p', {}, `Sắp mở. Điểm đến nhiều người bình chọn nhất sẽ được dựng tiếp theo.`),
      h('div', { class: 'actions' }, btn, count),
    ));
  }

  async function load() {
    try {
      const r = await getJSON<{ destinations: Dest[] }>('/api/destinations');
      dests = r.destinations;
    } catch {
      // vẫn hiện bản đồ từ registry tĩnh khi API lỗi
      const r = await getJSON<{ destinations: RegistryEntry[] }>('/destinations/registry.json');
      dests = r.destinations.map((d) => ({ ...d, online: 0, waitlist: 0, weather: { tempC: 0, code: 0, kind: 'clear', cloud: 0, wind: 0, isDay: true, label: '—', fetchedAt: 0, live: false } }));
    }
    if (!spectacle) {
      const open = dests.find((d) => d.status === 'open');
      if (open) {
        try {
          const m = await getJSON<Manifest>(`/destinations/${open.code}/manifest.json`);
          const zf = m.zones.find((z) => z.id === m.entryZone)?.file;
          const z = await getJSON<ZoneDef>(`/destinations/${open.code}/${zf}`);
          if (z.spectacles[0]) spectacle = { def: z.spectacles[0], zoneName: l(z.name) };
        } catch { /* không bắt buộc */ }
      }
    }
    render();
  }

  void load();
  timers.push(window.setInterval(load, 30_000));
  timers.push(window.setInterval(() => renderLive(dests.find((x) => x.status === 'open')), 1000));
  return () => timers.forEach(clearInterval);
}
