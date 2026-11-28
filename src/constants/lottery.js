/**
 * PCSO Lotto API v2 configuration.
 * Endpoint URLs live here so clients never hardcode hosts.
 */

/** Production v2 API root. */
export const LOTTO_API_BASE_URL = 'https://pcsolotto.org/api/v2';

/** Active 3D Lotto game catalogue. */
export const GAMES_URL = `${LOTTO_API_BASE_URL}/games`;

/** Latest-results snapshot (all games). */
export const LATEST_RESULTS_URL = `${LOTTO_API_BASE_URL}/results`;

/** Cursor-paginated historical draws. */
export const HISTORY_RESULTS_URL = `${LOTTO_API_BASE_URL}/draws`;

/** Lottery id kept in the app's normalized model. */
export const SUPPORTED_LOTTERIES = ['3DL'];

/** Family and number count used to discover 3D Lotto codes from `/games`. */
export const THREE_D_GAME_FAMILY = '3d';
export const THREE_D_NUMBER_COUNT = 3;

/** Maximum page size accepted by `/draws`. */
export const HISTORY_PAGE_SIZE = 200;
