/**
 * Types that cross the client/server boundary. Keep in sync with
 * server/db/queries/relationships.ts + server/db/queries/chat.ts.
 *
 * The app is small enough that hand-copying these is simpler than a
 * shared package. If this file grows past ~200 lines, consider a
 * proper shared lib.
 *
 * ─────────────────────────────────────────────────────────────────────
 * MERIDIAN BANK — Relationship Desk
 * ─────────────────────────────────────────────────────────────────────
 * This is the canonical schema for the *domain* — every page, fetch
 * helper, badge, and SQL projection uses what's defined here.
 *
 * Key types:
 *   - CustomerPositionRow: at-risk customer from synced `app.customer_position`
 *   - RiskBand: 'critical' | 'elevated' | 'watch' | 'healthy'
 *   - ActionType: 'retention_offer' | 'cross_sell' | 'rm_outreach'
 *   - RmActionRow: written action record from `app.rm_actions`
 *
 * Keep aligned with:
 *   1. server/db/schema.ts (Drizzle tables)
 *   2. server/db/queries/relationships.ts (SQL queries)
 *   3. client/src/lib/relationships.ts (fetch helpers)
 *   4. shared/badges.tsx (color mappings for risk bands + action types)
 * ───────────────────────────────────────────────────────────────────── */

export type ActionType = 'retention_offer' | 'cross_sell' | 'rm_outreach';
export type RiskBand = 'critical' | 'elevated' | 'watch' | 'healthy';
export type RmActionStatus = 'proposed' | 'approved' | 'executed' | 'overridden';
export type Tier = 'mass' | 'mass_affluent' | 'affluent' | 'private';

export type CustomerPositionRow = {
  customerId: string;
  tier: Tier;
  tenureYears: number | null;
  homeMetro: string | null;
  customerLat: number | null;
  customerLng: number | null;
  profileSummary: string | null;
  attritionRiskScore: number;
  balanceOutflow30dUsd: number | null;
  churnSignalScore: number | null;
  totalBalanceUsd: number | null;
  depositBalanceUsd: number | null;
  affectedDepositBalanceUsd: number | null;
  minDaysToMaturity: number | null;
  productCount: number | null;
  balanceAtRiskUsd: number;
  revenueAtRiskUsd: number;
  riskBand: RiskBand;
};

export type OpenAtriskRow = {
  customerId: string;
  attritionRiskScore: number;
  balanceAtRiskUsd: number;
  revenueAtRiskUsd: number;
  atriskProductId: string | null;
  atriskBalanceUsd: number | null;
  daysToMaturity: number | null;
  currentRateApy: number | null;
  candidateCrossSellProductId: string | null;
};

export type NbaRecommendationRow = {
  customerId: string;
  recommendedAction: ActionType;
  recommendedOfferProductId: string | null;
  recommendedRateApy: number | null;
  predictedRetainedUsd: number;
  predictedNetValueUsd: number;
  actionRanking: ActionRankingEntry[];
  scoredAt: string | null;
};

export type ActionRankingEntry = {
  actionType: ActionType;
  predictedRetainedUsd?: number;
  predictedNetValueUsd?: number;
  costUsd?: number;
  offeredProductId?: string;
  rateApy?: number;
};

export type RmActionRow = {
  id: string;
  customerId: string;
  actionType: ActionType;
  offeredProductId: string | null;
  rateApy: number | null;
  draftedNote: string | null;
  predictedRetainedUsd: number | null;
  status: RmActionStatus;
  approvedBy: string | null;
  auditTrail: RmAuditEntry[];
  createdAt: string;
  decidedAt: string | null;
};

export type RmAuditEntry = {
  at: string;
  by: string;
  action: string;
  notes?: string;
};

export type ProductRow = {
  productId: string;
  productName: string;
  productType: string | null;
  segment: string | null;
  rateApy: number | null;
  minBalanceUsd: number | null;
  description: string | null;
  isActive: boolean | null;
};

export type CustomerDetail = {
  customerId: string;
  tier: Tier;
  tenureYears: number | null;
  homeMetro: string | null;
  attritionRiskScore: number;
  balanceOutflow30dUsd: number | null;
  totalBalanceUsd: number | null;
  depositBalanceUsd: number | null;
  affectedDepositBalanceUsd: number | null;
  minDaysToMaturity: number | null;
  riskBand: RiskBand;
  balanceAtRiskUsd: number;
  revenueAtRiskUsd: number;
  profileSummary: string | null;
  recommendedAction?: ActionType;
  predictedRetainedUsd?: number;
  actionRanking?: ActionRankingEntry[];
};

export type RiskMetrics = {
  totalBalanceAtRiskUsd: number;
  totalRevenueAtRiskUsd: number;
  criticalCustomerCount: number;
};

export type MetroBucket = {
  homeMetro: string;
  customerId: string;
  attritionRiskScore: number;
  balanceAtRiskUsd: number;
  lat: number;
  lng: number;
  riskBand: RiskBand;
};

export type AtRiskMetroRow = {
  metro: string | null;
  lat: number | null;
  lng: number | null;
  customers: number;
  critical: number;
  revenue_at_risk_usd: number;
  balance_at_risk_usd: number;
  actioned_count: number;
};

export type ActivityEvent =
  | {
      kind: 'rm_action';
      actionId: string;
      at: string;
      by: string;
      customerId: string;
      actionType: ActionType;
      predictedRetainedUsd: number | null;
      status: RmActionStatus;
    };
