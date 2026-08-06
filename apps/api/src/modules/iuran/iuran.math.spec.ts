import { computeListrikAdjustment } from './iuran.math';

describe('computeListrikAdjustment', () => {
  const members = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('credits the buyer and surcharges shared cost to the others', () => {
    const result = computeListrikAdjustment({
      records: [{ anggotaId: 'a', nominal: 100_000 }],
      members,
    });

    // share = floor(100000 / 4) = 25000
    expect(result.baseDelta).toBe(100_000);
    expect(result.buyerMap.get('a')).toBe(100_000 - 25_000);
    expect(result.nonBuyerMap.get('b')).toBe(25_000);
    expect(result.nonBuyerMap.get('c')).toBe(25_000);
    expect(result.nonBuyerMap.get('d')).toBe(25_000);
  });

  it('handles multiple records and multiple buyers', () => {
    const result = computeListrikAdjustment({
      records: [
        { anggotaId: 'a', nominal: 80_000 },
        { anggotaId: 'b', nominal: 40_000 },
      ],
      members: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
    });

    expect(result.baseDelta).toBe(120_000);
    // a: 80000 - floor(80000/4) = 60000; b: 40000 - floor(40000/4) = 30000
    expect(result.buyerMap.get('a')).toBe(60_000);
    expect(result.buyerMap.get('b')).toBe(30_000);
    // non-buyers (c, d) get floor(80000/4) + floor(40000/4) = 30000 each
    expect(result.nonBuyerMap.get('c')).toBe(30_000);
    expect(result.nonBuyerMap.get('d')).toBe(30_000);
  });

  it('accumulates total but stores no credit when there are no members', () => {
    const result = computeListrikAdjustment({
      records: [{ anggotaId: 'a', nominal: 50_000 }],
      members: [],
    });
    expect(result.baseDelta).toBe(50_000);
    expect(result.buyerMap.size).toBe(0);
    expect(result.nonBuyerMap.size).toBe(0);
  });
});
