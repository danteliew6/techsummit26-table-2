/**
 * Book of Business — the relationship manager's ranked/flagged queue of
 * at-risk customers, the WRITE SURFACE for the Meridian use case.
 *
 * Layers (context doc): Visualize (this queue + KPIs + map, refreshed on a
 * trigger), Assist (the floating dock → the agent), Act (approve a next best
 * action in the Customer 360 drawer → writes app.rm_actions). Stays in sync
 * with the agent via the `dataMutated` pub/sub: when the chat stream
 * completes (or an action is approved), the queue + KPIs refetch.
 */
import { useEffect, useMemo, useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { fetchAtRiskCustomers, fetchRiskMetrics, fetchAtRiskByMetro } from '@/lib/relationships';
import { useSession } from '@/lib/api';
import { dataMutated } from '@/lib/events';
import { dockController } from '@/chat/dockController';
import type { CustomerPositionRow, RiskBand, RiskMetrics, AtRiskMetroRow } from '@/shared/types';

import { CityMap } from './CityMap';
import { KpiCards } from './KpiCards';
import { ReturnsTable } from './ReturnsTable';
import { CustomerDrawer } from './ReturnDrawer';

type BandFilter = RiskBand | 'all';

export function OperationsView() {
  const [rows, setRows] = useState<CustomerPositionRow[]>([]);
  const [metros, setMetros] = useState<AtRiskMetroRow[]>([]);
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [bandFilter, setBandFilter] = useState<BandFilter>('all');
  const [metroFilter, setMetroFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { config } = useSession();

  async function reload() {
    setLoading(true);
    try {
      const [list, m, metroData] = await Promise.all([
        fetchAtRiskCustomers(500),
        fetchRiskMetrics(),
        fetchAtRiskByMetro(),
      ]);
      setRows(list);
      setMetrics(m);
      setMetros(metroData);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    return dataMutated.subscribe(() => void reload());
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (bandFilter !== 'all' && r.riskBand !== bandFilter) return false;
      if (metroFilter && r.homeMetro !== metroFilter) return false;
      if (!q) return true;
      return (
        r.customerId.toLowerCase().includes(q) ||
        (r.homeMetro ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, bandFilter, metroFilter]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 lg:items-end">
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Relationship desk — book of business
              </div>
              <h1 className="display text-4xl font-semibold tracking-tight text-foreground mb-2">
                Work the at-risk book.
              </h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Each row is a customer the model has flagged for attrition. Open a
              customer to see why they're at risk, the model's next best action,
              and approve outreach — recorded straight to the operational store.
            </p>
            {config?.assistantScript?.[0] && (
              <button
                onClick={() =>
                  dockController.openAndSend(config.assistantScript[0].prompt)
                }
                className="w-full text-left rounded-xl border border-border bg-card hover:border-foreground/30 hover:shadow-sm px-5 py-4 transition-all flex items-center gap-4 group"
              >
                <div
                  className="size-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  <Sparkles className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Not sure who to call first?
                  </div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {config.assistantScript[0].label ?? config.assistantScript[0].prompt}
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </button>
            )}
          </div>
        </div>

        <KpiCards metrics={metrics} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          <CityMap metros={metros} onMetroSelect={setMetroFilter} />

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">At-risk hotspots</h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                Click a bubble to filter the table
              </p>
            </div>
            <div className="overflow-y-auto max-h-[340px]">
              {metros.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                  No metros with at-risk customers.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {metros.map((m) => {
                    const isSelected = metroFilter === m.metro;
                    const pctActioned = m.customers > 0 ? ((m.actioned_count / m.customers) * 100).toFixed(0) : '0';
                    const pctCritical = m.customers > 0 ? ((m.critical / m.customers) * 100).toFixed(0) : '0';
                    return (
                      <button
                        key={m.metro}
                        onClick={() => setMetroFilter(isSelected ? null : m.metro)}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border-l-2 border-l-primary'
                            : 'hover:bg-muted/30'
                        }`}
                      >
                        <div className="font-semibold text-foreground">{m.metro ?? 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <div>${(m.revenue_at_risk_usd / 1_000_000).toFixed(2)}M at risk</div>
                          <div>{m.customers} customers · {pctCritical}% critical</div>
                          <div>{pctActioned}% actioned</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <ReturnsTable
          rows={filteredRows}
          loading={loading}
          error={error}
          bandFilter={bandFilter}
          onBandFilter={setBandFilter}
          search={search}
          onSearch={setSearch}
          onSelect={setSelectedId}
        />
      </div>

      <CustomerDrawer
        id={selectedId}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onMutated={() => {
          void reload();
        }}
      />
    </div>
  );
}
