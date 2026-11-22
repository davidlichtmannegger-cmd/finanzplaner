const pad = (n) => String(n).padStart(2, '0');

export const ymd = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseYmd = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const today = (now = new Date()) => ymd(now);

export const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

export const dateInMonth = (year, monthIndex, day) => ymd(new Date(year, monthIndex, Math.min(day, daysInMonth(year, monthIndex))));

export const addDays = (s, n) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

export const daysBetween = (from, to) => Math.round((parseYmd(to) - parseYmd(from)) / 86400000);

export const maxDate = (a, b) => (!a ? b : !b ? a : a > b ? a : b);

export function* monthlyDates(day, from, to) {
  const start = parseYmd(from);
  const end = parseYmd(to);
  let y = start.getFullYear();
  let m = start.getMonth();
  while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
    const date = dateInMonth(y, m, day);
    if (date >= from && date <= to) yield date;
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
}

export const isActive = (item, date) => (!item.aktivAb || date >= item.aktivAb) && (!item.aktivBis || date <= item.aktivBis);
