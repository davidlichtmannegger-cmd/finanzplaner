export const peakHeight = (kosten) => 3 + Math.sqrt(Math.max(0, kosten)) / 6;

export function buildRoute(goals, { reserve = 0 } = {}) {
  const peaks = [];
  let from = 0;
  let x = 0;
  if (reserve > 0) {
    peaks.push({ id: 'notfall', name: 'Notfalltopf', kosten: reserve, from, to: from + reserve, h: 2.2, x, z: 0, camp: true });
    from += reserve;
    x += 7;
  }
  goals.forEach((g, i) => {
    const h = peakHeight(g.kosten);
    peaks.push({ id: g.id, name: g.name, kosten: g.kosten, from, to: from + g.kosten, h, x, z: i % 2 ? -4 : 3, farbe: g.farbe });
    from += g.kosten;
    x += 6 + h * 0.9;
  });
  return { peaks, total: from };
}

export function positionAt(route, money) {
  const { peaks } = route;
  if (!peaks.length) return { index: -1, t: 0, done: true };
  const m = Math.max(0, money);
  for (let i = 0; i < peaks.length; i++) {
    const p = peaks[i];
    if (m < p.to) return { index: i, t: (m - p.from) / (p.to - p.from || 1), done: false };
  }
  return { index: peaks.length - 1, t: 1, done: true };
}

export function hutsAlong(route, balance, transfers, limit = 6) {
  const huts = [];
  let money = balance;
  for (const tr of transfers) {
    money += tr.betrag;
    if (money >= route.total) break;
    const pos = positionAt(route, money);
    huts.push({ datum: tr.datum, betrag: tr.betrag, money, ...pos });
    if (huts.length >= limit) break;
  }
  return huts;
}

export const impulseSum = (expenses = []) => Math.round(expenses.filter((e) => e.impuls && !e.taschengeld).reduce((s, e) => s + (e.betrag || 0), 0) * 100) / 100;

export function dayPhase(hour, minute = 0) {
  const h = hour + minute / 60;
  if (h < 5 || h >= 21.5) return 'nacht';
  if (h < 7.5) return 'morgen';
  if (h < 17.5) return 'tag';
  if (h < 19.5) return 'abend';
  return 'daemmerung';
}

export function sunAngle(hour, minute = 0) {
  const h = hour + minute / 60;
  return ((h - 6) / 12) * Math.PI;
}
