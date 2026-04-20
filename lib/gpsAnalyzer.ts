export interface GPSReading {
  timestampMs: number;
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
}

export interface GPSAnalysis {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  isMoving: boolean;
  isDriving: boolean;
  smoothedHeading: number | null;
  headingChange: number | null;
  isTurning: boolean;
}

export const MOVING_THRESHOLD_MS = 1.4;
export const DRIVING_THRESHOLD_MS = 4.2;
export const TURNING_THRESHOLD_DEG_PER_S = 10;
export const HEADING_HISTORY_SIZE = 3;
export const MIN_ACCURACY_M = 30;

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(x));
}

export function circularMean(degrees: number[]): number | null {
  if (degrees.length === 0) return null;
  const sin = degrees.reduce((s, d) => s + Math.sin((d * Math.PI) / 180), 0);
  const cos = degrees.reduce((s, d) => s + Math.cos((d * Math.PI) / 180), 0);
  if (sin === 0 && cos === 0) return null;
  const mean = (Math.atan2(sin, cos) * 180) / Math.PI;
  return (mean + 360) % 360;
}

export function angularDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function isAccurate(reading: GPSReading): boolean {
  return reading.accuracy > 0 && reading.accuracy < MIN_ACCURACY_M;
}

export function analyzeGPS(history: GPSReading[]): GPSAnalysis {
  const empty: GPSAnalysis = {
    lat: null,
    lng: null,
    accuracy: null,
    heading: null,
    speed: null,
    isMoving: false,
    isDriving: false,
    smoothedHeading: null,
    headingChange: null,
    isTurning: false,
  };

  if (history.length === 0) return empty;

  const latest = history[history.length - 1];
  const speed = latest.speed ?? null;
  const isMoving = speed != null && speed > MOVING_THRESHOLD_MS;
  const isDriving = speed != null && speed > DRIVING_THRESHOLD_MS;

  const recentHeadings = history
    .slice(-HEADING_HISTORY_SIZE)
    .map((r) => r.heading)
    .filter((h): h is number => h != null);

  const smoothedHeading = circularMean(recentHeadings);

  let headingChange: number | null = null;
  let isTurning = false;

  if (history.length >= 2 && smoothedHeading != null) {
    const previousWindow = history
      .slice(-HEADING_HISTORY_SIZE - 1, -1)
      .map((r) => r.heading)
      .filter((h): h is number => h != null);

    const previousSmoothed = circularMean(previousWindow);

    if (previousSmoothed != null) {
      const dtMs = latest.timestampMs - history[history.length - 2].timestampMs;
      if (dtMs > 0) {
        const dtSeconds = dtMs / 1000;
        const delta = angularDelta(smoothedHeading, previousSmoothed);
        headingChange = delta / dtSeconds;
        isTurning = headingChange > TURNING_THRESHOLD_DEG_PER_S;
      }
    }
  }

  return {
    lat: latest.lat,
    lng: latest.lng,
    accuracy: latest.accuracy,
    heading: latest.heading,
    speed,
    isMoving,
    isDriving,
    smoothedHeading,
    headingChange,
    isTurning,
  };
}
