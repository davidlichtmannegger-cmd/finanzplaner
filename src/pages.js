const ICONS = {
  coins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  peak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20l6-11 4 6 3-4 5 9z"/></svg>'
};

const dateLine = (now) => new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);

const empty = (icon, text) => `<div class="card empty"><div class="ico">${ICONS[icon]}</div><div>${text}</div></div>`;

export function overviewPage(now = new Date()) {
  return `
    <div class="sub" style="margin:0">${dateLine(now)}</div>
    <h1>Hey David</h1>
    <div class="card hero">
      <div class="label">Gesamt gespart</div>
      <div class="big num">0 <small>€</small></div>
      <span class="pill">Daten kommen in Etappe 1</span>
    </div>
    ${empty('coins', 'Hier erscheinen bald dein nächstes Ziel, Zahltage, Daueraufträge und dein Level.')}
  `;
}

export function expensesPage() {
  return `
    <h1>Ausgaben</h1>
    <div class="sub">Noch keine Ausgaben erfasst</div>
    ${empty('list', 'Über den grünen Plus-Knopf trägst du ab Etappe 1 Ausgaben ein – mit Rewe-Schnellknopf.')}
  `;
}

export function goalsPage() {
  return `
    <h1>Ziele</h1>
    <div class="sub">Termine rechnen sich automatisch</div>
    ${empty('peak', 'Deine sechs Sparziele von der PS5 Pro bis zum iPhone 19 Pro Max kommen in Etappe 1.')}
  `;
}

export function profilePage({ firebase }) {
  return `
    <h1>Profil</h1>
    <div class="sub">Einstellungen und Verbindung</div>
    <div class="card">
      <div class="status-row"><span>Version</span><span>Etappe 0</span></div>
      <div class="status-row"><span>Firebase</span><span class="${firebase ? 'ok' : ''}">${firebase ? 'verbunden' : 'noch nicht verbunden'}</span></div>
      <div class="status-row"><span>Login</span><span>kommt in Etappe 1</span></div>
    </div>
  `;
}

export function newExpenseSheet() {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <p class="sub" style="text-align:center">Das Eintragen von Ausgaben kommt in Etappe 1.</p>
    <button class="cta" type="button" data-close>Okay</button>
  `;
  return wrap;
}
