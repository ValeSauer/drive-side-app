export type DrivingSide = 'left' | 'right';

const LEFT_HAND_TRAFFIC: ReadonlySet<string> = new Set([
  'AG', 'AI', 'AU', 'BB', 'BD', 'BM', 'BN', 'BS', 'BT', 'BW',
  'CC', 'CK', 'CX', 'CY', 'DM', 'FJ', 'FK', 'GB', 'GD', 'GG',
  'GY', 'HK', 'IE', 'IM', 'IN', 'JE', 'JM', 'JP', 'KE', 'KI',
  'KN', 'LC', 'LK', 'LS', 'MO', 'MS', 'MT', 'MU', 'MV', 'MW',
  'MY', 'MZ', 'NA', 'NF', 'NP', 'NR', 'NU', 'NZ', 'PG', 'PK',
  'PN', 'SB', 'SC', 'SG', 'SH', 'SR', 'SZ', 'TC', 'TH', 'TL',
  'TO', 'TT', 'TV', 'TZ', 'UG', 'VC', 'VG', 'WS', 'ZA', 'ZM',
  'ZW',
]);

export function getDrivingSide(countryCode: string | null | undefined): DrivingSide {
  if (!countryCode) return 'right';
  return LEFT_HAND_TRAFFIC.has(countryCode.toUpperCase()) ? 'left' : 'right';
}

export function isLeftHandTraffic(countryCode: string | null | undefined): boolean {
  return getDrivingSide(countryCode) === 'left';
}
