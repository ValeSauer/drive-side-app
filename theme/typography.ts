import { Platform } from 'react-native';

const sans = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

export const typography = {
  display: { fontFamily: sans, fontSize: 72, fontWeight: '800' as const, letterSpacing: -1.5 },
  headline: { fontFamily: sans, fontSize: 40, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontFamily: sans, fontSize: 24, fontWeight: '600' as const },
  body: { fontFamily: sans, fontSize: 16, fontWeight: '400' as const },
  label: {
    fontFamily: sans,
    fontSize: 12,
    fontWeight: '500' as const,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  },
  caption: { fontFamily: sans, fontSize: 11, fontWeight: '400' as const },
} as const;
