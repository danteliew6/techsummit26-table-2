import type { Application } from 'express';
import express from 'express';
import {
  createConversation,
  deleteConversation,
  getConversationWithMessages,
  getMessageById,
  getOrCreateDockConversation,
  insertFeedback,
  listConversations,
} from '../db/queries/index.js';
import { getCurrentUserEmail } from '../lib/user.js';
import { handleChatStream } from '../chat-stream/index.js';
import { postMlflowAssessment } from '../lib/mlflow.js';
import type { AppDb } from '../db/index.js';

/**
 * Everything chat-related: conversations CRUD, streaming turns, and
 * thumbs-up/down feedback (which posts to MLflow as an assessment).
 */

type Deps = {
  db: AppDb;
  appConfig: {
    /** MAS endpoint name — `ask_data` uses MAS only if this is set. */
    masEndpointName: string;
    /** Genie space id — `ask_data` uses this Genie space (Meridian demo). */
    genieSpaceId: string;
    agentModel?: string;
  };
};

export function registerChatRoutes(app: Application, deps: Deps): void {
  const { db, appConfig } = deps;

  // --- Conversations CRUD -------------------------------------------------
  app.get('/api/conversations', async (req, res) => {
    try {
      const userEmail = getCurrentUserEmail(req);
      const rows = await listConversations(db, userEmail);
      res.json(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // GET /api/dock-conversation — resolve or create the floating-dock
  // conversation for the current user. Idempotent; survives reload.
  app.get('/api/dock-conversation', async (req, res) => {
    try {
      const userEmail = getCurrentUserEmail(req);
      const convo = await getOrCreateDockConversation(db, userEmail);
      res.json(convo);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/conversations', express.json(), async (req, res) => {
    try {
      const userEmail = getCurrentUserEmail(req);
      const title = (req.body?.title as string) ?? 'New conversation';
      const convo = await createConversation(db, userEmail, title);
      res.json(convo);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/conversations/:id', async (req, res) => {
    try {
      const userEmail = getCurrentUserEmail(req);
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'invalid id' });
        return;
      }
      const result = await getConversationWithMessages(db, userEmail, id);
      if (!result) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/conversations/:id', async (req, res) => {
    try {
      const userEmail = getCurrentUserEmail(req);
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'invalid id' });
        return;
      }
      const ok = await deleteConversation(db, userEmail, id);
      if (!ok) {
        res.status(404).json({ error: 'not found' });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // --- Streaming chat turn ------------------------------------------------
  app.post('/api/chat/stream', express.json(), async (req, res) => {
    try {
      await handleChatStream({
        req,
        res,
        db,
        config: appConfig,
      });
    } catch (error) {
      if (!res.writableEnded) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    }
  });

  // --- Thumbs-up / thumbs-down → MLflow assessment + local audit ---------
  app.post('/api/messages/:id/feedback', express.json(), async (req, res) => {
    try {
      const userEmail = getCurrentUserEmail(req);
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'invalid id' });
        return;
      }
      const value = (req.body?.value as 'up' | 'down') ?? null;
      const rationale = (req.body?.rationale as string | undefined) ?? undefined;
      if (value !== 'up' && value !== 'down') {
        res.status(400).json({ error: 'value must be "up" or "down"' });
        return;
      }
      const msg = await getMessageById(db, id);
      if (!msg) {
        res.status(404).json({ error: 'message not found' });
        return;
      }
      let mlflowAssessmentId: string | null = null;
      const host = (process.env.DATABRICKS_HOST ?? '').replace(/\/$/, '');
      if (msg.traceId && host) {
        mlflowAssessmentId = await postMlflowAssessment({
          req,
          host,
          traceId: msg.traceId,
          userEmail,
          value,
          rationale,
        });
      }
      const row = await insertFeedback(db, {
        messageId: id,
        userEmail,
        value,
        rationale,
        traceId: msg.traceId,
        mlflowAssessmentId,
      });
      res.json({ ok: true, id: row.id, mlflowAssessmentId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });
}
