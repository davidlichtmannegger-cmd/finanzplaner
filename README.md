# Davids Finanzplaner

Persönliche Spar-App als PWA (iPhone + PC) – Bauplan in [PLAN.md](PLAN.md), Design-Vorlage in [docs/prototype.html](docs/prototype.html).

## Befehle
- `npm run dev` – lokal starten (http://localhost:5420, auch im WLAN erreichbar)
- `npm test` – Tests
- `npm run build` – Produktions-Build nach `dist/`

## Deploy
Jeder Push auf `main` baut die App per GitHub Actions und veröffentlicht sie auf GitHub Pages.

## Firebase
Anleitung: [docs/FIREBASE-EINRICHTEN.md](docs/FIREBASE-EINRICHTEN.md). Die Web-Konfiguration steht in `src/firebase-config.js`; Admin-Schlüssel gehören nie ins Repo.

## Stand
- Etappe 0: Grundgerüst, Design-Tokens, Tab-Leiste mit Wischen, Bottom Sheet, Deploy-Workflow.
- Etappe 1: Termin-Rechner (`src/logic/schedule.js`, Tag-für-Tag-Simulation der Daueraufträge), Spar-Topf mit automatischen Buchungen und Abgleich, Ziele mit Drag & Drop, Ausgaben mit Rewe-Schnellknopf, Einnahmen/feste Ausgaben/Daueraufträge bearbeitbar, Login (Google, E-Mail) und Sync über Firestore. Ohne Firebase-Konfiguration läuft die App im lokalen Modus.

## Termin-Rechner
Die App bucht jeden Dauerauftrag an seinem Tag in den Spar-Topf (16./29.; am 29. Februar zählt der 28.). Ziele bekommen das Geld der Reihe nach. Ein Ziel ist erreicht an dem Tag, an dem der Topf seine Summe deckt – frühestens zum optionalen „Nicht vor“-Datum (z. B. iPhone-Release). Davids Tabelle nennt jeweils den Zahltag davor (15./28.), daher liegen die App-Termine 0–1 Tag später.
