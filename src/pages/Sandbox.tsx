// Sandbox traces distinguish accepted requests from observed network status.
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Badge, Field, LoadNotice } from '../ui/components';
import { useResource } from '../ui/useResource';
import { TraceEntry, readSandboxTrace, appendSandboxTrace } from '../ui/sandboxTrace';
import { fmtTime } from '../ui/format';
import { NetworkView } from '../types';

const COMMANDS = [
  { value: 'START_SESSION', label: 'Start session — RemoteStartTransaction' },
  { value: 'STOP_SESSION', label: 'Stop session — RemoteStopTransaction' },
  { value: 'UNLOCK_CONNECTOR', label: 'Unlock connector — UnlockConnector' },
];


function TraceEntryView({ e }: { e: TraceEntry }) {
  const observed = e.kind === 'observation';
  return <div className="trace-entry">
    <div className="spread"><Badge text={observed ? e.outcome === 'changed' ? 'OBSERVED' : e.outcome === 'error' ? 'OBSERVATION FAILED' : 'NO CHANGE OBSERVED' : e.ok ? 'ACCEPTED' : 'REJECTED'} kind={observed ? e.outcome === 'error' ? 'FAILED' : 'neutral' : e.ok ? 'PASS' : 'FAIL'} /><span className="muted small">{e.at}</span></div>
    <p className="small muted">{e.note || 'Request'}</p>
    <pre className="json">{JSON.stringify(e.request, null, 2)}</pre>
    <div className="small muted">{observed ? 'Observation' : 'Response'}</div>
    <pre className="json">{JSON.stringify(e.response, null, 2)}</pre>
  </div>;
}

function pause(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(false); return; }
    const cancel = () => { clearTimeout(timer); resolve(false); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(true); }, ms);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

export default function Sandbox() {
  const { user } = useAuth();
  const owner = user?.id ?? '';
  const resource = useResource<NetworkView>('/admin/api/network');
  const net = resource.data;
  const [evseUid, setEvseUid] = useState('');
  const [command, setCommand] = useState('START_SESSION');
  const [targetSoc, setTargetSoc] = useState('80');
  const [targetError, setTargetError] = useState<string | undefined>();
  const [status, setStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [observation, setObservation] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceEntry[]>(() => readSandboxTrace(owner));
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const sendingRef = useRef(false);
  const refreshRef = useRef(false);
  const observer = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const selected = useRef(evseUid);
  selected.current = evseUid;
  useEffect(() => {
    alive.current = true; setTrace(readSandboxTrace(owner));
    return () => { alive.current = false; observer.current?.abort(); };
  }, [owner]);
  const conns = (net?.stations || []).flatMap(s => s.connectors || []);
  const evseOptions = (net?.stations || []).flatMap(s => (s.connectors || []).map(c => ({ value: c.evseUid, label: c.evseUid + ' · ' + s.name + ' · ' + c.status })));
  useEffect(() => {
    if (!net) return;
    if (!evseUid || !conns.some(c => c.evseUid === evseUid)) setEvseUid(conns[0]?.evseUid ?? '');
  }, [net]);
  useEffect(() => { setStatus(conns.find(c => c.evseUid === evseUid)?.status ?? null); setStatusError(null); }, [evseUid, net]);

  async function fetchStatus(uid: string, signal?: AbortSignal): Promise<string | null> {
    const network = await api<NetworkView>('/admin/api/network', { signal });
    return network.stations.flatMap(s => s.connectors || []).find(c => c.evseUid === uid)?.status ?? null;
  }
  async function refreshStatus() {
    if (refreshRef.current) return;
    refreshRef.current = true; setRefreshing(true);
    const uid = evseUid;
    try { const next = await fetchStatus(uid); if (alive.current && selected.current === uid) { setStatus(next); setStatusError(null); } }
    catch (error) { if (alive.current && selected.current === uid) setStatusError('Status refresh failed. ' + (error as ApiError).message + ' The displayed status may be out of date.'); }
    finally { refreshRef.current = false; if (alive.current) setRefreshing(false); }
  }
  function pushTrace(entry: TraceEntry) {
    if (!alive.current) return;
    const next = appendSandboxTrace(owner, entry);
    if (next) setTrace(next);
  }
  async function observeStatus(uid: string, before: string | null, signal: AbortSignal) {
    let latest = before;
    try {
      for (let i = 0; i < 6; i++) {
        if (!await pause(1500, signal)) return;
        latest = await fetchStatus(uid, signal);
        if (signal.aborted || !alive.current) return;
        if (selected.current === uid) { setStatus(latest); setStatusError(null); }
        if (before !== null && latest !== null && latest !== before) {
          pushTrace({ at: fmtTime(new Date()), ok: true, kind: 'observation', outcome: 'changed', note: 'Observed bay status change', request: { source: 'GET /admin/api/network polling', evseUid: uid }, response: { from: before, to: latest } });
          setObservation('Observed bay status change: ' + before + ' → ' + latest + '. This is a network poll, not an OCPI callback or confirmation of this command.');
          return;
        }
      }
      if (signal.aborted || !alive.current) return;
      if (before === null || latest === null) {
        const message = 'Could not compare bay status because the initial or latest reading was unavailable. Refresh status to retry.';
        setObservation(message);
        pushTrace({ at: fmtTime(new Date()), ok: false, kind: 'observation', outcome: 'error', note: 'Status comparison unavailable', request: { source: 'GET /admin/api/network polling', evseUid: uid }, response: { message, lastObservedStatus: latest } });
        return;
      }
      const message = 'No status change observed after 9 seconds. This does not confirm the command outcome; unlocking may leave bay status unchanged.';
      setObservation(message);
      pushTrace({ at: fmtTime(new Date()), ok: true, kind: 'observation', outcome: 'unchanged', note: 'Observation window ended', request: { source: 'GET /admin/api/network polling', evseUid: uid }, response: { message, lastObservedStatus: latest } });
    } catch (error) {
      if (signal.aborted || !alive.current) return;
      const message = 'Could not observe bay status. ' + (error as ApiError).message;
      setObservation(message);
      pushTrace({ at: fmtTime(new Date()), ok: false, kind: 'observation', outcome: 'error', note: 'Status observation failed', request: { source: 'GET /admin/api/network polling', evseUid: uid }, response: { message } });
    }
  }
  async function send() {
    if (sendingRef.current || !conns.some(c => c.evseUid === evseUid)) return;
    const target = Number(targetSoc);
    if (command === 'START_SESSION' && (!targetSoc.trim() || !Number.isFinite(target) || target < 0 || target > 100)) { setTargetError('Enter a target charge between 0 and 100%.'); return; }
    setTargetError(undefined);
    sendingRef.current = true; setSending(true);
    observer.current?.abort(); setObservation(null);
    const uid = evseUid;
    const request: Record<string, unknown> = { evseUid: uid, command };
    if (command === 'START_SESSION') request.targetSoc = target;
    const at = fmtTime(new Date());
    try {
      const before = await fetchStatus(uid).catch(() => null);
      if (!alive.current) return;
      const response = await api('/admin/api/sandbox/command', { method: 'POST', body: request });
      if (!alive.current) return;
      pushTrace({ at, ok: true, kind: 'command', request, response });
      const controller = new AbortController(); observer.current = controller;
      setObservation('Command accepted. Observing bay status for up to 9 seconds using network polling…');
      void observeStatus(uid, before, controller.signal);
    } catch (error) {
      if (!alive.current) return;
      const err = error as ApiError;
      pushTrace({ at, ok: false, kind: 'command', request, response: { error: err.code, message: err.message } });
      setObservation('Command rejected: ' + err.message);
    } finally { sendingRef.current = false; if (alive.current) setSending(false); }
  }

  const notice = <LoadNotice {...resource} hasData={!!net} onRetry={() => void resource.refresh()} label="sandbox bays" />;
  if (!net) return <div className="stack"><h1>Sandbox</h1>{notice}</div>;

  if (!conns.length) {
    return (
      <div className="stack">
        <h1>Sandbox</h1>
      {notice}
        <div className="card empty">You have no bays to test yet. Connect your OCPI platform first.</div>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>Sandbox</h1>
      {notice}
      <div className="banner warn">
        <div>
          <strong>Test commands only</strong>
          These commands bill ChargeNet's internal test driver. They are excluded from your revenue reports.
        </div>
      </div>
      <div className="two-col">
        <div className="card">
          <div className="card-head">
            <h2>Send a command</h2>
          </div>
          <Field required label="EVSE">
            <select className="select" name="evseUid" value={evseUid} onChange={(e) => setEvseUid(e.target.value)}>
              {evseOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field required label="Command">
            <select className="select" name="command" value={command} onChange={(e) => setCommand(e.target.value)}>
              {COMMANDS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          {command === 'START_SESSION' && (
            <Field required label="Target state of charge (%)" hint="Used by START_SESSION." error={targetError}>
              <input className="input" name="targetSoc" type="number" min="0" max="100" value={targetSoc} onChange={(e) => setTargetSoc(e.target.value)} />
            </Field>
          )}
          <div className="row wrap">
            <button className="btn btn-primary" type="button" disabled={sending || !evseUid} onClick={() => void send()}>
              {sending ? 'Sending…' : 'Send command'}
            </button>
            <button className="btn" type="button" disabled={refreshing} onClick={() => void refreshStatus()}>
              {refreshing ? 'Refreshing…' : 'Refresh status'}
            </button>
          </div>
          {statusError ? <div className="banner err" role="alert">{statusError} Use Refresh status to retry.</div> : null}
          {observation ? <p className="muted prose" role="status">{observation}</p> : null}
          <div className="row" style={{ marginTop: '.6rem' }}>
            <span className="muted small">Status: </span>
            {status ? <Badge text={status} kind={status} /> : <span className="muted small">unknown</span>}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Request / response trace</h2>
          </div>
          <div className="stack">
            {trace.length === 0 ? (
              <p className="muted prose">Send a command to see the request and response.</p>
            ) : (
              trace.map((e, i) => <TraceEntryView key={i} e={e} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
