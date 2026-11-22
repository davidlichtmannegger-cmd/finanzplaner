import { esc, euro, longDate, monthLabel, weekdayDate, goalDateLabel } from './ui/format.js';
import { dateInMonth } from './logic/dates.js';
import { formatRest } from './logic/tools.js';

const TYPE = {
  einnahme: { label: 'Zahltag', cls: 'ev-in', sign: '+' },
  sparen: { label: 'Dauerauftrag', cls: 'ev-save', sign: '→ ' },
  fix: { label: 'Feste Ausgabe', cls: 'ev-fix', sign: '−' },
  ziel: { label: 'Ziel bezahlbar', cls: 'ev-goal', sign: '' }
};

export function toolsRow(d) {
  const tool = (id, icon, label, badge) => `<button class="tool" data-tool="${id}"><span class="tool-ico">${icon}</span><span>${label}</span>${badge ? `<em>${badge}</em>` : ''}</button>`;
  return `<div class="tools">
    ${tool('kalender', '📅', 'Kalender')}
    ${tool('wuensche', '⏳', 'Wunschliste', d.openWishes || '')}
    ${tool('wasware', '🔮', 'Was wäre wenn')}
    ${tool('backup', '💾', 'Backup')}
  </div>`;
}

export function monthlyCheckCard(d) {
  return `<div class="card confirm monthly">
    <div class="label">Monatsabgleich</div>
    <b>Stimmt dein PayPal-Stand?</b>
    <div class="hint" style="margin:4px 0 12px">Laut App liegen <span class="num">${euro(d.balance, { cents: true })}</span> im Spar-Topf.</div>
    <div class="confirm-actions"><button class="cta" data-monthly="ok">Stimmt · +15 XP</button><button class="ghost" data-monthly="diff">Anderer Betrag</button></div>
  </div>`;
}

export function roundUpCard(d) {
  if (!d.roundUp.aktiv) return '';
  return `<div class="card roundup">
    <div class="xp-head"><div class="label">Aufrunden-Topf</div><span class="num neon">${euro(d.roundUp.betrag, { cents: true })}</span></div>
    <div class="hint" style="margin:4px 0 ${d.roundUp.betrag >= 1 ? '12px' : '0'}">Aus ${d.roundUp.anzahl} Ausgaben aufgerundet. Überweis den Betrag ab und zu extra auf PayPal.</div>
    ${d.roundUp.betrag >= 1 ? `<button class="ghost wide" data-roundup-done>Überwiesen · in den Spar-Topf</button>` : ''}
  </div>`;
}

export function calendarView(cal, selected) {
  const head = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((t) => `<div class="cal-h">${t}</div>`).join('');
  const cells = cal.cells
    .map((c) => {
      if (!c) return '<div class="cal-c empty"></div>';
      const dots = [...new Set(c.events.map((e) => e.typ))].map((t) => `<i class="${TYPE[t].cls}"></i>`).join('');
      return `<button class="cal-c ${c.heute ? 'today' : ''} ${c.datum === selected ? 'sel' : ''}" data-day="${c.datum}"><span>${c.tag}</span><div class="dots">${dots}${c.ausgaben ? '<i class="ev-spent"></i>' : ''}</div></button>`;
    })
    .join('');
  const day = cal.cells.find((c) => c?.datum === selected);
  const list = day
    ? `<div class="cal-day"><div class="label">${esc(weekdayDate(day.datum))}</div>${
        day.events.length || day.ausgaben
          ? [
              ...day.events.map((e) => `<div class="kv"><span><i class="dot ${TYPE[e.typ].cls}"></i>${esc(TYPE[e.typ].label)} · ${esc(e.name)}</span><b class="num">${TYPE[e.typ].sign}${euro(e.betrag)}</b></div>`),
              day.ausgaben ? `<div class="kv"><span><i class="dot ev-spent"></i>Ausgaben</span><b class="num">−${euro(day.ausgaben, { cents: true })}</b></div>` : ''
            ].join('')
          : '<div class="hint">Nichts geplant.</div>'
      }</div>`
    : '';
  return `<div class="label sheet-title">Kalender</div>
    <div class="cal-nav"><button class="mini" data-cal="-1" aria-label="Vormonat">‹</button><b>${esc(monthLabel(dateInMonth(cal.year, cal.month, 1)))}</b><button class="mini" data-cal="1" aria-label="Nächster Monat">›</button></div>
    <div class="cal-grid">${head}${cells}</div>
    <div class="cal-legend"><span><i class="ev-in"></i>Zahltag</span><span><i class="ev-save"></i>Dauerauftrag</span><span><i class="ev-fix"></i>Fix</span><span><i class="ev-goal"></i>Ziel</span><span><i class="ev-spent"></i>Ausgaben</span></div>
    ${list}`;
}

export function wishesView(d) {
  const open = d.wishes.filter((w) => w.offen);
  const done = d.wishes.filter((w) => !w.offen).slice(0, 12);
  const row = (w) => `<div class="wish ${w.frei ? 'free' : 'locked'}">
      <div class="wish-top"><b>${esc(w.name)}</b><span class="num">${euro(w.preis, { cents: true })}</span></div>
      ${w.link ? `<a class="wish-link" href="${esc(w.link)}" target="_blank" rel="noopener">Link öffnen</a>` : ''}
      ${
        w.frei
          ? `<div class="hint" style="margin:6px 0 10px">72 Stunden sind um. Willst du es immer noch?</div>
             <div class="wish-actions"><button class="cta" data-wish-skip="${esc(w.id)}">Verzichten · +20 XP</button><button class="ghost" data-wish-goal="${esc(w.id)}">Als Ziel</button><button class="ghost" data-wish-buy="${esc(w.id)}">Kaufen</button></div>`
          : `<div class="lock"><span>🔒 noch ${esc(formatRest(w.restMs))} gesperrt</span><button class="mini" data-wish-skip="${esc(w.id)}">Jetzt verzichten</button></div>`
      }
    </div>`;
  return `<div class="label sheet-title">Abkühl-Wunschliste</div>
    <p class="hint" style="text-align:center;margin-top:0">Alles, was du spontan kaufen willst, kommt erst hierher und ist 72 Stunden gesperrt. Meistens ist der Wunsch danach weg.</p>
    ${d.resisted ? `<div class="resisted">Durch Verzicht gespart: <b class="num">${euro(d.resisted, { cents: true })}</b></div>` : ''}
    <form class="wish-new" data-wish-new>
      <input class="input" name="name" placeholder="Was willst du kaufen?" autocomplete="off" maxlength="80">
      <div class="wish-row"><input class="input" name="preis" inputmode="decimal" placeholder="Preis" autocomplete="off"><input class="input" name="link" placeholder="Link (optional)" autocomplete="off"></div>
      <button class="cta" type="submit">Auf die Liste · 72 h warten</button>
      <div class="form-error"></div>
    </form>
    ${open.length ? `<div class="wish-list">${open.map(row).join('')}</div>` : '<div class="hint" style="text-align:center">Gerade nichts auf der Liste.</div>'}
    ${done.length ? `<div class="label group-label">Erledigt</div><div class="card list">${done.map((w) => `<div class="row"><div class="ico">${w.status === 'verzichtet' ? '✓' : '🛒'}</div><div class="t"><b>${esc(w.name)}</b><span>${w.status === 'verzichtet' ? 'verzichtet' : 'gekauft'}</span></div><div class="amt num">${euro(w.preis, { cents: true })}</div></div>`).join('')}</div>` : ''}`;
}

export function whatIfView(results, { extraMonthly, oneTime }) {
  const rows = results
    .map((r) => {
      const label = r.delta === null ? '–' : r.delta === 0 ? 'gleich' : r.delta < 0 ? `${-r.delta} Tage früher` : `${r.delta} Tage später`;
      return `<div class="kv whatif-row"><span><b>${esc(r.name)}</b><small>${r.nachher ? esc(goalDateLabel({ datum: r.nachher, wartetAufTermin: r.wartetAufTermin })) : 'außer Reichweite'}</small></span><em class="${r.delta < 0 ? 'neon' : r.delta > 0 ? 'red' : 'muted'}">${label}</em></div>`;
    })
    .join('');
  return `<div class="label sheet-title">Was wäre wenn …</div>
    <div class="field"><span class="field-label">… ich jeden Monat mehr spare <em>(am 16.)</em></span>
      <div class="range-row"><input type="range" min="-300" max="500" step="10" value="${extraMonthly}" data-whatif="extraMonthly"><b class="num">${extraMonthly > 0 ? '+' : ''}${euro(extraMonthly)}</b></div></div>
    <div class="field"><span class="field-label">… ich heute einmalig etwas einzahle</span>
      <div class="range-row"><input type="range" min="0" max="2000" step="25" value="${oneTime}" data-whatif="oneTime"><b class="num">${euro(oneTime)}</b></div></div>
    <div class="whatif-presets"><button class="mini" data-preset="rewe">Rewe halbieren (≈ +60 €)</button><button class="mini" data-preset="tr">Trade Republic pausieren (+100 €)</button><button class="mini" data-preset="zero">Zurücksetzen</button></div>
    <div class="card list" style="margin-top:12px">${rows}</div>
    <p class="hint">Nur eine Simulation – an deinen echten Daten ändert sich nichts.</p>`;
}

export function backupView({ lastBackup }) {
  return `<div class="label sheet-title">Backup</div>
    <p class="hint" style="text-align:center;margin-top:0">Lädt alle deine Daten als JSON-Datei herunter (ohne große Zielbilder). Mit „Einspielen“ holst du sie wieder zurück – bestehende Einträge mit gleicher ID werden überschrieben, nichts wird gelöscht.</p>
    ${lastBackup ? `<div class="hint" style="text-align:center">Letztes Backup: ${esc(longDate(lastBackup))}</div>` : ''}
    <button class="cta" data-backup="export">Backup herunterladen</button>
    <label class="ghost wide file-btn" style="display:block;text-align:center;margin-top:10px">Backup einspielen<input type="file" accept="application/json,.json" data-backup="import" hidden></label>
    <div class="form-error" data-backup-msg></div>`;
}
