import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NormalScreen } from '@/components/NormalScreen';
import { WarningScreen } from '@/components/WarningScreen';
import { Onboarding } from '@/components/Onboarding';
import { Permissions } from '@/components/Permissions';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useGPS } from '@/hooks/useGPS';
import { useOSM } from '@/hooks/useOSM';
import { useWarning } from '@/hooks/useWarning';
import { useDriveStore } from '@/store/driveStore';
import { colors } from '@/theme';

function AppShell() {
  useKeepAwake();

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const onboardingDone = useDriveStore((s) => s.onboardingDone);
  const warningActive = useDriveStore((s) => s.warning.event.type === 'side-changed');

  useGPS(permissionGranted === true);
  useOSM(permissionGranted === true);
  useWarning();

  const checkPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      setPermissionGranted(true);
      return;
    }
    const req = await Location.requestForegroundPermissionsAsync();
    setPermissionGranted(req.status === 'granted');
  };

  useEffect(() => {
    if (onboardingDone) checkPermission();
  }, [onboardingDone]);

  if (!onboardingDone) {
    return <Onboarding />;
  }

  if (permissionGranted === false) {
    return <Permissions onRetry={checkPermission} />;
  }

  return (
    <View style={styles.root}>
      <NormalScreen />
      {warningActive && <WarningScreen />}
      <ErrorBanner />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
