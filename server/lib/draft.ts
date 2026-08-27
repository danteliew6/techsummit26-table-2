/**
 * AI-generated draft outreach message using the Gateway model.
 *
 * Calls the Databricks Responses API with the same model + auth wiring as
 * the agent, but as a simple non-streaming responses.create() call grounded
 * on the customer's de-identified profile summary, action type, and product/rate.
 */
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

  // Fold the instructions into a single user message — the AI Gateway Responses
  // endpoint is proven to work with one `user` message of `input_text` (a
  // `system` role inside `input` yields an empty response for this model).
  const prompt = `You are a relationship-manager assistant at Meridian Bank. Draft a concise, warm, professional outreach message (~150 words) to a customer. Include the specific offer (rate, product, term) inline. Never mention internal models or risk scores — translate directly to customer benefit. No preamble; output only the message.

Situation:
${grounding}`;

  // Direct call to the Databricks AI Gateway Responses endpoint (mirrors the
  // known-working request shape rather than the SDK's responses shim).
  const resp = await fetch(`${config.databricksHost}/ai-gateway/mlflow/v1/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      // High enough that the model's reasoning budget doesn't starve the message
      // text (this model reasons before answering; at 400 the message truncated
      // to empty → status "incomplete"). 1500 completes with margin (~550 used).
      max_output_tokens: 1500,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Gateway ${resp.status}: ${errBody.slice(0, 300)}`);
  }

  const data: any = await resp.json();
  // Prefer output_text; fall back to concatenating text from the output[] array.
  let text: string =
    (typeof data.output_text === 'string' ? data.output_text : '').trim();
  if (!text) {
    text = (data.output ?? [])
      .flatMap((o: any) => o?.content ?? [])
      .filter((c: any) => c?.type === 'output_text' || c?.type === 'text')
      .map((c: any) => c?.text ?? '')
      .join('')
      .trim();
  }

  if (!text) {
    throw new Error('Model returned empty response');
  }

  return text;
}
