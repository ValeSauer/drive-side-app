import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useDriveStore } from '@/store/driveStore';
import { eventRequiresHaptic } from '@/lib/warningLogic';

export function useWarning() {
  const event = useDriveStore((s) => s.warning.event);
  const raisedAtMs = useDriveStore((s) => s.warning.raisedAtMs);
  const lastHandledRef = useRef<number | null>(null);

  useEffect(() => {
    if (!raisedAtMs || raisedAtMs === lastHandledRef.current) return;
    lastHandledRef.current = raisedAtMs;

    if (eventRequiresHaptic(event)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else if (event.type === 'entered-country') {
      Haptics.selectionAsync().catch(() => {});
    }
  }, [event, raisedAtMs]);
}
