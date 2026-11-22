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

- Etappe 2: Belohnungssystem (`src/logic/rewards.js`): XP-Protokoll `xpLog` mit festen IDs (keine Doppelvergabe zwischen Geräten), Level 1–10 mit Namen, Überweisungs-Bestätigung am 16./29. (Ja +50, Nein +10, Buchung wird dann auf 0 gesetzt), Impulskauf −15 XP mit Hinweis, wie viele Tage das nächste Ziel nach hinten rückt, Streak ohne Impulskauf, 3 tägliche Quests und eine Wochen-Challenge (die erste Teilwoche zählt nicht), 10 % Glücksbonus, 10 Erfolge, 5 € Taschengeld pro Level, Konfetti/Feuerwerk/Sound, abschaltbarer Roast-Modus.
- Etappe 3: Zielbilder werden im Browser verkleinert (Vorschau 240 px im Ziel, großes Bild bis 1000 px in `goalImages/{id}`, beides in Firestore, kein Storage nötig) und sind je nach Fortschritt grau bis farbig. „Bezahlbar!“-Feier beim Erreichen der Summe, „Gipfel erreicht“-Enthüllung beim Kauf (über 100 € mit Feuerwerk), danach wird das große Bild gelöscht und das Vorschaubild kommt in die Trophäensammlung. Beim Kauf wird nur der dem Ziel zugeteilte Betrag aus dem Topf genommen. Notfalltopf (`profile.notfall`) wird vor allen Zielen gefüllt und füllt sich nach Entnahmen von selbst wieder.
- Etappe 4: Werkzeug-Leiste in der Übersicht (`src/tool-views.js`, Logik in `src/logic/tools.js`): Monatskalender mit Zahltagen, Daueraufträgen, festen Ausgaben, Zielterminen und Ausgaben; Abkühl-Wunschliste (72 h gesperrt, Verzichten +20 XP, als Ziel übernehmen oder kaufen); Was-wäre-wenn mit Sparrate ± und Einmalbetrag; virtuelles Aufrunden (1/5/10 €) mit Aufrunden-Topf; Monatsabgleich in den ersten 10 Tagen (+15 XP); Backup als JSON herunterladen und einspielen; feste Ausgaben pausieren bis Monatsende, 2 Monate oder unbegrenzt.
- Etappe 6, Teil 1: 3D-Bergwelt auf der Ziele-Seite (Three.js, wird erst beim Öffnen der Seite geladen; `src/mountain/`, Logik in `src/logic/mountain.js`). Jeder offene Ziel ist ein Low-Poly-Gipfel (Höhe nach Kosten), der Notfalltopf das Basislager. Serpentinenpfad, Bergsteiger an der Position des Spar-Topfs, Geister-Kletterer an „Topf + alle Impulskäufe“, Hütten an den nächsten Daueraufträgen, Himmel und Licht nach Uhrzeit, Drehen mit dem Finger, Vollbild. Läuft nur, solange die Ziele-Seite sichtbar ist.
- Etappe 6, Teil 2: Bergwetter nach echtem Wetter (Open-Meteo, Ort im Profil per Standort oder Suche, auf ~1 km gerundet, 30 min Cache): Wolken, Regen, Schnee, Nebel, Gewitterblitze, Wind. Jahreszeiten mit Bäumen (Frühling grün, Herbst orange, Winter verschneit) und Schneegrenze. Ausrüstung am Bergsteiger ab Level 2/3/4/6/8 (Rucksack, Kopflampe mit Licht in der Nacht, Eispickel, Seil, Goldhelm). Impulskauf lässt den Bergsteiger abrutschen. Ist ein Ziel bezahlbar, springt die App zur Bergwelt und fliegt mit Feuerwerk um den Gipfel. Bergsounds (Wind, Vögel tagsüber, Grillen nachts, Regen) per Web Audio, abschaltbar.
- Testmodus: `?lokal` an die Adresse hängen startet ohne Login mit Daten nur im Browser.

## Termin-Rechner
Die App bucht jeden Dauerauftrag an seinem Tag in den Spar-Topf (16./29.; am 29. Februar zählt der 28.). Ziele bekommen das Geld der Reihe nach. Ein Ziel ist erreicht an dem Tag, an dem der Topf seine Summe deckt – frühestens zum optionalen „Nicht vor“-Datum (z. B. iPhone-Release). Davids Tabelle nennt jeweils den Zahltag davor (15./28.), daher liegen die App-Termine 0–1 Tag später.
