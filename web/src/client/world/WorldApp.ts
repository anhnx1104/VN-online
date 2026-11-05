// Ghép Engine + Kit + Gói điểm đến thành một khu chơi được.
// Không có tên điểm đến nào trong file này: mọi nội dung đến từ manifest và cấu hình khu.
import * as THREE from 'three';
import { getJSON, postJSON, serverNow } from '../api';
import { l, type Manifest, type RegistryEntry, type SpectacleDef, type StampDef, type ZoneDef, type ZoneEntry } from '../../shared/pack';
import type { LockRecord, ServerMsg, WeatherNow, PlayerInfo } from '../../shared/protocol';
import { fmtClock, fmtCountdown, localParts, spectacleWindow } from '../../shared/schedule';
import { Renderer, type Quality } from '../engine/Renderer';
import { InstanceCuller } from '../engine/Culler';
import { configureMaterials } from '../engine/Materials';
import { SkySystem } from '../engine/SkySystem';
import { WalkMap } from '../engine/Walk';
import { Input } from '../engine/Input';
import { Avatar } from '../engine/Avatar';
import { Player } from '../engine/Player';
import { Net } from '../engine/Net';
import { Crowd } from '../engine/Npc';
import { Guide } from '../engine/Nav';
import { startRide } from './RideScene';
import { makeScooter } from '../engine/vehicles';
import { ZoneMap, type MapMarker } from '../ui/Minimap';
import { Rain } from '../engine/Rain';
import { Ambience } from '../engine/Audio';
import { KITS } from '../kits';
import { Reflections } from '../kits/reflections';
import type { KitInstance, SpectacleState } from '../kits/types';
import type { LockApi } from '../kits/lockPier';
import { h, ICONS, stampArt } from '../ui/dom';
import { openBoarding } from '../ui/boarding';
import { composePostcard } from '../ui/postcard';
import { addStamp, getProfile, getStamps, hasStamp, type Profile } from '../profile';
import { navigate } from '../main';

const LOCK_COLORS = ['#C8102E', '#F2B705', '#1FA39A', '#E87BA6', '#C0C4CC', '#3B6FD8'];
const EMOTE_KEYS: Record<string, [string, string]> = { Digit1: ['wave', '👋'], Digit2: ['heart', '❤️'], Digit3: ['dance', '💃'], Digit4: ['sit', '🪑'], Digit5: ['photo', '📸'] };

/** Quãng đường đường bộ ước tính giữa hai khu (đường chim bay × 1,35) */
function roadKm(a: ZoneEntry, b: ZoneEntry) {
  const toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x)) * 1.35;
}
/** Thời lượng cảnh đi taxi (giây): tài liệu 01 – 4.3d gợi ý 30–60 giây; rút ngắn cho quãng gần */
const rideSeconds = (km: number) => Math.round(Math.min(45, Math.max(18, 14 + km * 5)));
/** Thời gian đi thật trong phố (phút), tốc độ trung bình 25 km/h + 3 phút chờ xe */
const realMinutes = (km: number) => Math.round((km / 25) * 60 + 3);
const fmtKm = (km: number) => km.toFixed(km < 10 ? 1 : 0).replace('.', ',');

export async function mountWorld(root: HTMLElement, code: string): Promise<() => void> {
  const wrap = h('div', { class: 'world' });
  const loading = h('div', { class: 'loading' }, h('div', { class: 'loading-in' }, h('b', {}, 'Đang hạ cánh…'), 'Chuẩn bị bầu trời theo giờ thật', h('div', { class: 'loading-bar' }, h('i'))));
  wrap.append(loading);
  root.append(wrap);

  const fail = (msg: string) => {
    loading.replaceChildren(h('div', { class: 'loading-in error-box' }, h('b', {}, 'Chưa vào được khu này'), h('p', {}, msg), h('button', { class: 'btn btn-primary', onclick: () => navigate('/') }, 'Về bản đồ')));
    return () => wrap.remove();
  };

  // ---------- Dữ liệu ----------
  let manifest: Manifest, zone: ZoneDef, reg: RegistryEntry | undefined;
  try {
    manifest = await getJSON<Manifest>(`/destinations/${code}/manifest.json`);
    const want = new URLSearchParams(location.search).get('khu');
    const entry = manifest.zones.find((z) => z.id === want && z.status === 'open' && z.file) ?? manifest.zones.find((z) => z.id === manifest.entryZone)!;
    zone = await getJSON<ZoneDef>(`/destinations/${code}/${entry.file}`);
    reg = (await getJSON<{ destinations: RegistryEntry[] }>('/destinations/registry.json')).destinations.find((d) => d.code === code);
  } catch {
    return fail('Không tải được dữ liệu điểm đến. Kiểm tra kết nối mạng rồi thử lại.');
  }
  const destName = l(manifest.name);
  const off = manifest.location.utcOffsetMin;

  // Hồ sơ: vào thẳng bằng link thì cần lên máy bay trước
  let profile = getProfile();
  if (!profile) {
    profile = await new Promise<Profile>((res) =>
      openBoarding({ code, name: destName, airport: reg?.airport ?? '✈', utcOffsetMin: off }, res, () => navigate('/')),
    );
  }

  const params = new URLSearchParams(location.search);
  // Giờ tự chọn → phòng riêng, không nhận dấu hiếm (giữ giá trị của việc có mặt đúng giờ thật)
  const customTime = params.get('gio');
  let clockShift = 0;
  if (customTime && /^\d{1,2}:\d{2}$/.test(customTime)) {
    const [hh, mm] = customTime.split(':').map(Number);
    const p = localParts(serverNow(), off);
    clockShift = ((hh - p.h) * 60 + (mm - p.m)) * 60_000 - p.s * 1000;
  }
  const isPrivate = clockShift !== 0 || params.has('gio');
  const worldNow = () => serverNow() + clockShift;

  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));

  // ---------- Engine ----------
  const scene = new THREE.Scene();
  let R: Renderer;
  try {
    R = new Renderer(wrap, scene);
  } catch {
    return fail('Trình duyệt hoặc máy này chưa hỗ trợ WebGL. Hãy thử Chrome, Edge hoặc Safari bản mới.');
  }
  R.renderer.domElement.setAttribute('aria-label', `Thế giới 3D: ${l(zone.name)}`);

  // Tới bằng taxi: phát cảnh ngồi trong xe trong lúc dựng khu (che thời gian tải)
  const byTaxi = params.get('den') === 'taxi';
  const fromZone = manifest.zones.find((z) => z.id === params.get('tu'));
  const hereZone = manifest.zones.find((z) => z.id === zone.id)!;
  let ride: ReturnType<typeof startRide> | null = null;
  let rideWeather: WeatherNow | null = null;
  if (byTaxi && fromZone) {
    getJSON<WeatherNow>(`/api/weather/${code}`).then((w) => (rideWeather = w)).catch(() => {});
    let companions: { name: string; color: string; hat: boolean }[] = [];
    try { companions = JSON.parse(params.get('cung') ?? '[]').slice(0, 3); } catch { /* */ }
    const km = roadKm(fromZone, hereZone);
    ride = startRide(R.renderer, R.camera, {
      lat: manifest.location.lat, lon: manifest.location.lon, now: worldNow, weather: () => rideWeather,
      toName: l(zone.name), km, seconds: rideSeconds(km), scenery: hereZone.scenery ?? 'city', companions, host: wrap,
    });
    loading.classList.add('done');
    await new Promise((r) => setTimeout(r, 900)); // để cảnh taxi chạy mượt trước khi dựng khu
  }
  configureMaterials(R.renderer, R.quality === 'low');
  const sky = new SkySystem(scene, R.renderer, manifest.location.lat, manifest.location.lon, R.quality === 'high');
  const reflect = new Reflections();
  const kits: KitInstance[] = [];
  for (const k of zone.kits) {
    const f = KITS[k.kit];
    if (!f) { console.warn('[vno] thiếu kit', k.kit); continue; }
    kits.push(f({ scene, quality: R.quality, zone, reflect }, k.params));
  }
  reflect.build(scene);
  const culler = new InstanceCuller();
  culler.collect(scene);
  const lockKit = kits.find((k) => k.api && (k.api as LockApi).slotPos)?.api as LockApi | undefined;
  const riverKit = zone.kits.find((k) => k.kit === 'river')?.params;
  const oceanKit = zone.kits.find((k) => k.kit === 'ocean')?.params;

  const hud = h('div', { class: 'hud' });
  if (ride) hud.style.visibility = 'hidden'; // đang ngồi taxi: chưa hiện giao diện khu mới
  wrap.append(hud);
  const walk = new WalkMap(zone.walk, zone.obstacles);
  const input = new Input(R.renderer.domElement, hud);
  const me = new Avatar(profile.device || 'me', profile.name, profile.color, profile.hat, true, profile.hair);
  scene.add(me.root);
  const vehicleWalk = new WalkMap([...zone.walk, ...(zone.ride ?? [])], zone.obstacles);
  const player = new Player(me, input, walk, R.camera, vehicleWalk);
  const at = params.get('at')?.split(',').map(Number);
  if (at && at.length >= 2 && at.every(Number.isFinite) && walk.heightAt(at[0], at[1]) !== null) player.place(at[0], at[1], at[2] ?? zone.spawn.yaw);
  else if (byTaxi && zone.transport?.taxi) {
    const t = zone.transport.taxi;
    player.place(t.x, t.z + (Math.random() - 0.5) * 4, t.yaw);
  } else player.place(zone.spawn.x, zone.spawn.z, zone.spawn.yaw);

  const crowdAnchors = zone.stamps.filter((s) => s.kind === 'place').map((s) => ({ x: s.x!, z: s.z! }));
  crowdAnchors.push({ x: zone.spawn.x, z: zone.spawn.z });
  const crowd = new Crowd(scene, walk, crowdAnchors);
  const guide = new Guide(scene, walk, zone.walk);
  const rain = new Rain(scene);
  const audio = new Ambience();

  // ---------- HUD ----------
  const clockEl = h('div', { class: 'clock' });
  const weatherEl = h('div', {});
  const peopleEl = h('div', {});
  hud.append(h('div', { class: 'place panel' },
    h('div', { class: 'place-name' }, l(zone.name), h('small', {}, destName)),
    h('div', { class: 'place-meta' },
      h('div', {}, clockEl, h('span', {}, isPrivate ? 'giờ tự chọn' : 'giờ thật')),
      weatherEl, peopleEl,
    ),
    isPrivate ? h('span', { class: 'badge-private' }, 'Phòng riêng') : null,
  ));
  const eventEl = h('div', { class: 'event panel', role: 'status' });
  hud.append(eventEl);

  const tool = (icon: string, label: string, onclick: () => void, extra?: HTMLElement) =>
    h('button', { class: 'tool', 'aria-label': label, onclick, html: ICONS[icon] }, h('span', { class: 'tip' }, label), extra ?? null);
  const stampCount = h('span', { class: 'n' });
  const soundBtn = tool(audio.muted ? 'mute' : 'sound', audio.muted ? 'Bật âm thanh' : 'Tắt âm thanh', () => {
    audio.start();
    audio.setMuted(!audio.muted);
    soundBtn.innerHTML = ICONS[audio.muted ? 'mute' : 'sound'] + `<span class="tip">${audio.muted ? 'Bật âm thanh' : 'Tắt âm thanh'}</span>`;
    soundBtn.setAttribute('aria-label', audio.muted ? 'Bật âm thanh' : 'Tắt âm thanh');
  });
  hud.append(h('div', { class: 'tools' },
    tool('pin', 'Đi đâu (M)', () => openPlaces()),
    tool('passport', 'Hộ chiếu (H)', () => void openPassport(), stampCount),
    tool('camera', 'Chụp bưu thiếp (P)', () => void openPostcard()),
    lockKit ? tool('lock', 'Ổ khóa và lời nhắn', () => openLocks()) : null,
    tool('eye', 'Đổi góc nhìn (V)', () => player.toggleView()),
    soundBtn,
    tool('gear', 'Cài đặt', () => openSettings()),
    tool('map', 'Về bản đồ Việt Nam', () => navigate('/')),
  ));

  const promptEl = h('div', { class: 'prompt panel' });
  const storyEl = h('div', { class: 'story', role: 'region', 'aria-live': 'polite' });
  const noteEl = h('div', { class: 'note', role: 'note' });
  const sprayEl = h('div', { class: 'spray', 'aria-hidden': 'true' });
  const guideEl = h('div', { class: 'guide panel', role: 'status' });
  hud.append(sprayEl, promptEl, storyEl, noteEl, guideEl);

  const log = h('div', { class: 'chat-log', role: 'log', 'aria-live': 'polite' });
  const chatInput = h('input', { type: 'text', maxlength: 140, placeholder: isPrivate ? 'Phòng riêng: không có ai khác' : 'Nhắn với mọi người quanh đây (Enter)', 'aria-label': 'Tin nhắn', enterkeyhint: 'send' });
  const chatForm = h('form', { class: 'chat-form' }, chatInput);
  const emoteBar = h('div', { class: 'emotes' });
  for (const [, [e, glyph]] of Object.entries(EMOTE_KEYS)) {
    emoteBar.append(h('button', { type: 'button', 'aria-label': 'Biểu cảm ' + e, title: e, onclick: () => emote(e) }, glyph));
  }
  hud.append(h('div', { class: 'chat' }, log, emoteBar, chatForm));

  // Chặn: ẩn nhân vật, tin nhắn, biểu cảm của người đó (lưu theo phiên trình duyệt)
  const blocked = new Set<string>(JSON.parse(sessionStorage.getItem('vno.blocked') ?? '[]'));
  const block = (id: string, name: string) => {
    blocked.add(id);
    sessionStorage.setItem('vno.blocked', JSON.stringify([...blocked]));
    removeOther(id);
    toast(`Đã chặn ${name}. Bạn sẽ không thấy người này và tin nhắn của họ nữa.`, 4500);
  };
  const addLog = (who: string | null, text: string, id?: string) => {
    const nameEl = who && id && id !== net?.id
      ? h('button', { type: 'button', class: 'chat-name', title: `Chặn ${who}`, onclick: () => { if (confirm(`Chặn ${who}? Bạn sẽ không thấy người này nữa trong lần chơi này.`)) block(id, who); } }, who + ': ')
      : who ? h('b', {}, who + ': ') : null;
    const line = who ? h('div', {}, nameEl ?? '', text) : h('div', { class: 'sys' }, text);
    log.append(line);
    while (log.children.length > 60) log.firstChild?.remove();
    log.scrollTop = log.scrollHeight;
  };

  let toastTimer = 0;
  const toast = (text: string, ms = 3500) => {
    hud.querySelector('.toast')?.remove();
    const t = h('div', { class: 'toast', role: 'status' }, text);
    hud.append(t);
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => t.remove(), ms);
  };

  // ---------- Mạng ----------
  const party = params.get('party')?.slice(0, 16) || sessionStorage.getItem('vno.party') || Math.random().toString(36).slice(2, 10);
  try { sessionStorage.setItem('vno.party', party); } catch { /* */ }
  const others = new Map<string, Avatar>();
  const infos = new Map<string, PlayerInfo>();
  let net: Net | null = null;
  const addOther = (p: PlayerInfo & { s: { x: number; y: number; z: number; yaw: number; anim: number } }) => {
    if (others.has(p.id) || blocked.has(p.id)) return;
    const a = new Avatar(p.id, p.name, p.color, p.hat, true, p.hair);
    infos.set(p.id, { id: p.id, name: p.name, color: p.color, hat: p.hat, hair: p.hair });
    a.root.position.set(p.s.x, p.s.y, p.s.z);
    a.target.set(p.s.x, p.s.y, p.s.z);
    a.targetYaw = p.s.yaw;
    scene.add(a.root);
    others.set(p.id, a);
  };
  const removeOther = (id: string) => {
    const a = others.get(id);
    if (!a) return;
    scene.remove(a.root);
    a.dispose();
    others.delete(id);
    syncParked(id, undefined);
    if (id === rideWith) onPartnerGone(id);
  };
  if (!isPrivate) {
    net = new Net({ t: 'join', dest: code, zone: zone.id, name: profile.name, color: profile.color, hat: profile.hat, hair: profile.hair, party });
    net.onStatus = (ok) => { if (!ok) { for (const id of [...others.keys()]) removeOther(id); } };
    net.onMsg = (m: ServerMsg) => {
      switch (m.t) {
        case 'welcome': m.players.forEach(addOther); addLog(null, others.size ? `Có ${others.size} người khác đang ở đây. Gõ lời chào nhé.` : 'Bạn là người đầu tiên tới đây lúc này.'); break;
        case 'join': if (!blocked.has(m.p.id)) { addOther(m.p); addLog(null, `${m.p.name} vừa tới.`); } break;
        case 'leave': removeOther(m.id); break;
        case 'states':
          for (const [id, x, y, z, yaw, anim, v, w, bk] of m.d) {
            const a = others.get(id);
            if (!a) continue;
            syncParked(id, bk);
            a.target.set(x, y, z); a.targetYaw = yaw; a.anim = anim;
            a.setVehicle(v ?? 0, infos.get(id)?.color);
            a.partner = w ?? '';
          }
          break;
        case 'chat': {
          if (blocked.has(m.id)) break;
          const a = m.id === net!.id ? me : others.get(m.id);
          a?.say(m.text);
          addLog(m.name, m.text, m.id);
          break;
        }
        case 'emote': {
          const a = others.get(m.id);
          if (!a) break;
          if (m.e === 'horn') audio.horn(a.root.position.distanceTo(player.pos));
          else a.playEmote(m.e);
          break;
        }
        case 'lock': lockKit?.upsert(m.lock); lockCache = [...lockCache.filter((x) => x.id !== m.lock.id && x.slot !== m.lock.slot), m.lock]; break;
        case 'sys': addLog(null, m.text); break;
        case 'ride': onRideMsg(m); break;
      }
    };
    net.connect();
  } else {
    addLog(null, 'Bạn đang ở phòng riêng với giờ tự chọn. Chuyển về giờ thật trong Cài đặt để gặp mọi người.');
  }
  const from = params.get('from');
  if (from && at) setTimeout(() => toast(`Bạn đang đứng đúng chỗ ${from.slice(0, 20)} chụp bưu thiếp.`, 5000), 1200);

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) { chatInput.blur(); return; }
    if (net?.connected) net.send({ t: 'chat', text });
    else { me.say(text); addLog(profile!.name, text); }
    chatInput.value = '';
    chatInput.blur(); // gửi xong trả quyền điều khiển cho nhân vật
  });
  chatInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') chatInput.blur(); });
  chatInput.addEventListener('focus', () => (input.enabled = false));
  chatInput.addEventListener('blur', () => (input.enabled = !sheetOpen));

  function emote(e: string) {
    me.playEmote(e);
    net?.send({ t: 'emote', e });
  }

  // ---------- Thời tiết ----------
  let weather: WeatherNow | null = null;
  const loadWeather = async () => {
    try { weather = await getJSON<WeatherNow>(`/api/weather/${code}`); } catch { /* giữ giá trị cũ */ }
  };
  void loadWeather();

  // ---------- Ổ khóa ----------
  let lockCache: LockRecord[] = [];
  if (lockKit) {
    getJSON<{ locks: LockRecord[] }>(`/api/locks/${code}/${zone.id}`).then((r) => { lockCache = r.locks; lockKit.setLocks(r.locks); }).catch(() => {});
  }
  const liked = new Set<string>(JSON.parse(sessionStorage.getItem('vno.liked') ?? '[]'));
  const likeLock = async (id: string) => {
    if (liked.has(id)) return;
    liked.add(id);
    sessionStorage.setItem('vno.liked', JSON.stringify([...liked]));
    try {
      const r = await postJSON<{ lock: LockRecord }>(`/api/locks/${id}/like`, {});
      lockKit?.upsert(r.lock);
      lockCache = lockCache.map((x) => (x.id === id ? r.lock : x));
    } catch { /* */ }
  };

  // ---------- Sheet (hộ chiếu, ổ khóa, cài đặt, bưu thiếp) ----------
  let sheetOpen = false;
  let closeSheet: (() => void) | null = null;
  function openSheet(content: HTMLElement[], cls = '') {
    closeSheet?.();
    sheetOpen = true;
    input.enabled = false;
    input.keys.clear();
    const close = h('button', { class: 'close', 'aria-label': 'Đóng' }, '✕');
    const sheet = h('div', { class: 'sheet ' + cls, role: 'dialog', 'aria-modal': 'true' }, close, ...content);
    const bg = h('div', { class: 'sheet-bg' }, sheet);
    const done = () => { bg.remove(); sheetOpen = false; input.enabled = true; closeSheet = null; };
    close.addEventListener('click', done);
    bg.addEventListener('pointerdown', (e) => { if (e.target === bg) done(); });
    hud.append(bg);
    closeSheet = done;
    (sheet.querySelector('input, textarea, button:not(.close)') as HTMLElement | null)?.focus({ preventScroll: true });
    sheet.scrollTop = 0;
    return done;
  }

  const stampEl = (s: StampDef, got: { at: number } | undefined, action?: HTMLElement | null) => {
    const date = got ? new Date(got.at + off * 60_000) : null;
    const d = date ? `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${date.getUTCFullYear()}` : '';
    return h('div', { class: 'pstamp stamp' + (got ? '' : ' empty') },
      h('div', { class: 'stamp-in' },
        s.rare ? h('span', { class: 'rare' }, 'Hiếm') : null,
        h('div', { class: 'art', style: got ? `background:${s.rare ? '#12213d' : '#d7e0d3'}` : '', html: stampArt(s.icon ?? 'plane', got ? (s.rare ? '#F2B705' : '#C8102E') : '#a9b8cf') }),
        h('div', { class: 'nm' }, l(s.name)),
        h('div', { class: 'dt' }, got ? d : stampHint(s)),
        got ? h('div', { class: 'mark' }, destName.toUpperCase(), h('br'), d) : null,
        action ?? null,
      ));
  };
  function stampHint(s: StampDef) {
    if (s.kind === 'place') return 'Chưa tới';
    if (s.kind === 'spectacle') return 'Có mặt lúc sự kiện diễn ra (giờ thật)';
    if (s.kind === 'sun') return 'Có mặt lúc hoàng hôn thật';
    if (s.kind === 'weather') return 'Có mặt khi trời mưa thật';
    return '';
  }
  // ---------- Di chuyển: chỉ đường, đi nhanh, danh sách địa điểm ----------
  type Place = { id: string; name: string; x: number; z: number; icon: string };
  const placeOf = (s: StampDef): Place => ({ id: s.id, name: l(s.name), x: s.x!, z: s.z!, icon: s.icon ?? 'plane' });
  const places: Place[] = [
    { id: 'spawn', name: 'Điểm xuất phát', x: zone.spawn.x, z: zone.spawn.z, icon: 'plane' },
    ...zone.stamps.filter((s) => s.kind === 'place').map(placeOf),
    ...(zone.transport?.taxi ? [{ id: 'taxi', name: 'Điểm đón taxi', x: zone.transport.taxi.x, z: zone.transport.taxi.z, icon: 'taxi' }] : []),
    ...(zone.transport?.bikes ? [{ id: 'bikes', name: 'Bãi thuê xe máy', x: zone.transport.bikes.x, z: zone.transport.bikes.z, icon: 'bike' }] : []),
  ];
  const guideArrow = h('span', { class: 'guide-arrow', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24"><path d="M12 3l7 16-7-4-7 4z"/></svg>' });
  const guideName = h('b', {});
  const guideDist = h('span', { class: 'guide-dist' });
  const autoBtn = h('button', { type: 'button', class: 'auto-btn', 'aria-pressed': 'false' }, 'Tự đi');
  let autoOn = false;
  const setAuto = (on: boolean) => {
    autoOn = on;
    autoBtn.setAttribute('aria-pressed', String(on));
    autoBtn.textContent = on ? 'Đang tự đi' : 'Tự đi';
    if (!on) player.auto = null;
  };
  autoBtn.addEventListener('click', () => setAuto(!autoOn));
  player.onAutoCancel = () => setAuto(false);
  guideEl.append(guideArrow, h('div', {}, guideName, guideDist), autoBtn, h('button', { type: 'button', class: 'link-btn', onclick: () => stopGuide() }, 'Hủy'));
  function startGuide(p: Place) {
    closeSheet?.();
    if (!guide.route(player.pos, p)) { toast(`Chưa tìm được đường tới ${p.name} từ chỗ bạn đứng.`); return; }
    guideName.textContent = p.name;
    guideEl.classList.add('show');
    setAuto(false);
    toast(input.touch ? 'Đi theo các chấm vàng, hoặc bấm "Tự đi".' : 'Đi theo các chấm vàng, hoặc bấm "Tự đi" để nhân vật tự đi.');
  }
  function stopGuide() {
    guide.clear();
    guideEl.classList.remove('show');
    setAuto(false);
  }
  function travel(p: Place) {
    closeSheet?.();
    stopGuide();
    const veil = h('div', { class: 'veil' });
    hud.append(veil);
    setTimeout(() => {
      const yaw = Math.atan2(-p.x, -p.z); // nhìn về phía giữa khu
      player.place(p.x, p.z, yaw);
      veil.classList.add('out');
      setTimeout(() => veil.remove(), 500);
    }, 350);
  }
  const visited = (p: Place) => ['spawn', 'taxi', 'bikes'].includes(p.id) || hasStamp(code, p.id);
  function openPlaces() {
    const items = places.map((p) => {
      const d = Math.round(Math.hypot(p.x - player.pos.x, p.z - player.pos.z));
      const go = h('button', { type: 'button', class: 'btn btn-ink' }, 'Chỉ đường');
      go.addEventListener('click', () => startGuide(p));
      const fast = visited(p) ? h('button', { type: 'button', class: 'btn btn-ghost-ink' }, 'Đi nhanh') : null;
      fast?.addEventListener('click', () => travel(p));
      return h('li', { class: 'place-row' },
        h('span', { class: 'place-ic', html: stampArt(p.icon, visited(p) ? '#C8102E' : '#7d8aa3') }),
        h('div', { class: 'place-txt' }, h('b', {}, p.name), h('span', {}, `${d < 3 ? 'Bạn đang ở đây' : `cách ${d} m`}${visited(p) ? '' : ', chưa tới'}`)),
        d < 3 ? h('div', { class: 'place-act' }) : h('div', { class: 'place-act' }, go, fast ?? ''),
      );
    });
    const soonZones = manifest.zones.filter((z) => z.id !== zone.id);
    openSheet(([
      h('h2', {}, 'Đi đâu?'),
      h('p', { class: 'sub' }, 'Chọn "Chỉ đường" để theo chấm vàng trên mặt đất. Nơi đã có dấu thì đi nhanh được.'),
      h('ul', { class: 'place-list' }, ...items),
      soonZones.length ? h('h3', { class: 'sheet-h3' }, `Khu khác ở ${destName}`) : '',
      soonZones.length ? h('ul', { class: 'place-list' }, ...soonZones.map((z) => {
        const km = roadKm(hereZone, z);
        const taxiPlace = places.find((x) => x.id === 'taxi');
        const go = z.status === 'open' && taxiPlace
          ? h('button', { type: 'button', class: 'btn btn-ink', onclick: () => {
              if (Math.hypot(player.pos.x - taxiPlace.x, player.pos.z - taxiPlace.z) < 8) openTaxi();
              else { startGuide(taxiPlace); toast(`Ra điểm đón taxi để đi ${l(z.name)}.`); }
            } }, 'Đi taxi')
          : h('span', { class: 'soon-tag' }, 'Sắp mở');
        return h('li', { class: 'place-row' }, h('span', { class: 'place-ic', html: stampArt('taxi', z.status === 'open' ? '#2f9e6f' : '#9aa6bd') }),
          h('div', { class: 'place-txt' }, h('b', {}, l(z.name)), h('span', {}, `${fmtKm(km)} km`)), h('div', { class: 'place-act' }, go));
      })) : '',
      h('h3', { class: 'sheet-h3' }, 'Điểm đến khác'),
      h('p', { class: 'sub', style: 'margin-bottom:12px' }, 'Hội An, Huế, Hạ Long, Sa Pa… đang được dựng. Về bản đồ Việt Nam để xem và bình chọn nơi bạn muốn đi tiếp.'),
      h('button', { type: 'button', class: 'btn btn-red', onclick: () => navigate('/') }, 'Về bản đồ Việt Nam'),
    ] as (HTMLElement | string)[]).filter((x): x is HTMLElement => typeof x !== 'string'));
  }

  const zoneCache = new Map<string, ZoneDef>([[zone.id, zone]]);
  async function openPassport() {
    const openZones = manifest.zones.filter((z) => z.status === 'open' && z.file);
    await Promise.all(openZones.filter((z) => !zoneCache.has(z.id)).map(async (z) => {
      try { zoneCache.set(z.id, await getJSON<ZoneDef>(`/destinations/${code}/${z.file}`)); } catch { /* bỏ qua khu lỗi */ }
    }));
    const mine = getStamps().filter((s) => s.dest === code);
    const all = openZones.flatMap((z) => zoneCache.get(z.id)?.stamps ?? []);
    const got = all.filter((s) => mine.some((m) => m.id === s.id)).length;
    const sections = openZones.flatMap((zEntry) => {
      const zd = zoneCache.get(zEntry.id);
      if (!zd) return [];
      const here = zd.id === zone.id;
      return [
        h('h3', { class: 'sheet-h3 passport-zone' }, l(zd.name), here ? h('span', {}, 'Bạn đang ở đây') : ''),
        h('div', { class: 'passport-page' }, ...zd.stamps.map((s) => {
          const have = mine.find((m) => m.id === s.id);
          const act = here && s.kind === 'place'
            ? h('button', { type: 'button', class: 'go', onclick: () => (have ? travel(placeOf(s)) : startGuide(placeOf(s))) }, have ? 'Đi nhanh tới đây' : 'Chỉ đường')
            : null;
          return stampEl(s, have, act);
        })),
      ];
    });
    openSheet([
      h('h2', {}, `Hộ chiếu: ${destName}`),
      h('p', { class: 'sub' }, 'Dấu thường nhận khi tới nơi. Dấu hiếm chỉ có khi bạn có mặt đúng lúc ở giờ thật. Khu khác đi bằng taxi.'),
      h('div', { class: 'progress' }, h('span', {}, `${got}/${all.length} dấu`), h('div', { class: 'bar' }, h('i', { style: `width:${(got / Math.max(1, all.length)) * 100}%` }))),
      ...sections,
    ], 'passport');
  }

  function openLocks() {
    let color = LOCK_COLORS[0];
    const name = h('input', { type: 'text', id: 'lk-name', maxlength: 18, value: profile!.name });
    const to = h('input', { type: 'text', id: 'lk-to', maxlength: 24, placeholder: 'Ví dụ: Mẹ, Lan, nhóm bạn đại học' });
    const text = h('textarea', { id: 'lk-text', maxlength: 90, placeholder: 'Viết điều bạn muốn gửi lại ở đây…', required: true });
    const err = h('p', { class: 'hint', role: 'alert', style: 'color:var(--red);margin:0' });
    const sw = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Màu ổ khóa' });
    LOCK_COLORS.forEach((c) => {
      const b = h('button', { type: 'button', class: 'swatch', role: 'radio', 'aria-checked': String(c === color), 'aria-label': 'Màu ' + c, style: `background:${c}` });
      b.addEventListener('click', () => { color = c; sw.querySelectorAll('.swatch').forEach((x) => x.setAttribute('aria-checked', String(x === b))); });
      sw.append(b);
    });
    const submit = h('button', { type: 'submit', class: 'btn btn-red' }, 'Treo khóa');
    const form = h('form', { class: 'lock-form' },
      h('div', { class: 'two' },
        h('div', { class: 'field' }, h('label', { for: 'lk-name' }, 'Ký tên'), name),
        h('div', { class: 'field' }, h('label', { for: 'lk-to' }, 'Gửi tới (không bắt buộc)'), to)),
      h('div', { class: 'field' }, h('label', { for: 'lk-text' }, 'Lời nhắn, ai đi ngang cũng đọc được'), text),
      h('div', { class: 'field' }, h('label', {}, 'Màu ổ khóa'), sw),
      err,
      h('div', { class: 'actions', style: 'margin-top:0' }, submit),
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!text.value.trim()) { err.textContent = 'Viết một lời nhắn trước khi treo khóa.'; text.focus(); return; }
      submit.setAttribute('disabled', '');
      try {
        const r = await postJSON<{ lock: LockRecord }>(`/api/locks/${code}/${zone.id}`, { name: name.value, to: to.value, text: text.value, color });
        lockKit?.upsert(r.lock);
        lockCache = [...lockCache.filter((x) => x.slot !== r.lock.slot), r.lock];
        closeSheet?.();
        lockKit?.highlight(r.lock.id);
        setTimeout(() => lockKit?.highlight(null), 9000);
        toast('Đã treo khóa. Ổ khóa của bạn đang sáng trên lan can.', 5000);
        markDone('lock');
      } catch (ex) {
        err.textContent = (ex as Error).message;
        submit.removeAttribute('disabled');
      }
    });
    const recent = [...lockCache].sort((a, b) => b.at - a.at).slice(0, 24);
    const list = h('div', { class: 'lock-list' }, ...recent.map((lk) => {
      const btn = h('button', { type: 'button', 'aria-pressed': String(liked.has(lk.id)) }, `♥ ${lk.likes}`);
      btn.addEventListener('click', async () => { await likeLock(lk.id); btn.textContent = `♥ ${(lockCache.find((x) => x.id === lk.id)?.likes ?? lk.likes)}`; });
      return h('div', { class: 'lock-item' },
        lk.to ? h('div', { class: 'meta' }, `Gửi ${lk.to}`) : null,
        h('div', { class: 'msg' }, lk.text),
        h('div', { class: 'meta' }, h('span', {}, h('i', { class: 'color-dot', style: `background:${lk.color}` }), lk.name), btn));
    }));
    openSheet([
      h('h2', {}, 'Treo một ổ khóa'),
      h('p', { class: 'sub' }, `Ổ khóa ở lại trên lan can. Lần sau quay lại, bạn và người khác vẫn đọc được. Đang có ${lockCache.length} ổ khóa.`),
      form,
      recent.length ? h('h3', { style: 'margin:26px 0 0;font-size:1.1rem' }, 'Lời nhắn gần đây') : null,
      recent.length ? list : null,
    ].filter(Boolean) as HTMLElement[]);
  }

  function openSettings() {
    const seg = (opts: [string, string][], cur: string, on: (v: string) => void) => {
      const s = h('div', { class: 'seg', role: 'group' });
      opts.forEach(([v, label]) => {
        const b = h('button', { type: 'button', 'aria-pressed': String(v === cur) }, label);
        b.addEventListener('click', () => { s.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); on(v); });
        s.append(b);
      });
      return s;
    };
    const time = h('input', { type: 'time', value: customTime ?? '21:00', 'aria-label': 'Giờ tự chọn' });
    const applyTime = h('button', { class: 'btn btn-ink', type: 'button' }, 'Vào phòng riêng với giờ này');
    applyTime.addEventListener('click', () => { location.href = `/d/${code}?gio=${time.value}`; });
    openSheet([
      h('h2', {}, 'Cài đặt'),
      h('p', { class: 'sub' }, `FPS hiện tại: ${Math.round(R.fps)}`),
      h('div', { class: 'settings' },
        h('div', {}, h('div', { class: 'field' }, h('label', {}, 'Chất lượng đồ họa')),
          seg([['low', 'Thấp'], ['medium', 'Vừa'], ['high', 'Cao']], R.quality, (v) => R.setQuality(v as Quality)),
          h('p', { class: 'hint' }, 'Máy nóng hoặc giật thì chọn Thấp. Bóng đổ thay đổi sau khi tải lại trang.')),
        h('div', {}, h('div', { class: 'field' }, h('label', {}, 'Giờ trong thế giới')),
          isPrivate
            ? h('button', { class: 'btn btn-ink', type: 'button', onclick: () => (location.href = `/d/${code}`) }, 'Về giờ thật và gặp mọi người')
            : h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' }, time, applyTime),
          h('p', { class: 'hint' }, 'Giờ tự chọn chạy trong phòng riêng, không gặp người khác và không nhận dấu hiếm.')),
        h('div', {}, h('div', { class: 'field' }, h('label', {}, 'Phím tắt')),
          h('div', { class: 'keys', html: `<kbd>W A S D</kbd><span>Đi lại (giữ Shift để chạy)</span><kbd>Kéo chuột</kbd><span>Xoay góc nhìn, cuộn để phóng to</span><kbd>E</kbd><span>Tương tác (treo khóa, đọc lời nhắn)</span><kbd>1–5</kbd><span>Vẫy tay, thả tim, nhảy, ngồi, chụp ảnh</span><kbd>Enter</kbd><span>Trò chuyện</span><kbd>P</kbd><span>Chụp bưu thiếp</span><kbd>H</kbd><span>Hộ chiếu</span><kbd>M</kbd><span>Đi đâu: chỉ đường, đi nhanh</span><kbd>V</kbd><span>Góc nhìn thứ nhất / thứ ba</span>` })),
      ),
    ]);
  }

  async function openPostcard() {
    const hidden = hud.style.visibility;
    me.root.visible = true;
    hud.style.visibility = 'hidden';
    const shot = R.capture(2);
    markDone('postcard');
    hud.style.visibility = hidden;
    if (player.firstPerson) me.root.visible = false;
    const now = worldNow();
    const lp = localParts(now, off);
    const date = `${String(lp.date.getUTCDate()).padStart(2, '0')}.${String(lp.date.getUTCMonth() + 1).padStart(2, '0')}.${lp.date.getUTCFullYear()}`;
    const noteInput = h('input', { type: 'text', maxlength: 46, placeholder: `Gửi từ ${l(zone.name)}`, 'aria-label': 'Dòng chữ trên bưu thiếp' });
    const img = h('img', { class: 'postcard-preview', alt: 'Xem trước bưu thiếp' });
    let card: HTMLCanvasElement;
    const redraw = async () => {
      card = await composePostcard({ shot, place: l(zone.name), city: destName, clock: fmtClock(now, off), date, weather: weather ? `${weather.tempC}°C ${weather.label.toLowerCase()}` : '', name: profile!.name, note: noteInput.value.trim() });
      img.src = card.toDataURL('image/jpeg', 0.9);
    };
    await redraw();
    let t = 0;
    noteInput.addEventListener('input', () => { clearTimeout(t); t = window.setTimeout(redraw, 250); });
    const link = `${location.origin}/d/${code}?khu=${zone.id}&at=${player.pos.x.toFixed(1)},${player.pos.z.toFixed(1)},${player.yaw.toFixed(2)}&from=${encodeURIComponent(profile!.name)}&party=${party}`;
    const download = h('button', { class: 'btn btn-red', type: 'button' }, 'Tải ảnh về');
    download.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = card.toDataURL('image/jpeg', 0.92);
      a.download = `buu-thiep-${code}-${date}.jpg`;
      a.click();
    });
    const share = h('button', { class: 'btn btn-ink', type: 'button' }, 'Gửi lời mời tới chỗ này');
    share.addEventListener('click', async () => {
      const text = `${noteInput.value.trim() || 'Ra đây với mình'}: ${l(zone.name)}, ${destName}`;
      try {
        const blob: Blob = await new Promise((r) => card.toBlob((b) => r(b!), 'image/jpeg', 0.9));
        const file = new File([blob], 'buu-thiep.jpg', { type: 'image/jpeg' });
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text, url: link }); return; }
        if (navigator.share) { await navigator.share({ text, url: link }); return; }
      } catch { /* người dùng hủy */ return; }
      await navigator.clipboard?.writeText(link);
      share.textContent = 'Đã chép link mời';
    });
    openSheet([
      h('h2', {}, 'Bưu thiếp'),
      h('p', { class: 'sub' }, 'Người mở link sẽ xuất hiện đúng chỗ bạn đứng chụp, cùng phòng với bạn.'),
      img,
      h('div', { class: 'field', style: 'margin-top:16px' }, h('label', {}, 'Dòng chữ viết tay'), noteInput),
      h('div', { class: 'actions' }, download, share),
    ]);
  }

  // ---------- Phương tiện: xe máy, đi nhờ, taxi ----------
  let rideWith: string | null = null; // người cùng xe máy (người lái hoặc người ngồi sau)
  let pendingPillion: string | null = null;
  let taxiWait: ((id: string, yes: boolean) => void) | null = null;
  const nameOf = (id: string) => infos.get(id)?.name ?? 'Bạn đồng hành';
  const zoneName = (id?: string) => { const z = manifest.zones.find((x) => x.id === id); return z ? l(z.name) : 'nơi khác'; };
  const inviteBox = h('div', { class: 'invite-box' });
  hud.append(inviteBox);

  /** Thẻ hỏi nhanh (không chặn việc lái xe). Hết giờ thì coi như chọn nút cuối. */
  function ask(text: string, actions: [string, () => void, string?][], ttl = 12000) {
    let closed = false;
    const el = h('div', { class: 'invite panel', role: 'alertdialog' }, h('p', {}, text));
    const close = () => { if (!closed) { closed = true; el.remove(); } };
    const row = h('div', { class: 'invite-act' });
    for (const [label, fn, cls] of actions) row.append(h('button', { type: 'button', class: 'btn ' + (cls ?? 'btn-ghost'), onclick: () => { if (!closed) { close(); fn(); } } }, label));
    el.append(row);
    inviteBox.append(el);
    if (ttl) setTimeout(() => { if (!closed) { close(); actions[actions.length - 1][1](); } }, ttl);
    return close;
  }

  function depart(dest: string, companions: PlayerInfo[], partyCode: string) {
    stopGuide();
    removeMyBike(); // rời khu bằng taxi: xe thuê được trả lại bãi
    markDone('taxi');
    hud.append(h('div', { class: 'veil' }));
    const cung = encodeURIComponent(JSON.stringify(companions.map((c) => ({ name: c.name, color: c.color, hat: c.hat, hair: c.hair }))));
    setTimeout(() => navigate(`/d/${code}?khu=${dest}&den=taxi&tu=${zone.id}&party=${partyCode}&cung=${cung}`), 400);
  }

  function getOffBike(notify = true): boolean {
    if (player.mode === 'walk') return true;
    const partner = rideWith;
    if (player.mode === 'bike') {
      // dựng xe ngay tại chỗ, người bước xuống bên cạnh (đang ở lòng đường thì bước lên vỉa hè gần nhất)
      const { x, y, z } = player.pos, yaw = player.yaw;
      if (!player.dismount()) {
        const p = nearestWalk(x, z);
        if (!p) { toast('Chỗ này không xuống xe được, chạy thêm một đoạn nhé.'); return false; }
        player.forceWalk(p.x, p.z);
      }
      placeMyBike(x, y, z, yaw);
    } else if (!player.dismount()) {
      const p = nearestWalk(player.pos.x, player.pos.z);
      if (p) player.forceWalk(p.x, p.z); else player.forceWalk(zone.spawn.x, zone.spawn.z);
    }
    if (notify && partner) net?.send({ t: 'ride', to: partner, kind: 'pillion', act: 'off' });
    rideWith = null;
    return true;
  }

  // ---------- Xe máy của mình (đang dựng) và xe người khác ----------
  const bikeKey = `vno.bike.${code}.${zone.id}`;
  let myBike: { x: number; y: number; z: number; yaw: number; mesh: THREE.Group } | null = null;
  function placeMyBike(x: number, y: number, z: number, yaw: number) {
    if (myBike) scene.remove(myBike.mesh);
    const mesh = makeScooter(profile!.color);
    mesh.position.set(x, y, z);
    mesh.rotation.set(0, yaw, 0.08); // nghiêng nhẹ trên chân chống
    scene.add(mesh);
    myBike = { x, y, z, yaw, mesh };
    try { sessionStorage.setItem(bikeKey, JSON.stringify([x, y, z, yaw])); } catch { /* */ }
  }
  function removeMyBike() {
    if (myBike) { scene.remove(myBike.mesh); myBike = null; }
    try { sessionStorage.removeItem(bikeKey); } catch { /* */ }
  }
  function rideMyBike() {
    if (!myBike) return;
    const b = myBike;
    scene.remove(b.mesh);
    myBike = null;
    try { sessionStorage.removeItem(bikeKey); } catch { /* */ }
    stopGuide();
    player.mountAt(b.x, b.y, b.z, b.yaw, profile!.color);
  }
  function returnBike() {
    if (player.mode === 'bike' && !getOffBike()) return;
    removeMyBike();
    toast('Đã trả xe ở bãi.');
  }
  /** Điểm đi bộ được gần nhất (tìm theo vòng tròn nở dần) */
  function nearestWalk(x: number, z: number) {
    for (let r = 1; r <= 30; r += 1) for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const y = walk.heightAt(px, pz);
      if (y !== null && walk.canStand(px, pz, y) !== null) return { x: px, z: pz };
    }
    return null;
  }
  try {
    const b = JSON.parse(sessionStorage.getItem(bikeKey) ?? 'null');
    if (Array.isArray(b) && b.length === 4 && b.every(Number.isFinite)) placeMyBike(b[0], b[1], b[2], b[3]);
  } catch { /* */ }
  const parkedOthers = new Map<string, THREE.Group>();
  function syncParked(id: string, bk: number[] | undefined) {
    let m = parkedOthers.get(id);
    if (!bk || bk.length !== 4) { if (m) { scene.remove(m); parkedOthers.delete(id); } return; }
    if (!m) { m = makeScooter(infos.get(id)?.color ?? '#C8102E'); scene.add(m); parkedOthers.set(id, m); }
    m.position.set(bk[0], bk[1], bk[2]);
    m.rotation.set(0, bk[3], 0.08);
  }

  // ---------- Việc nên làm (đánh dấu đã xong) ----------
  const DONE_KEY = 'vno.done.v1';
  const doneSet = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(DONE_KEY) ?? '{}'); } catch { return {}; } };
  const markDone = (flag: string) => {
    const d = doneSet();
    const k = `${code}:${zone.id}:${flag}`;
    if (d[k]) return;
    d[k] = true;
    try { localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch { /* */ }
  };
  const isDone = (flag: string) => !!doneSet()[`${code}:${zone.id}:${flag}`];
  function todo() {
    const items: { label: string; done: boolean }[] = [];
    for (const st of zone.stamps.filter((x) => x.kind === 'place')) items.push({ label: `Ghé ${l(st.name)}`, done: hasStamp(code, st.id) });
    for (const sp of zone.spectacles) {
      const st = zone.stamps.find((x) => x.kind === 'spectacle' && x.spectacle === sp.id);
      items.push({ label: `Xem ${l(sp.name)} lúc ${sp.schedule.time} (giờ thật)`, done: st ? hasStamp(code, st.id) : false });
    }
    if (lockKit) items.push({ label: 'Treo một ổ khóa kèm lời nhắn', done: isDone('lock') });
    items.push({ label: 'Chụp một tấm bưu thiếp', done: isDone('postcard') });
    if (zone.transport?.bikes) items.push({ label: 'Thuê xe máy dạo một vòng', done: isDone('bike') });
    if (zone.transport?.taxi) items.push({ label: 'Đi taxi sang khu khác', done: isDone('taxi') });
    return items;
  }

  function onPartnerGone(id: string) {
    if (rideWith !== id) return;
    if (player.mode === 'pillion') { getOffBike(false); toast(`${nameOf(id)} đã rời đi, bạn đã xuống xe.`); }
    rideWith = null;
  }

  function onRideMsg(m: Extract<ServerMsg, { t: 'ride' }>) {
    if (blocked.has(m.from)) return;
    const reply = (kind: 'pillion' | 'taxi', act: 'yes' | 'no') => net?.send({ t: 'ride', to: m.from, kind, act });
    if (m.kind === 'pillion') {
      if (m.act === 'ask') {
        if (player.mode !== 'bike' || rideWith) { reply('pillion', 'no'); return; }
        ask(`${m.name} muốn ngồi sau xe bạn.`, [
          ['Cho đi nhờ', () => { if (player.mode !== 'bike' || rideWith) return reply('pillion', 'no'); rideWith = m.from; reply('pillion', 'yes'); toast(`${m.name} đã ngồi sau. Bấm E khi muốn dừng xe.`); }, 'btn-primary'],
          ['Từ chối', () => reply('pillion', 'no')],
        ]);
      } else if (m.act === 'yes') {
        if (player.mode !== 'walk' || pendingPillion !== m.from) return;
        pendingPillion = null;
        rideWith = m.from;
        stopGuide();
        player.startPillion(() => { const a = others.get(m.from); return a ? { pos: a.root.position, yaw: a.root.rotation.y } : null; });
        toast(`Đã ngồi sau xe ${m.name}. Bấm E để xuống.`);
      } else if (m.act === 'no') {
        if (pendingPillion === m.from) { pendingPillion = null; toast(`${m.name} chưa cho đi nhờ lúc này.`); }
      } else if (m.act === 'off' && rideWith === m.from) {
        if (player.mode === 'pillion') { getOffBike(false); toast(`${m.name} đã dừng xe, bạn xuống xe.`); }
        else { rideWith = null; toast(`${m.name} đã xuống xe.`); }
      }
    } else if (m.kind === 'taxi') {
      if (m.act === 'ask' && m.dest && m.party) {
        const dest = m.dest, partyCode = m.party;
        const go = () => { reply('taxi', 'yes'); const inv = infos.get(m.from); depart(dest, inv ? [inv] : [], partyCode); };
        if (rideWith === m.from) { toast(`${m.name} gọi taxi cho cả hai tới ${zoneName(dest)}.`); go(); return; }
        ask(`${m.name} rủ bạn đi taxi tới ${zoneName(dest)}.`, [['Đi cùng', go, 'btn-primary'], ['Không', () => reply('taxi', 'no')]], 15000);
      } else if (m.act === 'yes' || m.act === 'no') taxiWait?.(m.from, m.act === 'yes');
    }
  }

  function callTaxi(z: ZoneEntry, invite: string[]) {
    closeSheet?.();
    if (player.mode !== 'walk' && !getOffBike()) return;
    if (!invite.length || !net?.connected) { depart(z.id, [], party); return; }
    const accepted: PlayerInfo[] = [];
    const waiting = new Set(invite);
    for (const id of invite) net.send({ t: 'ride', to: id, kind: 'taxi', act: 'ask', dest: z.id, party });
    const status = h('p', {});
    const render = () => { status.textContent = `Taxi tới ${l(z.name)}. ` + (waiting.size ? `Đang chờ ${[...waiting].map(nameOf).join(', ')} trả lời…` : '') + (accepted.length ? ` ${accepted.map((a) => a.name).join(', ')} đi cùng.` : ''); };
    render();
    let gone = false;
    const el = h('div', { class: 'invite panel' }, status);
    const go = () => { if (gone) return; gone = true; taxiWait = null; el.remove(); depart(z.id, accepted, party); };
    el.append(h('div', { class: 'invite-act' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: go }, 'Đi luôn')));
    inviteBox.append(el);
    taxiWait = (id, yes) => {
      if (!waiting.delete(id)) return;
      if (yes) { const i = infos.get(id); if (i) accepted.push(i); }
      render();
      if (!waiting.size) setTimeout(go, 400);
    };
    setTimeout(go, 16000);
  }

  function openTaxi() {
    const nearby = [...others.entries()].filter(([id, a]) => a.root.visible && a.root.position.distanceTo(player.pos) < 14 && !blocked.has(id));
    const picks = new Set<string>(rideWith ? [rideWith] : []);
    const rows = manifest.zones.filter((z) => z.id !== zone.id).map((z) => {
      const km = roadKm(hereZone, z);
      const act = z.status === 'open'
        ? h('button', { type: 'button', class: 'btn btn-red', onclick: () => callTaxi(z, [...picks]) }, 'Lên xe')
        : h('span', { class: 'soon-tag' }, 'Sắp mở');
      return h('li', { class: 'place-row' },
        h('span', { class: 'place-ic', html: stampArt('taxi', z.status === 'open' ? '#2f9e6f' : '#9aa6bd') }),
        h('div', { class: 'place-txt' }, h('b', {}, l(z.name)), h('span', {}, `${fmtKm(km)} km, đi thật khoảng ${realMinutes(km)} phút`)),
        h('div', { class: 'place-act' }, act));
    });
    const friends = nearby.map(([id]) => {
      const cb = h('input', { type: 'checkbox', ...(picks.has(id) ? { checked: true } : {}) });
      cb.addEventListener('change', () => (cb.checked ? picks.add(id) : picks.delete(id)));
      return h('label', { class: 'toggle' }, cb, `Rủ ${nameOf(id)} đi cùng`);
    });
    openSheet(([
      h('h2', {}, 'Gọi taxi'),
      h('p', { class: 'sub' }, `Quãng đường tính theo vị trí thật ở ${destName}. Trên xe bạn ngắm phố qua cửa kính trong vài chục giây.`),
      friends.length ? h('h3', { class: 'sheet-h3', style: 'margin-top:0' }, 'Người quanh đây') : '',
      friends.length ? h('div', { class: 'taxi-friends' }, ...friends) : '',
      friends.length ? h('p', { class: 'sub', style: 'margin:6px 0 10px;font-size:.85rem' }, 'Người được rủ sẽ nhận lời mời; đồng ý thì lên cùng xe và tới nơi cùng phòng.') : '',
      h('ul', { class: 'place-list' }, ...rows),
    ] as (HTMLElement | string)[]).filter((x): x is HTMLElement => typeof x !== 'string'));
  }

  function rentBike() {
    stopGuide();
    removeMyBike(); // mỗi người giữ một xe: thuê xe mới thì xe cũ được trả
    player.mountBike(profile!.color);
    markDone('bike');
    toast(input.touch ? 'Kéo cần gạt để chạy và rẽ. Bấm "Xuống" để dựng xe tại chỗ, nút còi để bóp còi.' : 'Lái bằng W A S D, Shift chạy nhanh hơn, B bóp còi. Bấm E để dựng xe tại chỗ, lại gần bấm E để lên lại.', 7000);
  }

  // ---------- Bản đồ ----------
  const zmap = new ZoneMap(zone);
  const miniCv = h('canvas', { 'aria-hidden': 'true' });
  const miniBtn = h('button', { type: 'button', class: 'minimap', 'aria-label': 'Mở bản đồ khu (M)', onclick: () => openMap() }, miniCv);
  hud.append(miniBtn);
  const hornBtn = h('button', { type: 'button', class: 'horn-btn', 'aria-label': 'Bóp còi (B)', onclick: () => honk() }, 'Bíp');
  hud.append(hornBtn);
  let lastHonk = 0;
  function honk() {
    if (player.mode !== 'bike' || performance.now() - lastHonk < 700) return;
    lastHonk = performance.now();
    audio.start();
    audio.horn(0);
    net?.send({ t: 'emote', e: 'horn' });
  }
  function mapMarkers(withPlayers: boolean): MapMarker[] {
    const ms: MapMarker[] = [];
    for (const pl of places) {
      if (pl.id === 'spawn') continue;
      if (pl.id === 'taxi') ms.push({ x: pl.x, z: pl.z, kind: 'taxi', label: 'Taxi' });
      else if (pl.id === 'bikes') ms.push({ x: pl.x, z: pl.z, kind: 'bikes', label: 'Thuê xe máy' });
      else ms.push({ x: pl.x, z: pl.z, kind: 'poi', label: pl.name, done: hasStamp(code, pl.id) });
    }
    if (myBike) ms.push({ x: myBike.x, z: myBike.z, kind: 'mybike', label: 'Xe của bạn' });
    if (withPlayers) for (const [id, a] of others) if (a.root.visible) ms.push({ x: a.root.position.x, z: a.root.position.z, kind: 'player', label: nameOf(id) });
    if (guide.target) ms.push({ x: guide.target.x, z: guide.target.z, kind: 'target', label: guide.target.name });
    return ms;
  }
  function openMap() {
    const cv = h('canvas', { class: 'full-map', 'aria-label': 'Bản đồ khu. Chạm vào một điểm để được chỉ đường.' });
    const items = todo();
    const doneN = items.filter((x) => x.done).length;
    openSheet([
      h('h2', {}, `Bản đồ ${l(zone.name)}`),
      h('p', { class: 'sub' }, 'Chạm vào một địa điểm hoặc bất kỳ chỗ nào đi bộ được để được chỉ đường.'),
      h('div', { class: 'map-grid' },
        h('div', { class: 'map-frame' }, cv,
          h('div', { class: 'map-legend' },
            h('span', {}, h('i', { class: 'lg poi' }), 'Địa điểm'), h('span', {}, h('i', { class: 'lg taxi' }, 'T'), 'Taxi'),
            h('span', {}, h('i', { class: 'lg bike' }, 'X'), 'Xe máy'), h('span', {}, h('i', { class: 'lg me' }), 'Bạn'))),
        h('div', { class: 'todo' },
          h('h3', { class: 'sheet-h3', style: 'margin-top:0' }, `Việc nên làm ở đây`, h('span', {}, `${doneN}/${items.length}`)),
          h('ul', {}, ...items.map((it) => h('li', { class: it.done ? 'done' : '' }, h('i', { 'aria-hidden': 'true' }), it.label))),
          h('div', { class: 'actions' },
            h('button', { type: 'button', class: 'btn btn-ink', onclick: () => openPlaces() }, 'Danh sách địa điểm'),
            zone.transport?.taxi ? h('button', { type: 'button', class: 'btn btn-ghost-ink', onclick: () => { const tp = places.find((x) => x.id === 'taxi')!; startGuide(tp); } }, 'Ra điểm đón taxi') : ''),
        ),
      ),
    ], 'sheet-wide');
    requestAnimationFrame(() => {
      const toWorld = zmap.drawFull(cv, mapMarkers(true), { x: player.pos.x, z: player.pos.z, yaw: player.yaw });
      cv.addEventListener('click', (e) => {
        const w = toWorld(e.clientX, e.clientY);
        const near = places.filter((x) => x.id !== 'spawn').map((x) => ({ x, d: Math.hypot(x.x - w.x, x.z - w.z) })).sort((a, b) => a.d - b.d)[0];
        if (near && near.d < 14) { startGuide(near.x); return; }
        const p = walk.heightAt(w.x, w.z) !== null ? w : nearestWalk(w.x, w.z);
        if (!p || Math.hypot(p.x - w.x, p.z - w.z) > 20) { toast('Chỗ đó không đi bộ tới được. Chọn trên vỉa hè, bãi cát hoặc cầu.'); return; }
        startGuide({ id: 'pin', name: 'Điểm đã chọn', x: p.x, z: p.z, icon: 'plane' });
      });
    });
  }

  function showWelcome() {
    const touch = input.touch;
    const row = (icon: string, title: string, text: string) => h('div', { class: 'wel-row' }, h('span', { class: 'wel-ic', html: ICONS[icon] }), h('div', {}, h('b', {}, title), h('p', {}, text)));
    openSheet([
      h('h2', {}, `Chào mừng tới ${l(zone.name)}`),
      h('p', { class: 'sub' }, `Mọi thứ ở đây chạy theo giờ và thời tiết thật của ${destName}. Vài điều để bắt đầu:`),
      row('eye', 'Đi lại', touch ? 'Kéo cần gạt bên trái để đi, vuốt màn hình để xoay, chụm hai ngón để phóng to.' : 'W A S D để đi, giữ Shift để chạy. Kéo chuột để xoay, cuộn để phóng to.'),
      row('map', 'Tìm đường', 'Bản đồ ở góc màn hình. Chạm vào một nơi trên bản đồ để được chỉ đường, bấm "Tự đi" nếu muốn nhân vật tự đi.'),
      row('pin', 'Đi xa hơn', touch ? 'Thuê xe máy ở bãi xe hoặc gọi taxi sang khu khác. Bạn bè đứng cạnh xe có thể xin đi nhờ.' : 'Thuê xe máy ở bãi xe (E để lên, xuống; B bóp còi) hoặc gọi taxi sang khu khác. Bạn bè đứng cạnh xe có thể xin đi nhờ.'),
      row('passport', 'Giữ kỷ niệm', 'Nhận dấu hộ chiếu ở mỗi nơi, chụp bưu thiếp gửi bạn bè, treo ổ khóa kèm lời nhắn.'),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn-red', onclick: () => closeSheet?.() }, 'Bắt đầu dạo')),
    ], 'welcome');
    try { localStorage.setItem('vno.welcomed', '1'); } catch { /* */ }
  }

  // ---------- Phím ----------
  const onKey = (e: KeyboardEvent) => {
    const typing = (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA';
    audio.start();
    if (e.key === 'Escape' && closeSheet) { closeSheet(); return; }
    if (typing || sheetOpen) return;
    if (e.key === 'Enter') { e.preventDefault(); chatInput.focus(); return; }
    const hot: Record<string, () => void> = {
      KeyV: () => player.toggleView(),
      KeyH: () => void openPassport(),
      KeyP: () => void openPostcard(),
      KeyE: () => interact?.(),
      KeyM: () => openMap(),
      KeyB: () => honk(),
    };
    const fn = hot[e.code] ?? (EMOTE_KEYS[e.code] ? () => emote(EMOTE_KEYS[e.code][0]) : null);
    if (fn) { e.preventDefault(); fn(); }
  };
  addEventListener('keydown', onKey);
  const onUnload = () => { if (player.mode === 'bike') placeMyBike(player.pos.x, player.pos.y, player.pos.z, player.yaw); };
  addEventListener('pagehide', onUnload);
  wrap.addEventListener('pointerdown', () => audio.start(), { once: true });

  // ---------- Sự kiện có lịch ----------
  const spectacles = zone.spectacles.map((def) => ({ def, kit: kits.find((k) => k.id === def.target), prev: { fire: false, water: false } }));
  let replayStart: number | null = null;
  const specState = (def: SpectacleDef, now: number) => {
    const win = spectacleWindow(def, now, off);
    const start = replayStart ?? win.current;
    const st: SpectacleState & { live: boolean; t: number; next: number | null } = { fire: false, water: false, burst: false, live: !!win.current && replayStart === null, t: 0, next: win.next };
    if (start === null) return st;
    const t = (now - start) / 1000;
    st.t = t;
    if (replayStart !== null && t > def.schedule.durationSec) { replayStart = null; return st; }
    for (const s of def.sequence) {
      if (t < s.start || t >= s.end) continue;
      const on = s.every ? (t - s.start) % s.every < (s.burst ?? s.every) : true;
      if (s.type === 'fire') st.fire = st.fire || on;
      if (s.type === 'water') st.water = st.water || on;
    }
    return st;
  };

  // ---------- Câu chuyện, dấu, tương tác ----------
  const dismissed = new Set<string>();
  let activeStory: string | null = null;
  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'vi-VN';
    const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('vi'));
    if (v) u.voice = v;
    u.rate = 0.98;
    speechSynthesis.speak(u);
  };
  const showStory = (id: string | null) => {
    if (id === activeStory) return;
    activeStory = id;
    if (!id) { storyEl.classList.remove('show'); return; }
    const s = zone.stories.find((x) => x.id === id)!;
    const canSpeak = 'speechSynthesis' in window;
    storyEl.replaceChildren(
      h('button', { class: 'close', 'aria-label': 'Ẩn thuyết minh', onclick: () => { dismissed.add(id); showStory(null); if (canSpeak) speechSynthesis.cancel(); } }, '✕'),
      h('h3', {}, l(s.title)),
      h('p', {}, l(s.text)),
      canSpeak ? h('div', { class: 'row' }, h('button', { onclick: () => speak(l(s.text)) }, '▶ Nghe thuyết minh')) : '',
    );
    storyEl.classList.add('show');
  };

  const stampToast = (s: StampDef) => {
    hud.querySelector('.toast-stamp')?.remove();
    const el = h('div', { class: 'toast-stamp', role: 'status' }, stampEl(s, { at: worldNow() }), h('div', { class: 'lbl' }, `Dấu mới: ${l(s.name)}`));
    hud.append(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3800);
  };
  const giveStamp = (s: StampDef) => {
    if (addStamp(code, s.id)) { stampToast(s); updateStampCount(); }
    if (guide.target && s.kind === 'place' && Math.hypot(guide.target.x - s.x!, guide.target.z - s.z!) < 1) stopGuide();
  };
  const updateStampCount = () => {
    const n = getStamps().filter((x) => x.dest === code).length;
    stampCount.textContent = String(n);
    stampCount.style.display = n ? '' : 'none';
  };
  updateStampCount();
  const giveArrive = () => setTimeout(() => { const a = zone.stamps.find((s) => s.kind === 'arrive'); if (a) giveStamp(a); }, 1500);

  let interact: (() => void) | null = null;
  let promptLabel = '';
  let nearLock: LockRecord | null = null;
  const checkWorld = () => {
    const p = player.pos;
    const now = worldNow();
    // dấu
    for (const s of zone.stamps) {
      if (hasStamp(code, s.id)) continue;
      if (s.kind === 'place' && Math.hypot(p.x - s.x!, p.z - s.z!) < (s.r ?? 8)) giveStamp(s);
      if (isPrivate) continue; // dấu hiếm chỉ có ở giờ thật
      if (s.kind === 'spectacle') {
        const sp = spectacles.find((x) => x.def.id === s.spectacle);
        if (sp && specState(sp.def, now).live && (sp.kit?.focus ? sp.kit.focus.distanceTo(p) < 160 : true)) giveStamp(s);
      }
      if (s.kind === 'sun' && sky.env.sunAlt > (s.altMin ?? -4) && sky.env.sunAlt < (s.altMax ?? 6) && (s.period === 'morning' ? localParts(now, off).h < 12 : localParts(now, off).h >= 12)) giveStamp(s);
      if (s.kind === 'weather' && weather?.live && (weather.kind === s.weather || (s.weather === 'rain' && weather.kind === 'storm'))) giveStamp(s);
    }
    // câu chuyện
    const story = zone.stories.find((s) => !dismissed.has(s.id) && Math.hypot(p.x - s.x, p.z - s.z) < s.r);
    showStory(story?.id ?? null);
    // tương tác gần nhất (E hoặc nút trên điện thoại)
    interact = null;
    nearLock = null;
    const offer = (label: string, short: string, fn: (() => void) | null) => {
      if (interact) return;
      interact = fn ?? (() => {});
      if (promptLabel === label) return; // không dựng lại nút đang hiện (tránh mất lượt chạm trên điện thoại)
      promptLabel = label;
      promptEl.replaceChildren(input.touch || !fn ? h('span', {}) : h('kbd', {}, 'E'), h('span', {}, label), input.touch && fn ? h('button', { onclick: () => interact?.() }, short) : '');
    };
    const t = zone.transport;
    const nearStation = !!t?.bikes && Math.hypot(p.x - t.bikes.x, p.z - t.bikes.z) < 7;
    if (player.mode === 'bike') {
      if (nearStation && !rideWith) offer('Trả xe về bãi', 'Trả xe', () => returnBike());
      offer(rideWith ? `Dừng xe (${nameOf(rideWith)} đang ngồi sau)` : 'Xuống xe, dựng xe tại chỗ', 'Xuống', () => { if (getOffBike()) toast('Đã dựng xe. Lại gần bấm E để lên lại.'); });
    }
    else if (player.mode === 'pillion') offer('Xuống xe', 'Xuống', () => getOffBike());
    else {
      if (myBike && Math.hypot(p.x - myBike.x, p.z - myBike.z) < 2.8) offer('Lên xe của bạn', 'Lên xe', () => rideMyBike());
      for (const [id, a] of others) {
        if (a.vehicle !== 1 || a.partner || a.root.position.distanceTo(p) > 3.5) continue;
        if (pendingPillion === id) offer(`Đang chờ ${nameOf(id)} trả lời…`, '', null);
        else offer(`Xin đi nhờ xe ${nameOf(id)}`, 'Xin đi nhờ', () => { pendingPillion = id; net?.send({ t: 'ride', to: id, kind: 'pillion', act: 'ask' }); toast(`Đã hỏi ${nameOf(id)}.`); setTimeout(() => { if (pendingPillion === id) pendingPillion = null; }, 15000); });
        break;
      }
      if (t?.taxi && Math.hypot(p.x - t.taxi.x, p.z - t.taxi.z) < 5) offer('Gọi taxi', 'Gọi', () => openTaxi());
      if (nearStation) offer(myBike ? 'Thuê xe khác (xe đang dựng được trả lại)' : 'Thuê xe máy', 'Thuê', () => rentBike());
      if (lockKit && lockKit.onPier(p)) {
        nearLock = lockKit.nearest(new THREE.Vector3(p.x, p.y + 1, p.z), 2.2);
        offer('Treo ổ khóa', 'Treo', () => openLocks());
      }
    }
    promptEl.classList.toggle('show', !!interact);
    if (!interact) promptLabel = '';
    if (nearLock) {
      const lk = nearLock;
      if (noteEl.dataset.id !== lk.id) {
        noteEl.dataset.id = lk.id;
        const like = h('button', { class: 'like', 'aria-pressed': String(liked.has(lk.id)) }, `♥ ${lk.likes}`);
        like.addEventListener('click', async () => { await likeLock(lk.id); like.setAttribute('aria-pressed', 'true'); like.textContent = `♥ ${lockCache.find((x) => x.id === lk.id)?.likes ?? lk.likes + 1}`; });
        noteEl.replaceChildren(
          lk.to ? h('div', { class: 'to' }, `Gửi ${lk.to},`) : h('div', { class: 'to' }, 'Một lời nhắn trên lan can'),
          h('div', { class: 'msg' }, lk.text),
          h('div', { class: 'from' }, h('span', {}, `— ${lk.name}`), like),
        );
      }
      noteEl.classList.add('show');
      lockKit?.highlight(lk.id);
    } else if (noteEl.classList.contains('show')) {
      noteEl.classList.remove('show');
      noteEl.dataset.id = '';
      lockKit?.highlight(null);
    }
  };

  // ---------- Vòng lặp ----------
  const clock = new THREE.Clock();
  let raf = 0;
  let checkAcc = 0, hudAcc = 1, weatherAcc = 0, miniAcc = 1;
  const tmpV = new THREE.Vector3();

  const updateHud = (now: number) => {
    clockEl.textContent = fmtClock(now, off);
    weatherEl.replaceChildren(
      h('b', { style: 'font-size:1rem' }, weather ? `${weather.tempC}°` : '—'),
      h('span', {}, weather ? weather.label.toLowerCase() : 'đang tải'),
    );
    const n = net?.connected ? others.size + 1 : 1;
    peopleEl.replaceChildren(h('b', { style: 'font-size:1rem' }, String(n)), h('span', {}, isPrivate ? 'chỉ mình bạn' : 'người thật'));
    // banner sự kiện
    const sp = spectacles[0];
    if (!sp) return;
    const st = specState(sp.def, now);
    eventEl.classList.remove('live', 'show');
    if (st.t > 0 && (st.live || replayStart !== null)) {
      eventEl.classList.add('show', 'live');
      eventEl.replaceChildren(h('b', {}, replayStart !== null ? 'Đang xem lại' : 'Đang diễn ra'), h('span', {}, l(sp.def.name)),
        replayStart !== null ? h('button', { class: 'link-btn', style: 'color:#fff', onclick: () => { replayStart = null; } }, 'Dừng') : '');
    } else if (st.next !== null) {
      const left = st.next - now;
      eventEl.classList.add('show');
      const soon = left < sp.def.countdownMin * 60_000;
      eventEl.replaceChildren(
        h('span', {}, soon ? l(sp.def.name) + ' sau' : 'Lần diễn tới sau'),
        h('span', { class: 't' }, fmtCountdown(left)),
        soon ? '' : h('button', { class: 'link-btn', onclick: () => { replayStart = worldNow() - 15_000; toast('Bản xem lại chỉ hiện cho bạn và không có dấu hiếm.'); } }, 'Xem lại'),
      );
    }
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1);
    const now = worldNow();
    player.update(dt);
    sky.update(now, weather, player.pos, R.camera);
    const env = sky.env;

    let watch: THREE.Vector3 | null = null;
    for (const sp of spectacles) {
      const st = specState(sp.def, now);
      const burstFire = st.fire && !sp.prev.fire, burstWater = st.water && !sp.prev.water;
      sp.prev = { fire: st.fire, water: st.water };
      sp.kit?.spectacle?.({ ...st, burst: burstFire || burstWater }, dt);
      const dist = sp.kit?.focus ? sp.kit.focus.distanceTo(player.pos) : 50;
      if (burstFire) audio.burst('fire', dist);
      if (burstWater) audio.burst('water', dist);
      const soon = st.next !== null && st.next - now < sp.def.countdownMin * 60_000;
      if ((st.t > 0 || soon) && sp.kit?.focus) watch = sp.kit.focus;
      const spray = sp.kit?.sprayAt?.(player.pos) ?? 0;
      sprayEl.style.opacity = String(Math.min(1, spray * 1.6));
    }
    for (const k of kits) k.update?.(dt, env, R.camera);
    culler.update(R.camera.position);
    reflect.update(now / 1000, env.night);
    for (const a of others.values()) { a.follow(dt); a.update(dt); }
    crowd.update(dt, watch);
    const g = guide.update(player.pos, R.camera, performance.now());
    if (g) {
      guideArrow.style.transform = `rotate(${g.angle.toFixed(1)}deg)`;
      guideDist.textContent = g.dist < 5 ? 'tới nơi' : `còn ${Math.round(g.dist)} m`;
      if (autoOn) player.auto = g.next;
      if (g.dist < 3 && guide.target) { toast(`Đã tới ${guide.target.name}.`); stopGuide(); }
    }
    rain.update(dt, env.rain, R.camera.position);
    if (riverKit) {
      const edge = Math.max(Math.abs(riverKit.x0), Math.abs(riverKit.x1));
      audio.update(THREE.MathUtils.clamp(1 - (Math.abs(player.pos.x) - edge) / 50, 0, 1), env.night, env.rain);
    } else if (oceanKit) {
      audio.update(THREE.MathUtils.clamp(1 - (oceanKit.shore - player.pos.x) / 90, 0.2, 1), env.night, env.rain);
    }
    audio.engine(player.mode === 'bike' ? Math.min(1, Math.abs(player.speed) / 17) : null);
    // người ngồi sau xe người khác: gắn vào yên sau của xe người lái
    for (const a of others.values()) {
      if (a.vehicle !== 2 || !a.partner) continue;
      const drv = a.partner === net?.id && player.mode === 'bike' ? me : others.get(a.partner);
      if (!drv) continue;
      const yaw = drv.root.rotation.y;
      a.root.position.set(drv.root.position.x - Math.sin(yaw) * 0.48, drv.root.position.y, drv.root.position.z - Math.cos(yaw) * 0.48);
      a.root.rotation.y = yaw;
    }
    net?.sendState({ x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, anim: me.emote === 'sit' ? 3 : me.emote === 'dance' ? 4 : me.anim, v: player.mode === 'bike' ? 1 : player.mode === 'pillion' ? 2 : 0, w: rideWith ?? '', bk: myBike && player.mode !== 'bike' ? [myBike.x, myBike.y, myBike.z, myBike.yaw] : [] }, performance.now());

    miniAcc += dt;
    if (miniAcc > 0.066) {
      miniAcc = 0;
      zmap.drawMini(miniCv, player.pos.x, player.pos.z, player.yaw, player.camYaw, mapMarkers(true));
      hornBtn.classList.toggle('show', player.mode === 'bike');
    }
    checkAcc += dt; hudAcc += dt; weatherAcc += dt;
    if (checkAcc > 0.25) { checkAcc = 0; checkWorld(); crowd.setCount(Math.max(0, zone.social.npcFillTo - others.size)); }
    if (hudAcc > 0.5) { hudAcc = 0; updateHud(now); }
    if (weatherAcc > 600) { weatherAcc = 0; void loadWeather(); }
    tmpV.copy(player.pos);
    R.setGrade(env.night, env.dusk * (1 - env.night), env.rain);
    R.render(dt, env.night);
  };
  if (import.meta.env.DEV) (window as any).__vno = { scene, R, sky, player, kits, THREE, others };
  if (ride) {
    ride.setReady();
    await ride.done;
    history.replaceState({}, '', `/d/${code}?khu=${zone.id}`); // tải lại trang không phát lại cảnh taxi
    hud.style.visibility = '';
    player.place(player.pos.x, player.pos.z, player.yaw); // đặt lại camera sau cảnh taxi
  }
  giveArrive();
  loop();
  setTimeout(() => {
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 700);
    let welcomed = false;
    try { welcomed = localStorage.getItem('vno.welcomed') === '1'; } catch { /* */ }
    if (!welcomed) showWelcome();
    else if (!input.touch) toast('Bấm M để mở bản đồ, Enter để trò chuyện.', 5000);
    else toast('Chạm bản đồ góc màn hình để tìm đường.', 5000);
  }, 400);

  return () => {
    if (player.mode === 'bike') placeMyBike(player.pos.x, player.pos.y, player.pos.z, player.yaw);
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey);
    removeEventListener('pagehide', onUnload);
    net?.close();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    void audio.ctx?.close();
    R.renderer.dispose();
    R.renderer.forceContextLoss();
    wrap.remove();
  };
}
