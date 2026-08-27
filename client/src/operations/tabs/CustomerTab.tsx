/**
 * Customer 360 — Overview + Why-flagged tabs of the drawer.
 * Reads the position + open-at-risk from the customer detail bundle.
 */
import type { CustomerDetailBundle } from '@/lib/relationships';
import { RiskBandBadge, TierBadge, usd } from '@/shared/badges';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:grid sm:grid-cols-3">
      <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground pt-0.5">
        {label}
      </dt>
      <dd className="sm:col-span-2">{value}</dd>
    </div>
  );
}

export function OverviewTab({ bundle }: { bundle: CustomerDetailBundle }) {
  const p = bundle.position;
  if (!p) {
    return <div className="text-sm text-muted-foreground">No position on file.</div>;
  }
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-1 gap-x-4 gap-y-3 sm:gap-y-4 text-sm max-w-2xl">
      <Row label="Tier" value={<TierBadge tier={p.tier} />} />
      <Row label="Risk band" value={<RiskBandBadge band={p.riskBand} />} />
      <Row label="Tenure" value={p.tenureYears != null ? `${p.tenureYears} yrs` : '—'} />
      <Row label="Home metro" value={p.homeMetro ?? '—'} />
      <Row label="Total balance" value={usd(p.totalBalanceUsd, false)} />
      <Row label="Deposit balance" value={usd(p.depositBalanceUsd, false)} />
      <Row label="Balance at risk" value={usd(p.balanceAtRiskUsd, false)} />
      <Row label="Revenue at risk" value={usd(p.revenueAtRiskUsd, false)} />
      <Row label="Products held" value={p.productCount ?? '—'} />
      <Row
        label="Nearest maturity"
        value={p.minDaysToMaturity != null ? `${p.minDaysToMaturity} days` : '—'}
      />
    </dl>
  );
}

export function WhyFlaggedTab({ bundle }: { bundle: CustomerDetailBundle }) {
  const p = bundle.position;
  const oar = bundle.openAtrisk;
  const score = Math.round((p?.attritionRiskScore ?? oar?.attritionRiskScore ?? 0) * 100);
  return (
    <div className="space-y-6 max-w-2xl text-sm">
      <div>
        <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2">
          Attrition risk
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 max-w-[240px] rounded-full bg-muted overflow-hidden">
            <div
              className={score >= 70 ? 'h-full bg-destructive' : score >= 40 ? 'h-full bg-warning' : 'h-full bg-muted-foreground/50'}
              style={{ width: `${Math.min(100, score)}%` }}
            />
          </div>
          <span className="font-mono tabular-nums">{score}%</span>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-1 gap-x-4 gap-y-3 sm:gap-y-4">
        <Row
          label="30-day outflow"
          value={p?.balanceOutflow30dUsd != null ? usd(p.balanceOutflow30dUsd, false) : '—'}
        />
        <Row
          label="Churn signal"
          value={p?.churnSignalScore != null ? `${Math.round(p.churnSignalScore * 100)}%` : '—'}
        />
        <Row label="At-risk product" value={oar?.atriskProductId ?? '—'} />
        <Row
          label="At-risk balance"
          value={oar?.atriskBalanceUsd != null ? usd(oar.atriskBalanceUsd, false) : '—'}
        />
        <Row
          label="Days to maturity"
          value={oar?.daysToMaturity != null ? `${oar.daysToMaturity} days` : '—'}
        />
        <Row
          label="Current rate"
          value={oar?.currentRateApy != null ? `${oar.currentRateApy}% APY` : '—'}
        />
      </dl>

      {p?.profileSummary && (
        <div>
          <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
            Profile
          </div>
          <p className="leading-relaxed text-foreground/90">{p.profileSummary}</p>
        </div>
      )}
    </div>
  );
}
