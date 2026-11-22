# Firebase einrichten – Klick für Klick

Dauer: ca. 10 Minuten. Kosten: 0 € (Spark-Tarif, keine Kreditkarte nötig).

## 1. Projekt anlegen
1. Öffne https://console.firebase.google.com und melde dich mit deinem Google-Konto an.
2. Klick auf **„Projekt erstellen“** (bzw. „Neues Firebase-Projekt erstellen“).
3. Projektname: **finanzplaner** → **Weiter**.
4. Gemini in Firebase: **ausschalten** → Weiter.
5. Google Analytics: **ausschalten** (brauchen wir nicht) → **Projekt erstellen**.
6. Warten, bis „Ihr Projekt ist bereit“ erscheint → **Weiter**.

## 2. Web-App registrieren (liefert die Konfiguration)
1. Auf der Projektübersicht auf das Symbol **`</>`** (Web) klicken.
2. App-Spitzname: **Finanzplaner Web**.
3. Haken bei „Firebase Hosting einrichten“ **nicht** setzen (wir nutzen GitHub Pages) → **App registrieren**.
4. Es erscheint ein Code-Block mit `const firebaseConfig = { apiKey: ..., authDomain: ..., ... }`.
5. **Diesen Block kopieren und mir in den Chat schicken.** Diese Werte sind nicht geheim – sie dürfen im Code stehen; geschützt wird alles über die Sicherheitsregeln (Schritt 4).
6. **Weiter zur Konsole**.

## 3. Datenbank (Firestore) anlegen
1. Links im Menü: **Erstellen → Firestore Database** → **Datenbank erstellen**.
2. Edition: **Standard** → Weiter.
3. Standort: **eur3 (Europe)** oder **europe-west3 (Frankfurt)** → Weiter.
4. **Im Produktionsmodus starten** auswählen → **Erstellen**.
   (Produktionsmodus sperrt erst einmal alles – die richtigen Regeln setze ich in Etappe 1.)

## 4. Login (Authentication) einschalten
1. Links: **Erstellen → Authentication** → **Jetzt starten**.
2. Reiter **Anmeldemethode**:
   - **Google** → aktivieren → Support-E-Mail auswählen → **Speichern**.
   - **E-Mail-Adresse/Passwort** → aktivieren → **Speichern**.
3. Reiter **Einstellungen → Autorisierte Domains → Domain hinzufügen**:
   - deine GitHub-Pages-Domain, z. B. **`deinname.github.io`** (bekommst du, sobald das Repo steht).
   - `localhost` ist schon eingetragen.

## 5. Sicherheitsregeln eintragen (nur dein Konto darf deine Daten sehen)
1. Links: **Firestore Database** → Reiter **Regeln**.
2. Den gesamten Text im Editor löschen.
3. Den Inhalt der Datei `firestore.rules` aus dem Projekt einfügen (ich schicke ihn dir auch im Chat).
4. **Veröffentlichen** klicken.

Die Regel erlaubt Lesen und Schreiben nur unter `users/{deineUid}` und nur, wenn genau dieses Konto angemeldet ist. Alles andere ist gesperrt.

## Was ich danach mache
- Konfiguration in `src/firebase-config.js` eintragen und deployen.
- Beim ersten Login werden deine Startwerte (Einnahmen, Daueraufträge, Ziele) in die Datenbank übernommen – inklusive allem, was du vorher lokal im Browser eingetragen hast.
- Keine Admin-Schlüssel oder Service-Account-Dateien landen im Repo.
