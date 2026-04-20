import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface AmbientAuraProps {
  color: string;
  active?: boolean;
}

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export function AmbientAura({ color, active = true }: AmbientAuraProps) {
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    if (!active) {
      pulse.value = withTiming(0.2, { duration: 500 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.75, { duration: 4000 }),
        withTiming(0.3, { duration: 4000 }),
      ),
      -1,
      true,
    );
  }, [active, pulse]);

  const gradientStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <AnimatedGradient
        colors={[color, 'transparent']}
        style={[StyleSheet.absoluteFill, gradientStyle]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
    </View>
  );
}
