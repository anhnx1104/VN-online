// Bộ lọc từ ngữ đơn giản cho chat và lời nhắn (bản v1; sau này thay bằng dịch vụ kiểm duyệt).
const BAD = [
  // Chỉ giữ từ không trùng với tiếng Việt gõ không dấu (tránh chặn nhầm "buoi toi", "lon ton"...)
  'đm', 'dm', 'đmm', 'dmm', 'vcl', 'vkl', 'clm', 'đéo', 'địt', 'lồn', 'buồi',
  'cặc', 'đĩ', 'chó đẻ', 'óc chó', 'fuck', 'shit', 'bitch', 'cunt', 'dick',
];
const strip = (s: string) => s.normalize('NFC').toLowerCase();

export function cleanText(input: string, max = 140): string {
  let s = input.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const words = s.split(' ');
  s = words
    .map((w) => {
      const bare = strip(w).replace(/[.,!?;:"'()]/g, '');
      return BAD.includes(bare) ? '•'.repeat(Math.max(2, [...w].length)) : w;
    })
    .join(' ');
  for (const phrase of BAD.filter((b) => b.includes(' '))) {
    const re = new RegExp(phrase, 'gi');
    s = s.replace(re, (m) => '•'.repeat(m.length));
  }
  return s;
}

export function cleanName(input: string): string {
  const s = cleanText(input, 18).replace(/[<>]/g, '');
  return s || 'Lữ khách';
}
