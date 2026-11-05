// Bàn phím, chuột kéo xoay camera, cần gạt ảo trên điện thoại.
export class Input {
  keys = new Set<string>();
  move = { x: 0, y: 0 }; // từ cần gạt
  lookDelta = { x: 0, y: 0 };
  zoomDelta = 0;
  run = false;
  enabled = true;
  private dragId: number | null = null;
  private last = { x: 0, y: 0 };
  private pinch: { a: number; b: number; d: number } | null = null;
  readonly touch = matchMedia('(pointer: coarse)').matches;

  constructor(el: HTMLElement, joystickHost: HTMLElement) {
    addEventListener('keydown', (e) => {
      if (this.isTyping(e)) return;
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    el.addEventListener('pointerdown', (e) => {
      if (this.dragId !== null) {
        if (e.pointerType === 'touch') this.pinch = { a: this.dragId, b: e.pointerId, d: 0 };
        return;
      }
      this.dragId = e.pointerId;
      this.last = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    const pts = new Map<number, { x: number; y: number }>();
    el.addEventListener('pointermove', (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && pts.has(this.pinch.a) && pts.has(this.pinch.b)) {
        const a = pts.get(this.pinch.a)!, b = pts.get(this.pinch.b)!;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch.d) this.zoomDelta += (this.pinch.d - d) * 0.05;
        this.pinch.d = d;
        return;
      }
      if (e.pointerId !== this.dragId) return;
      this.lookDelta.x += e.clientX - this.last.x;
      this.lookDelta.y += e.clientY - this.last.y;
      this.last = { x: e.clientX, y: e.clientY };
    });
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (this.pinch && (e.pointerId === this.pinch.a || e.pointerId === this.pinch.b)) this.pinch = null;
      if (e.pointerId === this.dragId) this.dragId = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { this.zoomDelta += e.deltaY * 0.01; e.preventDefault(); }, { passive: false });

    if (this.touch) this.mountJoystick(joystickHost);
  }

  private isTyping(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  private mountJoystick(host: HTMLElement) {
    const pad = document.createElement('div');
    pad.className = 'joy';
    pad.innerHTML = '<div class="joy-knob"></div>';
    host.appendChild(pad);
    const knob = pad.firstElementChild as HTMLElement;
    let id: number | null = null;
    let cx = 0, cy = 0;
    const R = 46;
    pad.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      const r = pad.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      pad.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.move.x = dx / R; this.move.y = -dy / R;
      this.run = d > R * 0.92;
    });
    const end = () => { id = null; knob.style.transform = ''; this.move.x = this.move.y = 0; this.run = false; };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
  }

  axis() {
    if (!this.enabled) return { x: 0, y: 0, run: false };
    let x = this.move.x, y = this.move.y;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, run: this.run || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') };
  }

  consumeLook() {
    const d = { ...this.lookDelta, zoom: this.zoomDelta };
    this.lookDelta.x = this.lookDelta.y = 0;
    this.zoomDelta = 0;
    return d;
  }
}
