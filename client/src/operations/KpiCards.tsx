/**
 * Three KPI cards for the Book of Business: balance at risk, revenue at
 * risk, and the at-risk customer count. When the agent writes an action and
 * fires `dataMutated`, the metrics refetch and any card whose number moved
 * pulses a primary ring (usePulseOnChange).
 */
import { Users, TrendingDown, DollarSign } from 'lucide-react';
import { usePulseOnChange } from '@/lib/usePulseOnChange';
import { usd } from '@/shared/badges';
import type { RiskMetrics } from '@/shared/types';

export function KpiCards({ metrics }: { metrics: RiskMetrics | null }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      <Card
        label="Balance at risk"
        value={usd(metrics?.totalBalanceAtRiskUsd)}
        icon={<DollarSign className="size-4" />}
        tone="danger"
        pulseKey={metrics?.totalBalanceAtRiskUsd ?? 0}
      />
      <Card
        label="Revenue at risk"
        value={usd(metrics?.totalRevenueAtRiskUsd)}
        icon={<TrendingDown className="size-4" />}
        tone="danger"
        pulseKey={metrics?.totalRevenueAtRiskUsd ?? 0}
      />
      <Card
        label="At-risk customers"
        value={(metrics?.criticalCustomerCount ?? 0).toLocaleString()}
        icon={<Users className="size-4" />}
        tone="neutral"
        pulseKey={metrics?.criticalCustomerCount ?? 0}
      />
    </div>
  );
}

function Card({
  label,
  value,
  icon,
  tone,
  pulseKey,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: 'neutral' | 'success' | 'danger';
  pulseKey: number;
}) {
  const pulse = usePulseOnChange(pulseKey);
  const toneClass =
    tone === 'success'
      ? 'text-[var(--success-subtle-foreground)]'
      : tone === 'danger'
        ? 'text-destructive'
        : 'text-foreground';
  return (
    <div
      className={`rounded-xl border border-border bg-card p-3 sm:p-5 transition-shadow ${
        pulse ? 'animate-pulse-ring' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.12em] sm:tracking-[0.15em] text-muted-foreground">
        <span className={toneClass}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 sm:mt-2 display text-2xl sm:text-3xl font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}
