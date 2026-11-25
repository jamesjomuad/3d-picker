/**
 * LottoMatik draw-results configuration
 * Both endpoint URLs live here so clients never hardcode hosts.
 */

/** PCSO-hosted latest results endpoint (returns every lottery type). */
export const LATEST_RESULTS_URL =
  'https://lottomatik.pcso.gov.ph/api/backend/api/v1/draw-results/latest';

/** LottoMatik history endpoint (cursor-paginated). */
export const HISTORY_RESULTS_URL =
  'https://lottomatik.pcso.gov.ph/api/backend/api/v1/lottery-results/history';

/** Lottery ids this app renders. Everything else from `latest` is filtered out. */
export const SUPPORTED_LOTTERIES = ['3DL'];

/** Records requested per history page. Matches the provider's own site (30). */
export const HISTORY_PAGE_SIZE = 30;
