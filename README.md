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
