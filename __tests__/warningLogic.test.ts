import {
  evaluateCrossing,
  eventRequiresHaptic,
  fromCountryCode,
} from '@/lib/warningLogic';

describe('fromCountryCode', () => {
  it('builds context with driving side', () => {
    expect(fromCountryCode('GB')).toEqual({
      countryCode: 'GB',
      drivingSide: 'left',
    });
    expect(fromCountryCode('de')).toEqual({
      countryCode: 'DE',
      drivingSide: 'right',
    });
  });

  it('returns null context for nullish input', () => {
    expect(fromCountryCode(null)).toEqual({
      countryCode: null,
      drivingSide: null,
    });
  });
});

describe('evaluateCrossing', () => {
  it('returns none on first known country (no previous)', () => {
    expect(evaluateCrossing(null, fromCountryCode('DE'))).toEqual({ type: 'none' });
  });

  it('returns none when country unchanged', () => {
    expect(
      evaluateCrossing(fromCountryCode('DE'), fromCountryCode('DE')),
    ).toEqual({ type: 'none' });
  });

  it('flags side-changed when crossing from right to left', () => {
    const event = evaluateCrossing(fromCountryCode('FR'), fromCountryCode('GB'));
    expect(event).toEqual({
      type: 'side-changed',
      fromSide: 'right',
      toSide: 'left',
      countryCode: 'GB',
    });
  });

  it('flags side-changed when crossing from left to right', () => {
    const event = evaluateCrossing(fromCountryCode('GB'), fromCountryCode('FR'));
    expect(event).toEqual({
      type: 'side-changed',
      fromSide: 'left',
      toSide: 'right',
      countryCode: 'FR',
    });
  });

  it('flags entered-country for same-side border crossing', () => {
    const event = evaluateCrossing(fromCountryCode('DE'), fromCountryCode('FR'));
    expect(event).toEqual({
      type: 'entered-country',
      countryCode: 'FR',
      drivingSide: 'right',
    });
  });

  it('returns none when current country unknown', () => {
    expect(
      evaluateCrossing(fromCountryCode('DE'), {
        countryCode: null,
        drivingSide: null,
      }),
    ).toEqual({ type: 'none' });
  });

  it('returns none when previous country unknown', () => {
    expect(
      evaluateCrossing({ countryCode: null, drivingSide: null }, fromCountryCode('GB')),
    ).toEqual({ type: 'none' });
  });
});

describe('eventRequiresHaptic', () => {
  it('requires haptic for side change', () => {
    expect(
      eventRequiresHaptic({
        type: 'side-changed',
        fromSide: 'right',
        toSide: 'left',
        countryCode: 'GB',
      }),
    ).toBe(true);
  });

  it('does not require haptic for same-side crossing', () => {
    expect(
      eventRequiresHaptic({
        type: 'entered-country',
        countryCode: 'FR',
        drivingSide: 'right',
      }),
    ).toBe(false);
  });

  it('does not require haptic for none', () => {
    expect(eventRequiresHaptic({ type: 'none' })).toBe(false);
  });
});
