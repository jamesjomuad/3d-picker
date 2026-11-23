import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * Edge spacing for a full-screen scroll container.
 *
 * Android draws edge to edge and gives no way out of it (Expo's edge-to-edge
 * plugin notes the flag "is no longer available — Android 16 makes edge-to-edge
 * mandatory"), so every screen has to move its own content out from under the
 * status bar, the navigation bar and any display cutout.
 *
 * `ScrollView`'s `contentInset` prop looks like the tool for this but is not:
 * it maps to `UIScrollView.contentInset` and has no Android implementation —
 * `ReactScrollView.kt` declares no `contentInset` setter, so the value is
 * dropped on that platform and content stays under the status bar. Padding on
 * the content container is the one mechanism that behaves the same on both
 * platforms, so this hook owns it and screens stay identical to each other.
 *
 * Top and sides are applied here because nothing else does. On Android the tabs
 * container wraps each screen in a `SafeAreaView` with `edges: { bottom: true }`
 * (`expo-router/build/native-tabs/NativeTabsView.android.js`), and its own types
 * say the bottom inset is applied automatically while "other insets must be
 * handled manually".
 *
 * The `expo-native-ui` skill recommends `contentInsetAdjustmentBehavior="automatic"`
 * on ScrollView instead. It is not used here: that prop is a UIScrollView feature
 * with no Android counterpart, so it would fix iOS only, and iOS needs no fix —
 * expo-router 58 injects it nowhere in its own sources but the sitemap screen
 * (`views/Sitemap.js`). Padding from this hook is what makes Android correct while
 * keeping every screen identical.
 *
 * The bottom padding below is kept exactly as these screens had it. It adds
 * `insets.bottom` on top of the tab bar reserve even though the tabs wrapper
 * already applies the system bottom inset on Android, so it is likely generous by
 * one inset. It only affects how much blank space trails the last item, which
 * cannot be judged without a device, so it is left alone rather than silently
 * changed alongside the header bug.
 *
 * @returns {{ contentPadding: object, contentWidth: number }} padding to append
 * last to a screen's `contentContainerStyle`, and the width its inner column may use.
 */
export function useScreenInsets() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // A cutout on one side costs usable width on both sides of a centred column.
  const sideInset = Math.max(insets.left, insets.right);

  return {
    contentPadding: {
      // Spacing.three is the design-token gap below the status bar, not a
      // substitute for insets.top — it is what was left when contentInset failed.
      paddingTop: insets.top + Spacing.three,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom + BottomTabInset + Spacing.three,
    },
    contentWidth: Math.min(
      width - sideInset * 2 - Spacing.three * 2,
      MaxContentWidth
    ),
  };
}
