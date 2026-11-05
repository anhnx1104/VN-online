// Máy chủ Việt Nam Online bản web v1: API + game server WebSocket + phục vụ file tĩnh khi chạy production.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { handleConnection, onlineByDest, broadcastZone } from './rooms';
import { getWeather } from './weather';
import { JsonStore } from './store';
import { cleanName, cleanText } from '../shared/filter';
import type { LockRecord } from '../shared/protocol';
import type { RegistryEntry, ZoneDef } from '../shared/pack';

const PORT = Number(process.env.PORT ?? 8787);
const PROD = process.env.NODE_ENV === 'production';
const ROOT = process.cwd();
const STATIC = join(ROOT, PROD ? 'dist' : 'public');

const registry: RegistryEntry[] = JSON.parse(readFileSync(join(ROOT, 'public/destinations/registry.json'), 'utf8')).destinations;
const byCode = new Map(registry.map((d) => [d.code, d]));

function zoneDef(dest: string, zone: string): ZoneDef | null {
  const f = join(ROOT, 'public/destinations', dest, 'zones', zone + '.json');
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

const locks = new JsonStore<LockRecord[]>('locks', []);
const waitlist = new JsonStore<Record<string, string[]>>('waitlist', {});

// Giới hạn tần suất đơn giản theo IP
const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return true;
  arr.push(now);
  hits.set(key, arr);
  return false;
}
const ipOf = (req: IncomingMessage) =>
  (String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || '?');
const hashIp = (ip: string) => createHash('sha256').update('vno:' + ip).digest('hex').slice(0, 16);

function json(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
async function readBody(req: IncomingMessage): Promise<any> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4000) throw new Error('too large');
  }
  return raw ? JSON.parse(raw) : {};
}

const LOCK_COLORS = ['#C8102E', '#F2B705', '#1FA39A', '#E87BA6', '#C0C4CC', '#3B6FD8'];

async function api(req: IncomingMessage, res: ServerResponse, path: string) {
  const ip = ipOf(req);
  const parts = path.split('/').filter(Boolean); // ['api', ...]

  if (path === '/api/time') return json(res, 200, { now: Date.now() });

  if (path === '/api/destinations') {
    const online = onlineByDest();
    const counts = Object.fromEntries(Object.entries(waitlist.data).map(([k, v]) => [k, v.length]));
    const list = await Promise.all(
      registry.map(async (d) => ({
        ...d,
        online: online[d.code] ?? 0,
        waitlist: counts[d.code] ?? 0,
        weather: await getWeather(d.code, d.lat, d.lon),
      })),
    );
    return json(res, 200, { now: Date.now(), destinations: list });
  }

  if (parts[1] === 'weather' && parts[2]) {
    const d = byCode.get(parts[2]);
    if (!d) return json(res, 404, { error: 'Không có điểm đến này' });
    return json(res, 200, await getWeather(d.code, d.lat, d.lon));
  }

  if (path === '/api/waitlist' && req.method === 'POST') {
    const body = await readBody(req);
    const d = byCode.get(String(body.code));
    if (!d || d.status !== 'soon') return json(res, 400, { error: 'Điểm đến này không nhận đăng ký chờ' });
    const id = hashIp(ip) + (body.device ? ':' + String(body.device).slice(0, 36) : '');
    const arr = (waitlist.data[d.code] ??= []);
    if (!arr.includes(id)) {
      if (limited('wl:' + ip, 20, 3600_000)) return json(res, 429, { error: 'Thử lại sau ít phút' });
      arr.push(id);
      waitlist.save();
    }
    return json(res, 200, { code: d.code, count: arr.length });
  }

  // /api/locks/:dest/:zone
  if (parts[1] === 'locks' && parts.length === 4) {
    const [, , dest, zone] = parts;
    const zdef = zoneDef(dest, zone);
    if (!zdef) return json(res, 404, { error: 'Không có khu này' });
    if (req.method === 'GET') {
      return json(res, 200, { locks: locks.data.filter((l) => l.dest === dest && l.zone === zone) });
    }
    if (req.method === 'POST') {
      if (limited('lock:' + ip, 5, 3600_000)) return json(res, 429, { error: 'Mỗi người treo tối đa 5 ổ khóa mỗi giờ.' });
      const body = await readBody(req);
      const text = cleanText(String(body.text ?? ''), 90);
      if (!text) return json(res, 400, { error: 'Hãy viết một lời nhắn trước khi treo khóa.' });
      const s = zdef.lockSlots;
      if (!s) return json(res, 400, { error: 'Khu này không có chỗ treo khóa' });
      const total = Math.floor((s.x1 - s.x0) * s.perMeter) * s.rows * s.zRails.length;
      const mine = locks.data.filter((l) => l.dest === dest && l.zone === zone);
      const lock: LockRecord = {
        id: randomUUID().slice(0, 10), dest, zone,
        slot: mine.length % total,
        name: cleanName(String(body.name ?? '')),
        to: cleanText(String(body.to ?? ''), 24),
        text,
        color: LOCK_COLORS.includes(body.color) ? body.color : LOCK_COLORS[0],
        likes: 0, at: Date.now(),
      };
      // Khi đầy, ổ khóa mới thay ổ khóa cũ nhất ở cùng vị trí
      locks.data = locks.data.filter((l) => !(l.dest === dest && l.zone === zone && l.slot === lock.slot));
      locks.data.push(lock);
      locks.save();
      broadcastZone(dest, zone, { t: 'lock', lock });
      return json(res, 200, { lock });
    }
  }

  // /api/locks/:id/like
  if (parts[1] === 'locks' && parts[3] === 'like' && req.method === 'POST') {
    const lock = locks.data.find((l) => l.id === parts[2]);
    if (!lock) return json(res, 404, { error: 'Ổ khóa không còn ở đây' });
    if (limited(`like:${ip}:${lock.id}`, 1, 86400_000)) return json(res, 200, { lock });
    lock.likes++;
    locks.save();
    broadcastZone(lock.dest, lock.zone, { t: 'lock', lock });
    return json(res, 200, { lock });
  }

  return json(res, 404, { error: 'Không tìm thấy' });
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.ktx2': 'image/ktx2', '.glb': 'model/gltf-binary', '.spz': 'application/octet-stream',
};

function serveStatic(req: IncomingMessage, res: ServerResponse, path: string) {
  let file = normalize(join(STATIC, decodeURIComponent(path)));
  if (!file.startsWith(STATIC)) return json(res, 403, { error: 'forbidden' });
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (!PROD) return json(res, 404, { error: 'Chế độ dev: mở giao diện qua Vite ở cổng 5173' });
    file = join(STATIC, 'index.html'); // SPA fallback
  }
  const ext = extname(file);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
  void req;
}

const server = createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0];
  try {
    if (path.startsWith('/api/')) return await api(req, res, path);
    return serveStatic(req, res, path);
  } catch (e) {
    return json(res, 400, { error: 'Yêu cầu không hợp lệ' });
  }
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (req, socket, head) => {
  if ((req.url ?? '').startsWith('/ws')) wss.handleUpgrade(req, socket, head, (ws) => handleConnection(ws));
  else socket.destroy();
});

server.listen(PORT, () => {
  console.log(`[vno] server http://localhost:${PORT} (${PROD ? 'production' : 'dev'})`);
});
