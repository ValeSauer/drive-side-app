import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmbientAura } from './ui/AmbientAura';
import { DirectionArrow } from './ui/DirectionArrow';
import { FlagBadge } from './ui/FlagBadge';
import { StatusDot } from './ui/StatusDot';
import { colors, spacing, typography } from '@/theme';
import { useDriveStore } from '@/store/driveStore';

export function NormalScreen() {
  const osm = useDriveStore((s) => s.osm);
  const errors = useDriveStore((s) => s.errors);
  const gps = useDriveStore((s) => s.gps);

  const hasSignal = osm.drivingSide != null && gps.lat != null;
  const side = osm.drivingSide;
  const isLeft = side === 'left';

  const tint = hasSignal ? colors.safe : colors.unknown;
  const glow = hasSignal ? colors.safeGlow : colors.unknownGlow;

  const statusLabel = !hasSignal
    ? errors.gps ?? 'Warte auf GPS'
    : isLeft
      ? 'Linksverkehr'
      : 'Rechtsverkehr';

  const hint = !hasSignal ? null : isLeft ? 'Links halten' : 'Rechts halten';

  return (
    <View style={styles.root}>
      <AmbientAura color={glow} active={hasSignal} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.appTitle}>DRIVE SIDE</Text>
        </View>

        <View style={styles.center}>
          <FlagBadge countryCode={osm.countryCode} glowColor={glow} />

          {hint && side && (
            <View style={styles.hintRow}>
              <DirectionArrow direction={side} color={tint} size={72} />
              <Text style={[styles.hint, { color: tint }]}>{hint}</Text>
            </View>
          )}

          <Text style={styles.status}>{statusLabel}</Text>
        </View>

        <View style={styles.footer}>
          <StatusDot state={hasSignal ? 'safe' : 'unknown'} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  header: { alignItems: 'center', paddingTop: spacing.md },
  appTitle: {
    ...typography.label,
    color: colors.textMuted,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  hint: {
    ...typography.headline,
  },
  status: {
    ...typography.label,
    color: colors.textSecondary,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
});
