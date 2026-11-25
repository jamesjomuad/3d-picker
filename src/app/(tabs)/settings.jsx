import { useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, Share, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import { ComingSoonCard } from '@/components/settings/coming-soon-card';
import { OptionSheet } from '@/components/settings/option-sheet';
import { SettingsRow } from '@/components/settings/settings-row';
import { SettingsSection } from '@/components/settings/settings-section';
import { ThemedText } from '@/components/themed-text';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { APP_SHARE_MESSAGE, RELEASES_URL } from '@/constants/app-config';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useScreenInsets } from '@/hooks/use-screen-insets';
import { useTheme } from '@/hooks/use-theme';
import { createBackup, parseBackup, restoreBackup, serializeBackup } from '@/services/backup';
import { pickBackupText, shareBackupFile } from '@/services/backup-file';
import { checkForUpdate } from '@/utils/update-check';
import { useBasketStore } from '@/store/basketStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Settings screen
 *
 * Organised as grouped panels — Appearance, Notifications, Data & Storage,
 * Share & Updates, About — built from the shared settings components.
 * Every row here does something real: theme mode drives the app-wide colour
 * scheme and persists, backups use local files, and info rows open in-app
 * pages. Notifications remains an honest Coming Soon card. Destructive
 * actions confirm first.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const { contentPadding, contentWidth } = useScreenInsets();

  const loadSettings = useSettingsStore((state) => state.load);
  const themeMode = useSettingsStore((state) => state.themeMode);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // One sheet slot at a time: currently just 'theme'.
  const [sheet, setSheet] = useState(null);
  const [clearDialog, setClearDialog] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const [pendingBackup, setPendingBackup] = useState(null);

  const themeLabel =
    THEME_OPTIONS.find((option) => option.value === themeMode)?.label ?? 'System';

  const version = Constants.expoConfig?.version;
  const build = Constants.expoConfig?.android?.versionCode;
  const appName = Constants.expoConfig?.name ?? '3D Picker';

  const handleShare = async () => {
    try {
      await Share.share({ message: APP_SHARE_MESSAGE, title: appName });
    } catch (error) {
      console.warn('Sharing failed:', error);
    }
  };

  /** Writes the current boards and saved picks to a file and opens Share. */
  const handleExportBackup = async () => {
    setExportingBackup(true);
    try {
      const backup = await createBackup();
      await shareBackupFile(serializeBackup(backup));
      Alert.alert(
        'Backup ready',
        'Your boards and saved picks are in a JSON file. Save or share it from the sheet.'
      );
    } catch (error) {
      console.warn('Backup export failed:', error);
      Alert.alert(
        'Could not export backup',
        error?.message ?? 'Something went wrong. Try again.'
      );
    } finally {
      setExportingBackup(false);
    }
  };

  /** Reads a user-selected file and asks before replacing local data. */
  const handleImportBackup = async () => {
    setImportingBackup(true);
    try {
      const text = await pickBackupText();
      if (!text) return;

      const result = parseBackup(text);
      if (!result.valid) {
        Alert.alert('Invalid backup', result.error);
        return;
      }

      setPendingBackup({
        backup: result.backup,
        boardCount: result.backup.data.library.boards.length,
        entryCount: result.backup.data.basket.entries.length,
      });
    } catch (error) {
      console.warn('Backup import failed:', error);
      Alert.alert(
        'Could not read backup',
        error?.message ?? 'The selected file could not be opened. Try again.'
      );
    } finally {
      setImportingBackup(false);
    }
  };

  /** Replaces stored data, then updates in-memory stores used by other tabs. */
  const handleConfirmImport = async () => {
    const pending = pendingBackup;
    setPendingBackup(null);
    if (!pending) return;

    setImportingBackup(true);
    try {
      await restoreBackup(pending.backup);

      const { library, basket } = pending.backup.data;
      useLibraryStore.setState({
        boards: library.boards,
        activeBoardId: library.activeBoardId,
        isLoaded: true,
      });
      useBasketStore.setState({ entries: basket.entries, isLoaded: true });

      Alert.alert(
        'Backup imported',
        `Restored ${library.boards.length} board${library.boards.length === 1 ? '' : 's'} and ${basket.entries.length} saved pick${basket.entries.length === 1 ? '' : 's'}.`
      );
    } catch (error) {
      console.warn('Backup restore failed:', error);
      Alert.alert(
        'Could not import backup',
        error?.message ?? 'Nothing was changed. Try again with another file.'
      );
    } finally {
      setImportingBackup(false);
    }
  };

  /**
   * Ask GitHub for the latest release and report honestly: an update offers
   * the release page, current says so, and anything else (no network, no
   * feed) is a failure to check — never a fake "up to date".
   */
  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const result = await checkForUpdate({
        releasesUrl: RELEASES_URL,
        currentVersion: version ?? '0.0.0',
      });
      if (result.status === 'update') {
        Alert.alert('Update available', `Version ${result.latest} is out.`, [
          { text: 'Later', style: 'cancel' },
          { text: 'View Release', onPress: () => Linking.openURL(RELEASES_URL) },
        ]);
      } else if (result.status === 'current') {
        Alert.alert('Up to date', `Version ${version} is the latest release.`);
      } else {
        Alert.alert(
          'Could not check for updates',
          'The release feed could not be reached. Check your connection and try again.'
        );
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  /**
   * Wipes every stored byte the app owns, then brings each domain back to
   * its factory state in memory: the library reseeds itself with the
   * default Angle Board (loadLibrary persists it), the basket empties, and
   * settings return to defaults without writing (storage was just cleared).
   */
  const handleClearData = async () => {
    setClearDialog(false);
    try {
      await AsyncStorage.clear();
      useLibraryStore.setState({ boards: [], activeBoardId: null, isLoaded: false });
      await useLibraryStore.getState().loadLibrary();
      useBasketStore.setState({ entries: [], isLoaded: false });
      useSettingsStore.getState().reset();
      Alert.alert('App data cleared', 'Boards, collection and settings are back to defaults.');
    } catch (error) {
      console.warn('Clearing app data failed:', error);
      Alert.alert('Could not clear data', 'Something went wrong. Try again.');
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={[styles.contentContainer, contentPadding]}>
        <View style={[styles.innerContainer, { width: contentWidth }]}>
          <ThemedText type="subtitle" style={styles.header}>
            Settings
          </ThemedText>

          <SettingsSection title="Appearance">
            <SettingsRow
              icon={{ ios: 'circle.lefthalf.filled', android: 'dark_mode', web: 'dark_mode' }}
              label="Theme"
              value={themeLabel}
              onPress={() => setSheet('theme')}
            />
          </SettingsSection>

          <SettingsSection
            title="Notifications"
            notes={
              <ComingSoonCard title="Notifications & Reminders">
                Enable notifications, choose reminder preferences and set a default reminder time
                for picking sessions. The app ships no notification infrastructure yet, so there
                is nothing honest to switch on here.
              </ComingSoonCard>
            }
          />

          <SettingsSection title="Data & Storage">
            <SettingsRow
              icon={{ ios: 'square.and.arrow.up', android: 'upload', web: 'upload' }}
              label="Export Backup"
              value={exportingBackup ? 'Exporting…' : undefined}
              onPress={exportingBackup || importingBackup ? undefined : handleExportBackup}
            />
            <SettingsRow
              icon={{ ios: 'square.and.arrow.down', android: 'download', web: 'download' }}
              label="Import Backup"
              value={importingBackup ? 'Importing…' : undefined}
              onPress={exportingBackup || importingBackup ? undefined : handleImportBackup}
            />
            <SettingsRow
              icon={{ ios: 'trash', android: 'delete', web: 'delete' }}
              label="Clear App Data"
              onPress={() => setClearDialog(true)}
              destructive
              accessibilityLabel="Clear all app data, requires confirmation"
            />
          </SettingsSection>

          <SettingsSection
            title="Share & Updates"
            notes={
              RELEASES_URL ? null : (
                <ComingSoonCard title="Check for Update">
                  This row will compare the installed version with the latest release on GitHub
                  and offer the download when a newer one exists. It appears once the repository
                  release URL is configured in src/constants/app-config.js — until then there is
                  no real release feed to check against.
                </ComingSoonCard>
              )
            }>
            <SettingsRow
              icon={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
              label="Share 3D Picker"
              onPress={handleShare}
            />
            {RELEASES_URL ? (
              <SettingsRow
                icon={{
                  ios: 'arrow.clockwise.circle',
                  android: 'refresh',
                  web: 'refresh',
                }}
                label="Check for Update"
                value={checkingUpdate ? 'Checking…' : undefined}
                onPress={checkingUpdate ? undefined : handleCheckUpdate}
              />
            ) : null}
          </SettingsSection>

          <SettingsSection title="About">
            <View style={styles.about}>
              <Image source={require('@/assets/images/icon.png')} style={styles.aboutLogo} />
              <ThemedText type="smallBold">{appName}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.aboutVersion}>
                Version {version ?? 'unknown'}
                {build ? ` (${build})` : ''}
              </ThemedText>
            </View>
            <SettingsRow
              icon={{ ios: 'doc.text', android: 'description', web: 'description' }}
              label="What's New & Changelog"
              onPress={() => router.push('/changelog')}
            />
            <SettingsRow
              icon={{ ios: 'hand.raised', android: 'privacy_tip', web: 'privacy_tip' }}
              label="Privacy Policy"
              onPress={() => router.push('/privacy-policy')}
            />
            <SettingsRow
              icon={{ ios: 'curlybraces', android: 'data_object', web: 'data_object' }}
              label="Open-Source Licenses"
              onPress={() => router.push('/licenses')}
            />
          </SettingsSection>
        </View>
      </ScrollView>

      <OptionSheet
        visible={sheet === 'theme'}
        title="Theme"
        options={THEME_OPTIONS}
        value={themeMode}
        onSelect={setThemeMode}
        onClose={() => setSheet(null)}
      />

      <ConfirmDialog
        visible={clearDialog}
        title="Clear App Data"
        message="This erases everything the app has saved on this device — all boards, your collection and your settings — and restores the defaults. It cannot be undone."
        confirmLabel="Clear Everything"
        confirmVariant="destructive"
        onConfirm={handleClearData}
        onCancel={() => setClearDialog(false)}
      />

      {pendingBackup ? (
        <ConfirmDialog
          visible
          title="Import Backup"
          message="This replaces the boards and saved picks currently on this device. It cannot be undone."
          confirmLabel="Import & Replace"
          confirmVariant="destructive"
          onConfirm={handleConfirmImport}
          onCancel={() => setPendingBackup(null)}>
          <ThemedText type="small">
            {pendingBackup.boardCount} board{pendingBackup.boardCount === 1 ? '' : 's'} ·{' '}
            {pendingBackup.entryCount} saved pick{pendingBackup.entryCount === 1 ? '' : 's'}
          </ThemedText>
        </ConfirmDialog>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    flexGrow: 1,
  },
  innerContainer: {
    flexShrink: 1,
    gap: Spacing.four,
  },
  header: {
    marginBottom: Spacing.half,
  },
  about: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.three,
  },
  aboutLogo: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
  },
  aboutVersion: {
    fontSize: Typography.size.body,
  },
});
