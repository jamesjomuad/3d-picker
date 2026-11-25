/**
 * Backup file helpers
 *
 * Thin wrappers around Expo's document picker, filesystem and share sheet.
 * Backups never leave the device automatically: export writes a JSON file to
 * the app's documents directory and opens the native share sheet; import only
 * reads a file the user chooses.
 */

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Builds a stable, sortable file name from the current time.
 * @param {Date} date
 * @returns {string}
 */
function backupFileName(date) {
  const pad = (value) => String(value).padStart(2, '0');
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join('');

  return `3d-picker-backup-${stamp}.json`;
}

/**
 * Writes backup JSON and opens the native share sheet for it.
 * @param {string} json
 * @returns {Promise<string>} Created file name
 */
export async function shareBackupFile(json) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  const file = new File(Paths.document, backupFileName(new Date()));
  file.create({ overwrite: true });
  await file.write(json);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Share 3D Picker backup',
  });

  return file.name;
}

/**
 * Reads text from a user-selected backup file.
 * @returns {Promise<string|null>} File text, or null when the user cancels
 */
export async function pickBackupText() {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) return null;

  const file = new File(result.assets[0].uri);
  return file.text();
}
