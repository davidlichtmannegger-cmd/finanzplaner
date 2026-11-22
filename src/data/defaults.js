export const CATEGORIES = ['Lebensmittel', 'Essen unterwegs', 'Tabak', 'Freizeit', 'Technik', 'Kleidung', 'Sonstiges'];

export const GOAL_COLORS = ['#1d3fae', '#6b2bb8', '#c9ccd1', '#0f8a6a', '#2a7a9a', '#8a6a3a', '#a83a5a', '#3a8a3a'];

export function defaultData(startDatum) {
  return {
    profile: {
      name: 'David',
      xp: 0,
      level: 1,
      streak: 0,
      taschengeld: 0,
      startDatum,
      settings: { roast: true, sounds: false, push: false }
    },
    income: [
      { id: 'inc-3', name: 'Einnahme am 3.', betrag: 200, tagImMonat: 3 },
      { id: 'inc-15', name: 'Gehalt am 15.', betrag: 500, tagImMonat: 15 },
      { id: 'inc-28', name: 'Einnahme am 28.', betrag: 270, tagImMonat: 28 }
    ],
    fixed: [
      { id: 'fix-zig', name: 'Zigaretten', betrag: 50, tagImMonat: null, pausiert: false },
      { id: 'fix-bild', name: 'Bildungsvertrag', betrag: 15, tagImMonat: null, pausiert: false },
      { id: 'fix-miete', name: 'Miete an Eltern', betrag: 50, tagImMonat: null, pausiert: false },
      { id: 'fix-tr', name: 'Trade Republic', betrag: 100, tagImMonat: null, pausiert: false }
    ],
    savingsRules: [
      { id: 'spar-16', name: 'Dauerauftrag 16.', betrag: 485, tagImMonat: 16, aktivBis: '2027-07-31' },
      { id: 'spar-16-neu', name: 'Dauerauftrag 16. (mit Gehaltserhöhung)', betrag: 685, tagImMonat: 16, aktivAb: '2027-08-01' },
      { id: 'spar-29', name: 'Dauerauftrag 29.', betrag: 270, tagImMonat: 29 }
    ],
    goals: [
      { id: 'goal-ps5', name: 'PS5 Pro + GTA 6', kosten: 1000, reihenfolge: 1, farbe: GOAL_COLORS[0] },
      { id: 'goal-tv', name: '75"-TV + Halterung + Govee + Solar', kosten: 1130, reihenfolge: 2, farbe: GOAL_COLORS[1] },
      { id: 'goal-pc', name: 'Neuer PC (weiß)', kosten: 2000, reihenfolge: 3, farbe: GOAL_COLORS[2] },
      { id: 'goal-peri', name: 'Monitor + Tastatur + Maus', kosten: 600, reihenfolge: 4, farbe: GOAL_COLORS[3] },
      { id: 'goal-mon', name: 'Zwei weitere Monitore', kosten: 600, reihenfolge: 5, farbe: GOAL_COLORS[4] },
      { id: 'goal-iphone', name: 'iPhone 19 Pro Max', kosten: 1500, reihenfolge: 6, farbe: GOAL_COLORS[5], fruehestens: '2027-09-01' }
    ],
    expenses: [],
    ledger: [{ id: 'start', datum: startDatum, typ: 'abgleich', betrag: 0 }]
  };
}
