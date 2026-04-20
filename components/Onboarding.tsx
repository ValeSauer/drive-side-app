import React, { useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, radii, spacing, typography } from '@/theme';
import { useDriveStore } from '@/store/driveStore';

interface Slide {
  eyebrow: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    eyebrow: 'WILLKOMMEN',
    title: 'Drive Side',
    body: 'Warnt dich, wenn du im Ausland möglicherweise auf der falschen Fahrbahn fährst.\n\nDies ist kein Sicherheitssystem — verlass dich nie allein auf die App.',
  },
  {
    eyebrow: 'SO FUNKTIONIERTS',
    title: 'GPS erkennt dein Land',
    body: 'Sobald du eine Grenze mit anderer Fahrtrichtung überquerst, meldet sich Drive Side mit einer einmaligen Warnung.',
  },
  {
    eyebrow: 'UNTERWEGS',
    title: 'Los geht’s',
    body: 'Lege das Telefon gut sichtbar ab. Drive Side läuft im Hintergrund und meldet sich nur, wenn es nötig ist.',
  },
];

const { width } = Dimensions.get('window');

export function Onboarding() {
  const complete = useDriveStore((s) => s.completeOnboarding);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const next = () => {
    Haptics.selectionAsync().catch(() => {});
    if (isLast) {
      complete();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === index ? colors.textPrimary : colors.divider },
            ]}
          />
        ))}
      </View>

      <Animated.View
        key={index}
        entering={FadeIn.duration(400)}
        exiting={FadeOut.duration(200)}
        style={styles.body}
      >
        <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.bodyText}>{slide.body}</Text>
      </Animated.View>

      <View style={styles.footer}>
        <Pressable onPress={next} style={styles.cta}>
          <Text style={styles.ctaText}>{isLast ? 'Los geht’s' : 'Weiter'}</Text>
        </Pressable>
        {!isLast && (
          <Pressable onPress={complete} style={styles.skip}>
            <Text style={styles.skipText}>Überspringen</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  dot: { width: 24, height: 4, borderRadius: 2 },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    maxWidth: width - spacing.lg * 2,
  },
  eyebrow: { ...typography.label, color: colors.safe },
  title: { ...typography.headline, color: colors.textPrimary },
  bodyText: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
  footer: { paddingBottom: spacing.lg, gap: spacing.sm },
  cta: {
    backgroundColor: colors.textPrimary,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
  },
  ctaText: { ...typography.title, color: colors.bg },
  skip: { alignItems: 'center', paddingVertical: spacing.sm },
  skipText: { ...typography.body, color: colors.textMuted },
});
