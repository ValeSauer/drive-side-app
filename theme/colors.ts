export const colors = {
  safe: '#00C853',
  safeGlow: 'rgba(0, 200, 83, 0.35)',
  caution: '#FFB300',
  cautionGlow: 'rgba(255, 179, 0, 0.4)',
  warning: '#D50000',
  warningDeep: '#5A0000',
  warningGlow: 'rgba(213, 0, 0, 0.55)',
  unknown: '#607D8B',
  unknownGlow: 'rgba(96, 125, 139, 0.3)',
  bg: '#0A0A0A',
  bgElevated: '#141414',
  bgWarn: '#2A0000',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.72)',
  textMuted: 'rgba(255, 255, 255, 0.42)',
  divider: 'rgba(255, 255, 255, 0.08)',
  laneGreen: '#00FF88',
} as const;

export type ColorToken = keyof typeof colors;
