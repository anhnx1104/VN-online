// Thẻ lên máy bay: nhập tên, chọn áo, nón lá, rồi "xé cuống vé" để bay tới điểm đến.
import { h } from './dom';
import { SHIRTS, getProfile, saveProfile, type Profile } from '../profile';
import { HAIR_STYLES } from '../engine/Avatar';
import { fmtClock } from '../../shared/schedule';
import { serverNow } from '../api';
import type { RegistryEntry } from '../../shared/pack';

export function openBoarding(dest: Pick<RegistryEntry, 'name' | 'airport' | 'utcOffsetMin' | 'code'>, onBoard: (p: Profile) => void, onCancel?: () => void) {
  const prof = getProfile();
  let color = prof?.color ?? SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
  const nameInput = h('input', { type: 'text', id: 'bp-name', maxlength: 18, autocomplete: 'nickname', placeholder: 'Ví dụ: Minh Anh', value: prof?.name ?? '', required: true });
  const hat = h('input', { type: 'checkbox', id: 'bp-hat', ...(prof?.hat ? { checked: true } : {}) });
  const sw = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Màu áo' });
  for (const c of SHIRTS) {
    const b = h('button', { type: 'button', class: 'swatch', role: 'radio', 'aria-checked': String(c === color), 'aria-label': 'Áo màu ' + c, style: `background:${c}` });
    b.addEventListener('click', () => {
      color = c;
      sw.querySelectorAll('.swatch').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    });
    sw.append(b);
  }
  let hair = prof?.hair ?? Math.floor(Math.random() * HAIR_STYLES.length);
  const hairSeg = h('div', { class: 'seg seg-paper', role: 'radiogroup', 'aria-label': 'Kiểu tóc' });
  HAIR_STYLES.forEach((label, i) => {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(i === hair), 'aria-pressed': String(i === hair) }, label);
    b.addEventListener('click', () => {
      hair = i;
      hairSeg.querySelectorAll('button').forEach((x) => { x.setAttribute('aria-pressed', String(x === b)); x.setAttribute('aria-checked', String(x === b)); });
    });
    hairSeg.append(b);
  });
  const seat = `${10 + Math.floor(Math.random() * 30)}${'ABCDEF'[Math.floor(Math.random() * 6)]}`;
  const gate = `${'ABC'[Math.floor(Math.random() * 3)]}${1 + Math.floor(Math.random() * 12)}`;
  const go = h('button', { type: 'submit', class: 'btn btn-red' }, 'Lên máy bay');
  const status = h('div', { class: 'pass-loading', 'aria-live': 'polite' });

  const pass = h('form', { class: 'pass' },
    h('div', { class: 'pass-main' },
      h('div', { class: 'pass-top' }, h('span', {}, 'Thẻ lên máy bay'), h('b', {}, 'Chuyến VNO 01')),
      h('div', { class: 'route' },
        h('div', {}, h('div', { class: 'iata' }, 'NHÀ'), h('div', { class: 'city' }, 'Nơi bạn đang ngồi')),
        h('div', { class: 'plane', 'aria-hidden': 'true' }),
        h('div', {}, h('div', { class: 'iata' }, dest.airport), h('div', { class: 'city' }, dest.name)),
      ),
      h('div', { class: 'field' }, h('label', { for: 'bp-name' }, 'Tên hiển thị với người khác'), nameInput),
      h('div', { class: 'field' }, h('label', {}, 'Màu áo'), sw),
      h('div', { class: 'field' }, h('label', {}, 'Kiểu tóc'), hairSeg),
      h('label', { class: 'toggle' }, hat, 'Đội nón lá'),
    ),
    h('div', { class: 'pass-stub' },
      h('div', { class: 'stub-row' },
        h('div', {}, 'Cửa', h('b', {}, gate)),
        h('div', {}, 'Ghế', h('b', {}, seat)),
        h('div', {}, 'Giờ ' + dest.name, h('b', {}, fmtClock(serverNow(), dest.utcOffsetMin))),
        h('div', {}, 'Hạng', h('b', {}, 'Phổ thông')),
      ),
      h('div', { class: 'barcode', 'aria-hidden': 'true' }),
      go,
      status,
    ),
  );
  const bg = h('div', { class: 'modal-bg', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Thẻ lên máy bay tới ' + dest.name }, pass);
  bg.addEventListener('click', (e) => { if (e.target === bg && onCancel) { bg.remove(); onCancel(); } });
  addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape' && onCancel && document.body.contains(bg)) { bg.remove(); onCancel(); removeEventListener('keydown', esc); }
  });
  pass.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) { status.textContent = 'Nhập tên để người khác biết bạn là ai.'; nameInput.focus(); return; }
    saveProfile({ name, color, hat: hat.checked, hair });
    go.setAttribute('disabled', '');
    status.textContent = `Đang bay tới ${dest.name}…`;
    pass.classList.add('tearing');
    setTimeout(() => { bg.remove(); onBoard(getProfile()!); }, 750);
  });
  document.body.append(bg);
  setTimeout(() => nameInput.focus(), 50);
}
