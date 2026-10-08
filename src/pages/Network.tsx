import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '../ui/useResource';
import { Badge, DetailLine, Drawer, SummaryItem, LoadNotice } from '../ui/components';
import { money, tariff, num, kwh, fmtDateTime, dayKey } from '../ui/format';
import { Connector, LedgerRow, NetworkView, PortalStation } from '../types';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'AVAILABLE', label: 'Available' },
  { key: 'CHARGING', label: 'Charging' },
  { key: 'BLOCKED', label: 'Blocked' },
  { key: 'INOPERATIVE', label: 'Inoperative' },
];

function EvseDrawer({ conn, station, onClose }: { conn: Connector; station: PortalStation; onClose: () => void }) {
  const recent = useResource<{ rows: LedgerRow[] }>('/admin/api/cdrs?evse=' + encodeURIComponent(conn.evseUid) + '&from=' + dayKey(new Date(Date.now() - 29 * 864e5)) + '&to=' + dayKey(new Date()) + '&limit=5&currency='+conn.currency);
  const rows = recent.data?.rows ?? null;

  return (
    <Drawer onClose={onClose}>
      <div className="spread">
        <h2>{conn.evseUid}</h2>
        <button className="btn btn-ghost btn-sm" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <Badge text={conn.status} kind={conn.status} />
      <div className="stack" style={{ marginTop: '1rem' }}>
        <DetailLine label="Station" value={station.name} />
        <DetailLine label="Station country" value={station.countryCode} />
        <DetailLine label="Address" value={station.address + ', ' + station.city} />
        <DetailLine label="Connector id" value={conn.id} />
        <DetailLine label="Standard" value={conn.standard + ' · ' + conn.format} />
        <DetailLine label="Power" value={conn.maxPowerKw + ' kW · ' + conn.powerType} />
        <DetailLine label="Tariff" value={tariff(conn.tariffPerKwh,conn.currency) + ' / kWh'} />
        <DetailLine label="Coordinates" value={Number(station.latitude).toFixed(5) + ', ' + Number(station.longitude).toFixed(5)} />
      </div>
      <h3 style={{ marginTop: '1rem' }}>Recent sessions</h3>
      <LoadNotice {...recent} hasData={!!rows} onRetry={() => void recent.refresh()} label="recent sessions" />
      {rows === null ? (
        null
      ) : rows.length === 0 ? (
        <p className="muted prose">No settled sessions on this bay in the last 30 days.</p>
      ) : (
        <div className="stack">
          {rows.map((r) => (
            <div key={r.id} className="spread small" style={{ padding: '.3rem 0', borderBottom: '1px dashed var(--border)' }}>
              <div>
                <div>{fmtDateTime(r.startTime)}</div>
                <div className="muted">
                  {kwh(r.energyKwh)} · {r.minutes} min
                </div>
              </div>
              <span>{money(r.netPayout,r.currency)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="row wrap" style={{ marginTop: '1rem' }}>
        <Link className="btn" to="/ledger">
          Revenue
        </Link>
        <Link className="btn" to="/sandbox">
          Test a command
        </Link>
      </div>
    </Drawer>
  );
}

function StationCard({ station, connectors, onOpen }: { station: PortalStation; connectors: Connector[]; onOpen: (c: Connector, s: PortalStation) => void }) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>{station.name}</h2>
        <span className="muted small">
          {station.availableBays}/{station.totalBays} bays free
        </span>
      </div>
      <div className="muted small">
        {station.address}, {station.city} {'\u00b7'} {station.countryCode}{station.isSimulated ? ' \u00b7 Simulated station' : ''}
      </div>
      <div className="tiles">
        {connectors.map((c) => (
          <button key={c.id} className={'tile' + (c.status === 'CHARGING' ? ' charging' : '')} type="button" onClick={() => onOpen(c, station)}>
            <span className="uid">{c.evseUid}</span>
            <span className="meta connector-detail">{c.standard} · {c.format} · {c.maxPowerKw} kW</span>
            <span className="meta connector-tariff">{tariff(c.tariffPerKwh,c.currency)} / kWh</span>
            <Badge text={c.status} kind={c.status} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Network() {
  const resource = useResource<NetworkView>('/admin/api/network');
  const latest = resource.data;
  const [paused, setPaused] = useState(document.hidden);
  const [query, setQuery] = useState('');
  const [country,setCountry]=useState('ALL');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<{ conn: Connector; station: PortalStation } | null>(null);

  const load = useCallback(async () => {
    if (!document.hidden) await resource.refresh();
  }, [resource.refresh]);

  useEffect(() => {
    void load();
    const timer = setInterval(load, 5000);
    const onVis = () => {
      setPaused(document.hidden);
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  const q = query.trim().toLowerCase();
  const cards = (latest?.stations || [])
    .filter(s=>country==='ALL'||s.countryCode===country)
    .map((s) => {
      const stationTextMatch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q) ||
        (s.address || '').toLowerCase().includes(q);
      const conns = (s.connectors || []).filter((c) => {
        if (status !== 'all' && c.status !== status) return false;
        if (!q) return true;
        return stationTextMatch || c.evseUid.toLowerCase().includes(q);
      });
      return conns.length ? { s, conns } : null;
    })
    .filter((x): x is { s: PortalStation; conns: Connector[] } => x !== null);

  if (!latest) return <div className="stack"><h1>Network</h1><LoadNotice {...resource} hasData={false} onRetry={() => void resource.refresh()} label="network" /></div>;

  const counts = latest?.counts || { available: 0, charging: 0, blocked: 0, inoperative: 0 };

  return (
    <div className="stack">
      {selected ? <EvseDrawer conn={selected.conn} station={selected.station} onClose={() => setSelected(null)} /> : null}

      <div className="spread wrap">
        <h1>Network</h1>
        <span className="live-pill">
          {!paused && !resource.error ? <span className="dot-live" /> : null}
          {paused ? 'Paused while tab is hidden' : resource.error ? 'Refresh failed' : resource.loading ? 'Refreshing…' : 'Live · refreshes every 5s'}
        </span>
      </div>

      <LoadNotice {...resource} hasData onRetry={() => void resource.refresh()} label="network" />
      <div className="row wrap" style={{ gap: '.75rem' }}>
        <div className="row" style={{ flex: '1 1 16rem', maxWidth: '22rem' }}>
          <input
            className="input"
            type="search"
            placeholder="Search stations or EVSE…"
            aria-label="Search stations or EVSE id"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="row">Country
          <select className="select" value={country} onChange={e=>setCountry(e.target.value)}>
            <option value="ALL">All countries</option><option value="MY">Malaysia</option>
            <option value="SG">Singapore</option><option value="TH">Thailand</option>
          </select>
        </label>
        <div className="chips">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              className={'chip' + (f.key === status ? ' active' : '')}
              aria-pressed={f.key === status}
              type="button"
              onClick={() => setStatus(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <dl className="summary-strip network-summary" aria-label="Network totals">
        <SummaryItem label="Stations" value={num((latest?.stations || []).length)} />
        <SummaryItem label="Bays available" value={num(counts.available)} />
        <SummaryItem label="Charging now" value={num(counts.charging)} />
        <SummaryItem label="Sessions today" value={num(latest?.sessionsToday ?? 0)} />
      </dl>

      <div className="stack">
        {cards.length === 0 ? (
          <div className="card empty">
            {q || status !== 'all'
              ? 'No bays match the current search and filters.'
              : 'No stations yet. Register your network with your OCPI platform.'}
          </div>
        ) : (
          cards.map(({ s, conns }) => <StationCard key={s.id} station={s} connectors={conns} onOpen={(c, st) => setSelected({ conn: c, station: st })} />)
        )}
      </div>
    </div>
  );
}
