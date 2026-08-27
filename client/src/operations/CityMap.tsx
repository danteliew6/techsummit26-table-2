/**
 * "Where the at-risk customers are" — bubble map for the Book of Business.
 *
 * One CircleMarker per at-risk customer that has lat/lng, colored by risk
 * band, radius sqrt-scaled by balance-at-risk. Data comes in via props
 * (the parent already fetched the queue) — no separate fetch. Leaflet CSS
 * is imported in client/src/index.css.
 */
import { useEffect, useRef } from 'react';
import { Globe2 } from 'lucide-react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { usd } from '@/shared/badges';
import type { CustomerPositionRow, RiskBand } from '@/shared/types';

const BAND_COLOR: Record<RiskBand, string> = {
  critical: '#dc2626',
  elevated: '#d97706',
  watch: '#64748b',
  healthy: '#16a34a',
};
const RADIUS_MIN = 5;
const RADIUS_MAX = 30;

function radiusFor(balanceAtRisk: number, max: number): number {
  if (max <= 0) return RADIUS_MIN;
  const frac = Math.sqrt(Math.max(0, balanceAtRisk) / max);
  return RADIUS_MIN + frac * (RADIUS_MAX - RADIUS_MIN);
}

function FitBounds({ points }: { points: CustomerPositionRow[] }) {
  const map = useMap();
  const lastKey = useRef<string>('');
  useEffect(() => {
    if (points.length === 0) return;
    const lats = points.map((c) => c.customerLat as number);
    const lngs = points.map((c) => c.customerLng as number);
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
  }, [points, map]);
  return null;
}

export function CityMap({ customers }: { customers: CustomerPositionRow[] }) {
  const points = customers.filter(
    (c) => c.customerLat != null && c.customerLng != null,
  );
  const maxBalance = points.reduce(
    (m, c) => Math.max(m, c.balanceAtRiskUsd ?? 0),
    0,
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Globe2 className="size-4 text-muted-foreground shrink-0" />
          <h3 className="text-sm font-semibold truncate">At-risk customers by location</h3>
        </div>
        <div className="text-xs text-muted-foreground shrink-0">
          {points.length} plotted
        </div>
      </div>
      <div className="h-[280px] sm:h-[340px] relative">
        {points.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            No geocoded at-risk customers in the current scope.
          </div>
        ) : (
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
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              subdomains={['a', 'b', 'c', 'd']}
              maxZoom={19}
            />
            <FitBounds points={points} />
            {points.map((c) => {
              const color = BAND_COLOR[c.riskBand];
              return (
                <CircleMarker
                  key={c.customerId}
                  center={[c.customerLat as number, c.customerLng as number]}
                  radius={radiusFor(c.balanceAtRiskUsd ?? 0, maxBalance)}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 1.5 }}
                >
                  <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                    <div className="text-xs">
                      <div className="font-semibold font-mono">{c.customerId}</div>
                      <div>{c.homeMetro ?? '—'} · {c.riskBand}</div>
                      <div>{usd(c.balanceAtRiskUsd)} at risk</div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
