import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme';

type Direction = 'left' | 'right';

interface DirectionArrowProps {
  direction: Direction;
  color?: string;
  size?: number;
  intensity?: 'subtle' | 'strong';
}

const ARROW_PATH_RIGHT = 'M 8 24 L 32 24 M 22 14 L 32 24 L 22 34';
const ARROW_PATH_LEFT = 'M 40 24 L 16 24 M 26 14 L 16 24 L 26 34';

export function DirectionArrow({
  direction,
  color = colors.safe,
  size = 96,
  intensity = 'subtle',
}: DirectionArrowProps) {
  const translate = useSharedValue(0);

  useEffect(() => {
    const distance = intensity === 'strong' ? 16 : 6;
    const duration = intensity === 'strong' ? 500 : 1400;
    const sign = direction === 'left' ? -1 : 1;
    translate.value = withRepeat(
      withSequence(
        withTiming(sign * distance, { duration }),
        withTiming(0, { duration }),
      ),
      -1,
      false,
    );
  }, [direction, intensity, translate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translate.value }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path
          d={direction === 'left' ? ARROW_PATH_LEFT : ARROW_PATH_RIGHT}
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
      {/* spacer for type inference */}
      <View style={{ width: 0, height: 0 }} />
    </Animated.View>
  );
}
