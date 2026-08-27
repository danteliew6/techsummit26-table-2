import express from 'express';
import type { Application } from 'express';
import type { AppDb } from '../db/index.js';
import { getCurrentUserEmail } from '../lib/user.js';
import {
  listAtRiskCustomers,
  getCustomerPosition,
  getOpenAtrisk,
  getNbaRecommendation,
  getRiskMetrics,
  listRmActions,
  createRmAction,
  updateRmActionStatus,
  searchProducts,
  getProduct,
} from '../db/queries/index.js';
import type { ActionType, RmActionStatus } from '../../client/src/shared/types.js';
import { generateDraft } from '../lib/draft.js';

/**
 * REST endpoints for the Meridian Relationship Desk UI:
 *   - Book of Business queue + risk KPIs
 *   - Customer 360 bundle (position + open at-risk + NBA + action history)
 *   - Act / approve: write an rm_action, or decide an existing one
 *
 * Reads the governed app.* views; writes only app.rm_actions.
 */
export function registerRelationshipRoutes(
  app: Application,
  deps: { db: AppDb },
): void {
  const { db } = deps;

  // Book of Business: ranked/flagged at-risk customers.
  app.get('/api/relationships/at-risk', async (req, res) => {
    const raw = Number(req.query.limit);
    const limit =
      Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), 500) : 200;
    const rows = await listAtRiskCustomers(db, limit);
    res.json(rows);
  });

  // KPI strip: balance-at-risk $, revenue-at-risk $, at-risk count.
  app.get('/api/relationships/metrics', async (_req, res) => {
    res.json(await getRiskMetrics(db));
  });

  // Customer 360 bundle for the drawer.
  app.get('/api/relationships/customers/:id', async (req, res) => {
    const id = String(req.params.id);
    const [position, openAtriskRow, nba, actions] = await Promise.all([
      getCustomerPosition(db, id),
      getOpenAtrisk(db, id),
      getNbaRecommendation(db, id),
      listRmActions(db, id),
    ]);
    if (!position && !openAtriskRow) {
      res.status(404).json({ error: `Customer ${id} not found` });
      return;
    }
    res.json({ customerId: id, position, openAtrisk: openAtriskRow, nba, actions });
  });

  app.get('/api/relationships/customers/:id/actions', async (req, res) => {
    res.json(await listRmActions(db, String(req.params.id)));
  });

  // Act: record an approved next-best-action (the closed loop's write).
  app.post(
    '/api/relationships/customers/:id/actions',
    express.json(),
    async (req, res) => {
      try {
        const customerId = String(req.params.id);
        const by = getCurrentUserEmail(req);
        const body = req.body as {
          actionType?: ActionType;
          offeredProductId?: string | null;
          rateApy?: number | null;
          draftedNote?: string | null;
          predictedRetainedUsd?: number | null;
        };
        if (!body.actionType) {
          res.status(400).json({ error: 'actionType is required' });
          return;
        }
        const row = await createRmAction(db, {
          customerId,
          actionType: body.actionType,
          offeredProductId: body.offeredProductId ?? null,
          rateApy: body.rateApy ?? null,
          draftedNote: body.draftedNote ?? null,
          predictedRetainedUsd: body.predictedRetainedUsd ?? null,
          approvedBy: by,
          status: 'approved',
        });
        res.json(row);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    },
  );

  // Decide an existing action (approve / execute / override).
  app.post(
    '/api/relationships/actions/:actionId/decide',
    express.json(),
    async (req, res) => {
      try {
        const actionId = String(req.params.actionId);
        const by = getCurrentUserEmail(req);
        const body = req.body as { status?: RmActionStatus; notes?: string };
        const status = body.status ?? 'approved';
        await updateRmActionStatus(db, actionId, status, {
          at: new Date().toISOString(),
          by,
          action: status,
          notes: body.notes,
        });
        res.json({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    },
  );

  // Feature A: Generate AI draft outreach note
  app.post(
    '/api/relationships/customers/:id/draft',
    express.json(),
    async (req, res) => {
      try {
        const customerId = String(req.params.id);
        const body = req.body as {
          actionType?: ActionType;
          offeredProductId?: string | null;
          rateApy?: number | null;
        };
        if (!body.actionType) {
          res.status(400).json({ error: 'actionType is required' });
          return;
        }
        // Load the customer context
        const [position, openAtrisk] = await Promise.all([
          getCustomerPosition(db, customerId),
          getOpenAtrisk(db, customerId),
        ]);
        if (!position && !openAtrisk) {
          res.status(404).json({ error: `Customer ${customerId} not found` });
          return;
        }
        // Get Databricks host and model from execution context
        const { client } = await import('@databricks/appkit').then((m) =>
          m.getExecutionContext(),
        );
        const databricksHost = (
          (client.config as { host?: string }).host ??
          process.env.DATABRICKS_HOST ??
          ''
        ).replace(/\/$/, '');
        const model =
          process.env.AGENT_MODEL ||
          process.env.MODEL ??
          'table_2.exercise.meridian_app_llm';
        if (!databricksHost) {
          res.status(500).json({ error: 'DATABRICKS_HOST not configured' });
          return;
        }
        // Generate draft
        const draft = await generateDraft(req, {
          actionType: body.actionType,
          offeredProductId: body.offeredProductId,
          rateApy: body.rateApy,
          position,
          openAtrisk,
        }, { databricksHost, model });
        res.json({ draft });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[draft] error:', message);
        res.status(500).json({ error: message });
      }
    },
  );

  // Feature B: Product search
  app.get('/api/relationships/products/search', async (req, res) => {
    try {
      const q = String(req.query.q ?? '');
      const limit = Math.min(Math.floor(Number(req.query.limit ?? 8)), 50);
      const rows = await searchProducts(db, q, limit);
      res.json(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Feature B: Product details
  app.get('/api/relationships/products/:id', async (req, res) => {
    try {
      const productId = String(req.params.id);
      const product = await getProduct(db, productId);
      if (!product) {
        res.status(404).json({ error: `Product ${productId} not found` });
        return;
      }
      res.json(product);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });
}
