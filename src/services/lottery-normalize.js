import {
  THREE_D_GAME_FAMILY,
  THREE_D_NUMBER_COUNT,
  SUPPORTED_LOTTERIES,
} from '@/constants/lottery';

/**
 * Normalizers for PCSO Lotto API v2 payloads.
 *
 * The UI keeps its existing normalized record model. Winning numbers stay as
 * single-digit strings, so leading zeros survive storage, search and sharing.
 * Draw dates and server times are copied verbatim; no UTC conversion is done.
 */

const DRAW_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SERVER_TIME_PATTERN = /T(\d{2}:\d{2}(?::\d{2})?)/;
const THREE_D_GAME_NAME = '3D Lotto';
const WINNERS_STATUSES = ['pending', 'final', 'unknown'];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  return value;
}

function optionalFiniteString(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return optionalString(value);
}

/** Accept one digit as a string or integer. Never coerce a multi-digit number. */
export function asDigitString(value) {
  if (typeof value === 'string' && /^[0-9]$/.test(value)) return value;
  if (Number.isInteger(value) && value >= 0 && value <= 9) return String(value);
  return null;
}

/** Read active 3D Lotto codes from the real `/games` response. */
export function discoverThreeDGameCodes(payload) {
  if (!isObject(payload)) return [];
  const items = Array.isArray(payload.items) ? payload.items : [];
  const codes = [];

  for (const item of items) {
    if (!isObject(item) || item.isActive === false) continue;

    const code = optionalString(item.code) ?? optionalString(item.gameCode);
    if (!code) continue;

    const family = optionalString(item.family);
    const name = optionalString(item.name) ?? optionalString(item.gameName);
    const isThreeD =
      family === THREE_D_GAME_FAMILY ||
      name === THREE_D_GAME_NAME ||
      code.startsWith(`${THREE_D_GAME_FAMILY}_lotto_`);
    if (!isThreeD) continue;

    if (
      item.numberCount !== undefined &&
      item.numberCount !== THREE_D_NUMBER_COUNT
    ) {
      continue;
    }
    if (!codes.includes(code)) codes.push(code);
  }

  return codes;
}

export function isThreeDGame(game) {
  if (!isObject(game)) return false;
  const code = optionalString(game.gameCode) ?? '';
  const name = optionalString(game.gameName) ?? '';
  return (
    code.startsWith(`${THREE_D_GAME_FAMILY}_lotto_`) || name === THREE_D_GAME_NAME
  );
}

function normalizeWinnersStatus(value) {
  return WINNERS_STATUSES.includes(value) ? value : null;
}

function provisionalFromStatus(status) {
  if (status === 'final') return false;
  if (status === 'pending' || status === 'unknown') return true;
  return null;
}

function drawTimeFromServerTime(serverTime) {
  if (!serverTime) return '';
  const match = SERVER_TIME_PATTERN.exec(serverTime);
  return match ? match[1] : '';
}

function stableId(gameCode, sourceId, drawDate, drawTime, digits) {
  const gameSourceId = optionalFiniteString(sourceId);
  if (gameSourceId) return `v2-${gameSourceId}`;

  const parts = [gameCode, drawDate, drawTime, digits.join('')].filter(Boolean);
  return `v2-${parts.join('-')}`;
}

/**
 * Convert one v2 game entry into the app's normalized draw record.
 * Returns null when required data is missing or malformed.
 */
export function normalizeV2Game(draw, game, source, collectedAt, envelope = {}) {
  if (!isObject(draw) || !isObject(game) || !isThreeDGame(game)) return null;

  const gameCode = optionalString(game.gameCode);
  const numbers = Array.isArray(game.numbers) ? game.numbers : null;
  if (!gameCode || !numbers || numbers.length !== THREE_D_NUMBER_COUNT) {
    return null;
  }

  const digits = numbers.map(asDigitString);
  if (digits.some((digit) => digit === null)) return null;

  const drawDate =
    optionalString(game.drawDate) ?? optionalString(draw.drawDate) ?? '';
  if (!DRAW_DATE_PATTERN.test(drawDate)) return null;

  const serverTime =
    optionalString(game.serverTime) ?? optionalString(draw.serverTime) ?? '';
  const drawTime = drawTimeFromServerTime(serverTime);
  const winnersStatus = normalizeWinnersStatus(game.winnersStatus);
  const lastSuccessfulCaptureAt =
    optionalString(envelope.updatedAt) ??
    optionalString(envelope.transformedAt) ??
    null;

  return {
    id: stableId(gameCode, game.sourceId, drawDate, drawTime, digits),
    lottery: SUPPORTED_LOTTERIES[0],
    drawNumber: optionalString(game.slot) ?? gameCode,
    result: digits,
    drawDate,
    drawTime,
    jackpot: optionalFiniteString(game.prizeAmount),
    currency: optionalString(game.currency),
    totalWinners: optionalFiniteString(game.winnersCount),
    winnersStatus,
    provisional: provisionalFromStatus(winnersStatus),
    lastVerifiedAt: null,
    lastSuccessfulCaptureAt,
    collectedAt: new Date(collectedAt).toISOString(),
    sources: [source],
    conflict: false,
    conflictSnapshots: [],
    fetchedAt: new Date(collectedAt).toISOString(),
    gameCode,
    gameName: optionalString(game.gameName),
    slot: optionalString(game.slot),
    sourceId: optionalFiniteString(game.sourceId),
    serverTime: serverTime || null,
    drawId: optionalFiniteString(draw.id),
    timezone: optionalString(envelope.timezone),
  };
}

function flattenV2Draws(items, source, collectedAt, envelope) {
  const records = [];
  let dropped = 0;
  let total = 0;

  for (const draw of items) {
    if (!isObject(draw)) continue;
    const games = Array.isArray(draw.games) ? draw.games : [];
    for (const game of games) {
      if (!isThreeDGame(game)) continue;
      total += 1;
      const record = normalizeV2Game(draw, game, source, collectedAt, envelope);
      if (record) records.push(record);
      else dropped += 1;
    }
  }

  return { records: sortRecordsNewestFirst(records), dropped, total };
}

/** Normalize a `/results` envelope. */
export function normalizeV2LatestPayload(payload, source = 'latest', collectedAt = Date.now()) {
  const envelope = isObject(payload) ? payload : {};
  const draws = Array.isArray(envelope.draws) ? envelope.draws : [];
  const { records, dropped, total } = flattenV2Draws(
    draws,
    source,
    collectedAt,
    envelope
  );

  return {
    records,
    dropped,
    total,
    timezone: optionalString(envelope.timezone),
    updatedAt: optionalString(envelope.updatedAt),
    transformedAt: optionalString(envelope.transformedAt),
  };
}

/** Normalize a `/draws` envelope. */
export function normalizeV2HistoryPayload(payload, source = 'history', collectedAt = Date.now()) {
  const envelope = isObject(payload) ? payload : {};
  const items = Array.isArray(envelope.items) ? envelope.items : [];
  const { records, dropped, total } = flattenV2Draws(
    items,
    source,
    collectedAt,
    envelope
  );

  return {
    records,
    dropped,
    total,
    pageInfo: normalizePageInfo(envelope.pageInfo),
    timezone: optionalString(envelope.timezone),
    transformedAt: optionalString(envelope.transformedAt),
  };
}

/** Cursors are opaque strings; numeric cursors keep their exact text. */
export function normalizePageInfo(rawInfo) {
  if (!isObject(rawInfo)) return { nextCursor: null, hasNextPage: false };

  let nextCursor = null;
  const cursor = rawInfo.nextCursor;
  if (typeof cursor === 'string' && cursor.trim().length > 0) nextCursor = cursor;
  else if (typeof cursor === 'number' && Number.isFinite(cursor) && cursor >= 0) {
    nextCursor = String(cursor);
  }

  return {
    nextCursor,
    hasNextPage: rawInfo.hasNextPage === true && nextCursor !== null,
  };
}

export function sortRecordsNewestFirst(records) {
  return [...records].sort((a, b) =>
    `${b.drawDate} ${b.drawTime}`.localeCompare(`${a.drawDate} ${a.drawTime}`)
  );
}

export function formatCombination(result) {
  return Array.isArray(result) ? result.join('') : '';
}

export function getRecordStatus(record) {
  if (record?.conflict) return 'Conflicting';
  if (record?.provisional) return 'Provisional';
  if (record?.lastVerifiedAt) return 'Verified';
  return 'Pending verification';
}
