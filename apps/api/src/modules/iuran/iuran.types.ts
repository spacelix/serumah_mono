export interface ListrikAdjustmentRecord {
  anggotaId: string;
  nominal: number;
}

export interface ListrikAdjustmentInput {
  records: ListrikAdjustmentRecord[];
  members: { id: string }[];
}

export interface ListrikAdjustmentResult {
  baseDelta: number;
  buyerMap: Map<string, number>;
  nonBuyerMap: Map<string, number>;
}
