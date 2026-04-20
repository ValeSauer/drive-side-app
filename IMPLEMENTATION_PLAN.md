# Drive Side — Analyse der Spezifikation & Implementierungsplan

## Context

Die Datei [SPEC_WrongSideAlert_ReactNative.md](SPEC_WrongSideAlert_ReactNative.md) beschreibt eine React-Native-App ("Drive Side"), die Fahrer im Ausland warnt, wenn sie vermutlich auf der falschen Fahrbahn fahren. Das Projektverzeichnis enthält bisher **ausschließlich** diese Spec — kein Code, kein Expo-Projekt, kein Git-Repo.

Aufgabe: Spec auf Lücken/Inkonsistenzen prüfen, Implementierungsreihenfolge planen, und ein "cool & modern" aussehendes UI entwerfen, das trotzdem dem Safety-First-Prinzip der Spec folgt (keine Ablenkung beim Fahren).

**Entschieden (aus AskUserQuestion):**
- **Stack:** Expo 53 + React Native 0.76 (New Architecture default)
- **Design:** Moderat modernisieren (Aura-Gradient, große Flagge+Arrow, Glassmorphism-Debug, SVG-Overlays, Reanimated-Springs)
- **Scope für diese Implementierung:** **Phase 0–4** — GPS-basierter MVP **ohne** Kamera/TFLite. Kamera/TFLite/Debug/Test-Modus folgen in einem zweiten Schritt (Phase 5–10 im Anhang dokumentiert).
- **Tooling:** zustand + MMKV + Sentry + Jest/RN Testing Library — alle vier.

---

## 1. Analyse der Spezifikation — was fehlt oder verbessert werden sollte

Die Spec ist inhaltlich sehr stark (klare Hooks, saubere Entscheidungslogik, realistische Edge Cases). Die folgenden Punkte sollten **vor Implementierungsbeginn** geklärt werden, sonst kostet es später Nacharbeit.

### 1.1 Stack-Versionen sind veraltet (Stand April 2026)

| Spec sagt | Aktuell empfohlen | Grund |
|---|---|---|
| `expo: ~51` | `expo: ~53` (oder ~52 LTS) | Expo 51 ist seit Ende 2025 deprecated |
| `react-native: 0.74` | `0.76+` (New Architecture default) | Fabric/TurboModules sind Standard |
| `expo-av` | `expo-audio` + `expo-video` | `expo-av` ist ab Expo 52 deprecated |
| `react: 18.2` | `react: 19.x` | Kommt mit Expo 53 |

**Empfehlung:** Auf Expo 53 + RN 0.76 + New Architecture starten. `react-native-vision-camera` v4 und `react-native-fast-tflite` sind beide New-Arch-kompatibel.

### 1.2 Modell-Handling — mehrere offene Details

- **Dateinamen-Inkonsistenz:** Projektstruktur nennt `ufldv2_culane_res18.tflite`, Setup-Sektion `ufldv2_culane_res18_320x1600.tflite`. Konsistent machen.
- **UFLD v2 Output-Format unterschätzt:** Die Spec sagt "X-Koordinaten pro Zeilen-Anker". In Wahrheit liefert UFLD v2 ein **Grid-Probabilistics-Tensor** (Anchor-Klassifikation), das decodiert werden muss (Softmax → Expected-Value → X-Koordinate). Das ist nicht trivial und sollte als eigenes Modul `lib/ufldDecoder.ts` gebaut werden.
- **Preprocessing-Ort unklar:** Input muss `[1, 3, 320, 1600]` NCHW Float32 mit ImageNet-Normalisierung sein. VisionCamera liefert aber NHWC-Frames in YUV/RGBA. Die Transpose+Normalisierung muss **im Worklet** passieren — das kostet Performance und ist fehleranfällig. Alternative: Frame Processor Plugin in nativem Code (C++/Swift/Kotlin), empfohlen für Produktion.
- **`frameProcessorFps` Prop existiert so nicht** — man kontrolliert die Rate nur via Frame-Counter-Modulo.

### 1.3 Lücken in der Warn-Logik

- **`positionRatio` ≠ Fahrzeugposition auf der Fahrbahn.** UFLD liefert Linien im **Bildkoordinatensystem**. Nur bei perfekt zentrierter Kameramontage entspricht die Bildmitte der Fahrzeugmitte. → `MountingGuide` muss einen **Kalibrierungsschritt** bekommen (Offset einmalig speichern).
- **`isTurning` Schwelle 15°/s ist sehr aggressiv.** Normale Autobahnkurven sind 2–5°/s. Schwelle besser 8–10°/s, sonst wird bei ruhigen Kurven nicht unterdrückt.
- **Einbahnstraßen-Gegenrichtung:** `headingDiffToRoad > 90°` setzt voraus, dass die Straßenrichtung aus OSM bekannt ist. Overpass liefert nur Geometrie (Nodes), die Richtung muss aus dem `oneway`-Tag + Node-Reihenfolge abgeleitet werden — in der Spec nicht beschrieben.
- **Confidence-Stufen zu grob:** `none/low/high` basierend nur auf Linienanzahl ignoriert Modell-Probabilities.

### 1.4 Netzwerk-Aspekte unterspezifiziert

- **Nominatim Rate-Limit:** 1 Request/Sekunde pro IP. Muss pro Land gecacht werden (Reverse-Geocode nur bei >1 km Bewegung erneut).
- **Overpass oft überlastet:** Kein Fallback-Mirror definiert. Empfehlung: primär `overpass-api.de`, sekundär `overpass.kumi.systems` / `overpass.openstreetmap.ru`.
- **Keine Persistenz** von letztem OSM-Ergebnis über App-Restart (AsyncStorage / MMKV).

### 1.5 Fehlende Querschnitts-Aspekte

- **Kein State-Management erwähnt.** Bei dieser Hook-Anzahl empfiehlt sich `zustand` (leichter als Redux, Worklet-freundlich) als zentraler Store für GPS/OSM/Lane/Warning-State.
- **Persistenz für Onboarding-Flag** (`@react-native-async-storage/async-storage` oder `react-native-mmkv`) fehlt.
- **Kein Analytics/Crash-Reporting** (Sentry) — bei einer Safety-App fragwürdig.
- **Keine Unit-Tests für die reine Logik** (`laneAnalyzer`, `gpsAnalyzer`, `countryDrivingSide`). Diese sind deterministisch und gut testbar mit Jest.
- **EAS Build nicht erwähnt** — für Distribution nötig.

### 1.6 Edge Cases im Fahrbetrieb

- **Tunnel:** GPS verloren, Kamera läuft weiter. Aktuell würde System bei GPS-Ausfall schweigen. Besser: letzten bekannten `drivingSide` bis zu X Minuten beibehalten.
- **Nacht/Regen:** Modell-Confidence massiv reduziert. Braucht eigenes "degraded mode" UI, nicht nur Standard-None.
- **Kreisverkehr:** `headingChange` ist konstant >15°/s über 10–20s — aktuelle 3s-Wartezeit reicht nicht.
- **Grenzübertritt:** Sollte **einmalig** eine explizite Benachrichtigung triggern ("Du fährst jetzt in Linksverkehrsland XY"), nicht nur den State ändern.

---

## 2. Design-Vorschlag "cool & modern" (ohne Safety zu kompromittieren)

Die Spec folgt richtig dem Prinzip "möglichst nichts anzeigen = alles gut". Das bleibt — wir machen *die wenigen sichtbaren Elemente* erstklassig.

### 2.1 Normalmodus — von "Auto auf Straße" zu "ambient Signal"

Statt statischer Fahrbahngrafik + Flagge + Dot:

```
┌─────────────────────────────┐
│                             │
│   ╭─────────────────────╮   │   Ambient-Gradient-Aura
│   │                     │   │   (pulst sanft in drivingSide-
│   │      Linksverkehr   │   │    Farbe, ~8s Zyklus)
│   │        🇬🇧          │   │
│   │                     │   │   Große, dezente Flagge mit
│   │   ◀━━━  halten      │   │   weichem Glow
│   │                     │   │
│   ╰─────────────────────╯   │   Richtungs-Arrow (links/rechts)
│                             │   als klarer Merksatz
│          Drive Side         │
└─────────────────────────────┘
```

- **Reanimated-Aura** (radial gradient) pulst sanft in Safe-Grün — Bewegung signalisiert "System lebt"
- **Große Flagge + Richtungspfeil** als primäres Merksignal, nicht die Fahrbahngrafik
- **Fahrbahngrafik nur in Caution/Warning sichtbar** — nicht als Permanent-Deko
- **SF Pro Display / Inter** als Font, große Letter-Spacing bei Labels

### 2.2 Warning — Ganzer Screen als Signal

```
┌─────────────────────────────┐
│                             │
│                             │
│    ◀━━━━━━━━━━━━━━━◀        │   Große animierte Pfeile
│                             │   (pulsieren von rechts nach links)
│         LINKS                │   XXL-Text, eine Zeile
│                             │
│      Linksverkehr 🇬🇧       │   Kleiner Kontext
│                             │
└─────────────────────────────┘
```

- Kein statischer Text "FALSCHE FAHRBAHN?" — stattdessen **Handlungsanweisung** ("LINKS" / "RECHTS")
- **Directional-Arrow-Animation** läuft in Richtung, in die gewechselt werden soll
- Radialer Gradient von `#D50000` (Rand) zu `#5a0000` (Mitte) statt flaches Rot
- Harte Haptic + optionaler 440Hz 100ms Piepton alle 2.5s

### 2.3 Debug-Modus — modernisiert

- **Glassmorphism**: `BlurView` (expo-blur) über Kamerafeed, Panels mit `rgba(255,255,255,0.06)` + Blur
- **Live-Sparklines** für Confidence/Position statt nur Zahlen (victory-native-xl oder eigener Reanimated-Renderer)
- **SVG-Overlay** für Spurlinien statt absolute Views — glatter, unterstützt Animationen
- Monospace-Font: **JetBrains Mono**

### 2.4 Micro-Interactions

- Haptic auf jeden Zustandsübergang (`Haptics.selectionAsync()` bei none→caution)
- **Shared-Element-Transition** zwischen Normal- und Debug-Screen (langer Druck → skaliert der Dot zum Fullscreen-Panel)
- Reanimated `withSpring` statt `withTiming` für alle UI-Übergänge → organischer Look

### 2.5 Onboarding — "cool" statt langweilige Slides

- **Animierte Szene**: Auto fährt im Linksverkehr, kippt auf falsche Seite, App warnt, Auto korrigiert sich — als SVG/Lottie-Animation
- **Dark-Gradient**-Backgrounds mit subtilem Noise
- Haptic bei jedem Slide-Wechsel

---

## 3. Tech-Stack Final (Ergänzungen zur Spec)

Zusätzlich zu den in der Spec genannten Packages:

| Paket | Zweck |
|---|---|
| `zustand` | Zentraler State-Store |
| `react-native-mmkv` | Schnelle Persistenz (Onboarding-Flag, OSM-Cache, Calibration-Offset) |
| `expo-blur` | Glassmorphism in Debug-Panel |
| `react-native-svg` | Fahrbahngrafik, Spurlinien-Overlay, Icons |
| `lottie-react-native` | Onboarding-Animation |
| `@sentry/react-native` | Crash-Reporting (Safety-App!) |
| `@react-native-async-storage/async-storage` | (nur falls MMKV zu viel) |
| `jest`, `@testing-library/react-native` | Unit-Tests |

Ersetzen: `expo-av` → `expo-audio` (ab Expo 52).

---

## 4. Implementierungsplan — Phasen

### Scope-Abgrenzung MVP (Phase 0–4)

Der MVP liefert eine **lauffähige App mit GPS+OSM-basierter Warnung** (degraded mode aus Spec §10). Beim Grenzübertritt in ein Land mit anderer Fahrtrichtung erscheint eine einmalige Warnung; der Normalmodus zeigt permanent das aktuelle Land + die korrekte Fahrtrichtung.

**Nicht enthalten im MVP:** Kamera, TFLite, Spurerkennung, Debug-Modus, Test-Modus. Diese stehen als Phase 5–10 im Anhang und sind als separater Auftrag implementierbar — die Architektur (Store, Hooks, Theme) ist so angelegt, dass sie additiv andocken.

---

### Phase 0 — Projektaufsetzung (½ Tag)
1. `npx create-expo-app@latest DriveSide --template blank-typescript` (Expo 53, RN 0.76)
2. Git-Repo init, `.gitignore`, Prettier + ESLint mit `expo`-Preset
3. Alle Dependencies aus Abschnitt 2 + Ergänzungen aus 3 installieren
4. `app.json`: Permissions, Fast-TFLite-Plugin, Bundle-ID
5. `expo prebuild` — native iOS/Android-Projekte generieren
6. Ordnerstruktur anlegen: `app/`, `components/`, `hooks/`, `lib/`, `assets/`, `store/`, `theme/`, `__tests__/`

### Phase 1 — Pure Logik (ohne RN, voll testbar) (1 Tag)
Alles was sich ohne Device testen lässt, zuerst. Reine TypeScript-Module mit Jest.

1. [lib/countryDrivingSide.ts](lib/countryDrivingSide.ts) — vollständige Länderliste aus Wikipedia/ISO + `getDrivingSide(countryCode)`
2. [lib/gpsAnalyzer.ts](lib/gpsAnalyzer.ts) — `smoothedHeading` (zirkulärer Mittelwert), `headingChange`, `isTurning`, `isDriving` + Tests
3. [lib/osmClient.ts](lib/osmClient.ts) — Overpass-Query-Builder, Response-Parser, Fallback-Mirror-Rotation, Nominatim-Wrapper mit Rate-Limit (1 req/s) + Cache-Key per gerundeter GPS-Kachel
4. [lib/warningLogic.ts](lib/warningLogic.ts) — MVP-Variante: nur GPS/OSM-Signale (ohne Kamera). Liefert `'none' | 'country-crossed'`. Erweitert in Phase 7.

**Ausgelassen im MVP:** `laneAnalyzer.ts`, `ufldDecoder.ts` — kommen in Phase 6/7.

**Nach Phase 1:** `npm test` grün für alle vier Module.

### Phase 2 — State & Hooks (1 Tag)
1. [store/driveStore.ts](store/driveStore.ts) — zustand-Store: `{ gps, osm, warning, onboardingDone, calibrationOffset }`. `lane` & `testMode` als Platzhalter-Slices, in Phase 6/9 befüllt.
2. [store/persist.ts](store/persist.ts) — MMKV-gebackter zustand-middleware für `onboardingDone` + letzter `osm.drivingSide` (Tunnel-Overbrückung) + `calibrationOffset`
3. [hooks/useGPS.ts](hooks/useGPS.ts) — `expo-location.watchPositionAsync` → `gpsAnalyzer` → Store
4. [hooks/useOSM.ts](hooks/useOSM.ts) — Position-Watch (Haversine-Gate >50m oder Heading-Delta >45°) → `osmClient` → Store
5. [hooks/useWarning.ts](hooks/useWarning.ts) — MVP-Logik: vergleicht `currentCountry.drivingSide` mit vorherigem Wert → triggert einmalige `country-crossed` Warnung

### Phase 3 — Theme & UI-Grundlagen (1 Tag)
1. [theme/colors.ts](theme/colors.ts), [theme/typography.ts](theme/typography.ts), [theme/spacing.ts](theme/spacing.ts)
2. [components/ui/StatusDot.tsx](components/ui/StatusDot.tsx) — animierter Reanimated-Dot
3. [components/ui/FlagBadge.tsx](components/ui/FlagBadge.tsx) — große Landesflagge mit Glow
4. [components/ui/DirectionArrow.tsx](components/ui/DirectionArrow.tsx) — animierter Richtungspfeil (SVG)
5. [components/ui/RoadGraphic.tsx](components/ui/RoadGraphic.tsx) — stilisierte Fahrbahn (SVG, animierbare Spuranzahl)
6. [components/ui/AmbientAura.tsx](components/ui/AmbientAura.tsx) — pulsierender Radial-Gradient (`expo-linear-gradient` + Reanimated)

### Phase 4 — Screens & App-Einstieg (1 Tag)
1. [components/NormalScreen.tsx](components/NormalScreen.tsx) — Aura + Flag + Arrow + Dot
2. [components/WarningScreen.tsx](components/WarningScreen.tsx) — Einmalige Country-Crossed-Warnung als Fullscreen (fadet nach 8s / Tap aus)
3. [components/Onboarding.tsx](components/Onboarding.tsx) — 3 Slides, Lottie-Animation, Skip-Button. **MountingGuide wird in Phase 7 hinzugefügt** (nur relevant wenn Kamera aktiv)
4. [components/ErrorBanner.tsx](components/ErrorBanner.tsx) — Slide-in Top-Banner (kein GPS / GPS ungenau / OSM offline)
5. [components/Permissions.tsx](components/Permissions.tsx) — GPS-Permission anfordern, Fallback-UI + Deep-Link in Settings bei Verweigerung
6. [app/index.tsx](app/index.tsx) — Root mit Store-Bootstrap + Screen-Routing: Onboarding → Permissions → Normal/Warning; `expo-keep-awake` aktiv; AppState-Listener für Vordergrund/Hintergrund
7. Development Build: `npx expo prebuild` + `npx expo run:ios --device` / `run:android --device` — erster Smoketest auf echtem Gerät

**Nach Phase 4 (MVP-Ende):**
- App läuft auf iPhone/Android
- Fährt man über eine Landesgrenze DE→GB (oder simuliert mit Mock-GPS), erscheint die einmalige "Linksverkehr"-Warnung
- Dauerhaft sichtbar: Flagge, Richtungs-Hinweis, ambient Aura
- Sentry meldet Crashes
- Jest-Tests grün für alle Logik-Module

---

## Anhang — Phase 5–10 (nicht im MVP-Scope, nur zur Referenz)

Die folgenden Phasen sind Follow-Up für einen zweiten Auftrag. Die MVP-Architektur ist so angelegt, dass sie ohne Refactor andocken.

### Phase 5 — Mounting Guide & Calibration (½ Tag)
- [components/MountingGuide.tsx](components/MountingGuide.tsx) — Kamera-Montage + Kalibrierungs-Offset speichern

### Phase 6 — Kamera & TFLite (2–3 Tage, riskantester Teil)
1. [components/CameraView.tsx](components/CameraView.tsx) — `react-native-vision-camera` Preview, niedrigste Auflösung
2. Frame Processor Grundgerüst (Counter, `runOnJS`)
3. Modell-Datei besorgen, in `assets/` ablegen, Tensorflow-Model-Load
4. **Frame-Preprocessing im Worklet** (resize zu 320×1600, normalize, NCHW-Transpose) — hier ist der schwierigste Teil. Evtl. natives Frame-Processor-Plugin nötig.
5. [hooks/useLaneDetection.ts](hooks/useLaneDetection.ts) — Inferenz-Aufruf, ufldDecoder, Shared-Value für `rawLines`
6. Performance-Messung: wenn Inferenz > 400ms → Fallback, nur jeden 30. Frame

### Phase 7 — Warn-System End-to-End (1 Tag)
1. Verdrahtung: `useWarning` konsumiert alle Signale aus Store
2. Haptics + optionaler Sound via `expo-audio`
3. Animationen zwischen None/Caution/Warning mit `withSpring`
4. Einmal-Grenzübertritt-Notification

### Phase 8 — Debug-Modus (1 Tag)
1. [components/DebugScreen.tsx](components/DebugScreen.tsx) — Glassmorphism-Layout
2. SVG-Overlay mit erkannten Spurlinien live
3. Sparklines für Confidence/Position-History
4. Zugang: 2s Long-Press auf Status-Dot

### Phase 9 — Test-Modus (½ Tag)
1. Video-File-Picker + Vision-Camera Video-Input
2. Simulated-GPS (vordefinierte Orte) überschreibt GPS-Hook
3. Modal-UI über langem StatusBar-Druck

### Phase 10 — Polish & Robustheit (1–2 Tage)
1. Alle Error-Banner aus Tabelle 10 implementieren
2. MMKV-Persistenz: Onboarding-Flag, letzter OSM-State, Mounting-Calibration
3. Sentry integrieren
4. EAS-Build-Config (`eas.json`) für iOS Ad-Hoc + Android APK
5. Manuelle Testfahrten + Feinjustierung der Schwellwerte

---

## 5. Kritische Dateien (MVP Phase 0–4)

- [SPEC_WrongSideAlert_ReactNative.md](SPEC_WrongSideAlert_ReactNative.md) — Quelle der Wahrheit
- [lib/gpsAnalyzer.ts](lib/gpsAnalyzer.ts) — zirkulärer Heading-Mittelwert, deterministisch testbar
- [lib/osmClient.ts](lib/osmClient.ts) — Overpass + Nominatim, Fallback-Mirrors, Rate-Limit
- [lib/warningLogic.ts](lib/warningLogic.ts) — Country-Crossed-Erkennung (Kernalgorithmus)
- [lib/countryDrivingSide.ts](lib/countryDrivingSide.ts) — vollständige ISO-Liste
- [store/driveStore.ts](store/driveStore.ts) — zustand-Store, alle Hook-Outputs zusammengeführt
- [store/persist.ts](store/persist.ts) — MMKV-Middleware
- [app/index.tsx](app/index.tsx) — Root-Routing + AppState

---

## 6. Verifikation

**Phase 1 (Logik):**
- `npm test` — Jest grün für `gpsAnalyzer`, `osmClient` (mit nock/msw gemockt), `warningLogic`, `countryDrivingSide`
- Edge-Cases: 0°/360° Heading-Übergang, leere OSM-Response, Timeout, Offline

**Phase 2 (Hooks + Store):**
- Storybook-ähnliche Debug-Route in `app/index.tsx` hinter `__DEV__`-Flag: Buttons um GPS-Werte manuell in den Store zu schreiben → Screens reagieren korrekt

**Phase 3–4 (UI + E2E MVP):**
- Auf echtem Gerät via `expo run:ios --device`
- **Simulator-Test:** iOS-Simulator → Debug → Location → Custom: Koordinaten London eingeben. Warning-Screen muss erscheinen. Danach München → zurück zu Normal.
- **Reale Testfahrt:** über eine Landesgrenze mit Fahrtrichtungswechsel (praktikabel: Frankreich→England via Eurotunnel, oder simuliert per Mock-Location-App auf Android)
- **Permission-Denial-Path:** Location verweigern → Fallback-UI mit Deep-Link in Settings sichtbar
- **App-Hintergrund:** App in Hintergrund → zurück → kein Crash, GPS läuft weiter
- **Sentry:** bewusst geworfener Test-Error erscheint im Sentry-Dashboard

---

## 7. Aufwandsschätzung MVP

Summe Phase 0–4: **~4 Personentage** bei fokussierter Arbeit.
Follow-Up Phase 5–10 (Kamera/TFLite/Debug/Test-Modus): weitere ~7–9 Tage, Phase 6 (TFLite-Preprocessing) mit höchstem Risiko.
