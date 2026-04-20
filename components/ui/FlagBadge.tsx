import React from 'react';
import { Text, View } from 'react-native';
import { colors, radii, spacing } from '@/theme';
import { countryCodeToFlag } from '@/lib/countryFlags';

interface FlagBadgeProps {
  countryCode: string | null;
  size?: number;
  glowColor?: string;
}

export function FlagBadge({ countryCode, size = 120, glowColor = colors.safeGlow }: FlagBadgeProps) {
  const flag = countryCodeToFlag(countryCode);
  return (
    <View
      style={{
        width: size + spacing.md * 2,
        height: size + spacing.md * 2,
        borderRadius: radii.lg,
        backgroundColor: colors.bgElevated,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: glowColor,
        shadowOpacity: 1,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 0 },
        elevation: 12,
      }}
    >
      <Text style={{ fontSize: size * 0.75, lineHeight: size }}>{flag}</Text>
    </View>
  );
}
