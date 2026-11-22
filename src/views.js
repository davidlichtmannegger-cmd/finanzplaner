import { esc, euro, shortDate, weekdayDate, monthLabel, headerDate, goalDateLabel, inDays, workMinutes } from './ui/format.js';
import { toolsRow, monthlyCheckCard, roundUpCard } from './tool-views.js';

const RING = 2 * Math.PI * 40;

const ICON = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  peak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20l6-11 4 6 3-4 5 9z"/></svg>'
};

const confirmCard = (e) => `
  <div class="card confirm" data-ledger="${esc(e.id)}">
    <div class="label">Dauerauftrag vom ${esc(shortDate(e.datum))}</div>
    <b>Überweisung erledigt?</b>
    <div class="hint" style="margin:4px 0 12px">${euro(e.betrag)} → PayPal-Spar-Topf</div>
    <div class="confirm-actions"><button class="cta" data-confirm="yes" data-id="${esc(e.id)}">Ja, erledigt · +50 XP</button><button class="ghost" data-confirm="no" data-id="${esc(e.id)}">Nein</button></div>
  </div>`;

const questRow = (q) => {
  const state = { claimed: 'done', ready: 'ready', failed: 'failed', open: '' }[q.status];
  const note = q.status === 'open' ? q.hint : q.status === 'failed' ? 'heute leider verpasst' : q.status === 'ready' ? 'Antippen zum Abholen' : 'geschafft';
  return `<div class="quest ${q.status}">
    <button class="check ${state}" ${q.status === 'ready' ? `data-claim="${esc(q.id)}" data-xp="${q.xp}"` : 'disabled'} aria-label="${esc(q.text)}"></button>
    <p>${esc(q.text)}<span>${esc(note)}</span></p>
    <em>+${q.xp} XP</em>
  </div>`;
};

const weekCard = (w) => {
  const pct = w.unit === '€' ? Math.min(100, (w.value / (w.limit + 1)) * 100) : w.limit === 0 ? (w.value ? 100 : 0) : Math.min(100, (w.value / w.limit) * 100);
  const status = { claimed: 'geschafft 🎉', failed: 'diesmal nicht geschafft', ready: 'heute abholbar!', warmup: 'Probewoche – zählt ab Montag', open: w.daysLeft === 1 ? 'noch 1 Tag' : `noch ${w.daysLeft} Tage` }[w.status];
  return `<div class="card week ${w.status}">
    <div class="xp-head"><div class="label">Wochen-Challenge</div><em class="neon">+${w.xp} XP</em></div>
    <b>${esc(w.text)}</b>
    <div class="bar ${w.status === 'failed' ? 'bad' : ''}"><i data-w="${Math.max(2, Math.round(pct))}"></i></div>
    <div class="meta-row"><span class="num">${w.value}${w.unit === '€' ? ' €' : ''} / ${w.limit === 0 ? '0' : w.unit === '€' ? `${w.limit + 1} €` : w.limit} ${w.unit === '€' ? '' : esc(w.unit)}</span><span>${status}</span></div>
    ${w.status === 'ready' ? `<button class="cta" style="margin-top:12px" data-claim="${esc(w.id)}" data-xp="${w.xp}">Belohnung abholen</button>` : ''}
  </div>`;
};

const goalThumb = (g, n, pct) =>
  g.bildThumb
    ? `<div class="thumb photo"><img src="${esc(g.bildThumb)}" alt="" style="filter:grayscale(${100 - pct}%) brightness(${0.75 + pct / 400})"><span>${n}</span></div>`
    : `<div class="thumb" style="background:${esc(g.farbe || '#1d3fae')};filter:grayscale(${100 - pct}%)">${n}</div>`;

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
    ${d.pending.map(confirmCard).join('')}
    ${d.monthlyCheck ? monthlyCheckCard(d) : ''}
    <div class="card hero">
      <div class="label">Gesamt gespart</div>
      <div class="big num" data-count="${d.balance}" data-suffix=" <small>€</small>">0 <small>€</small></div>
      ${goalBlock}
    </div>
    ${toolsRow(d)}
    ${roundUpCard(d)}
    ${d.reserve.ziel && !d.reserve.voll ? `<div class="card reserve-mini"><div class="xp-head"><div class="label">Notfalltopf wird gefüllt</div><span class="num xp-num">${euro(d.reserve.betrag)} / ${euro(d.reserve.ziel)}</span></div><div class="bar"><i data-w="${Math.max(2, Math.round(d.reserve.fortschritt * 100))}"></i></div></div>` : ''}
    <div class="grid2">
      ${tile('Nächster Zahltag', d.nextPayday ? shortDate(d.nextPayday.datum) : '–', d.nextPayday ? `+${euro(d.nextPayday.betrag)} · ${inDays(d.nextPayday.tageBis)}` : 'keine Einnahmen', false)}
      ${tile('Dauerauftrag', d.nextTransfer ? shortDate(d.nextTransfer.datum) : '–', d.nextTransfer ? `${euro(d.nextTransfer.betrag)} → PayPal` : 'keiner angelegt', false)}
      ${tile('Streak', `${d.streak} ${d.streak === 1 ? 'Tag' : 'Tage'}`, 'ohne Impulskauf', d.streak >= 7)}
      ${tile('Rewe-Besuche', String(d.reweWeek), `diese Woche · ${d.reweCount} im Monat`, d.reweWeek === 0)}
    </div>
    <div class="card">
      <div class="xp-head"><div class="label">Level ${d.level.level} · ${esc(d.level.name)}</div><span class="num xp-num">${d.level.into} / ${d.level.needed} XP</span></div>
      <div class="bar xpbar"><i data-w="${Math.max(2, Math.round(d.level.progress * 100))}"></i></div>
    </div>
    <div class="card">
      <div class="label" style="margin-bottom:6px">Tägliche Quests</div>
      ${d.quests.map(questRow).join('')}
    </div>
    ${weekCard(d.week)}
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
        ${goalThumb(g, i + 1, pct)}
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
        .map((g) => `<button class="row" data-goal="${esc(g.id)}">${g.bildThumb ? `<img class="ico trophy-ico" src="${esc(g.bildThumb)}" alt="">` : '<div class="ico" style="color:var(--gold)">✓</div>'}<div class="t"><b>${esc(g.name)}</b><span>gekauft am ${esc(weekdayDate(g.erreichtAm))}</span></div><div class="amt num">${euro(g.kosten)}</div></button>`)
        .join('')}</div>`
    : '';
  const reserveNote = d.reserve.ziel
    ? `<div class="card reserve-mini"><div class="xp-head"><div class="label">Notfalltopf</div><span class="num xp-num">${euro(d.reserve.betrag)} / ${euro(d.reserve.ziel)}</span></div><div class="bar"><i data-w="${Math.max(2, Math.round(d.reserve.fortschritt * 100))}"></i></div><div class="meta-row"><span>${d.reserve.voll ? 'gefüllt – alles Weitere geht in die Ziele' : 'wird zuerst gefüllt'}</span><span>${d.reserve.voll ? '✓' : d.reserve.datum ? `voll am ${esc(shortDate(d.reserve.datum))}` : ''}</span></div></div>`
    : '';
  return `
    <h1>Ziele</h1>
    <div class="sub">Sparrate ${euro(d.savingsSum)} im Monat · Termine rechnen sich automatisch</div>
    <div id="mountain-slot"></div>
    ${reserveNote}
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
      <div class="lvl">${d.level.level}</div>
      <div><b style="font-size:18px">${esc(d.level.name)}</b><div class="sub" style="margin:2px 0 0">${d.xp} XP · noch ${d.level.needed - d.level.into} XP bis Level ${d.level.level + 1}</div></div>
    </div>
    <div class="card">
      <div class="label section-head">Taschengeld<span class="num neon">${euro(d.taschengeld.frei, { cents: true })} frei</span></div>
      <p class="hint" style="margin-bottom:0">Jeder Level-Aufstieg schaltet 5 € frei. Ausgaben „aus Taschengeld“ kosten keine XP und brechen keinen Streak.${d.taschengeld.used ? ` Schon genutzt: ${euro(d.taschengeld.used, { cents: true })}.` : ''}</p>
    </div>
    <div class="card">
      <div class="label" style="margin-bottom:12px">Erfolge · ${d.achievements.filter((a) => a.unlocked).length}/${d.achievements.length}</div>
      <div class="ach">${d.achievements.map((a) => `<div class="${a.unlocked ? 'on' : 'off'}"><b>${esc(a.icon)}</b>${esc(a.label)}</div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="toggle">Roast-Modus <button class="sw ${snap.profile?.settings?.roast !== false ? 'on' : ''}" data-setting="roast" aria-label="Roast-Modus"></button></div>
      <div class="toggle">Sounds <button class="sw ${snap.profile?.settings?.sounds ? 'on' : ''}" data-setting="sounds" aria-label="Sounds"></button></div>
      <div class="toggle"><span>Virtuelles Aufrunden<small class="toggle-hint">${snap.profile?.settings?.aufrunden ? `auf volle ${snap.profile.settings.aufrundenStufe || 1} € · <button class="link" data-roundup-step>ändern</button>` : 'Ausgaben aufrunden, Differenz sparen'}</small></span><button class="sw ${snap.profile?.settings?.aufrunden ? 'on' : ''}" data-setting="aufrunden" aria-label="Virtuelles Aufrunden"></button></div>
    </div>
    ${d.reached.length ? `<div class="card"><div class="label" style="margin-bottom:12px">Trophäen · ${d.reached.length}</div><div class="trophies">${d.reached.map((g) => `<button class="trophy" data-goal="${esc(g.id)}">${g.bildThumb ? `<img src="${esc(g.bildThumb)}" alt="">` : `<div class="trophy-fill" style="background:${esc(g.farbe || '#c9a24a')}">⛰</div>`}<span>${esc(g.name)}</span><em>Freigeschaltet</em></button>`).join('')}</div></div>` : ''}
    <div class="card">
      <div class="label section-head">Notfalltopf<span class="num">${d.reserve.ziel ? `${euro(d.reserve.betrag)} / ${euro(d.reserve.ziel)}` : 'aus'}</span></div>
      ${d.reserve.ziel ? `<div class="bar"><i data-w="${Math.max(2, Math.round(d.reserve.fortschritt * 100))}"></i></div>` : ''}
      <p class="hint">Ein Puffer für Unvorhergesehenes. Der Spar-Topf füllt ihn zuerst, danach bekommen die Ziele Geld. Nimmst du etwas heraus, wird er automatisch wieder aufgefüllt.</p>
      <div class="confirm-actions"><button class="ghost" id="reserve-set">${d.reserve.ziel ? 'Höhe ändern' : 'Notfalltopf einrichten'}</button>${d.reserve.ziel && d.reserve.betrag > 0 ? '<button class="ghost danger" id="reserve-take">Geld entnehmen</button>' : ''}</div>
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
            <button class="t" data-edit="fixed" data-id="${esc(it.id)}"><b>${esc(it.name)}</b><span>${it.pausiert ? (it.pausiertBis ? `pausiert bis ${shortDate(it.pausiertBis)} ${it.pausiertBis.slice(0, 4)}` : 'pausiert') : it.tagImMonat ? `am ${it.tagImMonat}.` : 'monatlich'}</span></button>
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
