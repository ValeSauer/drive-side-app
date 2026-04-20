import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DrivingSide } from '@/lib/countryDrivingSide';
import type { GPSAnalysis } from '@/lib/gpsAnalyzer';
import {
  evaluateCrossing,
  fromCountryCode,
  WarningEvent,
} from '@/lib/warningLogic';
import { persistedStorage } from './storage';

const EMPTY_GPS: GPSAnalysis = {
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

export type OSMSource = 'osm' | 'cached' | 'unknown';

export interface OSMState {
  countryCode: string | null;
  displayName: string | null;
  drivingSide: DrivingSide | null;
  source: OSMSource;
  lastUpdatedMs: number | null;
}

const EMPTY_OSM: OSMState = {
  countryCode: null,
  displayName: null,
  drivingSide: null,
  source: 'unknown',
  lastUpdatedMs: null,
};

export type ErrorKey = 'gps' | 'osm' | 'permission';

export interface DriveState {
  gps: GPSAnalysis;
  osm: OSMState;
  warning: {
    event: WarningEvent;
    raisedAtMs: number | null;
    dismissedAt: number | null;
  };
  errors: Record<ErrorKey, string | null>;
  onboardingDone: boolean;
  lastKnownOSM: OSMState | null;

  setGPS: (gps: GPSAnalysis) => void;
  setOSM: (osm: Omit<OSMState, 'lastUpdatedMs'>) => void;
  setError: (key: ErrorKey, message: string | null) => void;
  dismissWarning: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useDriveStore = create<DriveState>()(
  persist(
    (set, get) => ({
      gps: EMPTY_GPS,
      osm: EMPTY_OSM,
      warning: { event: { type: 'none' }, raisedAtMs: null, dismissedAt: null },
      errors: { gps: null, osm: null, permission: null },
      onboardingDone: false,
      lastKnownOSM: null,

      setGPS: (gps) => set({ gps }),

      setOSM: (update) => {
        const now = Date.now();
        const next: OSMState = { ...update, lastUpdatedMs: now };
        const previous = get().osm;
        const previousContext =
          previous.countryCode && previous.drivingSide
            ? fromCountryCode(previous.countryCode)
            : get().lastKnownOSM && get().lastKnownOSM!.countryCode
              ? fromCountryCode(get().lastKnownOSM!.countryCode)
              : null;
        const currentContext = fromCountryCode(update.countryCode);
        const event = evaluateCrossing(previousContext, currentContext);

        set({
          osm: next,
          lastKnownOSM: next.countryCode ? next : get().lastKnownOSM,
          warning:
            event.type === 'none'
              ? get().warning
              : { event, raisedAtMs: now, dismissedAt: null },
        });
      },

      setError: (key, message) =>
        set((state) => ({ errors: { ...state.errors, [key]: message } })),

      dismissWarning: () =>
        set({
          warning: {
            event: { type: 'none' },
            raisedAtMs: null,
            dismissedAt: Date.now(),
          },
        }),

      completeOnboarding: () => set({ onboardingDone: true }),
      resetOnboarding: () => set({ onboardingDone: false }),
    }),
    {
      name: 'drive-side-v1',
      storage: persistedStorage,
      partialize: (state) => ({
        onboardingDone: state.onboardingDone,
        lastKnownOSM: state.lastKnownOSM,
      }),
      version: 1,
    },
  ),
);
