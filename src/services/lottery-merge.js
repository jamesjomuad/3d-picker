/**
 * Merge and conflict detection for draw records
 *
 * The API record `id` is the unique key. A record seen by both endpoints is
 * stored once, with both sources recorded. When two sources disagree on the
 * winning combination the first-seen combination stays on screen and the
 * disagreement is flagged — nothing is overwritten silently.
 */

import { sortRecordsNewestFirst } from '@/services/lottery-normalize';

function sameResult(a, b) {
  return a.length === b.length && a.every((digit, index) => digit === b[index]);
}

function snapshotOf(record) {
  return {
    sources: [...record.sources],
    result: [...record.result],
    jackpot: record.jackpot,
    collectedAt: record.collectedAt ?? null,
    fetchedAt: record.fetchedAt ?? null,
  };
}

function snapshotKey(snapshot) {
  return JSON.stringify(snapshot);
}

function mergePair(existing, incoming) {
  const sources = [...new Set([...existing.sources, ...incoming.sources])];

  if (sameResult(existing.result, incoming.result)) {
    // Same draw, same digits: union the sources, keep the richer metadata.
    return {
      ...existing,
      sources,
      lastVerifiedAt: existing.lastVerifiedAt ?? incoming.lastVerifiedAt,
      lastSuccessfulCaptureAt:
        existing.lastSuccessfulCaptureAt ?? incoming.lastSuccessfulCaptureAt,
      collectedAt: existing.collectedAt ?? incoming.collectedAt,
      jackpot: existing.jackpot ?? incoming.jackpot,
      currency: existing.currency ?? incoming.currency,
      totalWinners: existing.totalWinners ?? incoming.totalWinners,
      winnersStatus: existing.winnersStatus ?? incoming.winnersStatus,
      provisional: existing.provisional ?? incoming.provisional,
      gameCode: existing.gameCode ?? incoming.gameCode,
      gameName: existing.gameName ?? incoming.gameName,
      slot: existing.slot ?? incoming.slot,
      sourceId: existing.sourceId ?? incoming.sourceId,
      serverTime: existing.serverTime ?? incoming.serverTime,
      drawId: existing.drawId ?? incoming.drawId,
      timezone: existing.timezone ?? incoming.timezone,
    };
  }

  // Conflict: keep the stored combination, keep both snapshots for review.
  const snapshots = [...existing.conflictSnapshots];
  for (const snapshot of [snapshotOf(existing), snapshotOf(incoming)]) {
    if (!snapshots.some((item) => snapshotKey(item) === snapshotKey(snapshot))) {
      snapshots.push(snapshot);
    }
  }

  return { ...existing, sources, conflict: true, conflictSnapshots: snapshots };
}

/**
 * Merge incoming records into the existing collection by id.
 *
 * @param {import('@/services/lottery-normalize').DrawRecord[]} existing
 * @param {import('@/services/lottery-normalize').DrawRecord[]} incoming
 * @returns {{ records: ..., conflicts: number, added: number }}
 */
export function mergeRecords(existing, incoming) {
  const byId = new Map(existing.map((record) => [record.id, record]));
  let conflicts = 0;
  let added = 0;

  for (const record of incoming) {
    const previous = byId.get(record.id);
    if (!previous) {
      byId.set(record.id, record);
      added += 1;
      continue;
    }

    const merged = mergePair(previous, record);
    if (merged.conflict && !previous.conflict) conflicts += 1;
    byId.set(record.id, merged);
  }

  return {
    records: sortRecordsNewestFirst([...byId.values()]),
    conflicts,
    added,
  };
}
