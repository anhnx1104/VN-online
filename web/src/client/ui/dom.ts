// Tiện ích DOM nhỏ gọn.
type Attrs = Record<string, string | number | boolean | EventListener | undefined | null>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
}

export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export const ICONS: Record<string, string> = {
  passport: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3.2"/><path d="M8.5 16.5h7"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.6"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9.5h4L13 5v14l-5-4.5H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9.5h4L13 5v14l-5-4.5H4z"/><path d="m17 9.5 5 5M22 9.5l-5 5"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
};

/** Hình vẽ trên tem hộ chiếu, theo loại biểu tượng */
export function stampArt(icon: string, color: string) {
  const c = color;
  const art: Record<string, string> = {
    plane: `<path d="M8 40 56 18c4-2 7 2 4 5L36 40l2 14-5 2-7-11-11 7-5-2 6-8z" fill="${c}"/>`,
    dragon: `<path d="M6 44c6-14 12-14 16 0s10 14 16 0 10-14 14-4l4-6 4 2-3 6 3 3-6 1c-3 8-9 8-13-2-4 12-12 12-16 0-4 10-10 10-14 4z" fill="${c}"/>`,
    lock: `<path d="M20 30v-8a12 12 0 0 1 24 0v8" stroke="${c}" stroke-width="5" fill="none"/><path d="M32 58 14 40a10 10 0 0 1 18-12 10 10 0 0 1 18 12z" fill="${c}"/>`,
    fish: `<path d="M10 34c10-14 30-18 42-6l6-8v28l-6-8C40 52 20 48 10 34z" fill="${c}"/><circle cx="20" cy="31" r="2.5" fill="#fff"/>`,
    city: `<path d="M8 54V30h8v-8h8v32h4V16h10v38h4V26h8v28h6v4H4v-4z" fill="${c}"/>`,
    fire: `<path d="M32 6c4 12 16 16 16 32a16 16 0 0 1-32 0c0-8 4-12 8-16 0 8 4 10 6 10-4-10 0-18 2-26z" fill="${c}"/>`,
    sunset: `<circle cx="32" cy="38" r="14" fill="${c}"/><rect x="4" y="38" width="56" height="22" fill="#e8eee4"/><path d="M8 44h48M14 50h36M22 56h20" stroke="${c}" stroke-width="3"/>`,
    rain: `<path d="M14 34a12 12 0 0 1 8-20 14 14 0 0 1 26 4 9 9 0 0 1 2 16z" fill="${c}"/><path d="M20 42l-4 10M32 42l-4 10M44 42l-4 10" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`,
    wave: `<path d="M4 34c6-8 12-8 18 0s12 8 18 0 12-8 18 0v8c-6-8-12-8-18 0s-12 8-18 0-12-8-18 0z" fill="${c}"/><path d="M4 50c6-6 12-6 18 0s12 6 18 0 12-6 18 0" stroke="${c}" stroke-width="4" fill="none"/>`,
    tower: `<path d="M20 30h24l-4 -10H24z" fill="${c}"/><rect x="22" y="30" width="20" height="10" fill="${c}"/><path d="M24 40l-4 18M40 40l4 18M22 50h20" stroke="${c}" stroke-width="3"/><path d="M32 20V8l10 4-10 4" fill="${c}"/>`,
    bridge: `<rect x="4" y="30" width="56" height="6" fill="${c}"/><path d="M10 36v18M54 36v18M32 36v18" stroke="${c}" stroke-width="5"/><path d="M4 58h56" stroke="${c}" stroke-width="3" opacity=".5"/><path d="M38 30 46 8l3 1-6 21M46 8 22 30M46 8l10 22" stroke="${c}" stroke-width="2" fill="none"/>`,
    boat: `<path d="M8 32h48c0 14-11 22-24 22S8 46 8 32z" fill="${c}"/><path d="M14 36h36M18 42h28" stroke="#e8eee4" stroke-width="2"/><path d="M40 30 52 10" stroke="${c}" stroke-width="3"/>`,
    sunrise: `<rect x="4" y="40" width="56" height="20" fill="${c}" opacity=".35"/><path d="M14 40a18 18 0 0 1 36 0z" fill="${c}"/><path d="M32 8v8M12 16l5 5M52 16l-5 5" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,
    bike: `<circle cx="14" cy="46" r="8" fill="none" stroke="${c}" stroke-width="4"/><circle cx="50" cy="46" r="8" fill="none" stroke="${c}" stroke-width="4"/><path d="M14 46h18l8-18h8M24 30h14M40 28l-4-10h8" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M22 34h16v8H22z" fill="${c}"/>`,
    taxi: `<rect x="8" y="28" width="48" height="16" rx="4" fill="${c}"/><path d="M16 28l6-10h20l6 10z" fill="${c}"/><rect x="26" y="10" width="12" height="6" fill="${c}"/><circle cx="18" cy="46" r="5" fill="${c}"/><circle cx="46" cy="46" r="5" fill="${c}"/>`,
  };
  return `<svg viewBox="0 0 64 64">${art[icon] ?? art.plane}</svg>`;
}
