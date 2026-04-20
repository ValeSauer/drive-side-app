import {
  analyzeGPS,
  angularDelta,
  circularMean,
  haversineMeters,
  isAccurate,
  GPSReading,
} from '@/lib/gpsAnalyzer';

const reading = (overrides: Partial<GPSReading> = {}): GPSReading => ({
  timestampMs: 0,
  lat: 48.1351,
  lng: 11.582,
  accuracy: 10,
  heading: 90,
  speed: 10,
  ...overrides,
});

describe('circularMean', () => {
  it('returns null for empty input', () => {
    expect(circularMean([])).toBeNull();
  });

  it('averages plain angles', () => {
    expect(circularMean([10, 20, 30])).toBeCloseTo(20, 1);
  });

  it('handles the 0/360 wrap-around', () => {
    const mean = circularMean([355, 5]);
    expect(mean).toBeCloseTo(0, 1);
  });

  it('wraps around correctly near north', () => {
    const mean = circularMean([350, 10, 20]);
    expect(mean).toBeGreaterThanOrEqual(0);
    expect(mean).toBeLessThan(15);
  });
});

describe('angularDelta', () => {
  it('returns shortest angle difference', () => {
    expect(angularDelta(10, 20)).toBe(10);
    expect(angularDelta(350, 10)).toBe(20);
    expect(angularDelta(0, 180)).toBe(180);
    expect(angularDelta(170, 190)).toBe(20);
  });
});

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBe(0);
  });

  it('computes roughly 111 km per degree of latitude', () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe('isAccurate', () => {
  it('returns true for accuracy below threshold', () => {
    expect(isAccurate(reading({ accuracy: 15 }))).toBe(true);
  });

  it('returns false for accuracy at/above threshold', () => {
    expect(isAccurate(reading({ accuracy: 30 }))).toBe(false);
    expect(isAccurate(reading({ accuracy: 100 }))).toBe(false);
  });

  it('returns false for zero or negative accuracy', () => {
    expect(isAccurate(reading({ accuracy: 0 }))).toBe(false);
    expect(isAccurate(reading({ accuracy: -5 }))).toBe(false);
  });
});

describe('analyzeGPS', () => {
  it('returns empty analysis for empty history', () => {
    const a = analyzeGPS([]);
    expect(a.lat).toBeNull();
    expect(a.isDriving).toBe(false);
    expect(a.isTurning).toBe(false);
  });

  it('classifies pedestrian speeds as moving but not driving', () => {
    const a = analyzeGPS([reading({ speed: 2.0 })]);
    expect(a.isMoving).toBe(true);
    expect(a.isDriving).toBe(false);
  });

  it('classifies car speeds as driving', () => {
    const a = analyzeGPS([reading({ speed: 20 })]);
    expect(a.isMoving).toBe(true);
    expect(a.isDriving).toBe(true);
  });

  it('classifies parked vehicle as not moving', () => {
    const a = analyzeGPS([reading({ speed: 0.3 })]);
    expect(a.isMoving).toBe(false);
    expect(a.isDriving).toBe(false);
  });

  it('smooths heading over recent window', () => {
    const readings: GPSReading[] = [
      reading({ timestampMs: 0, heading: 88 }),
      reading({ timestampMs: 1000, heading: 90 }),
      reading({ timestampMs: 2000, heading: 92 }),
    ];
    const a = analyzeGPS(readings);
    expect(a.smoothedHeading).toBeCloseTo(90, 0);
  });

  it('detects sharp turn', () => {
    const readings: GPSReading[] = [
      reading({ timestampMs: 0, heading: 0 }),
      reading({ timestampMs: 1000, heading: 0 }),
      reading({ timestampMs: 2000, heading: 0 }),
      reading({ timestampMs: 3000, heading: 45 }),
    ];
    const a = analyzeGPS(readings);
    expect(a.headingChange).not.toBeNull();
    expect(a.headingChange!).toBeGreaterThan(10);
    expect(a.isTurning).toBe(true);
  });

  it('does not flag gentle curve as turning', () => {
    const readings: GPSReading[] = [
      reading({ timestampMs: 0, heading: 0 }),
      reading({ timestampMs: 1000, heading: 2 }),
      reading({ timestampMs: 2000, heading: 4 }),
      reading({ timestampMs: 3000, heading: 6 }),
    ];
    const a = analyzeGPS(readings);
    expect(a.isTurning).toBe(false);
  });

  it('handles wrap-around during turn', () => {
    const readings: GPSReading[] = [
      reading({ timestampMs: 0, heading: 350 }),
      reading({ timestampMs: 1000, heading: 355 }),
      reading({ timestampMs: 2000, heading: 0 }),
      reading({ timestampMs: 3000, heading: 5 }),
    ];
    const a = analyzeGPS(readings);
    expect(a.isTurning).toBe(false);
  });
});
