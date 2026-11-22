import { esc, parseAmount } from './format.js';

export function formSheet({ title, fields, values = {}, submitLabel = 'Speichern', onSubmit, extraActions = [] }) {
  const form = document.createElement('form');
  form.className = 'sheet-form';
  form.noValidate = true;
  form.innerHTML = `
    <div class="label sheet-title">${esc(title)}</div>
    ${fields.map((f) => field(f, values[f.key])).join('')}
    <div class="form-error" role="alert"></div>
    <button class="cta" type="submit">${esc(submitLabel)}</button>
    ${extraActions.length ? `<div class="sheet-actions">${extraActions.map((a, i) => `<button type="button" class="ghost ${a.danger ? 'danger' : ''}" data-extra="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}
  `;
  form.querySelectorAll('[data-seg]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-v]');
      if (!btn) return;
      group.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
      group.dataset.value = btn.dataset.v;
      group.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  form.querySelectorAll('[data-swatches]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-v]');
      if (!btn) return;
      group.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
      group.dataset.value = btn.dataset.v;
    });
  });
  const read = () => {
    const out = {};
    for (const f of fields) {
      const el = form.querySelector(`[data-key="${f.key}"]`);
      if (!el) continue;
      if (f.type === 'segments' || f.type === 'swatches') out[f.key] = el.dataset.value;
      else if (f.type === 'checkbox') out[f.key] = el.checked;
      else if (f.type === 'amount') out[f.key] = parseAmount(el.value);
      else if (f.type === 'number') out[f.key] = el.value === '' ? null : Number(el.value);
      else out[f.key] = el.value.trim() || null;
    }
    return out;
  };
  const error = form.querySelector('.form-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = read();
    for (const f of fields) {
      if (f.required && (data[f.key] === null || data[f.key] === '' || Number.isNaN(data[f.key]))) {
        error.textContent = `${f.label} fehlt`;
        form.querySelector(`[data-key="${f.key}"]`)?.focus({ preventScroll: true });
        return;
      }
      if (f.type === 'amount' && f.required && !(data[f.key] > 0)) {
        error.textContent = `${f.label} muss größer als 0 sein`;
        return;
      }
      if (f.type === 'number' && data[f.key] !== null && (data[f.key] < (f.min ?? -Infinity) || data[f.key] > (f.max ?? Infinity))) {
        error.textContent = `${f.label}: ${f.min}–${f.max}`;
        return;
      }
    }
    error.textContent = '';
    await onSubmit(data);
  });
  form.querySelectorAll('[data-extra]').forEach((btn) => btn.addEventListener('click', () => extraActions[Number(btn.dataset.extra)].onClick(read())));
  form.read = read;
  return form;
}

function field(f, value) {
  const v = value ?? f.default ?? '';
  const label = `<span class="field-label">${esc(f.label)}${f.hint ? ` <em>${esc(f.hint)}</em>` : ''}</span>`;
  switch (f.type) {
    case 'amount':
      return `<label class="field ${f.big ? 'big' : ''}">${f.big ? '' : label}<input data-key="${f.key}" inputmode="decimal" autocomplete="off" placeholder="${esc(f.placeholder || '0,00 €')}" value="${v === '' ? '' : esc(String(v).replace('.', ','))}" aria-label="${esc(f.label)}"></label>`;
    case 'number':
      return `<label class="field">${label}<input data-key="${f.key}" type="number" inputmode="numeric" min="${f.min ?? ''}" max="${f.max ?? ''}" value="${esc(v)}"></label>`;
    case 'date':
      return `<label class="field">${label}<input data-key="${f.key}" type="date" value="${esc(v)}"></label>`;
    case 'select':
      return `<label class="field">${label}<select data-key="${f.key}">${f.options.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    case 'segments':
      return `<div class="segs" data-seg data-key="${f.key}" data-value="${esc(v)}">${f.options.map((o) => `<button type="button" data-v="${esc(o.value)}" class="${o.value === v ? 'on' : ''}">${esc(o.label)}</button>`).join('')}</div>`;
    case 'swatches':
      return `<div class="field">${label}<div class="swatches" data-swatches data-key="${f.key}" data-value="${esc(v)}">${f.options.map((c) => `<button type="button" data-v="${esc(c)}" class="${c === v ? 'on' : ''}" style="background:${esc(c)}" aria-label="Farbe ${esc(c)}"></button>`).join('')}</div></div>`;
    case 'checkbox':
      return `<label class="field check-field"><input data-key="${f.key}" type="checkbox" ${v ? 'checked' : ''}>${label}</label>`;
    default:
      return `<label class="field">${label}<input data-key="${f.key}" type="text" autocomplete="off" ${f.list ? `list="${f.key}-list"` : ''} placeholder="${esc(f.placeholder || '')}" value="${esc(v)}">${f.list ? `<datalist id="${f.key}-list">${f.list.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : ''}</label>`;
  }
}
