/**
 * Book of Business — the ranked/flagged queue of at-risk customers.
 * Risk-band filter chips + search + the row list. Click a row → opens the
 * Customer 360 drawer. Rows whose risk band changed between dataMutated
 * refetches pulse a soft highlight so the eye lands on what moved.
 */
import { useState } from 'react';
import { Search, ArrowUp, ArrowDown } from 'lucide-react';
import { usePulseOnChange } from '@/lib/usePulseOnChange';
import type { CustomerPositionRow, RiskBand } from '@/shared/types';
import { RiskBandBadge, TierBadge, usd } from '@/shared/badges';

type BandFilter = RiskBand | 'all';

const BAND_TABS: { value: BandFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'elevated', label: 'Elevated' },
  { value: 'watch', label: 'Watch' },
];

type Props = {
  rows: CustomerPositionRow[];
  loading: boolean;
  error: string | null;
  bandFilter: BandFilter;
  onBandFilter: (b: BandFilter) => void;
  search: string;
  onSearch: (s: string) => void;
  onSelect: (id: string) => void;
};

type SortKey = 'revenueAtRisk' | 'balanceAtRisk' | 'attrition';
type SortDir = 'asc' | 'desc';

export function ReturnsTable({
  rows,
  loading,
  error,
  bandFilter,
  onBandFilter,
  search,
  onSearch,
  onSelect,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('revenueAtRisk');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    let aVal = 0;
    let bVal = 0;
    if (sortKey === 'revenueAtRisk') {
      aVal = a.revenueAtRiskUsd ?? 0;
      bVal = b.revenueAtRiskUsd ?? 0;
    } else if (sortKey === 'balanceAtRisk') {
      aVal = a.balanceAtRiskUsd ?? 0;
      bVal = b.balanceAtRiskUsd ?? 0;
    } else if (sortKey === 'attrition') {
      aVal = a.attritionRiskScore ?? 0;
      bVal = b.attritionRiskScore ?? 0;
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDir === 'asc' ? (
      <ArrowUp className="size-3 inline ml-1" />
    ) : (
      <ArrowDown className="size-3 inline ml-1" />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Risk band filter"
          className="relative inline-flex rounded-full border border-border bg-card p-0.5 text-sm"
        >
          {BAND_TABS.map((s) => {
            const active = bandFilter === s.value;
            return (
              <button
                key={s.value}
                onClick={() => onBandFilter(s.value)}
                aria-pressed={active}
                className={`relative z-10 rounded-full px-3 py-1 transition-colors duration-200 ${
                  active
                    ? 'text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {active && (
                  <span
                    className="absolute inset-0 rounded-full bg-foreground"
                    aria-hidden
                  />
                )}
                <span className="relative">{s.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm flex-1 sm:flex-initial min-w-[180px]">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search customer, metro…"
            className="bg-transparent outline-none w-full sm:w-60 placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="relative rounded-xl border border-border bg-card overflow-hidden">
        {loading && (
          <div className="absolute inset-x-0 top-0 h-0.5 z-10 overflow-hidden" aria-hidden>
            <div
              className="h-full w-1/3 rounded-full"
              style={{ background: 'var(--primary)', animation: 'loadingBar 1.1s ease-in-out infinite' }}
            />
          </div>
        )}
        <div className={`overflow-x-auto transition-opacity duration-150 ${loading && rows.length > 0 ? 'opacity-70' : 'opacity-100'}`}>
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Customer</th>
                <th className="text-left px-4 py-2 font-semibold">Risk</th>
                <th className="text-left px-4 py-2 font-semibold cursor-pointer hover:text-foreground" onClick={() => toggleSort('attrition')}>
                  Attrition {renderSortIcon('attrition')}
                </th>
                <th className="text-right px-4 py-2 font-semibold cursor-pointer hover:text-foreground" onClick={() => toggleSort('balanceAtRisk')}>
                  Balance at risk {renderSortIcon('balanceAtRisk')}
                </th>
                <th className="text-right px-4 py-2 font-semibold cursor-pointer hover:text-foreground" onClick={() => toggleSort('revenueAtRisk')}>
                  Revenue at risk {renderSortIcon('revenueAtRisk')}
                </th>
                <th className="text-right px-4 py-2 font-semibold">Matures</th>
              </tr>
            </thead>
            <tbody>
              {loading && sortedRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && sortedRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No at-risk customers match the current filters.
                  </td>
                </tr>
              )}
              {sortedRows.map((r) => (
                <Row key={r.customerId} row={r} onSelect={onSelect} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({
  row: r,
  onSelect,
}: {
  row: CustomerPositionRow;
  onSelect: (id: string) => void;
}) {
  const pulse = usePulseOnChange(r.riskBand);
  const score = Math.round((r.attritionRiskScore ?? 0) * 100);
  return (
    <tr
      onClick={() => onSelect(r.customerId)}
      className={`cursor-pointer border-t border-border hover:bg-muted/50 transition-colors ${
        pulse ? 'animate-pulse-row' : ''
      }`}
    >
      <td className="px-4 py-2">
        <div className="font-mono font-medium">{r.customerId}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
          <TierBadge tier={r.tier} />
          {r.homeMetro ?? ''}
        </div>
      </td>
      <td className="px-4 py-2">
        <RiskBandBadge band={r.riskBand} />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1.5" title={`Attrition risk: ${score}%`}>
          <div className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
            <div
              className={score >= 70 ? 'h-full bg-destructive' : score >= 40 ? 'h-full bg-warning' : 'h-full bg-muted-foreground/50'}
              style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
            />
          </div>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground w-7 text-right">
            {score}
          </span>
        </div>
      </td>
      <td className="px-4 py-2 text-right font-mono">{usd(r.balanceAtRiskUsd)}</td>
      <td className="px-4 py-2 text-right font-mono">{usd(r.revenueAtRiskUsd)}</td>
      <td className="px-4 py-2 text-right text-muted-foreground">
        {r.minDaysToMaturity != null ? `${r.minDaysToMaturity}d` : '—'}
      </td>
    </tr>
  );
}
