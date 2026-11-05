// Kết nối game server: vào phòng theo khu, gửi vị trí, nhận người khác, chat, biểu cảm. Tự kết nối lại.
import type { ClientMsg, PlayerState, ServerMsg } from '../../shared/protocol';

export class Net {
  ws: WebSocket | null = null;
  id = '';
  room = '';
  connected = false;
  private last = '';
  private lastSend = 0;
  private retry = 0;
  private closed = false;
  onMsg: (m: ServerMsg) => void = () => {};
  onStatus: (ok: boolean) => void = () => {};

  constructor(private join: Extract<ClientMsg, { t: 'join' }>) {}

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.send(this.join);
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data) as ServerMsg;
      if (m.t === 'welcome') {
        this.id = m.id; this.room = m.room; this.connected = true; this.onStatus(true);
      }
      this.onMsg(m);
    };
    ws.onclose = () => {
      this.connected = false;
      this.onStatus(false);
      if (this.closed) return;
      const wait = Math.min(15000, 1000 * 2 ** this.retry++);
      setTimeout(() => this.connect(), wait);
    };
  }

  send(m: ClientMsg) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m));
  }

  sendState(s: PlayerState, now: number) {
    if (now - this.lastSend < 100) return;
    const key = `${s.x.toFixed(2)},${s.z.toFixed(2)},${s.yaw.toFixed(2)},${s.anim},${s.v ?? 0},${s.w ?? ""},${(s.bk ?? []).join(':')}`;
    if (key === this.last && now - this.lastSend < 2000) return;
    this.last = key;
    this.lastSend = now;
    this.send({ t: 's', s });
  }

  close() {
    this.closed = true;
    this.ws?.close();
  }
}
