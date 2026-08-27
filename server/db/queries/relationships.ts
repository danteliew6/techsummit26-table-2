import { desc, eq, inArray, or, ilike, sql } from 'drizzle-orm';
import type { AppDb } from '../index.js';
import {
  customerPosition,
  openAtrisk,
  nbaRecommendations,
  products,
  rmActions,
} from '../schema.js';
import type {
  CustomerPositionRow,
  OpenAtriskRow,
  NbaRecommendationRow,
  ProductRow,
  RmActionRow,
  RmAuditEntry,
  RmActionStatus,
  ActionType,
  ActivityEvent,
  RiskMetrics,
  Tier,
  RiskBand,
} from '../../../client/src/shared/types.js';

/**
 * Queries for the Meridian Bank Relationship Desk app.
 *
 * These read the governed Lakebase objects the customer provisioned:
 *   - app.customer_position   (view over synced gold_customer_position)
 *   - app.open_atrisk         (view over synced gold_open_atrisk)
 *   - app.nba_recommendations (view over synced gold_nba_recommendations)
 *   - app.products            (view over meridian.products)
 *   - app.rm_actions          (writable — the app's only write surface)
 *
 * The synced/view tables are READ-ONLY; only rm_actions is written.
 */

const RISK_BANDS_AT_RISK: RiskBand[] = ['critical', 'elevated', 'watch'];

// Drizzle returns Date for timestamptz columns; the client types want ISO
// strings. Normalize once here so every mapper stays consistent.
function iso(d: Date | string | null): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : d;
}

type CustomerPositionSelect = typeof customerPosition.$inferSelect;
type OpenAtriskSelect = typeof openAtrisk.$inferSelect;
type NbaSelect = typeof nbaRecommendations.$inferSelect;
type ProductSelect = typeof products.$inferSelect;
type RmActionSelect = typeof rmActions.$inferSelect;

function toCustomerPosition(r: CustomerPositionSelect): CustomerPositionRow {
  return {
    customerId: r.customerId,
    tier: r.tier as Tier,
    tenureYears: r.tenureYears,
    homeMetro: r.homeMetro,
    customerLat: r.customerLat,
    customerLng: r.customerLng,
    profileSummary: r.profileSummary,
    attritionRiskScore: r.attritionRiskScore ?? 0,
    balanceOutflow30dUsd: r.balanceOutflow30dUsd,
    churnSignalScore: r.churnSignalScore,
    totalBalanceUsd: r.totalBalanceUsd,
    depositBalanceUsd: r.depositBalanceUsd,
    affectedDepositBalanceUsd: r.affectedDepositBalanceUsd,
    minDaysToMaturity: r.minDaysToMaturity,
    productCount: r.productCount,
    balanceAtRiskUsd: r.balanceAtRiskUsd ?? 0,
    revenueAtRiskUsd: r.revenueAtRiskUsd ?? 0,
    riskBand: r.riskBand as RiskBand,
  };
}

function toOpenAtrisk(r: OpenAtriskSelect): OpenAtriskRow {
  return {
    customerId: r.customerId,
    attritionRiskScore: r.attritionRiskScore ?? 0,
    balanceAtRiskUsd: r.balanceAtRiskUsd ?? 0,
    revenueAtRiskUsd: r.revenueAtRiskUsd ?? 0,
    atriskProductId: r.atriskProductId,
    atriskBalanceUsd: r.atriskBalanceUsd,
    daysToMaturity: r.daysToMaturity,
    currentRateApy: r.currentRateApy,
    candidateCrossSellProductId: r.candidateCrossSellProductId,
  };
}

function toNba(r: NbaSelect): NbaRecommendationRow {
  return {
    customerId: r.customerId,
    recommendedAction: r.recommendedAction as ActionType,
    recommendedOfferProductId: r.recommendedOfferProductId,
    recommendedRateApy: r.recommendedRateApy,
    predictedRetainedUsd: r.predictedRetainedUsd ?? 0,
    predictedNetValueUsd: r.predictedNetValueUsd ?? 0,
    actionRanking: r.actionRanking ?? [],
    scoredAt: iso(r.scoredAt),
  };
}

function toProduct(r: ProductSelect): ProductRow {
  return {
    productId: r.productId,
    productName: r.productName,
    productType: r.productType,
    segment: r.segment,
    rateApy: r.rateApy,
    minBalanceUsd: r.minBalanceUsd,
    description: r.description,
    isActive: r.isActive,
  };
}

function toRmAction(r: RmActionSelect): RmActionRow {
  return {
    id: r.id,
    customerId: r.customerId,
    actionType: r.actionType as ActionType,
    offeredProductId: r.offeredProductId,
    rateApy: r.rateApy,
    draftedNote: r.draftedNote,
    predictedRetainedUsd: r.predictedRetainedUsd,
    status: r.status as RmActionStatus,
    approvedBy: r.approvedBy,
    auditTrail: r.auditTrail ?? [],
    createdAt: iso(r.createdAt) ?? new Date().toISOString(),
    decidedAt: iso(r.decidedAt),
  };
}

// ─── Reads ──────────────────────────────────────────────────────────────

/** Book-of-business queue: at-risk customers, worst revenue-at-risk first. */
export async function listAtRiskCustomers(
  db: AppDb,
  limit = 500,
): Promise<CustomerPositionRow[]> {
  // Order by band severity first (critical→elevated→watch) THEN revenue within
  // band, so every at-risk band is represented — a plain revenue DESC + small
  // limit would fill entirely with 'critical' and hide elevated/watch.
  const rows = await db
    .select()
    .from(customerPosition)
    .where(inArray(customerPosition.riskBand, RISK_BANDS_AT_RISK))
    .orderBy(
      sql`CASE ${customerPosition.riskBand} WHEN 'critical' THEN 0 WHEN 'elevated' THEN 1 WHEN 'watch' THEN 2 ELSE 3 END`,
      desc(customerPosition.revenueAtRiskUsd),
    )
    .limit(limit);
  return rows.map(toCustomerPosition);
}

export async function getCustomerPosition(
  db: AppDb,
  customerId: string,
): Promise<CustomerPositionRow | null> {
  const rows = await db
    .select()
    .from(customerPosition)
    .where(eq(customerPosition.customerId, customerId))
    .limit(1);
  return rows[0] ? toCustomerPosition(rows[0]) : null;
}

export async function getOpenAtrisk(
  db: AppDb,
  customerId: string,
): Promise<OpenAtriskRow | null> {
  const rows = await db
    .select()
    .from(openAtrisk)
    .where(eq(openAtrisk.customerId, customerId))
    .limit(1);
  return rows[0] ? toOpenAtrisk(rows[0]) : null;
}

/** The worst open at-risk customer by attrition score (agent's null case). */
export async function getWorstOpenAtrisk(
  db: AppDb,
): Promise<OpenAtriskRow | null> {
  const rows = await db
    .select()
    .from(openAtrisk)
    .orderBy(desc(openAtrisk.revenueAtRiskUsd))
    .limit(1);
  return rows[0] ? toOpenAtrisk(rows[0]) : null;
}

export async function getNbaRecommendation(
  db: AppDb,
  customerId: string,
): Promise<NbaRecommendationRow | null> {
  const rows = await db
    .select()
    .from(nbaRecommendations)
    .where(eq(nbaRecommendations.customerId, customerId))
    .limit(1);
  return rows[0] ? toNba(rows[0]) : null;
}

/**
 * Product search powering the cross-sell option.
 *
 * TODO(lakebase-search): the customer provisioned hybrid search indexes on
 * `meridian.products` — `idx_products_desc_bm25` (lakebase_bm25 over
 * description) and `idx_products_embedding_ann` (lakebase_ann over
 * description_embedding). The production path is a hybrid bm25+ann query
 * through those indexes. We use a portable ILIKE over product_name +
 * description here so the tool works on any branch without depending on the
 * search-extension SQL surface; swap in the bm25/ann query for ranked
 * semantic retrieval.
 */
export async function searchProducts(
  db: AppDb,
  query: string,
  limit = 8,
): Promise<ProductRow[]> {
  const q = query.trim();
  if (!q) {
    const rows = await db.select().from(products).limit(limit);
    return rows.map(toProduct);
  }
  const like = `%${q}%`;
  const rows = await db
    .select()
    .from(products)
    .where(
      or(ilike(products.productName, like), ilike(products.description, like)),
    )
    .limit(limit);
  return rows.map(toProduct);
}

export async function getRiskMetrics(db: AppDb): Promise<RiskMetrics> {
  const rows = await db
    .select({
      totalBalanceAtRiskUsd: sql<number>`coalesce(sum(${customerPosition.balanceAtRiskUsd}), 0)`,
      totalRevenueAtRiskUsd: sql<number>`coalesce(sum(${customerPosition.revenueAtRiskUsd}), 0)`,
      criticalCustomerCount: sql<number>`count(*)`,
    })
    .from(customerPosition)
    .where(inArray(customerPosition.riskBand, RISK_BANDS_AT_RISK));
  const r = rows[0];
  return {
    totalBalanceAtRiskUsd: Number(r?.totalBalanceAtRiskUsd ?? 0),
    totalRevenueAtRiskUsd: Number(r?.totalRevenueAtRiskUsd ?? 0),
    criticalCustomerCount: Number(r?.criticalCustomerCount ?? 0),
  };
}

// ─── RM actions (the writable surface) ────────────────────────────────────

export async function createRmAction(
  db: AppDb,
  action: {
    customerId: string;
    actionType: ActionType;
    offeredProductId?: string | null;
    rateApy?: number | null;
    draftedNote?: string | null;
    predictedRetainedUsd?: number | null;
    approvedBy?: string | null;
    status?: RmActionStatus;
  },
): Promise<RmActionRow> {
  const now = new Date();
  const by = action.approvedBy ?? 'system';
  const status: RmActionStatus = action.status ?? 'approved';
  const audit: RmAuditEntry[] = [
    {
      at: now.toISOString(),
      by,
      action: status,
      notes: action.draftedNote ?? undefined,
    },
  ];
  const rows = await db
    .insert(rmActions)
    .values({
      customerId: action.customerId,
      actionType: action.actionType,
      offeredProductId: action.offeredProductId ?? null,
      rateApy: action.rateApy ?? null,
      draftedNote: action.draftedNote ?? null,
      predictedRetainedUsd: action.predictedRetainedUsd ?? null,
      status,
      approvedBy: action.approvedBy ?? null,
      auditTrail: audit,
      decidedAt: status === 'approved' || status === 'executed' ? now : null,
    })
    .returning();
  return toRmAction(rows[0]);
}

export async function getRmAction(
  db: AppDb,
  actionId: string,
): Promise<RmActionRow | null> {
  const rows = await db
    .select()
    .from(rmActions)
    .where(eq(rmActions.id, actionId))
    .limit(1);
  return rows[0] ? toRmAction(rows[0]) : null;
}

export async function listRmActions(
  db: AppDb,
  customerId: string,
): Promise<RmActionRow[]> {
  const rows = await db
    .select()
    .from(rmActions)
    .where(eq(rmActions.customerId, customerId))
    .orderBy(desc(rmActions.createdAt));
  return rows.map(toRmAction);
}

export async function updateRmActionStatus(
  db: AppDb,
  actionId: string,
  status: RmActionStatus,
  auditEntry: RmAuditEntry,
): Promise<void> {
  await db
    .update(rmActions)
    .set({
      status,
      approvedBy: auditEntry.by,
      decidedAt: new Date(),
      // Append to the JSONB audit trail without a read-modify-write race.
      auditTrail: sql`${rmActions.auditTrail} || ${JSON.stringify([auditEntry])}::jsonb`,
    })
    .where(eq(rmActions.id, actionId));
}

/** Recent RM actions → the home/activity feed. */
export async function recentActivity(
  db: AppDb,
  limit: number,
): Promise<ActivityEvent[]> {
  const rows = await db
    .select()
    .from(rmActions)
    .orderBy(desc(rmActions.createdAt))
    .limit(limit);
  return rows.map((r): ActivityEvent => {
    const a = toRmAction(r);
    return {
      kind: 'rm_action',
      actionId: a.id,
      at: a.decidedAt ?? a.createdAt,
      by: a.approvedBy ?? 'system',
      customerId: a.customerId,
      actionType: a.actionType,
      predictedRetainedUsd: a.predictedRetainedUsd,
      status: a.status,
    };
  });
}
