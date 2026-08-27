/**
 * Customer 360 — "Next best action" tab. Shows the model's ranked actions,
 * lets the RM pick one (recommended by default), edit the outreach note, and
 * approve — which writes an rm_action (the closed-loop Act step) and fires
 * dataMutated so the queue + KPIs refresh.
 */
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { CustomerDetailBundle } from '@/lib/relationships';
import { createRelationshipAction } from '@/lib/relationships';
import { dataMutated } from '@/lib/events';
import { ActionTypeBadge, usd } from '@/shared/badges';
import type { ActionType, ActionRankingEntry } from '@/shared/types';

const ACTION_LABEL: Record<ActionType, string> = {
  retention_offer: 'Retention offer',
  cross_sell: 'Cross-sell',
  rm_outreach: 'RM outreach',
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
      return `Reached out to offer a competitive renewal${rate ? ` at ${rate}% APY` : ''}${product ? ` on ${product}` : ''} ahead of maturity. Emphasized the long-standing relationship and that no action is needed to keep the balance at Meridian.`;
    case 'cross_sell':
      return `Introduced ${product ?? 'a product the customer qualifies for'} as a fit for their profile and goals. Framed as a value-add on top of the existing relationship.`;
    case 'rm_outreach':
      return `Scheduled a relationship-manager call to review the customer's goals and address any concerns before the upcoming maturity.`;
  }
}

export function NextBestActionTab({
  bundle,
  onMutated,
}: {
  bundle: CustomerDetailBundle;
  onMutated: () => void;
}) {
  const nba = bundle.nba;
  const ranking: ActionRankingEntry[] = useMemo(
    () => nba?.actionRanking ?? [],
    [nba],
  );
  const [selected, setSelected] = useState<ActionType>(
    nba?.recommendedAction ?? 'retention_offer',
  );
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const rec = nba?.recommendedAction ?? 'retention_offer';
    setSelected(rec);
    setDone(false);
    setError(null);
    setNote(draftNote(rec, bundle, ranking.find((r) => r.actionType === rec)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.customerId]);

  function pick(a: ActionType) {
    setSelected(a);
    setNote(draftNote(a, bundle, ranking.find((r) => r.actionType === a)));
  }

  async function approve() {
    setPending(true);
    setError(null);
    try {
      const entry = ranking.find((r) => r.actionType === selected);
      await createRelationshipAction(bundle.customerId, {
        actionType: selected,
        offeredProductId: entry?.offeredProductId ?? nba?.recommendedOfferProductId ?? null,
        rateApy: entry?.rateApy ?? nba?.recommendedRateApy ?? null,
        draftedNote: note || null,
        predictedRetainedUsd: entry?.predictedRetainedUsd ?? nba?.predictedRetainedUsd ?? null,
      });
      setDone(true);
      dataMutated.emit();
      onMutated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (!nba && ranking.length === 0) {
    return (
      <div className="text-sm text-muted-foreground max-w-md">
        No model recommendation for this customer yet. Once
        gold_nba_recommendations is populated, the ranked next best actions
        appear here.
      </div>
    );
  }

  // The ranked options: prefer the model ranking; else synthesize from the
  // single recommendation so the RM can still act.
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          Model-ranked actions
        </div>
        {options.map((o) => {
          const active = o.actionType === selected;
          const recommended = o.actionType === nba?.recommendedAction;
          return (
            <button
              key={o.actionType}
              onClick={() => pick(o.actionType)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                active ? 'border-foreground/40 bg-muted/50' : 'border-border hover:border-foreground/20'
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
                <div className="text-sm font-mono text-foreground">
                  {o.predictedRetainedUsd != null ? `${usd(o.predictedRetainedUsd)} retained` : '—'}
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground flex gap-3 flex-wrap">
                {o.offeredProductId && <span>Product {o.offeredProductId}</span>}
                {o.rateApy != null && <span>{o.rateApy}% APY</span>}
                {o.predictedNetValueUsd != null && (
                  <span>Net {usd(o.predictedNetValueUsd)}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Drafted outreach — {ACTION_LABEL[selected]}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={5}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 leading-relaxed"
        />
        {error && <div className="text-xs text-destructive">{error}</div>}
        {done ? (
          <div className="inline-flex items-center gap-1.5 text-sm text-[var(--success-subtle-foreground)]">
            <CheckCircle2 className="size-4" /> Action recorded — the queue and KPIs will refresh.
          </div>
        ) : (
          <button
            onClick={approve}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 bg-success text-success-foreground hover:opacity-90"
          >
            <CheckCircle2 className="size-4" />
            {pending ? 'Recording…' : 'Approve & record action'}
          </button>
        )}
      </div>
    </div>
  );
}
