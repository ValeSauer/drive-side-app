import { DrivingSide, getDrivingSide } from './countryDrivingSide';

export interface CountryContext {
  countryCode: string | null;
  drivingSide: DrivingSide | null;
}

export type WarningEvent =
  | { type: 'none' }
  | {
      type: 'side-changed';
      fromSide: DrivingSide;
      toSide: DrivingSide;
      countryCode: string;
    }
  | {
      type: 'entered-country';
      countryCode: string;
      drivingSide: DrivingSide;
    };

export function fromCountryCode(
  countryCode: string | null | undefined,
): CountryContext {
  if (!countryCode) return { countryCode: null, drivingSide: null };
  const code = countryCode.toUpperCase();
  return { countryCode: code, drivingSide: getDrivingSide(code) };
}

export function evaluateCrossing(
  previous: CountryContext | null,
  current: CountryContext,
): WarningEvent {
  if (!current.countryCode || !current.drivingSide) {
    return { type: 'none' };
  }

  if (!previous || !previous.countryCode) {
    return { type: 'none' };
  }

  if (previous.countryCode === current.countryCode) {
    return { type: 'none' };
  }

  if (previous.drivingSide && previous.drivingSide !== current.drivingSide) {
    return {
      type: 'side-changed',
      fromSide: previous.drivingSide,
      toSide: current.drivingSide,
      countryCode: current.countryCode,
    };
  }

  return {
    type: 'entered-country',
    countryCode: current.countryCode,
    drivingSide: current.drivingSide,
  };
}

export function eventRequiresHaptic(event: WarningEvent): boolean {
  return event.type === 'side-changed';
}
