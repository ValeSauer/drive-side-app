import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '@/theme';
import { useDriveStore } from '@/store/driveStore';

export function ErrorBanner() {
  const errors = useDriveStore((s) => s.errors);
  const first = errors.gps ?? errors.osm ?? errors.permission;
  if (!first) return null;

  return (
    <SafeAreaView edges={['top']} style={styles.wrap} pointerEvents="none">
      <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={styles.banner}>
        <Text style={styles.text}>{first}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  banner: {
    backgroundColor: 'rgba(20,20,20,0.92)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  text: { ...typography.caption, color: colors.textSecondary },
});
