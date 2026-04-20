import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { DirectionArrow } from './ui/DirectionArrow';
import { RoadGraphic } from './ui/RoadGraphic';
import { colors, spacing, typography } from '@/theme';
import { useDriveStore } from '@/store/driveStore';
import { countryCodeToFlag } from '@/lib/countryFlags';
import type { DrivingSide } from '@/lib/countryDrivingSide';

const AUTO_DISMISS_MS = 8000;

export function WarningScreen() {
  const event = useDriveStore((s) => s.warning.event);
  const dismiss = useDriveStore((s) => s.dismissWarning);
  const bgPulse = useSharedValue(0);

  useEffect(() => {
    bgPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700 }),
        withTiming(0.6, { duration: 700 }),
      ),
      -1,
      true,
    );
  }, [bgPulse]);

  useEffect(() => {
    const t = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [dismiss]);

  const bgStyle = useAnimatedStyle(() => ({ opacity: bgPulse.value }));

  if (event.type !== 'side-changed') return null;

  const drivingSide: DrivingSide = event.toSide;
  const directionLabel = drivingSide === 'left' ? 'LINKS' : 'RECHTS';
  const trafficLabel = drivingSide === 'left' ? 'Linksverkehr' : 'Rechtsverkehr';

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
      <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(400)} style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, bgStyle]} pointerEvents="none">
          <LinearGradient
            colors={[colors.warning, colors.warningDeep]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>JETZT GILT</Text>
          </View>

          <View style={styles.center}>
            <View style={styles.arrowRow}>
              <DirectionArrow
                direction={drivingSide}
                color={colors.textPrimary}
                size={120}
                intensity="strong"
              />
            </View>

            <Text style={styles.command}>{directionLabel}</Text>
            <Text style={styles.trafficLabel}>
              {countryCodeToFlag(event.countryCode)}  {trafficLabel}
            </Text>

            <View style={styles.roadWrap}>
              <RoadGraphic drivingSide={drivingSide} mode="wrong" width={240} height={140} />
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.dismiss}>Tippen zum Schließen</Text>
          </View>
        </SafeAreaView>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  header: { alignItems: 'center', paddingTop: spacing.md },
  eyebrow: {
    ...typography.label,
    color: colors.textPrimary,
    opacity: 0.85,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  arrowRow: { flexDirection: 'row', alignItems: 'center' },
  command: {
    ...typography.display,
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  trafficLabel: {
    ...typography.title,
    color: colors.textPrimary,
    opacity: 0.9,
  },
  roadWrap: { marginTop: spacing.md },
  footer: { alignItems: 'center', paddingBottom: spacing.lg },
  dismiss: {
    ...typography.caption,
    color: colors.textPrimary,
    opacity: 0.6,
  },
});
