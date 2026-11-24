import { checkForUpdate, isNewerVersion, toReleasesApiUrl } from '@/utils/update-check';

describe('toReleasesApiUrl', () => {
  it('derives the latest-release endpoint from a releases URL', () => {
    expect(toReleasesApiUrl('https://github.com/acme/3d-picker/releases')).toBe(
      'https://api.github.com/repos/acme/3d-picker/releases/latest'
    );
  });

  it('refuses anything that is not a GitHub releases URL', () => {
    expect(toReleasesApiUrl(null)).toBeNull();
    expect(toReleasesApiUrl('https://example.com/releases')).toBeNull();
    expect(toReleasesApiUrl('https://github.com/acme/3d-picker')).toBeNull();
  });
});

describe('isNewerVersion', () => {
  it('compares dot-separated numeric versions', () => {
    expect(isNewerVersion('1.2.0', '1.1.0')).toBe(true);
    expect(isNewerVersion('1.10.0', '1.9.9')).toBe(true);
    expect(isNewerVersion('1.1.0', '1.1.0')).toBe(false);
    expect(isNewerVersion('1.0.9', '1.1.0')).toBe(false);
    expect(isNewerVersion('2', '1.9.9')).toBe(true);
  });

  it('ignores a leading v and non-numeric tails', () => {
    expect(isNewerVersion('v1.2.0', '1.1.0')).toBe(true);
    expect(isNewerVersion('1.2.x', '1.1.0')).toBe(true);
  });
});

describe('checkForUpdate', () => {
  const releasesUrl = 'https://github.com/acme/3d-picker/releases';
  let fetchMock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('reports an update when the latest tag is newer', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v2.0.0' }),
    });

    await expect(checkForUpdate({ releasesUrl, currentVersion: '1.1.0' })).resolves.toEqual({
      status: 'update',
      latest: '2.0.0',
    });
  });

  it('reports current when installed is equal or newer', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ tag_name: '1.1.0' }) });

    await expect(checkForUpdate({ releasesUrl, currentVersion: '1.1.0' })).resolves.toEqual({
      status: 'current',
      latest: '1.1.0',
    });
  });

  it('degrades to error on a bad URL, HTTP failure, malformed body or network throw', async () => {
    await expect(checkForUpdate({ releasesUrl: null, currentVersion: '1.0.0' })).resolves.toEqual({
      status: 'error',
    });

    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(checkForUpdate({ releasesUrl, currentVersion: '1.0.0' })).resolves.toEqual({
      status: 'error',
    });

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(checkForUpdate({ releasesUrl, currentVersion: '1.0.0' })).resolves.toEqual({
      status: 'error',
    });

    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(checkForUpdate({ releasesUrl, currentVersion: '1.0.0' })).resolves.toEqual({
      status: 'error',
    });
  });
});
