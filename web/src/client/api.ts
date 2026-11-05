// Gọi API + đồng bộ giờ với máy chủ (đồng hồ thế giới chạy theo giờ server, không theo máy người dùng).
let offset = 0;

export async function syncTime() {
  try {
    const t0 = Date.now();
    const r = await fetch('/api/time').then((r) => r.json());
    const t1 = Date.now();
    offset = r.now - (t0 + t1) / 2;
  } catch { /* dùng giờ máy */ }
}
export const serverNow = () => Date.now() + offset;

export async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? 'Không tải được dữ liệu, kiểm tra kết nối mạng rồi thử lại.');
  return body as T;
}
export async function postJSON<T>(url: string, data: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? 'Gửi không thành công, thử lại sau.');
  return body as T;
}
