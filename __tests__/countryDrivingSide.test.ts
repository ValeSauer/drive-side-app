import { getDrivingSide, isLeftHandTraffic } from '@/lib/countryDrivingSide';

describe('countryDrivingSide', () => {
  describe('getDrivingSide', () => {
    it.each([
      ['GB', 'left'],
      ['IE', 'left'],
      ['JP', 'left'],
      ['AU', 'left'],
      ['IN', 'left'],
      ['ZA', 'left'],
    ])('returns left for %s', (code, expected) => {
      expect(getDrivingSide(code)).toBe(expected);
    });

    it.each([
      ['DE', 'right'],
      ['FR', 'right'],
      ['US', 'right'],
      ['CN', 'right'],
      ['BR', 'right'],
      ['CA', 'right'],
    ])('returns right for %s', (code, expected) => {
      expect(getDrivingSide(code)).toBe(expected);
    });

    it('normalises to uppercase', () => {
      expect(getDrivingSide('gb')).toBe('left');
      expect(getDrivingSide('de')).toBe('right');
    });

    it('defaults to right for nullish/empty input', () => {
      expect(getDrivingSide(null)).toBe('right');
      expect(getDrivingSide(undefined)).toBe('right');
      expect(getDrivingSide('')).toBe('right');
    });

    it('defaults to right for unknown codes', () => {
      expect(getDrivingSide('XX')).toBe('right');
      expect(getDrivingSide('ZZZ')).toBe('right');
    });
  });

  describe('isLeftHandTraffic', () => {
    it('returns true for left-hand countries', () => {
      expect(isLeftHandTraffic('GB')).toBe(true);
      expect(isLeftHandTraffic('JP')).toBe(true);
    });

    it('returns false for right-hand countries', () => {
      expect(isLeftHandTraffic('DE')).toBe(false);
      expect(isLeftHandTraffic('US')).toBe(false);
    });
  });
});
