/**
 * Application configuration constants
 *
 * Values that describe the app as a product rather than its design system.
 * Kept in one place so release links are a single, honest edit.
 */

/**
 * GitHub Releases page for "Check for Update".
 *
 * Set to the project repository's releases page. "Check for Update" derives
 * the matching api.github.com latest-release endpoint from this URL (see
 * src/utils/update-check.js); keep it in the
 * `https://github.com/<owner>/<repo>/releases` shape.
 */
export const RELEASES_URL = 'https://github.com/jamesjomuad/3d-picker/releases';

/** Share text for "Share 3D Picker" (native share sheet). */
export const APP_SHARE_MESSAGE =
  '3D Picker — an angle board for exploring number combinations. Build your grid, generate every valid angle walk and collect your picks. Fully offline on Android. https://github.com/jamesjomuad/3d-picker';
