import { CurrencyFilter } from '../ui/CurrencyFilter';
import { useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { Badge, BarChart, Field, FormError, SummaryItem, Modal, LoadNotice, useConfirm, BarPoint } from '../ui/components';
import { toast } from '../ui/toast';
import { money, num } from '../ui/format';
import { useResource } from '../ui/useResource';
import { AdminCPO, AdminOverview } from '../types';

function FeeModal({ cpo, onClose, onSaved }: { cpo: AdminCPO; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const [value, setValue] = useState(String(cpo.platformFeePct));

  async function save() {
    if (savingRef.current) return;
    const v = Number(value);
    if (!value.trim() || Number.isNaN(v) || v < 0 || v > 20) {
      setFieldError('Platform fee must be between 0 and 20 %.');
      return;
    }
    setFieldError(undefined);
    setSubmitError(null);
    savingRef.current = true; setSaving(true);
    try {
      await api('/admin/api/admin/cpos/' + cpo.id + '/status', {
        method: 'PUT',
        body: { status: cpo.status, platformFeePct: v },
      });
      toast('Platform fee updated.', 'ok');
      onSaved();
    } catch (err) {
      setSubmitError((err as ApiError).message);
    } finally { savingRef.current = false; setSaving(false); }
  }

  return (
    <Modal
      title={'Platform fee — ' + cpo.name}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <FormError message={submitError} />
      <Field required label="Platform fee (%)" hint="ChargeNet's cut per completed session (0–20 %)." error={fieldError}>
        <input className="input" type="number" min="0" max="20" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
    </Modal>
  );
}

export default function Admin() {
  const { confirm, dialog } = useConfirm();
  const [currency,setCurrency]=useState('MYR');
  const overviewResource = useResource<AdminOverview>('/admin/api/admin/overview?currency='+currency);
  const partnersResource = useResource<{ cpos: AdminCPO[] }>('/admin/api/admin/cpos?currency='+currency);
  const overview = overviewResource.data;
  const cpos = partnersResource.data?.cpos ?? null;
  const [editing, setEditing] = useState<AdminCPO | null>(null);
  const busy = useRef(new Set<string>());
  const [busyIds, setBusyIds] = useState(new Set<string>());
  async function load() { await Promise.all([overviewResource.refresh(), partnersResource.refresh()]); }

  async function setStatus(cpo: AdminCPO, status: string) {
    if (busy.current.has(cpo.id)) return;
    busy.current.add(cpo.id);
    try {
      if (status === 'SUSPENDED') {
        const ok = await confirm(
          'Suspend ' +
            cpo.name +
            '? Its stations are hidden from drivers in the app and no new sessions can start. Existing sessions and your records are unaffected.',
          { title: 'Suspend partner', confirmLabel: 'Suspend', danger: true },
        );
        if (!ok) return;
      } else if (status === 'PENDING') {
        const ok = await confirm(
          'Set ' + cpo.name + ' back to pending? Its stations are hidden from drivers until it is approved again.',
          { title: 'Set to pending', confirmLabel: 'Set pending' },
        );
        if (!ok) return;
      }
      setBusyIds(new Set(busy.current));
      try {
        await api('/admin/api/admin/cpos/' + cpo.id + '/status', { method: 'PUT', body: { status } });
        toast(cpo.name + ' is now ' + status.toLowerCase() + '.', 'ok');
        void load();
      } catch (err) {
        toast((err as ApiError).message, 'error');
      }

    } finally { busy.current.delete(cpo.id); setBusyIds(new Set(busy.current)); }
  }

  const points: BarPoint[] = ((overview?.last7Days) || []).map((d) => ({
    label: String(d.day),
    value: Math.round((d.gross || 0) * 100) / 100,
  }));

  return (
    <div className="stack">
      {dialog}
      {editing ? <FeeModal cpo={editing} onClose={() => setEditing(null)} onSaved={() => void load()} /> : null}
      <h1>Partners</h1>
      <CurrencyFilter value={currency} onChange={setCurrency} />
      <LoadNotice {...partnersResource} hasData={!!cpos} onRetry={() => void partnersResource.refresh()} label="partners" />

      {cpos ? <dl className="summary-strip" aria-label="Partner review">
        <SummaryItem label="Pending approval" value={num(cpos.filter(c => c.status === 'PENDING').length)} />
        <SummaryItem label="Failed handshakes" value={num(cpos.filter(c => c.handshakeStatus === 'FAILED').length)} />
        <SummaryItem label="Suspended" value={num(cpos.filter(c => c.status === 'SUSPENDED').length)} />
      </dl> : null}

      <div className="card">
        <div className="card-head">
          <h2>All CPO partners</h2>
        </div>
        <div className="table-wrap">
          <table className="table partner-table" role="table" aria-label="CPO partner review">
            <thead>
              <tr>
                {['Partner', 'Party', 'Status', 'Handshake', 'Fee', 'Stations', 'EVSEs', 'Sessions today', 'Gross today', 'Actions'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cpos?.length === 0 ? <tr><td colSpan={10}>No CPO partners yet.</td></tr> : null}
              {(cpos || []).map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td data-label="Party">{c.partyId}</td>
                  <td data-label="Status">
                    <Badge text={c.status} kind={c.status} />
                  </td>
                  <td data-label="Handshake">
                    <Badge text={c.handshakeStatus || 'NOT_STARTED'} kind={c.handshakeStatus || 'NOT_STARTED'} />
                  </td>
                  <td data-label="Fee">{c.platformFeePct.toFixed(1)} %</td>
                  <td data-label="Stations">{String(c.stations)}</td>
                  <td data-label="EVSEs">{String(c.evses)}</td>
                  <td data-label="Sessions today">{String(c.sessionsToday)}</td>
                  <td data-label="Gross today">{money(c.grossToday,c.currency)}</td>
                  <td>
                    <div className="row wrap">
                      {c.status !== 'ACTIVE' && (
                        <button className="btn btn-sm" type="button" disabled={busyIds.has(c.id)} onClick={() => void setStatus(c, 'ACTIVE')}>
                          Approve
                        </button>
                      )}
                      {c.status !== 'SUSPENDED' && (
                        <button className="btn btn-sm btn-danger" type="button" disabled={busyIds.has(c.id)} onClick={() => void setStatus(c, 'SUSPENDED')}>
                          Suspend
                        </button>
                      )}
                      {c.status !== 'PENDING' && (
                        <button className="btn btn-sm" type="button" disabled={busyIds.has(c.id)} onClick={() => void setStatus(c, 'PENDING')}>
                          Set pending
                        </button>
                      )}
                      <button className="btn btn-sm" type="button" disabled={busyIds.has(c.id)} onClick={() => setEditing(c)}>
                        Edit fee
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <LoadNotice {...overviewResource} hasData={!!overview} onRetry={() => void overviewResource.refresh()} label="network totals" />
      {overview ? <dl className="summary-strip" aria-label="Network totals">
        <SummaryItem label="Partners" value={num(overview?.cpos ?? 0)} />
        <SummaryItem label="Active partners" value={num(overview?.activeCpos ?? 0)} />
        <SummaryItem label="Stations" value={num(overview?.stations ?? 0)} />
        <SummaryItem label="EVSEs" value={num(overview?.evses ?? 0)} />
        <SummaryItem label="Sessions today" value={num(overview?.sessionsToday ?? 0)} />
        <SummaryItem label="Gross today" value={money(overview?.grossToday ?? 0,overview?.currency ?? currency)} />
      </dl> : null}

      {overview ? <div className="card">
        <div className="card-head">
          <h2>Network gross — last 7 days</h2>
        </div>
        <BarChart points={points} currency={overview?.currency ?? currency} />
      </div> : null}

    </div>
  );
}
