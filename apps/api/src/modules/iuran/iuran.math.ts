import type { ListrikAdjustmentInput } from './iuran.types';

/**
 * Pure math for the next-month electricity adjustment (see features/listrik).
 *
 * Extra electricity bought in `month` shifts every member's `listrik_wajib`
 * the following month:
 *   - buyer:    credit `nominal − share`
 *   - non-buyer: surcharge `share`
 *   - share     = floor(nominal / n) per record
 *   - clamped ≥ 0, total preserved.
 */
export function computeListrikAdjustment(input: ListrikAdjustmentInput): {
  baseDelta: number;
  buyerMap: Map<string, number>;
  nonBuyerMap: Map<string, number>;
} {
  const n = input.members.length;
  const buyerMap = new Map<string, number>();
  const nonBuyerMap = new Map<string, number>();
  let baseDelta = 0;

  const buyerSet = new Set<string>();
  for (const rec of input.records) {
    baseDelta += rec.nominal;
    buyerSet.add(rec.anggotaId);
    if (n === 0) continue;
    const share = Math.floor(rec.nominal / n);
    buyerMap.set(
      rec.anggotaId,
      (buyerMap.get(rec.anggotaId) ?? 0) + (rec.nominal - share),
    );
  }

  for (const member of input.members) {
    if (buyerSet.has(member.id)) continue;
    let shareSum = 0;
    for (const rec of input.records) {
      shareSum += Math.floor(rec.nominal / n);
    }
    if (shareSum > 0) nonBuyerMap.set(member.id, shareSum);
  }

  return { baseDelta, buyerMap, nonBuyerMap };
}
