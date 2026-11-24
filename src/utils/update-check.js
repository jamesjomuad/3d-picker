/**
 * Update checking against the project's GitHub Releases page.
 *
 * The app has no backend, but a public repository's release feed is a plain
 * GET: the latest release's tag is compared with the installed version from
 * expo-constants. Everything degrades to an honest "error" result — the
 * Settings screen turns that into a retry message, never a fake "up to date".
 */

/**
 * Derive the GitHub API endpoint for the latest release from a releases URL
 * like https://github.com/<owner>/<repo>/releases. Returns null for anything
 * that is not such a URL, so a misconfiguration fails closed.
 * @param {string} releasesUrl
 * @returns {string|null}
 */
export function toReleasesApiUrl(releasesUrl) {
  const match = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/releases/.exec(releasesUrl ?? '');
  if (!match) return null;
  return `https://api.github.com/repos/${match[1]}/${match[2]}/releases/latest`;
}

/**
 * Whether `latest` is newer than `current` (dot-separated numeric versions;
 * an optional leading "v" is ignored, missing parts count as 0).
 * @param {string} latest
 * @param {string} current
 * @returns {boolean}
 */
export function isNewerVersion(latest, current) {
  const parse = (value) =>
    String(value)
      .replace(/^v/i, '')
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) return left > right;
  }
  return false;
}

/**
 * Fetch the latest release and classify it against the installed version.
 * @param {Object} options
 * @param {string} options.releasesUrl - GitHub releases page URL
 * @param {string} options.currentVersion - installed app version
 * @returns {Promise<{ status: 'update', latest: string } | { status: 'current', latest: string } | { status: 'error' }>}
 */
export async function checkForUpdate({ releasesUrl, currentVersion }) {
  const apiUrl = toReleasesApiUrl(releasesUrl);
  if (!apiUrl) return { status: 'error' };

  try {
    const response = await fetch(apiUrl, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) return { status: 'error' };

    const release = await response.json();
    const latest =
      typeof release?.tag_name === 'string' ? release.tag_name.replace(/^v/i, '') : '';
    if (!latest) return { status: 'error' };

    return isNewerVersion(latest, currentVersion)
      ? { status: 'update', latest }
      : { status: 'current', latest };
  } catch {
    return { status: 'error' };
  }
}
