import { useCallback, useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContextualActionSheet } from '@/components/ui/contextual-action-sheet';
import { Spacing } from '@/constants/theme';
import { useContextualSheetStore } from '@/store/contextualSheetStore';

/**
 * Root-level host for contextual sheets.
 *
 * Keeping the sheet outside a screen avoids inheriting a short screen layout.
 * Its backdrop is visual only, so taps still reach the list behind it.
 */
export function ContextualActionSheetHost() {
  const visible = useContextualSheetStore((state) => state.visible);
  const title = useContextualSheetStore((state) => state.title);
  const actions = useContextualSheetStore((state) => state.actions);
  const onCancel = useContextualSheetStore((state) => state.onCancel);
  const registerDismiss = useContextualSheetStore((state) => state.registerDismiss);
  const sheetRef = useRef(null);
  const insets = useSafeAreaInsets();

  const dismiss = useCallback((callback) => {
    sheetRef.current?.dismiss(callback);
  }, []);

  useEffect(() => registerDismiss(dismiss), [dismiss, registerDismiss]);

  return (
    <ContextualActionSheet
      ref={sheetRef}
      visible={visible}
      title={title}
      actions={actions}
      onCancel={onCancel}
      bottomInset={visible ? insets.bottom + Spacing.one : undefined}
    />
  );
}
