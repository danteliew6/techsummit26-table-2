/**
 * Customer 360 — "Next best action" tab: the guided Act / approve surface.
 *
 * A single legible decision arc for the relationship manager:
 *   1. SURFACE  — why act now (risk band, attrition, $ at risk, maturity)
 *   2. PRESCRIBE — the recommended action as the hero, with its predicted impact
 *   3. COMPARE  — the three model-ranked options, tradeoff visible, RM can re-pick
 *   4. DRAFT    — the outreach note, prefilled + editable
 *   5. ACT      — Approve & log (writes an rm_action) or Cancel; closed-loop
 *                 refresh via dataMutated so the queue + KPIs update.
 *
 * Colour is semantic only (tokens): risk → --destructive, retained/value →
 * --success, recommended accent → --primary, labels → --muted-foreground.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, TriangleAlert, Sparkles, RotateCcw, Search, Loader2, XCircle } from 'lucide-react';
import type { CustomerDetailBundle } from '@/lib/relationships';
import { createRelationshipAction, generateDraftOutreach, searchProductsCatalog } from '@/lib/relationships';
import { dataMutated } from '@/lib/events';
import { ActionTypeBadge, RiskBandBadge, ActionStatusBadge, usd } from '@/shared/badges';
import type { ActionType, ActionRankingEntry, ProductRow } from '@/shared/types';

const ACTION_LABEL: Record<ActionType, string> = {
  retention_offer: 'Retention offer',
  cross_sell: 'Cross-sell',
  rm_outreach: 'RM outreach',
};

/** Format APY as a percentage string (multiply by 100 and fix to 2 decimals). */
function formatAPY(apy: number | null | undefined): string {
  if (apy == null) return '';
  return `${(apy * 100).toFixed(2)}%`;
}

const ACTION_RATIONALE: Record<ActionType, string> = {
  retention_offer: 'Match the competing rate before maturity to keep the balance.',
  cross_sell: 'Deepen the relationship with a product they qualify for.',
  rm_outreach: 'A personal call to understand goals and pre-empt attrition.',
};

function draftNote(
  actionType: ActionType,
  bundle: CustomerDetailBundle,
  entry?: ActionRankingEntry,
): string {
  const rate = entry?.rateApy ?? bundle.nba?.recommendedRateApy;
  const product = entry?.offeredProductId ?? bundle.nba?.recommendedOfferProductId;
  switch (actionType) {
    case 'retention_offer':
      return `Reached out to offer a competitive renewal${rate ? ` at ${formatAPY(rate)} APY` : ''}${product ? ` on ${product}` : ''} ahead of maturity. Emphasized the long-standing relationship and that no action is needed to keep the balance at Meridian.`;
    case 'cross_sell':
      return `Introduced ${product ?? 'a product the customer qualifies for'} as a fit for their profile and goals. Framed as a value-add on top of the existing relationship.`;
    case 'rm_outreach':
      return `Scheduled a relationship-manager call to review the customer's goals and address any concerns before the upcoming maturity.`;
  }
}

/** A compact labelled statistic cell. */
function Stat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: ReactNode;
  tone?: 'risk' | 'value' | 'default';
  sub?: ReactNode;
}) {
  const color =
    tone === 'risk'
      ? 'text-destructive'
      : tone === 'value'
        ? 'text-success'
        : 'text-foreground';
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function NextBestActionTab({
  bundle,
  onMutated,
}: {
  bundle: CustomerDetailBundle;
  onMutated: () => void;
}) {
  const nba = bundle.nba;
  const pos = bundle.position;
  const open = bundle.openAtrisk;

  const ranking: ActionRankingEntry[] = useMemo(
    () => nba?.actionRanking ?? [],
    [nba],
  );
  const [selected, setSelected] = useState<ActionType>(
    nba?.recommendedAction ?? 'retention_offer',
  );
  const [draft, setDraft] = useState('');
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ActionType | null>(null);

  // Feature A: draft generation
  const [draftGenerating, setDraftGenerating] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  // Feature B: product search
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<ProductRow[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);
  const [productSearchError, setProductSearchError] = useState<string | null>(null);

  useEffect(() => {
    const rec = nba?.recommendedAction ?? 'retention_offer';
    setSelected(rec);
    setDone(null);
    setError(null);
    setDraft(draftNote(rec, bundle, ranking.find((r) => r.actionType === rec)));
    setComment('');
    setSent(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.customerId]);

  function pick(a: ActionType) {
    if (done) return;
    setSelected(a);
    setDraft(draftNote(a, bundle, ranking.find((r) => r.actionType === a)));
    setSent(false);
  }

  function resetDraft() {
    setDraft(draftNote(selected, bundle, ranking.find((r) => r.actionType === selected)));
    setSent(false);
  }

  async function generateDraft() {
    setDraftGenerating(true);
    setDraftError(null);
    try {
      const entry = ranking.find((r) => r.actionType === selected);
      const result = await generateDraftOutreach(bundle.customerId, {
        actionType: selected,
        offeredProductId: selectedProduct?.productId ?? entry?.offeredProductId ?? nba?.recommendedOfferProductId ?? null,
        rateApy: selectedProduct?.rateApy ?? (entry?.rateApy ?? nba?.recommendedRateApy ?? null),
      });
      setDraft(result.draft);
      setSent(false);
    } catch (e) {
      setDraftError((e as Error).message);
    } finally {
      setDraftGenerating(false);
    }
  }

  async function searchProducts() {
    setProductSearchLoading(true);
    setProductSearchError(null);
    try {
      const results = await searchProductsCatalog(productSearchQuery, 8);
      setProductSearchResults(results);
    } catch (e) {
      setProductSearchError((e as Error).message);
    } finally {
      setProductSearchLoading(false);
    }
  }

  function selectProduct(product: ProductRow) {
    setSelectedProduct(product);
    setProductSearchOpen(false);
  }

  async function approve() {
    setPending(true);
    setError(null);
    try {
      const entry = ranking.find((r) => r.actionType === selected);
      await createRelationshipAction(bundle.customerId, {
        actionType: selected,
        offeredProductId: selectedProduct?.productId ?? entry?.offeredProductId ?? nba?.recommendedOfferProductId ?? null,
        rateApy: selectedProduct?.rateApy ?? (entry?.rateApy ?? nba?.recommendedRateApy ?? null),
        draftedNote: comment || null,
        predictedRetainedUsd: entry?.predictedRetainedUsd ?? nba?.predictedRetainedUsd ?? null,
      });
      setDone(selected);
      dataMutated.emit();
      onMutated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  // Empty state — no model recommendation yet.
  if (!nba && ranking.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center max-w-md mx-auto">
        <Sparkles className="size-5 mx-auto text-muted-foreground" />
        <div className="mt-2 text-sm font-medium">No recommendation yet</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Once the model has scored this customer, the ranked next best actions
          appear here for you to review and approve.
        </div>
      </div>
    );
  }

  // The ranked options: prefer the model ranking; else synthesize the single
  // recommendation so the RM can still act.
  const options: ActionRankingEntry[] =
    ranking.length > 0
      ? ranking
      : nba
        ? [
            {
              actionType: nba.recommendedAction,
              predictedRetainedUsd: nba.predictedRetainedUsd,
              predictedNetValueUsd: nba.predictedNetValueUsd,
              offeredProductId: nba.recommendedOfferProductId ?? undefined,
              rateApy: nba.recommendedRateApy ?? undefined,
            },
          ]
        : [];

  const selectedEntry = options.find((o) => o.actionType === selected);
  const maturityDays = open?.daysToMaturity ?? pos?.minDaysToMaturity ?? null;
  const latestAction = bundle.actions?.[0] ?? null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 1 — SURFACE: why act now */}
      <section className="rounded-xl border border-border bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <TriangleAlert className="size-4 text-destructive" />
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Why act now
          </span>
          {pos && <RiskBandBadge band={pos.riskBand} />}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {pos && (
            <Stat
              label="Attrition risk"
              tone="risk"
              value={`${Math.round(pos.attritionRiskScore * 100)}%`}
            />
          )}
          {pos && (
            <Stat label="Revenue at risk" tone="risk" value={usd(pos.revenueAtRiskUsd)} sub="per year" />
          )}
          {pos && (
            <Stat label="Balance at risk" value={usd(pos.balanceAtRiskUsd)} />
          )}
          <Stat
            label="Maturity"
            value={maturityDays != null ? `${maturityDays}d` : '—'}
            sub={
              open?.currentRateApy != null
                ? `${formatAPY(open.currentRateApy)} APY${open.atriskProductId ? ` · ${open.atriskProductId}` : ''}`
                : open?.atriskProductId ?? undefined
            }
          />
        </div>
      </section>

      {/* 2 — PRESCRIBE: the recommended action, hero — reflects current selection */}
      {nba && (
        <section className="rounded-xl border border-primary/40 bg-primary/5 px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="size-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
              Recommended next best action
            </span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ActionTypeBadge action={selected} />
                {(selectedProduct?.productId || selectedEntry?.offeredProductId || nba.recommendedOfferProductId) && (
                  <span className="text-sm font-medium">
                    {selectedProduct?.productId || selectedEntry?.offeredProductId || nba.recommendedOfferProductId}
                    {(selectedProduct?.rateApy ?? selectedEntry?.rateApy ?? nba.recommendedRateApy) != null && ` · ${formatAPY(selectedProduct?.rateApy ?? selectedEntry?.rateApy ?? nba.recommendedRateApy)} APY`}
                  </span>
                )}
                {selected === nba.recommendedAction && (
                  <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                    Recommended
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground max-w-sm">
                {ACTION_RATIONALE[selected]}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums text-success">
                {usd(selectedEntry?.predictedRetainedUsd ?? nba.predictedRetainedUsd)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                predicted retained · net {usd(selectedEntry?.predictedNetValueUsd ?? nba.predictedNetValueUsd)}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3 — COMPARE: the ranked options */}
      <section className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Compare options{done ? '' : ' — pick one to log'}
        </div>
        {options.map((o) => {
          const active = o.actionType === selected;
          const recommended = o.actionType === nba?.recommendedAction;
          return (
            <button
              key={o.actionType}
              onClick={() => pick(o.actionType)}
              disabled={!!done}
              aria-pressed={active}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-colors disabled:cursor-default ${
                active
                  ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border hover:border-foreground/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ActionTypeBadge action={o.actionType} />
                  {recommended && (
                    <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold tabular-nums text-success">
                  {o.predictedRetainedUsd != null ? usd(o.predictedRetainedUsd) : '—'}
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {o.offeredProductId ? `${o.offeredProductId}` : ACTION_LABEL[o.actionType]}
                  {o.rateApy != null && ` · ${formatAPY(o.rateApy)} APY`}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {o.predictedNetValueUsd != null ? `net ${usd(o.predictedNetValueUsd)}` : ''}
                </span>
              </div>
            </button>
          );
        })}
      </section>

      {/* 4a — DRAFT OUTREACH */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="nba-draft"
            className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground"
          >
            Draft outreach
          </label>
          {!done && (
            <div className="flex items-center gap-2">
              <button
                onClick={generateDraft}
                disabled={draftGenerating}
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
              >
                {draftGenerating ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                Generate draft
              </button>
              <button
                onClick={resetDraft}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="size-3" /> Reset draft
              </button>
            </div>
          )}
        </div>
        {draftError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <TriangleAlert className="size-3.5 mt-0.5 shrink-0" />
            <span>Couldn't generate draft: {draftError}. Try again.</span>
          </div>
        )}

        {/* Find an alternative product (optional) — nested inside draft */}
        <div className="space-y-2 rounded-lg border border-border bg-background p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Find an alternative product (optional)
          </div>
          {selectedProduct ? (
            // Selected product — full detail card
            <div className="rounded-md bg-primary/5 border border-primary/30 p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{selectedProduct.productName}</div>
                  <div className="text-[11px] font-mono text-muted-foreground">{selectedProduct.productId}</div>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  aria-label="Clear selected product"
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <XCircle className="size-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
                {selectedProduct.productType && (
                  <span><span className="text-muted-foreground">Type </span>{selectedProduct.productType}</span>
                )}
                {selectedProduct.segment && (
                  <span><span className="text-muted-foreground">Segment </span>{selectedProduct.segment}</span>
                )}
                <span><span className="text-muted-foreground">Rate </span>{selectedProduct.rateApy != null ? `${(selectedProduct.rateApy * 100).toFixed(2)}% APY` : 'TBD'}</span>
                {selectedProduct.minBalanceUsd != null && (
                  <span><span className="text-muted-foreground">Min </span>{usd(selectedProduct.minBalanceUsd)}</span>
                )}
              </div>
              {selectedProduct.description && (
                <p className="text-xs text-muted-foreground">{selectedProduct.description}</p>
              )}
              <p className="text-[11px] text-primary">Attached to this action — the logged offer and the generated draft will reference it.</p>
            </div>
          ) : (
            // Search box
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search products (e.g., 'high yield savings')..."
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchProducts()}
                  className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-2 text-sm outline-none focus:border-primary/50"
                />
              </div>
              <button
                onClick={searchProducts}
                disabled={!productSearchQuery.trim() || productSearchLoading}
                className="px-3 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity inline-flex items-center gap-1"
              >
                {productSearchLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Search className="size-3" />
                )}
              </button>
            </div>
          )}

          {/* Search results */}
          {productSearchResults.length > 0 && !selectedProduct && (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {productSearchResults.map((p) => (
                <button
                  key={p.productId}
                  onClick={() => selectProduct(p)}
                  className="w-full text-left rounded-md border border-border p-2 hover:border-primary/50 hover:bg-primary/5 transition-colors text-xs space-y-0.5"
                >
                  <div className="font-medium">{p.productName}</div>
                  <div className="text-muted-foreground">
                    {p.productType && `${p.productType} · `}
                    {p.rateApy != null ? `${(p.rateApy * 100).toFixed(2)}% APY` : 'Rate TBD'}
                    {p.minBalanceUsd != null && ` · min ${usd(p.minBalanceUsd)}`}
                  </div>
                  {p.description && (
                    <div className="text-muted-foreground line-clamp-1">{p.description}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {productSearchError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
              <TriangleAlert className="size-3 mt-0.5 shrink-0" />
              <span>Search failed: {productSearchError}</span>
            </div>
          )}

          {productSearchResults.length === 0 && productSearchQuery && !productSearchLoading && !productSearchError && (
            <div className="text-xs text-muted-foreground text-center py-2">No products found</div>
          )}
        </div>

        <textarea
          id="nba-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!!done}
          rows={5}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 leading-relaxed disabled:opacity-70"
        />

        {/* Send to customer button */}
        {!done && (
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                if (draft) {
                  try {
                    await navigator.clipboard.writeText(draft);
                    setSent(true);
                    setTimeout(() => setSent(false), 3000);
                  } catch (e) {
                    console.error('Failed to copy to clipboard:', e);
                  }
                }
              }}
              disabled={!draft}
              className="inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 bg-primary text-primary-foreground hover:opacity-90"
            >
              {sent ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Sent ✓
                </>
              ) : (
                'Send to customer'
              )}
            </button>
            {sent && (
              <span className="text-xs text-success">Outreach copied to clipboard</span>
            )}
          </div>
        )}
      </section>

      {/* 4b — COMMENTS */}
      <section className="space-y-2">
        <label
          htmlFor="nba-comment"
          className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground"
        >
          Comments
        </label>
        <textarea
          id="nba-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={!!done}
          placeholder="Log what you did — e.g. 'Called customer, offered CD renewal at 3.85%, awaiting response.'"
          rows={4}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 leading-relaxed disabled:opacity-70"
        />
        <p className="text-[11px] text-muted-foreground">
          Your action log and notes for this customer — recorded on approval.
        </p>
      </section>

      {/* 5 — ACT */}
      <section className="space-y-3">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <TriangleAlert className="size-3.5 mt-0.5 shrink-0" />
            <span>Couldn't log the action: {error}. Try again.</span>
          </div>
        )}
        {done ? (
          <div className="rounded-xl border border-success/40 bg-success/5 px-5 py-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="size-5" />
              <span className="text-sm font-semibold">
                {ACTION_LABEL[done]} logged
              </span>
              <ActionStatusBadge status="approved" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Recorded to the customer's record. The Book of Business queue and
              the at-risk KPIs have been updated. See the Activity tab for the
              audit trail.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={approve}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 bg-success text-success-foreground hover:opacity-90"
            >
              <CheckCircle2 className="size-4" />
              {pending
                ? 'Logging…'
                : `Approve & log ${ACTION_LABEL[selected].toLowerCase()}`}
            </button>
            {selectedEntry?.predictedRetainedUsd != null && !pending && (
              <span className="text-xs text-muted-foreground">
                keeps ~{usd(selectedEntry.predictedRetainedUsd)} at risk
              </span>
            )}
          </div>
        )}
        {latestAction && !done && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Last logged:</span>
            <ActionTypeBadge action={latestAction.actionType} />
            <ActionStatusBadge status={latestAction.status} />
            {latestAction.approvedBy && <span>· by {latestAction.approvedBy}</span>}
          </div>
        )}
      </section>
    </div>
  );
}
