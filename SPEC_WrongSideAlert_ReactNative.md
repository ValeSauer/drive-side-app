# Drive Side – Claude Code Specification (React Native)

## Projektübersicht

Eine mobile App (iOS + Android) die Fahrer warnt, wenn sie im Ausland möglicherweise auf der falschen Fahrbahn fahren. Die App kombiniert GPS/OpenStreetMap-Daten mit Kamera-basierter Spurerkennung via TFLite.

**App-Name:** Drive Side
**Stack:** React Native (Expo), react-native-vision-camera, react-native-fast-tflite, OpenStreetMap Overpass API

---

## 1. Projektstruktur

```
DriveSide/
├── app/
│   └── index.tsx                   # Einziger Screen (single screen app)
├── components/
│   ├── NormalScreen.tsx            # Normalmodus: Fahrbahngrafik + Dot
│   ├── WarningScreen.tsx           # Vollbild-Warnung (roter Screen)
│   ├── RoadGraphic.tsx             # Wiederverwendbare Fahrbahn-Draufsicht
│   ├── DebugScreen.tsx             # Kamerafeed + alle Werte + Spurlinien-Overlay
│   ├── Onboarding.tsx              # Erster App-Start
│   ├── MountingGuide.tsx           # Kamera-Montagehinweis
│   └── ErrorBanner.tsx             # Fehlerzustände (kompaktes Banner)
├── hooks/
│   ├── useGPS.ts                   # GPS-Position kontinuierlich
│   ├── useOSM.ts                   # OSM Abfrage nach Fahrrichtung + Spuren
│   ├── useLaneDetection.ts         # TFLite Inferenz + Spurposition
│   ├── useWarning.ts               # Kombinierte Entscheidungslogik
│   └── useTestMode.ts              # Test-Modus (Video/Bild statt Kamera)
├── lib/
│   ├── osmClient.ts                # Overpass API Wrapper
│   ├── laneAnalyzer.ts             # Geometrie: Spurposition berechnen
│   ├── gpsAnalyzer.ts              # Fahrdaten: Heading glätten, isTurning, isDriving
│   └── countryDrivingSide.ts       # Fallback: Land → Fahrtrichtung
├── assets/
│   └── ufldv2_culane_res18.tflite  # Modell-Datei (muss manuell hinzugefügt werden)
├── app.json
├── babel.config.js
└── package.json
```

---

## 2. Abhängigkeiten

```json
{
  "dependencies": {
    "expo": "~51.0.0",
    "expo-location": "~17.0.0",
    "expo-haptics": "~13.0.0",
    "expo-image-picker": "~15.0.0",
    "expo-av": "~14.0.0",
    "expo-keep-awake": "~13.0.0",
    "react": "18.2.0",
    "react-native": "0.74.0",
    "react-native-vision-camera": "^4.0.0",
    "react-native-fast-tflite": "^1.0.0",
    "react-native-worklets-core": "^1.0.0",
    "react-native-reanimated": "^3.0.0",
    "react-native-safe-area-context": "^4.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Wichtige Hinweise:**
- `react-native-worklets-core` ist Pflicht als Peer-Dependency von `react-native-fast-tflite`
- `react-native-vision-camera` v4 benötigt einen **Development Build** (kein Expo Go)
- Für den ersten Test: `expo prebuild` + direkt auf Gerät deployen via USB

---

## 3. Modell-Setup

### Modell herunterladen
Das UFLD v2 Modell muss manuell von PINTO_model_zoo heruntergeladen werden:
```
https://github.com/PINTO0309/PINTO_model_zoo/blob/main/324_Ultra-Fast-Lane-Detection-v2/download.sh
```

Datei: `ufldv2_culane_res18_320x1600.tflite`
→ ablegen in `assets/`
→ in `app.json` als Asset registrieren:
```json
{
  "expo": {
    "plugins": [
      ["react-native-fast-tflite", {
        "enableCoreMLDelegate": true,
        "enableAndroidGPUDelegate": true
      }]
    ]
  }
}
```

### Modell laden (in `useLaneDetection.ts`)
```typescript
import { loadTensorflowModel } from 'react-native-fast-tflite'

const model = await loadTensorflowModel(
  require('../assets/ufldv2_culane_res18_320x1600.tflite')
)
```

### Modell-Eingabe
- **Input Shape:** `[1, 3, 320, 1600]` (Batch, RGB, Höhe, Breite)
- **Preprocessing:** Frame auf 320×1600 resizen, normalisieren mit ImageNet mean/std:
  - mean: `[0.485, 0.456, 0.406]`
  - std: `[0.229, 0.224, 0.225]`
- VisionCamera liefert Frames als `Float32Array` via Frame Processor – direkt verwendbar

### Modell-Ausgabe
Das Modell gibt Spurlinien-Positionen zurück als X-Koordinaten pro Zeilen-Anker. Für die Positionsberechnung relevant: X-Koordinaten der erkannten Linien in der unteren Bildhälfte (Zeile ~280 von 320).

---

## 4. Kamera & Frame Processor

`react-native-vision-camera` ermöglicht TFLite-Inferenz **direkt im Kamera-Frame-Thread** – kein manuelles Canvas-Resizing nötig.

```typescript
// CameraView.tsx
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera'
import { useTensorflowModel } from 'react-native-fast-tflite'
import { useSharedValue, runOnJS } from 'react-native-worklets-core'

const device = useCameraDevice('back')
const model = useTensorflowModel(require('../assets/ufldv2_culane_res18_320x1600.tflite'))

const frameProcessor = useFrameProcessor((frame) => {
  'worklet'
  if (model.state !== 'loaded') return

  const outputs = model.model.runSync([frame])
  const lines = parseModelOutput(outputs)
  runOnJS(onLinesDetected)(lines)
}, [model])
```

**Takt – alle 500ms via Frame-Counter:**
```typescript
const frameCount = useSharedValue(0)
const frameProcessor = useFrameProcessor((frame) => {
  'worklet'
  frameCount.value++
  if (frameCount.value % 15 !== 0) return  // ~30fps → alle 500ms
  // ... Inferenz
}, [model])
```

---

## 5. Hooks – Detaillierte Spezifikation

### `useGPS.ts`

```typescript
interface GPSState {
  // Rohe Position
  lat: number | null
  lng: number | null
  accuracy: number | null
  heading: number | null      // Kompassrichtung in Grad (0–360)
  speed: number | null        // m/s

  // Abgeleitete Fahrdaten (berechnet aus Historie)
  isMoving: boolean           // Geschwindigkeit > 5 km/h
  isDriving: boolean          // Geschwindigkeit > 15 km/h (kein Fußgänger/Fahrrad)
  smoothedHeading: number | null  // Gemittelter Heading über 3 Messungen (Kurven-Stabilität)
  headingChange: number | null    // Grad/Sekunde – erkennt Kurven/Abbiegevorgänge
  isTurning: boolean          // headingChange > 15°/s → gerade in Kurve/Abbiegevorgang
}
```

- `expo-location` mit `watchPositionAsync`
- Update-Intervall: 1000ms
- Accuracy: `Location.Accuracy.Balanced` – spart Akku, reicht für Ländererkennung
- Nur verwenden wenn `accuracy < 30` Meter
- Historie der letzten 5 Positionen halten für Heading-Glättung und Geschwindigkeitsberechnung

**Fahrdaten-Auswertung:**

```
isMoving  = speed > 1.4 m/s  (5 km/h)
isDriving = speed > 4.2 m/s  (15 km/h)

// Heading glätten über letzte 3 Messungen (zirkulärer Mittelwert wegen 0°/360° Übergang)
smoothedHeading = zirkulärerMittelwert([heading_t, heading_t-1, heading_t-2])

// Richtungsänderung pro Sekunde
headingChange = |smoothedHeading_t - smoothedHeading_t-1| / deltaT

isTurning = headingChange > 15  // Grad pro Sekunde
```

**Wichtig für Warnsystem:**
- Nur warnen wenn `isDriving === true` → keine falschen Alarme beim Parken oder Gehen
- Warnung unterdrücken wenn `isTurning === true` → Abbiegevorgänge verfälschen Spurerkennung
- Warnung nach Abbiegevorgang erst nach 3s Stabilisierung neu evaluieren

---

### `useOSM.ts`

```typescript
interface OSMRoad {
  // Straßengeometrie
  highway: string             // 'motorway' | 'trunk' | 'primary' | 'secondary' |
                              // 'tertiary' | 'residential' | 'service' | ...
  lanes: number | null        // Gesamtspuranzahl (beide Richtungen)
  lanesForward: number | null // Spuren in Fahrtrichtung (tags.lanes:forward)
  lanesBackward: number | null// Spuren Gegenrichtung (tags.lanes:backward)
  oneway: boolean             // Einbahnstraße
  maxspeed: number | null     // km/h
  name: string | null         // Straßenname

  // Abgeleitet
  isRelevantForWarning: boolean  // false für footway, cycleway, path, steps, etc.
  expectedLanesVisible: number   // Wie viele Linien das Kamera-Modell sehen sollte
}

interface OSMState {
  drivingSide: 'left' | 'right' | 'unknown'
  road: OSMRoad | null
  lastUpdated: number
  source: 'osm' | 'country_fallback' | 'unknown'
}
```

**Overpass API Query (erweitert):**
```
[out:json][timeout:5];
way(around:25,{LAT},{LNG})[highway][highway!~"footway|cycleway|path|steps|track"];
out tags;
```

Aus dem Ergebnis extrahieren:
- `tags.lanes` → Gesamtspuranzahl
- `tags.lanes:forward` → Spuren in Fahrtrichtung
- `tags.lanes:backward` → Gegenspuren
- `tags.highway` → Straßentyp
- `tags.oneway` → Einbahnstraße (`yes`/`no`/`-1`)
- `tags.maxspeed` → Tempolimit (hilft Straßentyp zu plausibilisieren)
- `tags.name` → Straßenname (für Debug/Display)
- `drivingSide`: via Nominatim Land-Lookup + `countryDrivingSide.ts`

**`expectedLanesVisible` berechnen:**
```
// Wie viele Spurlinien sollte das Modell sehen?
// Linien = Spuren + 1 (äußere Begrenzungen)

if (oneway):
  expectedLanesVisible = lanes + 1

else if (lanesForward != null):
  // Nur eigene Richtung sichtbar
  expectedLanesVisible = lanesForward + 1

else if (lanes != null):
  // Annahme: Spuren gleichmäßig aufgeteilt
  expectedLanesVisible = floor(lanes / 2) + 1

else:
  expectedLanesVisible = 2  // Minimum: linke + rechte Begrenzung
```

**`isRelevantForWarning`:**
```typescript
const IRRELEVANT_TYPES = [
  'footway', 'cycleway', 'path', 'steps', 'track',
  'pedestrian', 'bridleway', 'corridor'
]
isRelevantForWarning = !IRRELEVANT_TYPES.includes(highway)
```

**Cache-Strategie:**
- Neu abfragen wenn GPS-Position sich um >50m verändert hat (Haversine)
- Zusätzlich neu abfragen wenn `heading` sich um >45° geändert hat (Abbiegevorgang → andere Straße)
- Timeout: 5 Sekunden, dann Fallback auf letzten bekannten Wert

**OSM-Daten im Warnsystem nutzen:**

```
// Spurerkennung mit OSM-Erwartung abgleichen
if (detectedLaneCount < expectedLanesVisible - 1):
  confidence = 'low'   // Weniger Linien als erwartet → unsicherer

// Positionsschwellwert je nach Spuranzahl anpassen
if (lanesForward >= 2):
  // Mehrspurig: auch auf der zweiten Spur von rechts ist man korrekt
  warningThreshold = 0.3   // Erst warnen wenn im linkeren Drittel
else:
  warningThreshold = 0.45  // Zweispurig: Mitte ist die Grenze

// Einbahnstraße: Fahrtrichtung mit GPS-Heading gegen OSM-Richtung prüfen
if (oneway && headingDiffToRoad > 90°):
  → sofortige Warnung unabhängig von Kamera
```

### `countryDrivingSide.ts`
Statische Map aller Linksverkehr-Länder als Fallback:
```typescript
const LEFT_HAND_TRAFFIC_COUNTRIES = [
  'GB', 'IE', 'AU', 'NZ', 'JP', 'IN', 'ZA', 'TH', 'MY', 'SG',
  'HK', 'PK', 'KE', 'TZ', 'UG', 'ZW', 'ZM', 'MW', 'NA', 'BW',
  'LS', 'SZ', 'MV', 'MT', 'CY', 'JM', 'TT', 'BB', 'GY', 'SR'
  // ... vollständige Liste
]
```
Land aus GPS-Koordinaten via Nominatim Reverse Geocoding.

### `useLaneDetection.ts`
```typescript
interface LaneDetectionResult {
  myPositionRatio: number | null  // 0.0=ganz links, 1.0=ganz rechts
  detectedLaneCount: number
  confidence: 'high' | 'low' | 'none'
  rawLines: number[][]
  inferenceTimeMs: number
}
```

Empfängt Ergebnisse aus Frame Processor via `runOnJS` und:
1. Parst Modell-Output → Linienpositionen
2. Ruft `laneAnalyzer.ts` auf
3. Hält letzte 5 Ergebnisse für Mittelwertbildung

**Confidence:**
- `none`: < 2 Linien erkannt
- `low`: genau 2 Linien
- `high`: 3+ Linien

### `laneAnalyzer.ts`
```typescript
function calculatePositionOnRoad(
  lines: number[][],
  imageWidth: number   // 1600
): number | null       // 0.0 - 1.0
```

**Algorithmus:**
```
bildMitte = imageWidth / 2  // = 800
linien = sortiere nach durchschnittlichem X-Wert

linkeNachbar  = letzte Linie mit X < bildMitte
rechteNachbar = erste Linie mit X > bildMitte

if (keine linkeNachbar ODER keine rechteNachbar): return null

äußersteLinks  = linien[0].x
äußersteRechts = linien[letzter].x
return (bildMitte - äußersteLinks) / (äußersteRechts - äußersteLinks)
```

### `useWarning.ts`
```typescript
interface WarningState {
  level: 'none' | 'caution' | 'warning'
  reason: string[]
}
```

**Entscheidungslogik:**
```
1: GPS verfügbar + accuracy < 30m?            → Nein: none
2: isDriving === true?                         → Nein: none  (steht/geht → kein Alarm)
3: isTurning === true?                         → Nein: none  (Abbiegevorgang → abwarten)
4: drivingSide bekannt?                        → Nein: none
5: road.isRelevantForWarning === true?         → Nein: none
6: confidence != 'none'?                       → Nein: none

7: Schwellwert je nach Spuranzahl wählen:
   lanesForward >= 2 → threshold = 0.30   (mehrspurig: großzügiger)
   sonst             → threshold = 0.45   (zweispurig: Mitte ist Grenze)

8: Signal berechnen:
   signal = drivingSide=='left'  && positionRatio > (1 - threshold)
          = drivingSide=='right' && positionRatio < threshold

9: Sonderfall Einbahnstraße:
   oneway && GPS-Heading weicht >90° von Straßenrichtung ab
   → sofortige Warnung, kein Frame-Averaging nötig

10: Über letzten 5 Frames mitteln:
    activeFrames = Anzahl true-Frames der letzten 5

11: Entscheidung:
    activeFrames >= 4 → warning
    activeFrames >= 2 → caution
    sonst             → none

12: Nach isTurning-Ende: 3s Wartezeit bevor neu evaluiert wird
```

### `useTestMode.ts`
```typescript
interface TestModeState {
  active: boolean
  source: 'live' | 'video' | 'image'
  simulatedGPS: { lat: number, lng: number, drivingSide: 'left' | 'right' } | null
}
```
Siehe Abschnitt 9 (Test-Modus).

---

## 6. UI & Design

### Design-Prinzipien
- **Kein Kamerafeed im Normalmodus** – der Fahrer soll auf die Straße schauen, nicht aufs Handy
- **Dark-first** – schwarzer Hintergrund, kein Blendeffekt bei Nacht
- **Kontextsensitive Farben** – Zustand wird primär über Farbe kommuniziert, nicht Text
- **So wenig wie möglich anzeigen** – Abwesenheit von Warnung = alles gut
- Kein Kamerafeed, keine Zahlen, keine Koordinaten im Normalmodus
- Debug-Modus ist ein komplett anderer Screen, nur für Entwicklung/Testing

---

### Farbpalette

```typescript
const colors = {
  safe:    '#00C853',            // Grün  – System aktiv, alles OK
  caution: '#FFB300',            // Amber – Vorsicht
  warning: '#D50000',            // Rot   – Falsche Fahrbahn
  unknown: '#607D8B',            // Grau  – kein Signal / pausiert
  bg:      '#0a0a0a',            // Fast-Schwarz – Normalmodus Hintergrund
  bgWarn:  '#2a0000',            // Dunkelrot – Warning-Hintergrund
  laneGreen: '#00ff88',          // Helles Grün – erkannte Spurlinien im Debug
}
```

---

### Screen 1 – Normalmodus (OK)

Schwarzer Bildschirm. Kein Kamerafeed. Minimale Informationen.

```
┌─────────────────────────────┐
│                             │
│                             │
│                             │
│            🇬🇧              │  ← Landesflagge (groß, zentriert)
│                             │
│      [Fahrbahngrafik]       │  ← Stilisierte Draufsicht der Straße
│                             │    Auto grün auf korrekter Seite
│             ●               │  ← Status-Dot (grün = aktiv & OK)
│                             │
│       Linksverkehr          │  ← Kleine Beschriftung, gedimmt
│                             │
└─────────────────────────────┘
```

**Fahrbahngrafik (Normalmodus):**
- Stilisierte Draufsicht: dunkelgraues Rechteck = Straße, weiße Linien = Spuren, gestrichelte Mittellinie
- Kleines farbiges Rechteck = Auto, positioniert auf der korrekten Seite für das aktuelle Land
- Farbe des Autos: grün (#00C853)
- Anzahl der dargestellten Spuren kommt aus OSM (`lanesForward`)
- Grafik ist statisch/dekorativ – zeigt die Regel, nicht die Echtzeit-Position

---

### Screen 2 – Normalmodus (Warning)

Ganzer Bildschirm wird rot. Nicht zu übersehen.

```
┌─────────────────────────────┐
│                             │
│                             │
│      [Fahrbahngrafik]       │  ← Auto rot auf falscher Seite
│                             │
│      FALSCHE                │  ← Großer Text, weiß auf rotem Grund
│      FAHRBAHN?              │
│                             │
│         🇬🇧                 │  ← Hinweis: welches Land / welche Regel
│      Linksverkehr           │
│                             │
└─────────────────────────────┘
```

**Fahrbahngrafik (Warning):**
- Identische Grafik wie Normalmodus, aber:
- Auto ist rot (#D50000) und auf der falschen Seite positioniert
- Rotes Blink-Overlay über dem Auto (opacity 0→0.6→0, 400ms, wiederholt)

**Ton & Haptik:**
- `Haptics.notificationAsync(NotificationFeedbackType.Warning)`
- Alle 3 Sekunden wiederholen solange `level='warning'`
- Optionaler Warnton (kurzes Piepen, via `expo-av`)

---

### Screen 3 – Normalmodus (Caution)

Wie OK-Screen, aber Dot wird amber und Fahrbahngrafik zeigt Auto in der Mitte / leicht falsch.
Kein roter Hintergrund, kein Text-Banner. Nur visuelles Signal.

---

### Screen 4 – Normalmodus (kein Signal)

```
┌─────────────────────────────┐
│                             │
│                             │
│                             │
│            ──               │  ← Keine Flagge (Land unbekannt)
│                             │
│      [Fahrbahngrafik grau]  │  ← Ausgegraut, Auto grau
│                             │
│             ●               │  ← Dot grau
│                             │
│       Kein GPS-Signal       │  ← Fehlerhinweis, klein
│                             │
└─────────────────────────────┘
```

---

### Screen 5 – Debug-Modus

Erreichbar über langen Druck (2s) auf den Status-Dot. Komplett anderer Screen.

```
┌─────────────────────────────┐
│ ┌─────────────────────────┐ │
│ │   [KAMERA-FEED]         │ │  ← Live-Kamerabild (~35% der Höhe)
│ │   mit Spurlinien-Overlay│ │    Erkannte Linien in Grün eingezeichnet
│ │   und Bildmitte-Linie   │ │    Gestrichelte weiße Mittellinie
│ │   ● Fahrzeugposition    │ │    Amber Dot = geschätzte Position
│ └─────────────────────────┘ │
│                             │
│ GPS   51.507 / -0.127       │
│       48 km/h · 274°        │
│       driving · not turning │
│ ─────────────────────────── │
│ OSM   🇬🇧 left · primary    │
│       2+2 Spuren · 4 erw.   │
│ ─────────────────────────── │
│ Lane  pos: 0.71             │
│       conf: [████████░░] 85%│  ← Balken für Confidence
│       4 Linien · 34ms       │
│ ─────────────────────────── │
│ Warn  caution · 3/5 Frames  │
│       threshold: 0.45       │
└─────────────────────────────┘
```

**Kamera-Overlay im Debug-Modus:**
- Erkannte Spurlinien als dünne grüne Linien (`#00ff88`) über dem Kamerabild
- Vertikale gestrichelte weiße Linie = Bildmitte (= Fahrzeugposition)
- Kleiner amber Punkt = berechnete Fahrzeugposition auf der Fahrbahn
- Spurlinien werden mit `position: absolute` Views über dem Camera-Preview gerendert, koordiniert aus `rawLines` des `useLaneDetection` Hooks

**Debug-Datenpanel:**
- Monospace-Font, kleine Schrift (10–11pt)
- Sektionen: GPS · OSM · Lane · Warning
- Confidence als visueller Balken (nicht nur Zahl)
- Hintergrund: `rgba(0,0,0,0.85)` – lesbar aber nicht blendend
- Scrollbar wenn Inhalt zu lang

**Debug-Modus verlassen:** Langer Druck (2s) auf beliebige Stelle → zurück zum Normalmodus

---

### Zustands-Animationen (react-native-reanimated)

**OK → Caution:**
- Status-Dot wechselt zu Amber (300ms Fade)
- Fahrbahngrafik: Auto bewegt sich leicht zur falschen Seite (animiert)

**Caution → Warning:**
- Hintergrund wechselt zu `#2a0000` (400ms)
- Fahrbahngrafik: Auto springt auf falsche Seite, rotes Blinken
- Text-Banner erscheint von unten (translateY, 250ms, ease-out)
- Haptics + optionaler Ton

**Warning → OK:**
- Hintergrund faded zurück zu `#0a0a0a` (500ms)
- Auto bewegt sich zurück auf korrekte Seite
- Banner verschwindet nach unten

---

## 7. Performance & Akku

### CPU/GPU Delegate Strategie
```json
// app.json
["react-native-fast-tflite", {
  "enableCoreMLDelegate": true,      // iOS: Neural Engine statt CPU
  "enableAndroidGPUDelegate": true   // Android: GPU statt CPU
}]
```
Das ist der größte Einzelfaktor: CoreML auf iPhone ist ~5× schneller und stromsparender als CPU-Inferenz.

### Kamera-Auflösung
Für Inferenz wird keine hohe Auflösung benötigt:
```typescript
<Camera
  photo={false}
  video={false}
  frameProcessorFps={2}        // Nur 2 FPS nötig (alle 500ms)
  // Niedrigste verfügbare Auflösung wählen die noch 320×1600 erlaubt
/>
```

### GPS-Genauigkeit
`Location.Accuracy.Balanced` statt `High` – reicht für Ländererkennung, deutlich weniger Akku als `High` oder `BestForNavigation`.

### Frame Processor Throttling
Nicht jeden Frame verarbeiten – via Frame-Counter (siehe Abschnitt 4). Auf schwachen Geräten Frame-Rate dynamisch reduzieren wenn Inferenz > 400ms dauert.

### Wake Lock
`expo-keep-awake` aktivieren damit der Bildschirm während der Fahrt nicht sperrt:
```typescript
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'

// App in Vordergrund → aktivieren
// App in Hintergrund → deaktivieren + Frame Processor pausieren
```

### Hintergrund-Verhalten
Wenn App in den Hintergrund geht:
- Frame Processor pausieren (kamera-feed stoppen)
- GPS weiter laufen lassen (für Grenzübertritt-Erkennung)
- Bei Rückkehr in Vordergrund: sofort wieder aktivieren

---

## 8. Onboarding & Usability

### Erster App-Start (`Onboarding.tsx`)
Wird nur beim allerersten Start angezeigt, danach nie wieder. Drei kurze Screens:

**Screen 1 – Was ist das?**
- Titel: "Drive Side"
- Text: "Warnt dich wenn du im Ausland möglicherweise auf der falschen Fahrbahn fährst."
- Wichtig: "Diese App ist kein Sicherheitssystem. Verlass dich nie allein auf sie."

**Screen 2 – So funktioniert's**
- GPS erkennt automatisch in welchem Land du bist
- Kamera erkennt Spurmarkierungen
- Nur wenn beide Signale übereinstimmen wird gewarnt

**Screen 3 – Handy-Montage**
- Handy mittig hinter der Windschutzscheibe montieren
- Kamera muss die Straße vor dem Auto sehen
- Nicht seitlich oder zu steil nach unten gerichtet
- Illustration der korrekten Montageposition (einfache SVG-Grafik)

### Permissions-Flow
Falls Kamera oder GPS verweigert:
- Klarer Hinweis was fehlt und warum es gebraucht wird
- Deep-Link direkt in die iOS/Android Einstellungen
- App funktioniert im eingeschränkten Modus ohne Kamera (nur GPS-basierte Warnung)

---

## 9. Test-Modus (`useTestMode.ts`)

Erreichbar über langen Druck (2s) auf die StatusBar. Kein separater Screen – kleines Modal über dem Kamera-Feed.

### Test-Optionen

**A) Video-Datei statt Live-Kamera**
- Beliebiges Video aus der Galerie wählen (`expo-image-picker`)
- Video wird in einer Schleife abgespielt
- Frame Processor läuft auf Video-Frames statt Live-Kamera
- Empfohlen: CULane Testvideos (aus dem Datensatz des Modells)

**B) Einzelbild-Test**
- Bild aus Galerie wählen
- Einmalige Inferenz ausführen
- Ergebnis anzeigen: erkannte Linien als Overlay auf dem Bild
- Positionswert und Confidence anzeigen

**C) Simulierter GPS-Standort**
Dropdown mit vordefinierten Szenarien:
```typescript
const TEST_LOCATIONS = [
  { label: '🇬🇧 London (Linksverkehr)',    lat: 51.5074, lng: -0.1278, side: 'left' },
  { label: '🇩🇪 München (Rechtsverkehr)', lat: 48.1351, lng: 11.5820, side: 'right' },
  { label: '🇯🇵 Tokyo (Linksverkehr)',     lat: 35.6762, lng: 139.6503, side: 'left' },
  { label: '🇦🇺 Sydney (Linksverkehr)',    lat: -33.8688, lng: 151.2093, side: 'left' },
]
```
GPS-Hook gibt simulierte Position zurück, OSM-Hook reagiert darauf normal.

**D) Kombination: Video + simuliertes GPS**
Video aus Linksverkehr-Land abspielen + GPS auf London setzen → vollständiger End-to-End Test ohne Auto.

### Debug-Overlay im Test-Modus
Zusätzlich zum normalen DebugPanel:
- Erkannte Spurlinien als farbige Linien auf dem Kamera/Video-Feed eingezeichnet
- Bildmitte als vertikale Linie
- Positionsbalken mit numerischem Wert

---

## 10. Fehlerzustände (`ErrorState.tsx`)

Jeder Fehlerzustand wird als kompaktes Banner am oberen Rand angezeigt, nicht als Vollbild-Fehler. Die App bleibt nutzbar.

| Fehlerzustand | Anzeige | Verhalten |
|---|---|---|
| Kein GPS-Signal | "📡 Kein GPS" (grau) | Keine Warnung möglich, App wartet |
| GPS zu ungenau (>30m) | "📡 GPS ungenau" (grau) | Keine Warnung, weiter versuchen |
| OSM nicht erreichbar | "🗺 Offline" (grau) | Fallback auf countryDrivingSide.ts |
| Modell lädt noch | Ladebalken beim Start | Frame Processor pausiert bis geladen |
| Modell-Fehler | "⚠️ Spurerkennung fehlt" | Nur GPS-basierte Warnung (degraded mode) |
| Kamera verweigert | "📷 Kamera-Zugriff nötig" + Settings-Link | Nur GPS-Modus |
| Kamera zu dunkel | "🌙 Zu dunkel" (gedimmt) | Confidence='none', System schweigt |
| App im Hintergrund | (unsichtbar) | Frame Processor pausiert, GPS läuft |

### Degraded Mode
Wenn Kamera oder Spurerkennung nicht verfügbar: App funktioniert weiter mit reiner GPS+OSM-Erkennung. Beim Grenzübertritt in ein Linksfahrland:
- Einmalige Warnung: "🚗 Du fährst jetzt in ein Linksfahrland"
- Kein kontinuierliches Monitoring ohne Kamera

---

## 11. Permissions

### iOS (`app.json`)
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "Kamera wird zur Erkennung von Fahrspurmarkierungen benötigt",
        "NSLocationWhenInUseUsageDescription": "GPS wird zur Erkennung des aktuellen Fahrtrichtungslandes benötigt"
      }
    }
  }
}
```

### Android (`app.json`)
```json
{
  "expo": {
    "android": {
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.ACCESS_FINE_LOCATION"
      ]
    }
  }
}
```

---

## 12. Testing auf dem Handy

**Expo Go funktioniert NICHT** – native Module erfordern einen Development Build.

```bash
# Einmalig
npx expo prebuild

# iOS (Mac + Xcode erforderlich)
npx expo run:ios --device

# Android
npx expo run:android --device
```

Nach dem ersten Build: Fast Refresh funktioniert normal für JS-Änderungen.

---

## 13. Implementierungs-Reihenfolge

1. **Projekt Setup** – `npx create-expo-app DriveSide --template blank-typescript`
2. **Abhängigkeiten** – alle Packages aus Abschnitt 2
3. **GPS Hook** – Position + Genauigkeit
4. **countryDrivingSide + OSM Hook** – Fahrtrichtung aus Position
5. **Basis-UI** – StatusOverlay mit GPS + Fahrtrichtung (noch ohne Kamera)
6. **Onboarding** – einmaliger Erster-Start Flow
7. **Development Build** – `expo prebuild` + auf Gerät deployen
8. **Kamera** – Preview + Frame Processor läuft
9. **TFLite** – Modell laden, Inferenz testen, Output loggen
10. **Lane Analyzer** – Position aus Modell-Output
11. **Warning Logic** – Multi-Signal Entscheidung + Haptics + Animationen
12. **Test-Modus** – Video/Bild/Simulated GPS
13. **Fehlerzustände** – alle Error-Banner implementieren
14. **Performance** – Wake Lock, Hintergrund-Verhalten, Frame-Rate tuning
15. **Debug Panel** – vollständige Werte
16. **Polish** – Animationen, Farben, Feinschliff

---

## 14. Bekannte Herausforderungen & Lösungen

| Problem | Lösung |
|---|---|
| Expo Go unterstützt keine nativen Module | Development Build via `expo run:ios/android` |
| TFLite Input muss Float32Array sein | VisionCamera Frame Processor liefert das direkt |
| Input-Shape 320×1600 sehr breit | Frame Processor kann Frame vor Inferenz resizen |
| OSM-API offline/langsam | countryDrivingSide.ts Fallback + >50m Cache |
| Kurven verfälschen Position | Über 5 Frames mitteln |
| Keine Linienmarkierungen | Confidence='none' → System schweigt |
| Worklet-Kontext Einschränkungen | Nur serialisierbare Daten via runOnJS übergeben |
| Akku-Verbrauch | CoreML/GPU Delegate + niedrige Kamera-FPS + Balanced GPS |

---

## 15. Nicht im Scope (MVP)

- Einbahnstraßen-Erkennung (später via OSM `oneway` Tag)
- Abbiegehinweise
- Offline-Karten
- Aufzeichnung/Logging
- Einstellungen-Screen
- App Store Veröffentlichung