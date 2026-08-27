/**
 * REST helpers for the Meridian Relationship Desk domain. Hits the
 * /api/relationships/* routes (server/routes/relationships.ts).
 *
 * TYPES live in shared/types.ts — change those there, not here.
 */
import { okOrThrow } from './api';
import type {
  ActionType,
  ActivityEvent,
  CustomerPositionRow,
  NbaRecommendationRow,
  OpenAtriskRow,
  RiskMetrics,
  RmActionRow,
  RmActionStatus,
  ProductRow,
} from '@/shared/types';

/** Unified activity feed (rm_actions) — powers the home page "Recent activity". */
export async function fetchActivity(limit = 20): Promise<ActivityEvent[]> {
  const res = await okOrThrow(
    await fetch(`/api/activity/recent?limit=${limit}`),
    '/api/activity/recent',
  );
  return res.json();
}

/** The Customer 360 bundle returned by GET /api/relationships/customers/:id. */
export type CustomerDetailBundle = {
  customerId: string;
  position: CustomerPositionRow | null;
  openAtrisk: OpenAtriskRow | null;
  nba: NbaRecommendationRow | null;
  actions: RmActionRow[];
};

export async function fetchAtRiskCustomers(
  limit = 200,
): Promise<CustomerPositionRow[]> {
  const res = await okOrThrow(
    await fetch(`/api/relationships/at-risk?limit=${limit}`),
    '/api/relationships/at-risk',
  );
  return res.json();
}

export async function fetchRiskMetrics(): Promise<RiskMetrics> {
  const res = await okOrThrow(
    await fetch('/api/relationships/metrics'),
    '/api/relationships/metrics',
  );
  return res.json();
}

export async function fetchCustomerDetail(
  id: string,
): Promise<CustomerDetailBundle> {
  const res = await okOrThrow(
    await fetch(`/api/relationships/customers/${encodeURIComponent(id)}`),
    `/api/relationships/customers/${id}`,
  );
  return res.json();
}

export async function createRelationshipAction(
  customerId: string,
  payload: {
    actionType: ActionType;
    offeredProductId?: string | null;
    rateApy?: number | null;
    draftedNote?: string | null;
    predictedRetainedUsd?: number | null;
  },
): Promise<RmActionRow> {
  const res = await okOrThrow(
    await fetch(
      `/api/relationships/customers/${encodeURIComponent(customerId)}/actions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    ),
    `/api/relationships/customers/${customerId}/actions`,
  );
  return res.json();
}

export async function decideRelationshipAction(
  actionId: string,
  status: RmActionStatus,
  notes?: string,
): Promise<void> {
  await okOrThrow(
    await fetch(
      `/api/relationships/actions/${encodeURIComponent(actionId)}/decide`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      },
    ),
    `/api/relationships/actions/${actionId}/decide`,
  );
}

// Feature A: Generate AI draft outreach
export async function generateDraftOutreach(
  customerId: string,
  payload: {
    actionType: ActionType;
    offeredProductId?: string | null;
    rateApy?: number | null;
  },
): Promise<{ draft: string }> {
  const res = await okOrThrow(
    await fetch(
      `/api/relationships/customers/${encodeURIComponent(customerId)}/draft`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    ),
    `/api/relationships/customers/${customerId}/draft`,
  );
  return res.json();
}

// Feature B: Search products
export async function searchProductsCatalog(
  query: string,
  limit = 8,
): Promise<ProductRow[]> {
  const res = await okOrThrow(
    await fetch(
      `/api/relationships/products/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    ),
    '/api/relationships/products/search',
  );
  return res.json();
}

// Feature B: Get product details
export async function getProductDetail(
  productId: string,
): Promise<ProductRow> {
  const res = await okOrThrow(
    await fetch(`/api/relationships/products/${encodeURIComponent(productId)}`),
    `/api/relationships/products/${productId}`,
  );
  return res.json();
}
