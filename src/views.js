import { esc, euro, shortDate, weekdayDate, monthLabel, headerDate, goalDateLabel, inDays, workMinutes } from './ui/format.js';

const RING = 2 * Math.PI * 40;

const ICON = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  peak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20l6-11 4 6 3-4 5 9z"/></svg>'
};

const initials = (s) => esc((s || '?').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?');

export function overview(snap, d, { now = new Date() } = {}) {
  const g = d.nextGoal;
  const pct = g ? Math.round(g.fortschritt * 100) : 0;
  const gold = g && g.fortschritt >= 0.9;
  const goalBlock = g
    ? `<div class="goalrow">
        <div class="ring">
          <svg width="96" height="96"><circle cx="48" cy="48" r="40" stroke="var(--surface2)" stroke-width="10" fill="none"/><circle class="ring-fill" cx="48" cy="48" r="40" stroke="${gold ? 'var(--gold)' : 'var(--neon)'}" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="${RING}" stroke-dashoffset="${RING}" data-offset="${RING * (1 - g.fortschritt)}"/></svg>
          <div class="pct num" data-count="${pct}" data-suffix="%">0%</div>
        </div>
        <div class="goalinfo">
          <div class="label">Nächstes Ziel</div>
          <b>${esc(g.name)}</b>
          <span>${euro(g.zugeteilt)} von ${euro(g.kosten)}</span><br>
          <span class="chip">● ${g.tageBis === 0 ? 'Kaufbereit!' : g.datum ? `${shortDate(g.datum)} · noch ${g.tageBis} Tage` : 'noch kein Termin'}</span>
        </div>
      </div>`
    : `<div class="goalinfo" style="margin-top:12px"><span class="chip">Alle Ziele erreicht 🎉</span></div>`;
  const tile = (label, value, hint, accent) =>
    `<div class="card stat"><div class="label">${label}</div><div class="num" ${accent ? 'style="color:var(--neon)"' : ''}>${value}</div><div class="hint">${hint}</div></div>`;
  return `
    <div class="sub" style="margin:0">${esc(headerDate(now))}</div>
    <h1>Hey ${esc(snap.profile?.name || 'David')}</h1>
    <div class="card hero">
      <div class="label">Gesamt gespart</div>
      <div class="big num" data-count="${d.balance}" data-suffix=" <small>€</small>">0 <small>€</small></div>
      ${goalBlock}
    </div>
    <div class="grid2">
      ${tile('Nächster Zahltag', d.nextPayday ? shortDate(d.nextPayday.datum) : '–', d.nextPayday ? `+${euro(d.nextPayday.betrag)} · ${inDays(d.nextPayday.tageBis)}` : 'keine Einnahmen', false)}
      ${tile('Dauerauftrag', d.nextTransfer ? shortDate(d.nextTransfer.datum) : '–', d.nextTransfer ? `${euro(d.nextTransfer.betrag)} → PayPal` : 'keiner angelegt', false)}
      ${tile(`Ausgaben ${esc(monthLabel(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`).split(' ')[0])}`, euro(d.monthSpent), `${d.monthCount} Einträge`, false)}
      ${tile('Rewe-Besuche', String(d.reweCount), 'diesen Monat', d.reweCount === 0)}
    </div>
    <div class="card">
      <div class="label" style="margin-bottom:6px">Monat im Überblick</div>
      <div class="kv"><span>Einnahmen</span><b class="num">+${euro(d.incomeSum)}</b></div>
      <div class="kv"><span>Feste Ausgaben</span><b class="num">−${euro(d.fixedSum)}</b></div>
      <div class="kv"><span>Sparen (PayPal)</span><b class="num neon">−${euro(d.savingsSum)}</b></div>
      <div class="kv total"><span>Bleibt frei</span><b class="num ${d.frei < 0 ? 'red' : ''}">${euro(d.frei)}</b></div>
    </div>
  `;
}

export function expenses(snap, d, { now = new Date() } = {}) {
  const list = [...(snap.expenses || [])].sort((a, b) => (a.datum === b.datum ? (b.erstellt || 0) - (a.erstellt || 0) : a.datum < b.datum ? 1 : -1));
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const groups = [];
  for (const e of list) {
    const key = e.datum.slice(0, 7);
    let grp = groups.find((x) => x.key === key);
    if (!grp) groups.push((grp = { key, items: [] }));
    grp.items.push(e);
  }
  const rows = groups
    .map(
      (grp) => `
      ${grp.key === month ? '' : `<div class="label group-label">${esc(monthLabel(`${grp.key}-01`))} · ${euro(grp.items.reduce((s, e) => s + e.betrag, 0))}</div>`}
      <div class="card list">${grp.items
        .map(
          (e) => `<button class="row" data-expense="${esc(e.id)}">
            <div class="ico">${initials(e.haendler)}</div>
            <div class="t"><b>${esc(e.haendler || 'Ausgabe')}${e.impuls ? '<span class="tag">Impuls</span>' : ''}</b><span>${esc(weekdayDate(e.datum))} · ${esc(e.kategorie || 'Sonstiges')} · ${workMinutes(e.betrag)} Min. Arbeit</span></div>
            <div class="amt num">−${euro(e.betrag, { cents: true })}</div>
          </button>`
        )
        .join('')}</div>`
    )
    .join('');
  return `
    <h1>Ausgaben</h1>
    <div class="sub">${esc(monthLabel(`${month}-01`).split(' ')[0])} · <span class="num">${euro(d.monthSpent, { cents: true })}</span> ausgegeben${d.impulseCount ? ` · ${d.impulseCount}× Impuls` : ''}</div>
    <button class="rewe" id="rewe-btn">+ Schnell: Rewe-Einkauf</button>
    ${rows || `<div class="card empty"><div class="ico">${ICON.list}</div><div>Noch keine Ausgaben. Tipp: Der Rewe-Knopf oben füllt alles bis auf den Betrag schon aus.</div></div>`}
  `;
}

export function goals(snap, d) {
  const cards = d.plan
    .map((g, i) => {
      const pct = Math.round(g.fortschritt * 100);
      return `<div class="card goal" data-id="${esc(g.id)}">
        <button class="handle" aria-label="${esc(g.name)} verschieben">${ICON.grip}</button>
        <div class="thumb" style="background:${esc(g.farbe || '#1d3fae')};filter:grayscale(${100 - pct}%)">${i + 1}</div>
        <button class="t goal-open" data-goal="${esc(g.id)}">
          <b>${esc(g.name)}</b>
          <div class="bar"><i class="${g.fortschritt >= 0.9 ? 'gold' : ''}" data-w="${Math.max(pct, 2)}"></i></div>
          <div class="meta"><span class="num">${euro(g.zugeteilt)} / ${euro(g.kosten)}</span><span>${esc(goalDateLabel(g))}</span></div>
        </button>
      </div>`;
    })
    .join('');
  const reached = d.reached.length
    ? `<div class="label group-label">Erreicht</div><div class="card list">${d.reached
        .map((g) => `<button class="row" data-goal="${esc(g.id)}"><div class="ico" style="color:var(--gold)">✓</div><div class="t"><b>${esc(g.name)}</b><span>gekauft am ${esc(weekdayDate(g.erreichtAm))}</span></div><div class="amt num">${euro(g.kosten)}</div></button>`)
        .join('')}</div>`
    : '';
  return `
    <h1>Ziele</h1>
    <div class="sub">Sparrate ${euro(d.savingsSum)} im Monat · Termine rechnen sich automatisch</div>
    <div id="goal-list">${cards || `<div class="card empty"><div class="ico">${ICON.peak}</div><div>Noch keine offenen Ziele.</div></div>`}</div>
    <button class="ghost wide" id="goal-add">+ Neues Ziel</button>
    ${reached}
  `;
}

export function profile(snap, d, { mode, user, syncPending }) {
  const listRows = (col, items, render) =>
    items.length
      ? items.map((it) => `<button class="row" data-edit="${col}" data-id="${esc(it.id)}">${render(it)}</button>`).join('')
      : '<div class="hint" style="padding:8px 0">Noch nichts angelegt</div>';
  const period = (it) => [it.aktivAb ? `ab ${shortDate(it.aktivAb)} ${it.aktivAb.slice(0, 4)}` : '', it.aktivBis ? `bis ${shortDate(it.aktivBis)} ${it.aktivBis.slice(0, 4)}` : ''].filter(Boolean).join(' · ');
  const byDay = (a, b) => (a.tagImMonat || 99) - (b.tagImMonat || 99);
  return `
    <h1>Profil</h1>
    <div class="sub">${mode === 'cloud' ? `Angemeldet als ${esc(user?.email || '')}` : 'Lokaler Modus – Daten nur auf diesem Gerät'}</div>
    <div class="card level">
      <div class="lvl">${snap.profile?.level || 1}</div>
      <div><b style="font-size:18px">Spar-Neuling</b><div class="sub" style="margin:2px 0 0">${snap.profile?.xp || 0} XP · Belohnungen kommen in Etappe 2</div></div>
    </div>
    <div class="card">
      <div class="label section-head">Spar-Topf (PayPal)<span class="num">${euro(d.balance, { cents: true })}</span></div>
      <p class="hint">Daueraufträge werden an ihrem Tag automatisch gebucht. Stimmt der Stand nicht mit PayPal überein, gleich ihn hier ab.</p>
      <button class="ghost wide" id="pot-adjust">Stand abgleichen</button>
    </div>
    <div class="card">
      <div class="label section-head">Einnahmen<button class="mini" data-add="income">+ Neu</button></div>
      ${listRows('income', [...snap.income].sort(byDay), (it) => `<div class="t"><b>${esc(it.name)}</b><span>am ${it.tagImMonat}.${period(it) ? ` · ${esc(period(it))}` : ''}</span></div><div class="amt num neon">+${euro(it.betrag)}</div>`)}
    </div>
    <div class="card">
      <div class="label section-head">Feste Ausgaben<span class="num">${euro(d.fixedSum)}</span></div>
      ${snap.fixed
        .map(
          (it) => `<div class="row fixed-row">
            <button class="t" data-edit="fixed" data-id="${esc(it.id)}"><b>${esc(it.name)}</b><span>${it.pausiert ? 'pausiert' : it.tagImMonat ? `am ${it.tagImMonat}.` : 'monatlich'}</span></button>
            <div class="amt num ${it.pausiert ? 'muted strike' : ''}">−${euro(it.betrag)}</div>
            <button class="sw ${it.pausiert ? '' : 'on'}" data-toggle-fixed="${esc(it.id)}" aria-label="${esc(it.name)} ${it.pausiert ? 'fortsetzen' : 'pausieren'}"></button>
          </div>`
        )
        .join('')}
      <button class="mini wide-mini" data-add="fixed">+ Feste Ausgabe</button>
    </div>
    <div class="card">
      <div class="label section-head">Daueraufträge<span class="num">${euro(d.savingsSum)}/Monat</span></div>
      ${listRows('savingsRules', [...snap.savingsRules].sort(byDay), (it) => `<div class="t"><b>${esc(it.name || `Dauerauftrag ${it.tagImMonat}.`)}</b><span>am ${it.tagImMonat}.${period(it) ? ` · ${esc(period(it))}` : ''}</span></div><div class="amt num">${euro(it.betrag)}</div>`)}
      <button class="mini wide-mini" data-add="savingsRules">+ Dauerauftrag</button>
    </div>
    <div class="card">
      <div class="status-row"><span>Synchronisation</span><span class="${mode === 'cloud' ? 'ok' : ''}">${mode === 'cloud' ? (syncPending ? 'wartet auf Verbindung …' : 'aktuell') : 'aus (Firebase fehlt)'}</span></div>
      ${mode === 'cloud' ? '<div class="status-row"><span>Konto</span><button class="mini" id="logout">Abmelden</button></div>' : ''}
    </div>
  `;
}

export function loginScreen() {
  return `
    <div class="login">
      <div class="login-logo">€</div>
      <h1>Finanzplaner</h1>
      <p class="sub">Melde dich an, damit Handy und PC dieselben Daten sehen.</p>
      <button class="cta google" id="login-google">Mit Google anmelden</button>
      <div class="or"><span>oder</span></div>
      <form id="login-form" novalidate>
        <input class="input" id="login-email" type="email" autocomplete="email" placeholder="E-Mail">
        <input class="input" id="login-password" type="password" autocomplete="current-password" placeholder="Passwort">
        <div class="form-error" id="login-error" role="alert"></div>
        <button class="cta" type="submit">Anmelden</button>
        <div class="login-links"><button type="button" class="link" id="login-register">Konto erstellen</button><button type="button" class="link" id="login-reset">Passwort vergessen?</button></div>
      </form>
    </div>
  `;
}
