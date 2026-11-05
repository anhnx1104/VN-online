// Ghép bưu thiếp: ảnh chụp thế giới + viền giấy + tem + dấu bưu điện có giờ thật + lời nhắn viết tay.
export interface PostcardInfo {
  shot: HTMLCanvasElement;
  place: string;
  city: string;
  clock: string;
  date: string;
  weather: string;
  name: string;
  note: string;
}

function roundRectPerforated(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, hole: number, gap: number) {
  g.save();
  g.fillStyle = '#e8eee4';
  g.fillRect(x, y, w, h);
  g.globalCompositeOperation = 'destination-out';
  for (let i = x; i <= x + w; i += gap) { g.beginPath(); g.arc(i, y, hole, 0, 7); g.arc(i, y + h, hole, 0, 7); g.fill(); }
  for (let j = y; j <= y + h; j += gap) { g.beginPath(); g.arc(x, j, hole, 0, 7); g.arc(x + w, j, hole, 0, 7); g.fill(); }
  g.restore();
}

export async function composePostcard(info: PostcardInfo): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const W = 1800, H = 1200, M = 48;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f6f3ea';
  g.fillRect(0, 0, W, H);

  // ảnh (cắt cover)
  const pw = W - M * 2, ph = H - M * 2 - 150;
  const s = info.shot;
  const scale = Math.max(pw / s.width, ph / s.height);
  const sw = pw / scale, sh = ph / scale;
  g.drawImage(s, (s.width - sw) / 2, (s.height - sh) / 2, sw, sh, M, M, pw, ph);

  // dòng chữ viết tay dưới ảnh
  g.fillStyle = '#12213d';
  g.font = '64px "Patrick Hand", cursive';
  g.textBaseline = 'alphabetic';
  const note = info.note || `Gửi từ ${info.place}`;
  g.fillText(note.length > 46 ? note.slice(0, 45) + '…' : note, M + 6, H - M - 62);
  g.font = '40px "Patrick Hand", cursive';
  g.fillStyle = '#4a5a78';
  g.fillText(`— ${info.name}`, M + 10, H - M - 12);

  // tem
  const tx = W - M - 230, ty = H - M - 300;
  roundRectPerforated(g, tx, ty, 200, 250, 7, 20);
  g.fillStyle = '#c8102e';
  g.fillRect(tx + 18, ty + 18, 164, 214);
  g.fillStyle = '#f2b705';
  g.beginPath();
  const cx = tx + 100, cy = ty + 110, R = 52, r = 21;
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.fill();
  g.font = '800 26px "Be Vietnam Pro", sans-serif';
  g.textAlign = 'center';
  g.fillText('VIỆT NAM', cx, ty + 205);
  g.textAlign = 'left';

  // dấu bưu điện tròn, đè lên tem
  g.save();
  g.translate(tx - 40, ty + 150);
  g.rotate(-0.22);
  g.strokeStyle = 'rgba(18,33,61,0.78)';
  g.fillStyle = 'rgba(18,33,61,0.82)';
  g.lineWidth = 5;
  g.beginPath(); g.arc(0, 0, 110, 0, 7); g.stroke();
  g.lineWidth = 2.5;
  g.beginPath(); g.arc(0, 0, 92, 0, 7); g.stroke();
  g.textAlign = 'center';
  g.font = '800 30px "Be Vietnam Pro", sans-serif';
  g.fillText(info.city.toUpperCase(), 0, -26);
  g.font = '700 46px "Be Vietnam Pro", sans-serif';
  g.fillText(info.clock, 0, 22);
  g.font = '600 24px "Be Vietnam Pro", sans-serif';
  g.fillText(info.date, 0, 58);
  g.restore();
  // các vạch sóng của dấu
  g.strokeStyle = 'rgba(18,33,61,0.6)';
  g.lineWidth = 4;
  for (let k = 0; k < 4; k++) {
    g.beginPath();
    for (let x = 0; x <= 260; x += 6) g.lineTo(tx - 330 + x, ty + 90 + k * 26 + Math.sin(x / 22) * 6);
    g.stroke();
  }

  // dòng thông tin nhỏ
  g.font = '500 26px "Be Vietnam Pro", sans-serif';
  g.fillStyle = '#4a5a78';
  g.textAlign = 'right';
  g.fillText(`${info.place}, ${info.weather}`, W - M - 260, H - M - 12);
  g.textAlign = 'left';
  return c;
}
