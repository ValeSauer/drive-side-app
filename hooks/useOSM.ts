import { useEffect, useRef } from 'react';
import { createOSMClient, OSMClient } from '@/lib/osmClient';
import { getDrivingSide } from '@/lib/countryDrivingSide';
import { haversineMeters, isAccurate } from '@/lib/gpsAnalyzer';
import { useDriveStore } from '@/store/driveStore';

const POLL_INTERVAL_MS = 10_000;
const REFRESH_DISTANCE_M = 50;
const MIN_GEOCODE_INTERVAL_MS = 30_000;

let sharedClient: OSMClient | null = null;
function getClient(): OSMClient {
  if (!sharedClient) sharedClient = createOSMClient();
  return sharedClient;
}

export function useOSM(enabled: boolean) {
  const setOSM = useDriveStore((s) => s.setOSM);
  const setError = useDriveStore((s) => s.setError);
  const lastFixRef = useRef<{ lat: number; lng: number; atMs: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const client = getClient();
    let cancelled = false;

    const tick = async () => {
      const state = useDriveStore.getState();
      const { lat, lng, accuracy } = state.gps;
      if (lat == null || lng == null || accuracy == null) return;
      if (!isAccurate({ accuracy, lat, lng, timestampMs: 0, heading: null, speed: null })) {
        return;
      }

      const now = Date.now();
      const lastFix = lastFixRef.current;
      if (lastFix) {
        const distance = haversineMeters(
          { lat, lng },
          { lat: lastFix.lat, lng: lastFix.lng },
        );
        const age = now - lastFix.atMs;
        if (distance < REFRESH_DISTANCE_M && age < MIN_GEOCODE_INTERVAL_MS) {
          return;
        }
      }

      try {
        const result = await client.reverseGeocode(lat, lng);
        if (cancelled) return;
        if (!result) {
          const cached = state.lastKnownOSM;
          if (cached?.countryCode) {
            setOSM({
              countryCode: cached.countryCode,
              displayName: cached.displayName,
              drivingSide: cached.drivingSide,
              source: 'cached',
            });
            setError('osm', 'OSM offline — nutze letzten bekannten Standort');
          } else {
            setError('osm', 'Land nicht ermittelbar');
          }
          return;
        }

        lastFixRef.current = { lat, lng, atMs: now };
        setOSM({
          countryCode: result.countryCode,
          displayName: result.displayName ?? null,
          drivingSide: getDrivingSide(result.countryCode),
          source: 'osm',
        });
        setError('osm', null);
      } catch (e) {
        setError('osm', e instanceof Error ? e.message : 'OSM-Fehler');
      }
    };

    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, setOSM, setError]);
}
