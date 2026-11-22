# Finanzplaner – Bauplan für Claude Code

> Diese Datei liegt im Projektordner. Claude Code: Lies sie komplett, bevor du anfängst.
> Arbeite **eine Etappe nach der anderen** ab. Nach jeder Etappe: kurz zeigen, was fertig ist, committen, auf mein Okay warten.
> Sprache in der App und in allen Antworten: **Deutsch**.

---

## 1. Worum es geht

Eine persönliche Spar-App nur für mich (David). Sie zeigt, wie viel ich gespart habe, wann ich mir meine Ziele leisten kann, und motiviert mich mit einem Belohnungssystem (XP, Level, Konfetti), weniger Geld für Kleinkram (vor allem Rewe) auszugeben.

- Läuft als **Web-App (PWA)** auf iPhone (Home-Bildschirm) und PC
- Daten werden zwischen Handy und PC **synchronisiert**
- Design-Vorlage: `prototype.html` im Projektordner (klickbarer Entwurf). Look und Aufbau davon übernehmen.

---

## 2. Technik (fest entschieden)

| Bereich | Entscheidung |
|---|---|
| Frontend | Vite + Vanilla JS (oder leichtes Framework wie Preact, wenn sinnvoll) |
| Hosting | GitHub Pages (Deploy per GitHub Actions) |
| Datenbank | Firebase Firestore (Gratis-Tarif) |
| Login | Firebase Auth – Start mit E-Mail/Google, später Passkeys/Face ID |
| Offline | PWA mit Service Worker + Firestore Offline-Cache |
| 3D (später) | Three.js |
| Push (später) | Firebase Cloud Messaging + GitHub Actions (Cron) |
| iPhone-Widgets (später) | Scriptable-Skripte, lesen Daten aus Firebase |

**Wichtig:** Firebase-Sicherheitsregeln so setzen, dass nur mein eingeloggter Account meine Daten lesen/schreiben kann. Firebase-Config darf im Code stehen, aber keine Admin-Schlüssel ins Repo.

---

## 3. Design

- Fast schwarzer Hintergrund, **Neongrün** als Akzent (`#39ff88`)
- Fortschrittsbalken ab **90 %** von Neongrün zu **dunklem Gold** (`#c9a24a`), kein knalliges Gelb
- Orientierung an **Apple Human Interface Guidelines**: große Titel, Karten, Bottom Sheets, Tab-Leiste unten
- Tab-Leiste: **Übersicht · Ausgaben · [+] · Ziele · Profil**, zusätzlich **Wischen** zwischen den Seiten
- Animationen: Zahlen zählen hoch, Balken füllen sich, Konfetti bei Erfolgen
- `prefers-reduced-motion` respektieren
- Mobile first (iPhone-Breite), am PC zentriert

---

## 4. Meine echten Daten (als Startwerte)

**Einnahmen (monatlich):**
- 200 € am 3.
- 500 € am 15.
- 270 € am 28.

**Feste Ausgaben (monatlich, 215 €):**
- Zigaretten 50 €
- Bildungsvertrag 15 €
- Miete an Eltern 50 €
- Trade Republic 100 € (kann 1–2 Monate pausiert werden → Schalter in der App)

**Sparen:** 755 € im Monat über zwei Daueraufträge auf PayPal (Spar-Topf)
- 16. des Monats: 485 €
- 29. des Monats: 270 €
- Ab 1.8.2027 ca. 200 € mehr Gehalt → Sparrate ca. 955 €

**Sparziele (in dieser Reihenfolge):**

| # | Ziel | Kosten | Geplant |
|---|---|---|---|
| 1 | PS5 Pro + GTA 6 | 1.000 € | 28.12.2026 |
| 2 | 75"-TV + Wandhalterung + Govee Ambilight + Solarpanel | 1.130 € | 15.02.2027 |
| 3 | Neuer PC (weiß) | 2.000 € | 15.05.2027 |
| 4 | Monitor + Tastatur + Maus | 600 € | 28.05.2027 |
| 5 | Zwei weitere Monitore | 600 € | 28.06.2027 |
| 6 | iPhone 19 Pro Max | 1.500 € | Sept 2027 |

Die Termine soll die App **selbst ausrechnen** (siehe Etappe 1), die Tabelle dient nur zum Gegenprüfen.

---

## 5. Datenmodell (Firestore)

```
users/{uid}
  profile:      { name, xp, level, streak, taschengeld, settings{roast, sounds, push} }
  income/{id}:  { name, betrag, tagImMonat, aktivAb, aktivBis }
  fixed/{id}:   { name, betrag, tagImMonat, pausiert }
  savingsRules/{id}: { betrag, tagImMonat }            // Daueraufträge
  goals/{id}:   { name, kosten, reihenfolge, bildUrl, thumbUrl, erreichtAm }
  expenses/{id}:{ betrag, haendler, kategorie, datum, impuls(bool), quelle('manuell'|'applepay') }
  ledger/{id}:  { datum, typ('einzahlung'|'entnahme'|'abgleich'), betrag }  // Spar-Topf
  achievements/{id}: { freigeschaltetAm }
```

Gesamt gespart = Summe `ledger`. Jedes Ziel bekommt Geld in Reihenfolge, Rest fließt ins nächste.

---

## 6. Etappen

Zeitangaben = realistische Arbeitszeit mit Claude Code, ohne lange Pausen.

### Etappe 0 – Projekt aufsetzen (~20 min)
- Vite-Projekt, Ordnerstruktur, Git-Repo, GitHub-Repo, Deploy auf GitHub Pages per Action
- Firebase-Projekt verbinden (ich lege das Projekt in der Firebase-Konsole an, du sagst mir genau, welche Klicks)
- Design-Tokens aus `prototype.html` übernehmen
- **Fertig wenn:** leere App mit Tab-Leiste ist unter meiner GitHub-Pages-URL erreichbar

### Etappe 1 – Kern (~1–2 h)
- Login (E-Mail oder Google)
- Einnahmen, feste Ausgaben, Daueraufträge anlegen/bearbeiten
- Sparziele anlegen, sortieren (Drag & Drop), bearbeiten
- **Termin-Rechner:** simuliert Tag für Tag die Einzahlungen und berechnet für jedes Ziel das Datum, an dem es bezahlt werden kann
- Übersicht: Gesamt gespart, Ring zum nächsten Ziel, nächster Zahltag, nächster Dauerauftrag
- Ausgaben erfassen über Plus-Knopf (Bottom Sheet) + Rewe-Schnellknopf
- Sync zwischen Geräten
- **Fertig wenn:** ich am Handy eine Ausgabe eintrage und sie am PC sofort sehe, und die Zieltermine mit der Tabelle oben übereinstimmen
- Unit-Tests für den Termin-Rechner

### Etappe 2 – Belohnungssystem (~1–1,5 h)
- XP + Level, Level-Namen
- Erinnerung am 16. und 29.: „Überweisung erledigt?" → Ja = volle XP, Nein = weniger XP (keine harte Strafe)
- Impulskauf-Schalter bei Ausgaben → weniger XP + Anzeige „Ziel rückt X Tage nach hinten" + Arbeitsminuten
- Streak (Tage ohne Impulskauf)
- Tägliche Mini-Quests, Wochen-Challenges (z. B. „max. 3× Rewe")
- Zufällige Bonus-XP
- Erfolge/Trophäen
- Taschengeld aus XP freispielen
- Konfetti + kurzer Sound bei Erfolgen, Roast-Modus (abschaltbar)
- **Fertig wenn:** jede Aktion sofort sichtbares Feedback gibt

### Etappe 3 – Ziele schöner (~45 min)
- Eigene Bilder pro Ziel hochladen (Firebase Storage), Bild geht mit Fortschritt von grau zu farbig
- Ziel erreicht → Konfetti (über 100 €: Feuerwerk), großes Bild löschen, nur Vorschaubild bleibt für die Trophäensammlung
- Notfalltopf/Rückfall-Puffer

### Etappe 4 – Werkzeuge (~1–1,5 h)
- Kalenderansicht (Zahltage, Daueraufträge, geplante Käufe)
- Abkühl-Wunschliste (72 h Sperre)
- Was-wäre-wenn-Rechner
- Virtuelles Aufrunden
- Monatlicher Abgleich mit echtem PayPal-Kontostand
- Backup/Export als JSON
- Trade-Republic-Pause-Schalter

### Etappe 5 – iPhone-Anbindung (~1–1,5 h)
- PWA-Installation auf dem Home-Bildschirm, App-Icon
- Push-Benachrichtigungen (Erinnerung an Überweisung)
- Apple-Pay-Automation: Kurzbefehl, der bei Wallet-Zahlung Betrag + Händler an die App schickt (Firebase-Endpunkt oder URL-Schema). Schritt-für-Schritt-Anleitung für mich zum Einrichten
- Scriptable-Widgets: Fortschritt mit Zielbild (grau → farbig), Tagesbudget, Sperrbildschirm-Widget, Ziel erreicht = golden „Freigeschaltet"
- Siri-Abfrage fürs Tagesbudget über Kurzbefehl
- Passkeys/Face ID-Login

### Etappe 6 – 3D-Bergwelt (~3–5 h, in Teilen)
- Three.js-Szene, Stil zwischen realistisch und Low Poly
- Jeder Gipfel = ein Ziel, Höhe = Kosten, Pfad mit Bergsteiger-Figur
- Hütten am Weg = Zahltage
- Tageszeit nach echter Uhrzeit, Wetter über Open-Meteo, Jahreszeiten
- Impulskauf = Figur rutscht ein Stück runter; Geister-Kletterer zeigt Position ohne Impulskäufe
- Ausrüstung per XP freischalten (Rucksack, Kopflampe, Eispickel)
- Gipfel erreicht = Kamerarundflug, Fahne, Feuerwerk
- Bergsounds (abschaltbar)
- Muss auf dem iPhone flüssig laufen → Leistung testen, Details notfalls reduzieren

### Etappe 7 – Wrapped (~3–4 h)
- **Monats-Rückblick** als Story im Vollbild (antippen = weiter), professionelle Animationen, keine reine Textzusammenfassung: gespart, Rewe-Besuche, größter Impulskauf, Streak, XP, Gipfel-Fortschritt
- **Jahres-Wrapped:** noch aufwendiger als der Monats-Rückblick
- Monatliches Glücksrad nach erfolgreicher Überweisung

### Später / optional
- Preis-Wecker für Sparziele
- Weitere Logins (Firebase erlaubt mehrere)
- Auto ab 2027 als neue feste Ausgabe

---

## 7. Regeln für Claude Code

1. Erst lesen, dann planen, dann bauen. Bei Unklarheiten **fragen**, nicht raten.
2. Pro Etappe ein eigener Git-Branch, am Ende in `main` mergen.
3. Kleine, saubere Commits mit deutschen Commit-Nachrichten.
4. Keine Geheimnisse (Admin-Keys, Tokens) ins Repo. `.env` in `.gitignore`.
5. Rechenlogik (Termine, XP) in eigene Module mit Tests.
6. Jede Etappe muss auf dem iPhone (Safari) und am PC (Chrome) funktionieren.
7. Wenn ich in der Firebase-Konsole oder auf dem iPhone etwas einrichten muss: genaue Schritt-für-Schritt-Anleitung.

---

## 8. Startbefehl

Kopier das als erste Nachricht in Claude Code:

```
Lies PLAN.md und prototype.html. Fang mit Etappe 0 an.
Sag mir zuerst in ein paar Sätzen, wie du vorgehst, dann leg los.
```
