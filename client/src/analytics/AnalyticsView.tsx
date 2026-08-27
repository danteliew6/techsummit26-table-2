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
 * Repurposing: edit/add a .sql under config/queries/, register its key in
 * charts.ts's QUERY_FILES map, and reference it here via <ChartData chartKey=…>.
 */
import { useEffect, useState } from 'react';
import { BarChart, DonutChart } from '@databricks/appkit-ui/react';
import { BRAND_PALETTE } from '@/lib/brand';

const usd0 = (n: number) =>
  '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

const usdM = (n: number) =>
  '$' + (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'M';

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
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6 sm:space-y-10 pb-32">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Retention analytics
          </div>
          <h1 className="display text-4xl font-semibold tracking-tight text-foreground mb-2">
            Where the attrition risk is concentrated.
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Live queries against the SQL warehouse — the same governed numbers
            the assistant reasons about, on one page. Use the Book of Business
            to act; use this page to spot the pattern.
          </p>
        </div>

        {/* Top row: revenue at risk by band + next-best-action mix. */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <ChartCard
            title="Revenue at risk by band"
            subtitle="Annual at-risk revenue across all customers, by risk severity"
            scope="All customers (US$M)"
            className="lg:col-span-3"
          >
            <ChartData chartKey="risk_by_band" height={260}>
              {(rows) => (
                <BarChart
                  data={rows.map((r) => ({ ...r, revenue_at_risk_usd: (r.revenue_at_risk_usd ?? 0) / 1e6 }))}
                  xKey="risk_band"
                  yKey="revenue_at_risk_usd"
                  colors={[BRAND_PALETTE[0]]}
                  height={260}
                />
              )}
            </ChartData>
          </ChartCard>

          <ChartCard
            title="Next best action mix"
            subtitle="Multi-year relationship value by recommended action"
            scope="Predicted retained (US$M)"
            className="lg:col-span-2"
          >
            <div className="h-[260px] flex flex-col justify-center">
              <ChartData chartKey="nba_action_mix" height={220}>
                {(rows) => (
                  <BarChart
                    data={rows.map((r) => ({ ...r, predicted_retained_usd: (r.predicted_retained_usd ?? 0) / 1e6 }))}
                    xKey="recommended_action"
                    yKey="predicted_retained_usd"
                    colors={[BRAND_PALETTE[1] ?? BRAND_PALETTE[0]]}
                    height={220}
                  />
                )}
              </ChartData>
            </div>
          </ChartCard>
        </div>

        {/* At-risk revenue by relationship tier. */}
        <ChartCard
          title="Revenue at risk by tier"
          subtitle="Annual at-risk revenue by customer tier"
          scope="At-risk customers (US$M)"
        >
          <ChartData chartKey="atrisk_by_tier" height={240}>
            {(rows) => (
              <BarChart
                data={rows.map((r) => ({ ...r, revenue_at_risk_usd: (r.revenue_at_risk_usd ?? 0) / 1e6 }))}
                xKey="tier"
                yKey="revenue_at_risk_usd"
                colors={[BRAND_PALETTE[0]]}
                height={240}
              />
            )}
          </ChartData>
        </ChartCard>

        {/* Top at-risk customers table. */}
        <ChartCard
          title="Top customers at risk"
          subtitle="Ranked by annual revenue at risk; see Details in Relationship Desk for actions"
          scope="By revenue at risk"
          flush
        >
          <TopAtRiskTable />
        </ChartCard>

        {/* Retention cockpit: urgency, ROI, rate gap, coverage. */}
        <div className="mt-12 pt-6 border-t border-muted-foreground/20">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
              Retention program
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
              Execution dashboard.
            </h2>
            <p className="text-muted-foreground max-w-2xl text-sm">
              Track urgency, ROI, and coverage of retention actions. The funnel shows
              how much of the at-risk book is covered by recommendations and actions.
            </p>
          </div>
        </div>

        {/* Maturity urgency. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Maturity urgency"
            subtitle="Revenue at risk by days to product maturity"
            scope="Act-now window"
          >
            <MaturityUrgency />
          </ChartCard>

          <ChartCard
            title="Retention ROI by action"
            subtitle="Predicted net value + retained revenue per play"
            scope="Predicted value (US$M)"
          >
            <RetentionROI />
          </ChartCard>
        </div>

        {/* Rate gap analysis. */}
        <ChartCard
          title="Rate gap analysis"
          subtitle="Current APY vs recommended lift needed for at-risk deposits"
          scope="Basis points (bps)"
        >
          <RateGapAnalysis />
        </ChartCard>

        {/* Retention coverage funnel. */}
        <ChartCard
          title="Retention coverage funnel"
          subtitle="At-risk revenue flowing through recommendation → action stages"
          scope="Coverage funnel (US$M)"
        >
          <RetentionCoverageFunnel />
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
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          <tr className="border-b border-border">
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
          {data.map((row) => (
            <tr key={row.customer_id} className="hover:bg-muted/40">
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
