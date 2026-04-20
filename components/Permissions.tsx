import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '@/theme';

interface PermissionsProps {
  onRetry: () => void;
}

export function Permissions({ onRetry }: PermissionsProps) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>STANDORT BENÖTIGT</Text>
        <Text style={styles.title}>Drive Side braucht deinen Standort</Text>
        <Text style={styles.bodyText}>
          Ohne GPS können wir nicht erkennen, in welchem Land du gerade bist — und ob dort Links- oder Rechtsverkehr gilt.
        </Text>
      </View>
      <View style={styles.footer}>
        <Pressable onPress={onRetry} style={[styles.cta, styles.primary]}>
          <Text style={[styles.ctaText, { color: colors.bg }]}>Erlauben</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openSettings()} style={styles.cta}>
          <Text style={styles.ctaText}>Einstellungen öffnen</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  body: { flex: 1, justifyContent: 'center', gap: spacing.md },
  eyebrow: { ...typography.label, color: colors.caution },
  title: { ...typography.headline, color: colors.textPrimary },
  bodyText: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
  footer: { paddingBottom: spacing.lg, gap: spacing.sm },
  cta: {
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  primary: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  ctaText: { ...typography.title, color: colors.textPrimary },
});
