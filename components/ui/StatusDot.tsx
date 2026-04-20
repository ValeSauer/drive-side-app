import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme';

type DotState = 'safe' | 'caution' | 'warning' | 'unknown';

const COLOR_MAP: Record<DotState, string> = {
  safe: colors.safe,
  caution: colors.caution,
  warning: colors.warning,
  unknown: colors.unknown,
};

const GLOW_MAP: Record<DotState, string> = {
  safe: colors.safeGlow,
  caution: colors.cautionGlow,
  warning: colors.warningGlow,
  unknown: colors.unknownGlow,
};

export function StatusDot({ state = 'safe', size = 14 }: { state?: DotState; size?: number }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.25, { duration: 1200 }), withTiming(1, { duration: 1200 })),
      -1,
      true,
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  const color = COLOR_MAP[state];
  const glow = GLOW_MAP[state];

  return (
    <View style={{ width: size * 3, height: size * 3, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: size * 1.5,
            backgroundColor: glow,
            width: size * 3,
            height: size * 3,
          },
          ringStyle,
        ]}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
