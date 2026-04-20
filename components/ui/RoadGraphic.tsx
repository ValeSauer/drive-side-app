import React from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { colors, radii } from '@/theme';
import type { DrivingSide } from '@/lib/countryDrivingSide';

interface RoadGraphicProps {
  drivingSide: DrivingSide;
  mode?: 'ok' | 'wrong';
  width?: number;
  height?: number;
}

export function RoadGraphic({
  drivingSide,
  mode = 'ok',
  width = 220,
  height = 140,
}: RoadGraphicProps) {
  const roadLeft = width * 0.1;
  const roadRight = width * 0.9;
  const roadWidth = roadRight - roadLeft;
  const centerX = width / 2;
  const carWidth = 34;
  const carHeight = 52;
  const carY = height - carHeight - 12;

  const correctSide = drivingSide === 'left' ? 'left' : 'right';
  const shownSide = mode === 'wrong' ? (correctSide === 'left' ? 'right' : 'left') : correctSide;

  const laneOffset = roadWidth * 0.22;
  const carX =
    shownSide === 'left'
      ? centerX - laneOffset - carWidth / 2
      : centerX + laneOffset - carWidth / 2;

  const carColor = mode === 'wrong' ? colors.warning : colors.safe;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Rect
          x={roadLeft}
          y={0}
          width={roadWidth}
          height={height}
          fill="#1a1a1a"
          rx={radii.sm}
        />
        <Line
          x1={roadLeft}
          y1={0}
          x2={roadLeft}
          y2={height}
          stroke={colors.textSecondary}
          strokeWidth={2}
        />
        <Line
          x1={roadRight}
          y1={0}
          x2={roadRight}
          y2={height}
          stroke={colors.textSecondary}
          strokeWidth={2}
        />
        <Line
          x1={centerX}
          y1={0}
          x2={centerX}
          y2={height}
          stroke={colors.textMuted}
          strokeWidth={2}
          strokeDasharray="8 8"
        />
        <Rect
          x={carX}
          y={carY}
          width={carWidth}
          height={carHeight}
          fill={carColor}
          rx={6}
        />
      </Svg>
    </View>
  );
}
