import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import {
  analyzeGPS,
  GPSReading,
  isAccurate,
  MIN_ACCURACY_M,
} from '@/lib/gpsAnalyzer';
import { useDriveStore } from '@/store/driveStore';

const HISTORY_SIZE = 5;
const UPDATE_INTERVAL_MS = 1000;
const MIN_DISTANCE_M = 0;

export function useGPS(enabled: boolean) {
  const setGPS = useDriveStore((s) => s.setGPS);
  const setError = useDriveStore((s) => s.setError);
  const historyRef = useRef<GPSReading[]>([]);

  useEffect(() => {
    if (!enabled) return;

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('permission', 'Location permission denied');
          return;
        }
        setError('permission', null);

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: UPDATE_INTERVAL_MS,
            distanceInterval: MIN_DISTANCE_M,
          },
          (loc) => {
            if (cancelled) return;
            const reading: GPSReading = {
              timestampMs: loc.timestamp,
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              accuracy: loc.coords.accuracy ?? 9999,
              heading: loc.coords.heading ?? null,
              speed: loc.coords.speed ?? null,
            };
            const next = [...historyRef.current, reading].slice(-HISTORY_SIZE);
            historyRef.current = next;
            const analysis = analyzeGPS(next);
            setGPS(analysis);
            setError(
              'gps',
              isAccurate(reading)
                ? null
                : `GPS ungenau (${Math.round(reading.accuracy)}m > ${MIN_ACCURACY_M}m)`,
            );
          },
        );
      } catch (e) {
        setError('gps', e instanceof Error ? e.message : 'Unbekannter GPS-Fehler');
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, setGPS, setError]);
}
