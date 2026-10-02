import { CurrencyFilter } from '../ui/CurrencyFilter';
// Revenue excludes sandbox sessions.
import { useRef, useState } from 'react';
import { ApiError, download } from '../api';
import { useAuth } from '../auth/AuthContext';
import { DetailLine, SummaryItem, Modal, LoadNotice } from '../ui/components';
import { useResource } from '../ui/useResource';
import { rangeFor, cycleFor, validRange } from '../ui/reporting';
import { toast } from '../ui/toast';
import { copy } from '../ui/clipboard';
import { money, tariff, num, kwh, fmtDateTime, REPORTING_TIMEZONE } from '../ui/format';
import { LedgerResponse, LedgerTotals, PortalCDR, CPOProfile } from '../types';

const PRESETS = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'mtd', label: 'This month' },
  { key: 'today', label: 'Today' },
];

function CDRModal({ id, onClose }: { id: string; onClose: () => void }) {
  const resource = useResource<PortalCDR>('/admin/api/cdrs/' + encodeURIComponent(id));
  const data = resource.data;
  const json = data ? JSON.stringify(data.document, null, 2) : '';

  return (
    <Modal
      title="Charge detail record"
      wide
      onClose={onClose}
      footer={
        data ? (
          <button className="btn btn-primary" type="button" onClick={() => void copy(json, 'CDR JSON copied')}>
            Copy JSON
          </button>
        ) : undefined
      }
    >
      <LoadNotice {...resource} hasData={!!data} onRetry={() => void resource.refresh()} label="charge detail record" />
      {data ? (
        <div className="stack">
          <DetailLine label="CDR id" value={data.row.id} />
          <DetailLine label="Session" value={data.row.sessionId} />
          <DetailLine label="Station / EVSE" value={data.row.stationName + ' · ' + data.row.evseUid} />
          <DetailLine label="Start" value={fmtDateTime(data.row.startTime)} />
          <DetailLine label="End" value={fmtDateTime(data.row.endTime)} />
          <DetailLine label="Energy" value={kwh(data.row.energyKwh) + '  ·  ' + data.row.minutes + ' min'} />
          <DetailLine label="Tariff" value={tariff(data.row.tariffPerKwh,data.row.currency) + ' / kWh'} />
          <DetailLine label="Gross" value={money(data.row.gross,data.row.currency)} />
          <DetailLine label="Platform fee" value={money(data.row.platformFee,data.row.currency)} />
          <DetailLine label="Net payout" value={money(data.row.netPayout,data.row.currency)} />
          <h3 style={{ marginTop: '1rem' }}>OCPI CDR document</h3>
          <pre className="json">{json}</pre>
        </div>
      ) : null}
    </Modal>
  );
}

function PayoutEstimate({ cycle,currency }: { cycle: string;currency:string }) {
  const { from, to } = cycleFor(cycle);
  const resource = useResource<{ totals: LedgerTotals }>('/admin/api/cdrs?from=' + from + '&to=' + to + '&limit=1&currency='+currency);
  const totals = resource.data?.totals;
  return <div className="stack" style={{ marginTop: '.5rem' }}>
    <LoadNotice {...resource} hasData={!!totals} onRetry={() => void resource.refresh()} label="payout estimate" />
    {totals ? <>
      <DetailLine label="Current cycle" value={from + ' → ' + to} />
      <DetailLine label="Estimated net for current cycle" value={money(totals.netPayout,totals.currency)} />
      <div className="muted small">Demo cycle estimate. No bank transfer or previous payout is recorded.</div>
    </> : null}
  </div>;
}

export default function Ledger() {
  const { profile } = useAuth();
  const [currency,setCurrency]=useState('MYR');
  const [preset, setPreset] = useState('30d');
  const [from, setFrom] = useState(() => rangeFor('30d').from);
  const [to, setTo] = useState(() => rangeFor('30d').to);
  const [page, setPage] = useState(1);
  const [cdrId, setCdrId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportInFlight = useRef(false);
  const limit = 25;
  const valid = validRange(from, to);
  const resource = useResource<LedgerResponse>(valid
    ? '/admin/api/cdrs?from=' + from + '&to=' + to + '&page=' + page + '&limit=' + limit + '&currency='+currency : null);
  const res = resource.data;

  function changeDate(kind: 'from' | 'to', value: string) {
    setPreset('');
    setPage(1);
    if (kind === 'from') setFrom(value); else setTo(value);
  }

  function applyPreset(key: string) {
    const r = rangeFor(key);
    setPreset(key);
    setFrom(r.from);
    setTo(r.to);
    setPage(1);
  }

  async function exportCsv() {
    if (!valid || exportInFlight.current) return;
    exportInFlight.current = true;
    setExporting(true);
    try { await download('/admin/api/cdrs?format=csv&from=' + from + '&to=' + to + '&currency='+currency, 'chargenet-cdrs-'+currency+'.csv'); }
    catch (err) { toast((err as ApiError).message, 'error'); }
    finally { exportInFlight.current = false; setExporting(false); }
  }

  const totals = res?.totals || { count: 0, energyKwh: 0, gross: 0, platformFee: 0, netPayout: 0,currency };
  const rows = res?.rows || [];
  const pages = Math.max(1, Math.ceil((totals.count || 0) / limit));
  const profileView: Partial<CPOProfile> = profile || {};

  const notice = <LoadNotice {...resource} hasData={!!res} onRetry={() => void resource.refresh()} label="revenue records" />;

  return (
    <div className="stack">
      {cdrId ? <CDRModal id={cdrId} onClose={() => setCdrId(null)} /> : null}

      <div className="spread wrap">
        <h1>Revenue</h1>
        <div className="row wrap">
          <button className="btn" type="button" onClick={() => void exportCsv()} disabled={!valid || exporting}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <CurrencyFilter value={currency} onChange={value=>{setCurrency(value);setPage(1);}} />
      {notice}
      <div className="card">
        <div className="row wrap">
          <div className="chips">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                className={'chip' + (p.key === preset ? ' active' : '')}
                aria-pressed={p.key === preset}
                type="button"
                onClick={() => applyPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="muted small">
            {from} → {to}
          </span>
        </div>
        <div className="row wrap" style={{ marginTop: '.6rem' }}>
          <div className="row">
            <label className="muted small" htmlFor="revenue-from">From</label>
            <input className="input" type="date" id="revenue-from" value={from} aria-invalid={!valid || undefined} aria-describedby={!valid ? 'revenue-range-error' : undefined} onChange={(e) => changeDate('from', e.target.value)} />
          </div>
          <div className="row">
            <label className="muted small" htmlFor="revenue-to">To</label>
            <input className="input" type="date" id="revenue-to" value={to} aria-invalid={!valid || undefined} aria-describedby={!valid ? 'revenue-range-error' : undefined} onChange={(e) => changeDate('to', e.target.value)} />
          </div>
        </div>
      </div>

      {!valid ? <div id="revenue-range-error" role="alert">Enter valid dates with From on or before To.</div> : null}
      <p className="muted small">Reporting calendar: {REPORTING_TIMEZONE}. Records use settlement date, newest first. Displayed start times are in this timezone.</p>
      {res ? <>
      <dl className="summary-strip" aria-label="Selected range totals">
        <SummaryItem label="Charge sessions" value={num(totals.count)} />
        <SummaryItem label="Energy" value={kwh(totals.energyKwh)} />
        <SummaryItem label="Gross" value={money(totals.gross,totals.currency)} />
        <SummaryItem label="Platform fee" value={money(totals.platformFee,totals.currency)} />
        <SummaryItem label="Net payout" value={money(totals.netPayout,totals.currency)} />
      </dl>

      <div className="stack ledger-layout">
        <div>
          {rows.length === 0 ? (
            <div className="card empty">No settled sessions in this range.</div>
          ) : (
            <div className="table-wrap">
              <table className="table ledger-table">
                <thead>
                  <tr>
                    <th>Session start</th>
                    {['Station', 'EVSE', 'Energy', 'Minutes', 'Tariff', 'Gross', 'Fee', 'Net', 'Record'].map((h) => (
                      <th key={h} className={['Station', 'EVSE'].includes(h) ? undefined : 'numeric'}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="clickable" onClick={() => setCdrId(r.id)}>
                      <td>{fmtDateTime(r.startTime)}</td>
                      <td>{r.stationName}</td>
                      <td>{r.evseUid}</td>
                      <td className="numeric">{kwh(r.energyKwh)}</td>
                      <td className="numeric">{String(r.minutes)}</td>
                      <td className="numeric">{tariff(r.tariffPerKwh,r.currency)}</td>
                      <td className="numeric">{money(r.gross,r.currency)}</td>
                      <td className="numeric">{money(r.platformFee,r.currency)}</td>
                      <td className="numeric">{money(r.netPayout,r.currency)}</td>
                      <td><button type="button" className="btn btn-sm" aria-label={'View record for ' + r.evseUid + ' at ' + fmtDateTime(r.startTime)} onClick={e => { e.stopPropagation(); setCdrId(r.id); }}>View</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Whole-range totals</td>
                    <td className="numeric">{kwh(totals.energyKwh)}</td>
                    <td />
                    <td />
                    <td className="numeric">{money(totals.gross,totals.currency)}</td>
                    <td className="numeric">{money(totals.platformFee,totals.currency)}</td>
                    <td className="numeric">{money(totals.netPayout,totals.currency)}</td><td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <div className="row wrap" style={{ justifyContent: 'flex-end', marginTop: '.6rem' }}>
            <button className="btn btn-sm" type="button" disabled={resource.loading || page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </button>
            <span className="muted small">
              Page {page} of {pages}
            </span>
            <button className="btn btn-sm" type="button" disabled={resource.loading || page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Payouts</h3>
          </div>
          <DetailLine label="Bank" value={(profileView.bankName || '—') + ' · ' + (profileView.bankAccountNo || '—')} />
          <DetailLine label="Cycle" value={profileView.payoutCycle || 'MONTHLY'} />
          <DetailLine label="Scheduled cycle date (demo)" value={cycleFor(profileView.payoutCycle || 'MONTHLY').next} />
          <PayoutEstimate cycle={profileView.payoutCycle || 'MONTHLY'} currency={currency} />
        </div>
      </div>
      </> : null}
    </div>
  );
}
