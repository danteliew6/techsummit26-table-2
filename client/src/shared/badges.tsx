/**
 * Small pill-style badges reused across the Operations page + home activity
 * feed. If you add a new status or tier, update both the type union in
 * shared/types.ts and the colour map here.
 */
import type { ReturnStatus, RiskBand, ActionType, RmActionStatus } from './types';

/** Compact USD, e.g. $1.1M / $420K. */
export function usd(n: number | null | undefined, compact = true): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(v);
}

const RISK_LABEL: Record<RiskBand, string> = {
  critical: 'Critical',
  elevated: 'Elevated',
  watch: 'Watch',
  healthy: 'Healthy',
};

export function RiskBandBadge({ band }: { band: RiskBand }) {
  const styles: Record<RiskBand, string> = {
    critical: 'bg-[var(--destructive)] text-[var(--destructive-foreground)]',
    elevated: 'bg-[var(--warning-subtle)] text-[var(--warning-subtle-foreground)]',
    watch: 'bg-muted text-foreground',
    healthy: 'bg-[var(--success-subtle)] text-[var(--success-subtle-foreground)]',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[band]}`}
    >
      {RISK_LABEL[band]}
    </span>
  );
}

const ACTION_LABEL: Record<ActionType, string> = {
  retention_offer: 'Retention offer',
  cross_sell: 'Cross-sell',
  rm_outreach: 'RM outreach',
};

export function ActionTypeBadge({ action }: { action: ActionType }) {
  const styles: Record<ActionType, string> = {
    retention_offer: 'bg-primary/15 text-primary',
    cross_sell: 'bg-[var(--info-subtle)] text-[var(--info-subtle-foreground)]',
    rm_outreach: 'bg-muted text-foreground',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[action]}`}
    >
      {ACTION_LABEL[action]}
    </span>
  );
}

export function ActionStatusBadge({ status }: { status: RmActionStatus }) {
  const styles: Record<RmActionStatus, string> = {
    proposed: 'bg-muted text-muted-foreground',
    approved: 'bg-[var(--success-subtle)] text-[var(--success-subtle-foreground)]',
    executed: 'bg-[var(--success-subtle)] text-[var(--success-subtle-foreground)]',
    overridden: 'bg-[var(--warning-subtle)] text-[var(--warning-subtle-foreground)]',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function StatusBadge({ status }: { status: ReturnStatus }) {
  const styles: Record<ReturnStatus, string> = {
    pending: 'bg-muted text-foreground',
    approved: 'bg-[var(--success-subtle)] text-[var(--success-subtle-foreground)]',
    rejected: 'bg-muted text-muted-foreground',
    escalated: 'bg-[var(--warning-subtle)] text-[var(--warning-subtle-foreground)]',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    gold: 'bg-[var(--tier-gold)] text-[var(--tier-gold-foreground)]',
    silver: 'bg-[var(--tier-silver)] text-[var(--tier-silver-foreground)]',
    bronze: 'bg-[var(--tier-bronze)] text-[var(--tier-bronze-foreground)]',
    platinum: 'bg-[var(--tier-platinum)] text-[var(--tier-platinum-foreground)]',
  };
  const cls = styles[tier.toLowerCase()] ?? 'bg-muted text-muted-foreground';
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${cls}`}
    >
      {tier}
    </span>
  );
}
