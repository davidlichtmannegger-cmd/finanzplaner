import { parseYmd } from '../logic/dates.js';

const HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => HTML[c]);

export const euro = (n, { cents = 'auto' } = {}) => {
  const v = Number(n) || 0;
  const withCents = cents === true || (cents === 'auto' && Math.round(v * 100) % 100 !== 0);
  return `${v.toLocaleString('de-DE', { minimumFractionDigits: withCents ? 2 : 0, maximumFractionDigits: withCents ? 2 : 0 })} €`;
};

export const parseAmount = (s) => {
  const clean = String(s ?? '').replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const v = Number.parseFloat(clean);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN;
};

const fmt = (opts) => new Intl.DateTimeFormat('de-DE', opts);
const SHORT = fmt({ day: 'numeric', month: 'short' });
const LONG = fmt({ day: 'numeric', month: 'long', year: 'numeric' });
const WEEKDAY = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
const MONTH = fmt({ month: 'long', year: 'numeric' });
const HEADER = fmt({ weekday: 'long', day: 'numeric', month: 'long' });

export const shortDate = (ymd) => SHORT.format(parseYmd(ymd)).replace('.', '');
export const longDate = (ymd) => LONG.format(parseYmd(ymd));
export const weekdayDate = (ymd) => WEEKDAY.format(parseYmd(ymd));
export const monthLabel = (ymd) => MONTH.format(parseYmd(ymd));
export const headerDate = (d = new Date()) => HEADER.format(d);

export const goalDateLabel = (goal) => {
  if (!goal.datum) return 'außer Reichweite';
  if (goal.wartetAufTermin && goal.datum.endsWith('-01')) return MONTH.format(parseYmd(goal.datum));
  return longDate(goal.datum);
};

export const inDays = (n) => (n === 0 ? 'heute' : n === 1 ? 'morgen' : `in ${n} Tagen`);

export const workMinutes = (betrag, stundenlohn = 13.5) => Math.round((betrag / stundenlohn) * 60);
