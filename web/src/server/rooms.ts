// Phòng chơi theo khu + matchmaker: xếp người vào phòng "đông vừa đủ", giữ nhóm bạn ở cùng phòng.
import type { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import type { ClientMsg, PlayerInfo, PlayerState, ServerMsg } from '../shared/protocol';
import { cleanName, cleanText } from '../shared/filter';

interface Client {
  ws: WebSocket;
  info: PlayerInfo;
  s: PlayerState;
  room: Room | null;
  party?: string;
  lastChat: number;
  chatBurst: number;
}

interface Room { key: string; dest: string; zone: string; clients: Set<Client> }

const rooms = new Map<string, Room>();
const CAP = 80;
const COMFORT = 40;

function send(ws: WebSocket, m: ServerMsg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(m));
}
function broadcast(room: Room, m: ServerMsg, except?: Client) {
  const raw = JSON.stringify(m);
  for (const c of room.clients) if (c !== except && c.ws.readyState === 1) c.ws.send(raw);
}

function pickRoom(dest: string, zone: string, party?: string): Room {
  const prefix = `${dest}:${zone}:`;
  const list = [...rooms.values()].filter((r) => r.key.startsWith(prefix));
  if (party) {
    const withParty = list.find((r) => [...r.clients].some((c) => c.party === party) && r.clients.size < CAP);
    if (withParty) return withParty;
  }
  const comfy = list.filter((r) => r.clients.size < COMFORT).sort((a, b) => b.clients.size - a.clients.size)[0];
  if (comfy) return comfy;
  const any = list.filter((r) => r.clients.size < CAP).sort((a, b) => a.clients.size - b.clients.size)[0];
  if (any) return any;
  let n = 1;
  while (rooms.has(`${prefix}shard-${n}`)) n++;
  const room: Room = { key: `${prefix}shard-${n}`, dest, zone, clients: new Set() };
  rooms.set(room.key, room);
  return room;
}

export function onlineByDest(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rooms.values()) out[r.dest] = (out[r.dest] ?? 0) + r.clients.size;
  return out;
}

export function broadcastZone(dest: string, zone: string, m: ServerMsg) {
  for (const r of rooms.values()) if (r.dest === dest && r.zone === zone) broadcast(r, m);
}

const validColor = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#C8102E');
const num = (v: unknown, lim = 5000) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : 0);

export function handleConnection(ws: WebSocket) {
  const client: Client = {
    ws, info: { id: randomUUID().slice(0, 8), name: 'Lữ khách', color: '#C8102E', hat: false },
    s: { x: 0, y: 0, z: 0, yaw: 0, anim: 0 }, room: null, lastChat: 0, chatBurst: 0,
  };
  let alive = true;
  ws.on('pong', () => (alive = true));
  const ping = setInterval(() => {
    if (!alive) return ws.terminate();
    alive = false;
    ws.ping();
  }, 20_000);

  ws.on('message', (raw) => {
    if (raw.toString().length > 2000) return;
    let m: ClientMsg;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    if (m.t === 'join') {
      if (client.room) leave(client);
      if (!/^[a-z0-9-]{2,24}$/.test(m.dest) || !/^[a-z0-9-]{2,12}$/.test(m.zone)) return;
      client.info.name = cleanName(String(m.name ?? ''));
      client.info.color = validColor(String(m.color ?? ''));
      client.info.hat = !!m.hat;
      client.info.hair = typeof m.hair === 'number' ? Math.max(0, Math.min(3, m.hair | 0)) : undefined;
      client.party = typeof m.party === 'string' ? m.party.slice(0, 16) : undefined;
      const room = pickRoom(m.dest, m.zone, client.party);
      room.clients.add(client);
      client.room = room;
      send(ws, {
        t: 'welcome', id: client.info.id, room: room.key, time: Date.now(),
        players: [...room.clients].filter((c) => c !== client).map((c) => ({ ...c.info, s: c.s })),
      });
      broadcast(room, { t: 'join', p: { ...client.info, s: client.s } }, client);
    } else if (m.t === 's' && client.room) {
      const s = m.s;
      client.s = { x: num(s.x), y: num(s.y, 300), z: num(s.z), yaw: num(s.yaw, 100), anim: num(s.anim, 10) | 0, v: Math.max(0, Math.min(3, num(s.v, 3) | 0)), w: typeof s.w === 'string' ? s.w.slice(0, 12) : '', bk: Array.isArray(s.bk) && s.bk.length === 4 ? s.bk.map((n) => +num(n).toFixed(2)) : [] };
    } else if (m.t === 'chat' && client.room) {
      const now = Date.now();
      client.chatBurst = Math.max(0, client.chatBurst - (now - client.lastChat) / 4000) + 1;
      client.lastChat = now;
      if (client.chatBurst > 4) return send(ws, { t: 'sys', text: 'Bạn gửi tin hơi nhanh, đợi vài giây nhé.' });
      const text = cleanText(String(m.text ?? ''));
      if (!text) return;
      broadcast(client.room, { t: 'chat', id: client.info.id, name: client.info.name, text, at: now });
    } else if (m.t === 'ride' && client.room) {
      // chuyển lời mời đi nhờ xe / đi chung taxi tới đúng người trong cùng phòng
      const now = Date.now();
      if (m.act === 'ask') {
        client.chatBurst = Math.max(0, client.chatBurst - (now - client.lastChat) / 4000) + 1;
        client.lastChat = now;
        if (client.chatBurst > 5) return send(ws, { t: 'sys', text: 'Bạn gửi lời mời hơi nhanh, đợi vài giây nhé.' });
      }
      if (!['pillion', 'taxi'].includes(m.kind) || !['ask', 'yes', 'no', 'off'].includes(m.act)) return;
      const target = [...client.room.clients].find((c) => c.info.id === m.to);
      if (!target) return;
      send(target.ws, {
        t: 'ride', from: client.info.id, name: client.info.name, kind: m.kind, act: m.act,
        dest: typeof m.dest === 'string' && /^[a-z0-9-]{1,12}$/.test(m.dest) ? m.dest : undefined,
        party: typeof m.party === 'string' ? m.party.slice(0, 16) : undefined,
      });
    } else if (m.t === 'emote' && client.room) {
      const e = String(m.e).slice(0, 12);
      broadcast(client.room, { t: 'emote', id: client.info.id, e }, client);
    }
  });

  ws.on('close', () => {
    clearInterval(ping);
    leave(client);
  });
}

function leave(c: Client) {
  const room = c.room;
  if (!room) return;
  room.clients.delete(c);
  c.room = null;
  broadcast(room, { t: 'leave', id: c.info.id });
  if (room.clients.size === 0) rooms.delete(room.key);
}

// Gửi trạng thái 10 lần mỗi giây
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.clients.size < 2) continue;
    const d = [...room.clients].map((c) => [c.info.id, +c.s.x.toFixed(2), +c.s.y.toFixed(2), +c.s.z.toFixed(2), +c.s.yaw.toFixed(2), c.s.anim, c.s.v ?? 0, c.s.w ?? '', c.s.bk ?? []] as [string, number, number, number, number, number, number, string, number[]]);
    broadcast(room, { t: 'states', d });
  }
}, 100);
