/**
 * Analytics — warehouse-backed charts (Meridian).
 *
 * Surfaces the "lakehouse analytics" half of the story: live SQL-warehouse
 * queries against the governed gold tables (table_2.exercise), the same
 * numbers the assistant reasons about. The header shows the warehouse
 * name + state to make that obvious.
 *
 * How the data flows: each chart fetches `/api/charts/<key>` (see
 * server/routes/charts.ts). That route reads config/queries/<key>.sql —
 * written with IDENTIFIER(:catalog || '.' || :schema || '.table') — and binds
 * the demo's catalog+schema (DEMO_CATALOG/DEMO_SCHEMA), so one env var drives
 * the analytics tables on any workspace. Rows come back via `useChartData`
 * and feed the chart components' `data` prop.
 *
 * Layout: one continuous page that reads top-to-bottom — headline KPIs, where
 * the exposure sits (band / action / tier / maturity), the program economics
 * (ROI / rate gap / coverage funnel), then the shortlist of customers to work.
 *
 * Repurposing: edit/add a .sql under config/queries/, register its key in
 * charts.ts's QUERY_FILES map, and reference it here via <ChartData chartKey=…>.
 */
import { useEffect, useState } from 'react';
import { BarChart } from '@databricks/appkit-ui/react';
import { BRAND_PALETTE } from '@/lib/brand';

const usd0 = (n: number) =>
  '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

// Adaptive currency: $X.XM for millions, $XXK for thousands, else $X — so small
// non-zero values (e.g. a $38K cross-sell) don't collapse to a misleading "$0M".
const usdM = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return '$' + (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'M';
  if (a >= 1e3) return '$' + Math.round(n / 1e3).toLocaleString() + 'K';
  return '$' + Math.round(n).toLocaleString();
};

const pct = (n: number) =>
  (n * 100).toLocaleString(undefined, { maximumFractionDigits: 1 }) + '%';

/**
 * Fetch chart rows from the server's /api/charts/<key> route. That route
 * reads the query SQL, substitutes the demo catalog/schema, and runs it
 * against the SQL warehouse — so a single env var drives the catalog/schema
 * for analytics just like the rest of the app (see server/routes/charts.ts).
 */
function useChartData<T = Record<string, unknown>>(key: string): {
  data: T[] | null;
  error: string | null;
  isLoading: boolean;
} {
  const [state, setState] = useState<{
    data: T[] | null;
    error: string | null;
    isLoading: boolean;
  }>({ data: null, error: null, isLoading: true });

  useEffect(() => {
    let alive = true;
    setState({ data: null, error: null, isLoading: true });
    fetch(`/api/charts/${key}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
        return body.data as T[];
      })
      .then((data) => alive && setState({ data, error: null, isLoading: false }))
      .catch(
        (e) =>
          alive &&
          setState({ data: null, error: String(e?.message ?? e), isLoading: false }),
      );
    return () => {
      alive = false;
    };
  }, [key]);

  return state;
}

export function AnalyticsView() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8 pb-32">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Retention analytics
          </div>
          <h1 className="display text-4xl font-semibold tracking-tight text-foreground mb-2">
            Where the attrition risk is concentrated.
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Live queries against the SQL warehouse — the same governed numbers the
            assistant reasons about. Read top-to-bottom: the exposure, where it sits,
            the plays that recover it, and how much of the book is already covered.
          </p>
        </div>

        {/* Headline KPIs — the exposure at a glance. */}
        <KpiStrip />

        {/* Exposure: by severity band + by recommended action. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Revenue at risk by band"
            subtitle="Annual at-risk revenue by risk severity"
            scope="Share of at-risk"
          >
            <BandBreakdown />
          </ChartCard>

          <ChartCard
            title="Next best action mix"
            subtitle="Multi-year relationship value by recommended action"
            scope="Predicted retained (US$M)"
          >
            <div className="h-[260px] flex flex-col justify-center">
              <ChartData chartKey="nba_action_mix" height={240}>
                {(rows) => (
                  <BarChart
                    data={rows.map((r) => ({ ...r, predicted_retained_usd: (r.predicted_retained_usd ?? 0) / 1e6 }))}
                    xKey="recommended_action"
                    yKey="predicted_retained_usd"
                    colors={[BRAND_PALETTE[1] ?? BRAND_PALETTE[0]]}
                    height={240}
                  />
                )}
              </ChartData>
            </div>
          </ChartCard>
        </div>

        {/* Where it sits + how soon it comes due. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Revenue at risk by tier"
            subtitle="Annual at-risk revenue by relationship tier"
            scope="Share of at-risk"
          >
            <TierBreakdown />
          </ChartCard>

          <ChartCard
            title="Maturity urgency"
            subtitle="Revenue at risk by days to product maturity"
            scope="Act-now window (US$M)"
          >
            <MaturityUrgency />
          </ChartCard>
        </div>

        {/* Program economics: which plays pay, and where the rate gap is. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Retention ROI by action"
            subtitle="Predicted net value + retained revenue per play"
            scope="Predicted value"
          >
            <RetentionROI />
          </ChartCard>

          <ChartCard
            title="Rate gap analysis"
            subtitle="At-risk revenue by current-vs-recommended rate gap"
            scope="At-risk revenue (US$M)"
          >
            <RateGapAnalysis />
          </ChartCard>
        </div>

        {/* Coverage funnel — how much of the at-risk book the program has touched. */}
        <ChartCard
          title="Retention coverage funnel"
          subtitle="At-risk revenue flowing through recommendation → action stages"
          scope="Coverage funnel"
        >
          <RetentionCoverageFunnel />
        </ChartCard>

        {/* Top at-risk customers — the shortlist to work in Book of Business. */}
        <ChartCard
          title="Top 10 customers at risk"
          subtitle="Ranked by annual revenue at risk; open Book of Business to act"
          scope="By revenue at risk"
          flush
        >
          <TopAtRiskTable />
        </ChartCard>
      </div>
    </div>
  );
}

/**
 * Wraps a chart/table in a bordered card with a compact header (title +
 * scope chip). `flush` removes inner padding for components that draw their
 * own (e.g. a table).
 */
function ChartCard({
  title,
  subtitle,
  scope,
  className,
  flush,
  children,
}: {
  title: string;
  subtitle?: string;
  scope?: string;
  className?: string;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-card overflow-hidden ${className ?? ''}`}
    >
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {scope && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground ml-2 shrink-0">
            {scope}
          </span>
        )}
      </div>
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </div>
  );
}

/**
 * Fetches /api/charts/<chartKey> and renders the rows via `children` once
 * ready, with loading/error/empty fallbacks.
 */
function ChartData({
  chartKey,
  height,
  children,
}: {
  chartKey: string;
  height: number;
  children: (rows: Record<string, unknown>[]) => React.ReactNode;
}) {
  const { data, error, isLoading } = useChartData(chartKey);
  const center = `flex items-center justify-center text-sm`;
  if (error) {
    return (
      <div className={`${center} text-destructive`} style={{ height }}>
        Error loading chart: {error}
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className={`${center} text-muted-foreground`} style={{ height }}>
        Loading…
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <div className={`${center} text-muted-foreground`} style={{ height }}>
        No data.
      </div>
    );
  }
  return <>{children(data)}</>;
}

type TopAtRiskRow = {
  customer_id: string;
  tier: string | null;
  risk_band: string | null;
  home_metro: string | null;
  attrition_risk_score: number;
  balance_at_risk_usd: number;
  revenue_at_risk_usd: number;
  min_days_to_maturity: number | null;
};

type RiskByBandRow = {
  risk_band: string;
  customers: number;
  balance_at_risk_usd: number;
  revenue_at_risk_usd: number;
};

type AtriskByTierRow = {
  tier: string;
  atrisk_customers: number;
  revenue_at_risk_usd: number;
};

type NbaActionMixRow = {
  recommended_action: string;
  customers: number;
  predicted_retained_usd: number;
};

type MaturityUrgencyRow = {
  maturity_bucket: string;
  customers: number;
  revenue_at_risk_usd: number;
};

type RetentionROIRow = {
  recommended_action: string;
  customers: number;
  predicted_retained_usd: number;
  predicted_net_value_usd: number;
};

type RateGapRow = {
  rate_gap_bucket: string;
  customers: number;
  avg_current_rate_apy: number;
  avg_recommended_rate_apy: number;
  revenue_at_risk_usd: number;
};

type RetentionCoverageFunnelRow = {
  stage: string;
  customers: number;
  revenue_at_risk_usd: number;
};

function bandToneClass(band: string | null): string {
  if (band === 'critical') return 'text-destructive font-semibold';
  if (band === 'elevated') return 'text-warning font-semibold';
  return 'text-muted-foreground';
}

/**
 * Headline KPI strip — the exposure at a glance, composed from three governed
 * queries (band severity, coverage funnel, action mix). Cards fall back to "—"
 * while loading and surface a single inline error if any feed fails.
 */
function KpiStrip() {
  const band = useChartData<RiskByBandRow>('risk_by_band');
  const funnel = useChartData<RetentionCoverageFunnelRow>('retention_coverage_funnel');
  const nba = useChartData<NbaActionMixRow>('nba_action_mix');

  const loading = band.isLoading || funnel.isLoading || nba.isLoading;
  const error = band.error ?? funnel.error ?? nba.error;

  const total = funnel.data?.find((d) => d.stage === 'Total at-risk revenue');
  const withRec = funnel.data?.find((d) => d.stage === 'With recommendation');
  const actioned = funnel.data?.find((d) => d.stage === 'Actioned');
  const totalRevenue = total?.revenue_at_risk_usd ?? 0;
  const criticalRev =
    band.data?.find((d) => d.risk_band === 'critical')?.revenue_at_risk_usd ?? 0;
  const predictedRetained = (nba.data ?? []).reduce(
    (s, r) => s + (r.predicted_retained_usd ?? 0),
    0,
  );
  const recCoveragePct = totalRevenue > 0 ? (withRec?.revenue_at_risk_usd ?? 0) / totalRevenue : 0;
  const totalCustomers = total?.customers ?? 0;
  const actionedCustomers = actioned?.customers ?? 0;
  const actionedPct = totalCustomers > 0 ? actionedCustomers / totalCustomers : 0;

  const cards: { label: string; value: string; sub: string; tone: string }[] = [
    {
      label: 'Annual revenue at risk',
      value: usdM(totalRevenue),
      sub: `${(total?.customers ?? 0).toLocaleString()} at-risk customers`,
      tone: 'text-foreground',
    },
    {
      label: 'Critical-band exposure',
      value: usdM(criticalRev),
      sub: totalRevenue > 0 ? `${pct(criticalRev / totalRevenue)} of at-risk revenue` : '—',
      tone: 'text-destructive',
    },
    {
      label: 'Recoverable if actioned',
      value: usdM(predictedRetained),
      sub: 'Predicted retained (multi-year)',
      tone: 'text-foreground',
    },
    {
      label: 'Actioned so far',
      value: `${actionedCustomers.toLocaleString()} of ${totalCustomers.toLocaleString()}`,
      sub:
        totalCustomers > 0
          ? `${pct(actionedPct)} worked · ${pct(recCoveragePct)} have a recommendation`
          : '—',
      tone: 'text-warning',
    },
  ];

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-destructive">
        Couldn't load headline metrics: {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {c.label}
          </div>
          <div className={`mt-2 text-2xl font-semibold tabular-nums ${c.tone}`}>
            {loading ? '—' : c.value}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {loading ? 'Loading…' : c.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Horizontal semantic breakdown: bar length is linear in value (largest fills
 * the track), the value + share-of-total print on the right, and an optional
 * customer count sits underneath. Reads far better than a 3-bar vertical chart.
 */
function BreakdownBars({
  rows,
  labelKey,
  valueKey,
  countKey,
  colorFor,
}: {
  rows: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  countKey?: string;
  colorFor: (label: string, idx: number) => string;
}) {
  const values = rows.map((r) => Number(r[valueKey] ?? 0));
  const max = Math.max(1, ...values);
  const total = values.reduce((s, v) => s + v, 0);
  return (
    <div className="space-y-4 py-2">
      {rows.map((row, idx) => {
        const label = String(row[labelKey] ?? '—');
        const value = Number(row[valueKey] ?? 0);
        const count = countKey != null ? Number(row[countKey] ?? 0) : null;
        const width = (value / max) * 100;
        const share = total > 0 ? value / total : 0;
        return (
          <div key={label} className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium capitalize">{label.replace(/_/g, ' ')}</span>
              <span className="text-right">
                <span className="font-mono font-semibold tabular-nums">{usdM(value)}</span>{' '}
                <span className="text-muted-foreground text-xs">{pct(share)}</span>
              </span>
            </div>
            <div className="bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${width}%`, backgroundColor: colorFor(label, idx) }}
              />
            </div>
            {count != null && (
              <div className="text-[11px] text-muted-foreground">
                {count.toLocaleString()} customers
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Severity → semantic fill, so the chart's color carries the same meaning as
// the band labels everywhere else in the app.
const BAND_COLOR: Record<string, string> = {
  critical: 'var(--destructive)',
  elevated: 'var(--warning)',
  watch: 'var(--muted-foreground)',
};

function BandBreakdown() {
  const { data, error, isLoading } = useChartData<RiskByBandRow>('risk_by_band');
  if (error) {
    return <div className="flex items-center justify-center h-[220px] text-sm text-destructive">Error: {error}</div>;
  }
  if (isLoading || !data) {
    return <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">Loading…</div>;
  }
  const rows = data.filter((r) => ['critical', 'elevated', 'watch'].includes(r.risk_band));
  if (rows.length === 0) {
    return <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">No data.</div>;
  }
  return (
    <BreakdownBars
      rows={rows}
      labelKey="risk_band"
      valueKey="revenue_at_risk_usd"
      countKey="customers"
      colorFor={(label) => BAND_COLOR[label] ?? 'var(--muted-foreground)'}
    />
  );
}

function TierBreakdown() {
  const { data, error, isLoading } = useChartData<AtriskByTierRow>('atrisk_by_tier');
  if (error) {
    return <div className="flex items-center justify-center h-[220px] text-sm text-destructive">Error: {error}</div>;
  }
  if (isLoading || !data) {
    return <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">Loading…</div>;
  }
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">No data.</div>;
  }
  return (
    <BreakdownBars
      rows={data}
      labelKey="tier"
      valueKey="revenue_at_risk_usd"
      countKey="atrisk_customers"
      colorFor={(_label, idx) => BRAND_PALETTE[idx % BRAND_PALETTE.length]}
    />
  );
}

function MaturityUrgency() {
  const { data, error, isLoading } = useChartData<MaturityUrgencyRow>('maturity_urgency');
  if (error) {
    return <div className="flex items-center justify-center h-[260px] text-sm text-destructive">Error: {error}</div>;
  }
  if (isLoading || !data) {
    return <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">Loading…</div>;
  }
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">No data.</div>;
  }
  return (
    <BarChart
      data={data.map((r) => ({ ...r, revenue_at_risk_usd: (r.revenue_at_risk_usd ?? 0) / 1e6 }))}
      xKey="maturity_bucket"
      yKey="revenue_at_risk_usd"
      colors={[BRAND_PALETTE[2] ?? BRAND_PALETTE[0]]}
      height={260}
    />
  );
}

function RetentionROI() {
  const { data, error, isLoading } = useChartData<RetentionROIRow>('retention_roi_by_action');
  if (error) {
    return <div className="flex items-center justify-center h-[260px] text-sm text-destructive">Error: {error}</div>;
  }
  if (isLoading || !data) {
    return <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">Loading…</div>;
  }
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">No data.</div>;
  }
  // Display as a table of actions with their metrics for clarity
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          <tr className="border-b border-border">
            <th className="text-left font-medium px-3 py-2">Action</th>
            <th className="text-right font-medium px-3 py-2">Customers</th>
            <th className="text-right font-medium px-3 py-2">Predicted Retained</th>
            <th className="text-right font-medium px-3 py-2">Net Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.recommended_action} className="hover:bg-muted/40">
              <td className="px-3 py-2 capitalize">{(row.recommended_action ?? '—').replace(/_/g, ' ')}</td>
              <td className="px-3 py-2 text-right">{row.customers}</td>
              <td className="px-3 py-2 text-right font-mono text-muted-foreground">{usdM(row.predicted_retained_usd)}</td>
              <td className="px-3 py-2 text-right font-mono font-semibold">{usdM(row.predicted_net_value_usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RateGapAnalysis() {
  const { data, error, isLoading } = useChartData<RateGapRow>('rate_gap_analysis');
  if (error) {
    return <div className="flex items-center justify-center h-[260px] text-sm text-destructive">Error: {error}</div>;
  }
  if (isLoading || !data) {
    return <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">Loading…</div>;
  }
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">No data.</div>;
  }
  return (
    <BarChart
      data={data.map((r) => ({ ...r, revenue_at_risk_usd: (r.revenue_at_risk_usd ?? 0) / 1e6 }))}
      xKey="rate_gap_bucket"
      yKey="revenue_at_risk_usd"
      colors={[BRAND_PALETTE[1] ?? BRAND_PALETTE[0]]}
      height={260}
    />
  );
}

function RetentionCoverageFunnel() {
  const { data, error, isLoading } = useChartData<RetentionCoverageFunnelRow>('retention_coverage_funnel');
  if (error) {
    return <div className="flex items-center justify-center h-[240px] text-sm text-destructive">Error: {error}</div>;
  }
  if (isLoading || !data) {
    return <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">Loading…</div>;
  }
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">No data.</div>;
  }
  // Compute coverage percentages for display
  const total = data.find(d => d.stage === 'Total at-risk revenue');
  const totalRevenue = total?.revenue_at_risk_usd ?? 0;
  const colors = [BRAND_PALETTE[0], BRAND_PALETTE[1], BRAND_PALETTE[2]];

  return (
    <div className="space-y-4 py-2">
      {data.map((row, idx) => {
        const pctCoverage = totalRevenue > 0 ? (row.revenue_at_risk_usd / totalRevenue) * 100 : 0;
        return (
          <div key={row.stage} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{row.stage}</span>
              <span className="text-right">
                <span className="font-mono font-semibold">{usdM(row.revenue_at_risk_usd)}</span>
                {' '}
                <span className="text-muted-foreground text-xs">
                  {row.customers.toLocaleString()} customers
                </span>
              </span>
            </div>
            <div className="bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${pctCoverage}%`, backgroundColor: colors[idx % colors.length] }}
              />
            </div>
            <div className="text-xs text-muted-foreground text-right">
              {pctCoverage.toLocaleString(undefined, { maximumFractionDigits: 1 })}% of at-risk
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopAtRiskTable() {
  const { data, error, isLoading } = useChartData<TopAtRiskRow>('top_atrisk_customers');
  if (error) {
    return <div className="px-4 py-3 text-sm text-destructive">Couldn't load customers: {error}</div>;
  }
  if (isLoading || !data) {
    return <div className="px-4 py-6 text-sm text-muted-foreground text-center">Loading…</div>;
  }
  if (data.length === 0) {
    return <div className="px-4 py-6 text-sm text-muted-foreground text-center">No at-risk customers.</div>;
  }
  const rows = data.slice(0, 10);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          <tr className="border-b border-border">
            <th className="text-left font-medium px-3 py-2">#</th>
            <th className="text-left font-medium px-3 py-2">Customer</th>
            <th className="text-left font-medium px-3 py-2">Tier</th>
            <th className="text-left font-medium px-3 py-2">Band</th>
            <th className="text-left font-medium px-3 py-2">Metro</th>
            <th className="text-right font-medium px-3 py-2">Risk</th>
            <th className="text-right font-medium px-3 py-2">Balance at risk</th>
            <th className="text-right font-medium px-3 py-2">Revenue at risk</th>
            <th className="text-right font-medium px-3 py-2">Days to maturity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, idx) => (
            <tr key={row.customer_id} className="hover:bg-muted/40">
              <td className="px-3 py-2 text-muted-foreground tabular-nums">{idx + 1}</td>
              <td className="px-3 py-2 font-mono text-xs">{row.customer_id}</td>
              <td className="px-3 py-2 capitalize text-muted-foreground">
                {(row.tier ?? '—').replace(/_/g, ' ')}
              </td>
              <td className={`px-3 py-2 font-semibold capitalize ${bandToneClass(row.risk_band)}`}>
                {row.risk_band ?? '—'}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{row.home_metro ?? '—'}</td>
              <td className="px-3 py-2 text-right">{row.attrition_risk_score?.toFixed?.(2) ?? '—'}</td>
              <td className="px-3 py-2 text-right font-mono">{usd0(row.balance_at_risk_usd)}</td>
              <td className="px-3 py-2 text-right font-mono">{usd0(row.revenue_at_risk_usd)}</td>
              <td className="px-3 py-2 text-right">{row.min_days_to_maturity ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
