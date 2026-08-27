/**
 * Customer 360 — Activity tab. The audit timeline of RM actions recorded
 * for this customer (app.rm_actions + each action's append-only audit trail),
 * newest first. This is the examiner-facing trail.
 */
import type { RmActionRow } from '@/shared/types';
import { ActionTypeBadge, ActionStatusBadge, usd } from '@/shared/badges';

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatAPY(apy: number | null | undefined): string {
  if (apy == null) return '';
  return `${(apy * 100).toFixed(2)}%`;
}

export function ActivityTab({ actions }: { actions: RmActionRow[] }) {
  if (!actions || actions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground max-w-md">
        No actions recorded for this customer yet. Once you approve a next best
        action (or the assistant executes one), it appears here with its full
        audit trail.
      </div>
    );
  }
  return (
    <ol className="space-y-3 max-w-3xl">
      {actions.map((a) => (
        <li key={a.id} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-3 border-b border-border">
            <ActionTypeBadge action={a.actionType} />
            <ActionStatusBadge status={a.status} />
            <div className="ml-auto text-xs text-muted-foreground">{fmt(a.createdAt)}</div>
          </div>
          <div className="px-4 py-3 space-y-2 text-sm">
            <div className="flex gap-3 flex-wrap text-xs text-muted-foreground">
              {a.offeredProductId && <span>Product {a.offeredProductId}</span>}
              {a.rateApy != null && <span>{formatAPY(a.rateApy)} APY</span>}
              {a.predictedRetainedUsd != null && (
                <span>{usd(a.predictedRetainedUsd)} predicted retained</span>
              )}
              {a.approvedBy && <span>by {a.approvedBy}</span>}
            </div>
            {a.draftedNote && (
              <p className="leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {a.draftedNote}
              </p>
            )}
            {a.auditTrail.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-border pt-2">
                {a.auditTrail.map((e, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{e.action}</span>
                    {' · '}
                    {e.by}
                    {' · '}
                    {fmt(e.at)}
                    {e.notes ? ` · ${e.notes}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
