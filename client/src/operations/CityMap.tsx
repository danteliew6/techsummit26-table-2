/**
 * "Where the at-risk revenue is concentrated" — metro bubble map for C-suite.
 *
 * One CircleMarker per metro with:
 *   - Size: sqrt-scaled by total revenue-at-risk
 *   - Color opacity: shaded by % critical customers (more critical = more opaque)
 *   - Tooltip: metro name, customer count, actioned count, total revenue at risk
 *
 * Data comes in via props; map also renders a ranked hotspot list beside it
 * (in OperationsView) for filtering the Book of Business by metro.
 */
import { useEffect, useRef } from 'react';
import { Globe2 } from 'lucide-react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { AtRiskMetroRow } from '@/shared/types';

const RADIUS_MIN = 8;
const RADIUS_MAX = 45;

function radiusFor(revenueAtRisk: number, max: number): number {
  if (max <= 0) return RADIUS_MIN;
  const frac = Math.sqrt(Math.max(0, revenueAtRisk) / max);
  return RADIUS_MIN + frac * (RADIUS_MAX - RADIUS_MIN);
}

function opacityFor(criticalShare: number): number {
  // 0% critical → 0.3 opacity, 100% critical → 0.9 opacity
  return 0.3 + criticalShare * 0.6;
}

function severityColor(criticalShare: number): string {
  // Green (watch) → Yellow (elevated) → Red (critical)
  if (criticalShare >= 0.66) return '#dc2626'; // Red / critical
  if (criticalShare >= 0.33) return '#d97706'; // Orange / elevated
  return '#f59e0b'; // Yellow / watch
}

function FitBounds({ metros }: { metros: AtRiskMetroRow[] }) {
  const map = useMap();
  const lastKey = useRef<string>('');
  useEffect(() => {
    const points = metros.filter((m) => m.lat != null && m.lng != null);
    if (points.length === 0) return;
    const lats = points.map((m) => m.lat as number);
    const lngs = points.map((m) => m.lng as number);
    const key = `${points.length}:${Math.min(...lats).toFixed(1)}:${Math.max(...lats).toFixed(1)}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    if (Math.abs(maxLat - minLat) < 0.5 && Math.abs(maxLng - minLng) < 0.5) {
      map.setView([lats[0], lngs[0]], 6, { animate: true });
      return;
    }
    map.fitBounds(
      [
        [minLat, minLng],
        [maxLat, maxLng],
      ],
      { padding: [40, 40], animate: true },
    );
  }, [metros, map]);
  return null;
}

export function CityMap({
  metros,
  onMetroSelect,
}: {
  metros: AtRiskMetroRow[];
  onMetroSelect?: (metro: string | null) => void;
}) {
  const points = metros.filter((m) => m.lat != null && m.lng != null);
  const maxRevenue = points.reduce((m, c) => Math.max(m, c.revenue_at_risk_usd ?? 0), 0);

  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Globe2 className="size-4 text-muted-foreground shrink-0" />
          <h3 className="text-sm font-semibold">At-risk revenue by metro</h3>
        </div>
        <div className="h-[280px] sm:h-[340px] flex items-center justify-center text-sm text-muted-foreground">
          No geocoded at-risk metros in the current scope.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Globe2 className="size-4 text-muted-foreground shrink-0" />
          <h3 className="text-sm font-semibold truncate">At-risk revenue by metro</h3>
        </div>
        <div className="text-xs text-muted-foreground shrink-0">
          {points.length} metros
        </div>
      </div>
      <div className="h-[280px] sm:h-[340px] relative">
        <MapContainer
          center={[39, -98]}
          zoom={4}
          minZoom={2}
          scrollWheelZoom={false}
          worldCopyJump
          className="h-full w-full"
          style={{ background: 'var(--muted)' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            subdomains={['a', 'b', 'c']}
            maxZoom={19}
          />
          <FitBounds metros={points} />
          {points.map((m) => {
            const criticalShare = m.customers > 0 ? m.critical / m.customers : 0;
            const color = severityColor(criticalShare);
            const opacity = opacityFor(criticalShare);
            const pctActioned = m.customers > 0 ? ((m.actioned_count / m.customers) * 100).toFixed(0) : '0';
            return (
              <CircleMarker
                key={m.metro}
                center={[m.lat as number, m.lng as number]}
                radius={radiusFor(m.revenue_at_risk_usd ?? 0, maxRevenue)}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: opacity,
                  weight: 1.5,
                }}
                eventHandlers={{
                  click: () => onMetroSelect?.(m.metro),
                }}
              >
                <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                  <div className="text-xs">
                    <div className="font-semibold">{m.metro ?? 'Unknown'}</div>
                    <div>{m.customers} customers · {m.critical} critical</div>
                    <div>${(m.revenue_at_risk_usd / 1_000_000).toFixed(2)}M at risk</div>
                    <div>{pctActioned}% actioned</div>
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
