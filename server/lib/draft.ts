/**
 * AI-generated draft outreach message using the Gateway model.
 *
 * Calls the Databricks Responses API with the same model + auth wiring as
 * the agent, but as a simple non-streaming responses.create() call grounded
 * on the customer's de-identified profile summary, action type, and product/rate.
 */
import OpenAI from 'openai';
import type { Request } from 'express';
import { authHeaders } from './auth.js';
import type { CustomerPositionRow, OpenAtriskRow, ActionType } from '../../client/src/shared/types.js';

export interface DraftParams {
  actionType: ActionType;
  offeredProductId?: string | null;
  rateApy?: number | null;
  position: CustomerPositionRow | null;
  openAtrisk: OpenAtriskRow | null;
}

/**
 * Generate a concise (~150 word) relationship-manager outreach note.
 *
 * Grounded ONLY on:
 *   - profile_summary (de-identified customer context)
 *   - action type (retention_offer / cross_sell / rm_outreach)
 *   - product / rate / maturity facts (from openAtrisk)
 *
 * Does NOT pass raw PII (name, account numbers, internal IDs).
 *
 * Uses the same gateway model + auth wiring as the agent's main loop.
 */
export async function generateDraft(
  req: Request,
  params: DraftParams,
  config: { databricksHost: string; model: string },
): Promise<string> {
  const headers = await authHeaders(req);
  const bearer = headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  const apiKey = process.env.MODEL_KEY?.trim() || bearer;

  // Construct the grounding facts (non-PII).
  const maturityInfo =
    params.openAtrisk?.daysToMaturity != null
      ? ` The deposit matures in ${params.openAtrisk.daysToMaturity} days.`
      : '';
  const rateInfo =
    params.openAtrisk?.currentRateApy != null
      ? ` Current rate: ${(params.openAtrisk.currentRateApy * 100).toFixed(2)}% APY.`
      : '';
  const profileContext = params.position?.profileSummary || 'Customer profile: standard depositor.';

  const grounding = `
Customer Context: ${profileContext}
Action: ${params.actionType === 'retention_offer' ? 'Offer a competitive rate to retain balance before maturity.' : params.actionType === 'cross_sell' ? 'Cross-sell an investment or savings product.' : 'Schedule a relationship-manager call to understand goals and address concerns.'}
${params.offeredProductId ? `Product: ${params.offeredProductId}` : ''}
${params.rateApy != null ? `Rate: ${(params.rateApy * 100).toFixed(2)}% APY` : ''}
${rateInfo}${maturityInfo}
`.trim();

  const client = new OpenAI({
    apiKey,
    baseURL: `${config.databricksHost}/ai-gateway/mlflow/v1`,
    maxRetries: 2,
  });

  // Non-streaming single response call using the Responses API.
  const response = await (client.responses as any).create({
    model: config.model,
    max_output_tokens: 200,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: `You are a relationship-manager assistant at Meridian Bank. Draft a concise, warm, professional outreach message (~150 words) to a customer. The message should include the specific offer (rate, product, term) inline. Never mention internal models or risk scores—translate directly to customer benefit. No preamble; just the message.`,
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Draft an outreach message for this situation:\n\n${grounding}`,
          },
        ],
      },
    ],
  });

  // Try response.output_text first (older SDK versions)
  let text = response.output_text?.trim();

  // If empty, parse from response.output[] array (newer SDK versions / gateway format)
  if (!text) {
    text = (response.output ?? [])
      .flatMap((o: any) => (o.content ?? []))
      .filter((c: any) => c.type === 'output_text' || c.type === 'text')
      .map((c: any) => c.text)
      .join('')
      .trim();
  }

  if (!text) {
    throw new Error('Model returned empty response');
  }

  return text;
}
