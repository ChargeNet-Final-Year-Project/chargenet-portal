import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiBase, ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Badge, Field, FormError, LoadNotice, useConfirm } from '../ui/components';
import { toast } from '../ui/toast';
import { copy } from '../ui/clipboard';
import { fmtDateTime } from '../ui/format';
import { CPOProfile, HandshakeStep } from '../types';

const KNOWN_STATUS: Record<string, string> = {
  NOT_STARTED: 'not-started',
  IN_PROGRESS: 'in-progress',
  VERIFIED: 'verified',
  FAILED: 'failed',
};

function maskToken(t: string): string {
  return !t ? '' : t.length <= 10 ? '••••••' : t.slice(0, 6) + '••••••' + t.slice(-4);
}

function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="row wrap">
        <span className={mono ? 'token' : ''}>{value || '—'}</span>
        <button className="btn btn-sm" type="button" onClick={() => void copy(value, label + ' copied')}>
          Copy
        </button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="spread small">
      <span className="muted">{label}</span>
      <span className="token">{value}</span>
    </div>
  );
}

function StepNode({ s }: { s: HandshakeStep }) {
  const kind = (s.status || '').toLowerCase();
  const mark = s.status === 'PASS' ? '✔' : s.status === 'FAIL' ? '✖' : '–';
  return (
    <div className="check">
      <span className={'mark ' + kind}>{mark}</span>
      <div className="body">
        <div className="label">
          {s.step}. {s.label}
        </div>
        {s.detail ? <div className="detail">{s.detail}</div> : null}
      </div>
      <span className="ms">{s.durationMs != null ? s.durationMs + ' ms' : ''}</span>
    </div>
  );
}

export default function Credentials() {
  const { profile, setProfile } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [loading, setLoading] = useState(!profile);
  const [loadError, setLoadError] = useState<string | null>(null);
  const operation = useRef(false);
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [endpointError, setEndpointError] = useState<string | undefined>();
  const [revealed, setRevealed] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [steps, setSteps] = useState<HandshakeStep[] | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try { setProfile(await api<CPOProfile>('/admin/api/cpo')); setLoadError(null); }
    catch (error) { setLoadError((error as ApiError).message); }
    finally { setLoading(false); }
  }, [setProfile]);
  useEffect(() => { if (!profile) void loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (profile) setBaseUrl(profile.baseUrl || '');
    setRevealed(false);
  }, [profile]);

  if (!profile) return <div className="stack"><h1>Connect your OCPI platform</h1><LoadNotice loading={loading} error={loadError} hasData={false} onRetry={() => void loadProfile()} label="company profile" /></div>;
  const p = profile;

  const versionsURL = apiBase() + '/ocpi/emsp/versions';
  const used = profile.tokenAUsed;
  const tokenA = profile.tokenA || '';

  async function regenerate() {
    if (operation.current) return;
    setOperationError(null);
    operation.current = true;
    try {
      const ok = await confirm('Issue a new Token A? Any token you already shared stops working.', {
        confirmLabel: 'Regenerate',
        danger: true,
      });
      if (!ok) return;
      setBusy(true);
      try {
        const res = await api<{ tokenA: string }>('/admin/api/cpo/token-a/regenerate', { method: 'POST' });
        setProfile({ ...p, tokenA: res.tokenA, tokenAUsed: false });
        setRevealed(false);
        toast('A new Token A was issued.', 'ok');
      } catch (err) {
        setOperationError((err as ApiError).message);
      }

    } finally { operation.current = false; setBusy(false); }
  }

  async function saveEndpoint() {
    if (operation.current) return;
    setOperationError(null);
    operation.current = true; setBusy(true);
    try {
      setEndpointError(undefined);
      setSaving(true);
      try {
        const updated = await api<CPOProfile>('/admin/api/cpo', {
          method: 'PUT',
          body: {
            name: p.name,
            baseUrl: baseUrl.trim(),
            contactEmail: p.contactEmail,
            colorHex: p.colorHex,
            payoutCycle: p.payoutCycle,
            bank: { bankName: p.bankName, accountHolder: p.bankAccountHolder, accountNo: p.bankAccountNo },
          },
        });
        setProfile(updated);
        toast('Endpoint saved.', 'ok');
      } catch (err) {
        const failure = err as ApiError;
        if (failure.fields.baseUrl) setEndpointError(failure.fields.baseUrl);
        else setOperationError(failure.message);
      }
      setSaving(false);

    } finally { operation.current = false; setBusy(false); }
  }

  async function runHandshake() {
    if (operation.current) return;
    setOperationError(null);
    operation.current = true; setBusy(true);
    try {
      setTesting(true);
      setSteps(null);
      setResult(null);
      try {
        const res = await api<{ status: string; steps: HandshakeStep[] }>('/admin/api/cpo/handshake-test', { method: 'POST' });
        setSteps(res.steps || []);
        const ok = res.status === 'VERIFIED';
        const fresh = await api<CPOProfile>('/admin/api/cpo');
        setResult({
          ok,
          message: ok
            ? fresh.status === 'ACTIVE'
              ? 'Connection verified. Your company is approved.'
              : 'Connection verified. Administrator approval is still required before drivers can use your stations.'
            : 'Verification failed. Fix the failing step, then test again.',
        });
        setProfile(fresh);
      } catch (err) {
        setResult({ ok: false, message: (err as ApiError).message });
      }
      setTesting(false);

    } finally { operation.current = false; setBusy(false); }
  }

  async function disconnect() {
    if (operation.current) return;
    setOperationError(null);
    operation.current = true;
    try {
      const ok = await confirm(
        'Disconnect your OCPI platform? ChargeNet stops calling it and your bays stop receiving commands until you reconnect. Your account, network and payouts are unaffected.',
        { confirmLabel: 'Disconnect', danger: true },
      );
      if (!ok) return;
      setBusy(true);
      try {
        await api('/admin/api/cpo/disconnect', { method: 'POST' });
        const fresh = await api<CPOProfile>('/admin/api/cpo');
        setProfile(fresh);
        toast('Platform disconnected. Register again before running verification.', 'ok');
      } catch (err) {
        setOperationError((err as ApiError).message);
      }

    } finally { operation.current = false; setBusy(false); }
  }

  return (
    <div className="stack">
      {dialog}
      <h1>Connect your OCPI platform</h1>
      <FormError message={operationError} />
      {profile.status === 'PENDING' ? <p className="muted prose">Awaiting administrator approval. You can configure and verify your connection; your stations remain hidden from drivers until approved.</p> : null}

      <div className="card">
        <div className="spread wrap">
          <div className="row wrap">
            <Badge text={'Handshake ' + profile.handshakeStatus} kind={KNOWN_STATUS[profile.handshakeStatus]} />
            <Badge text={'Company ' + profile.status} kind={profile.status} />
          </div>
          <div className="muted small">
            {profile.handshakeAt ? 'Last tested ' + fmtDateTime(profile.handshakeAt) : 'Never tested'}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>1 · Give these to your OCPI platform</h2>
        </div>
        <p className="muted prose">Your platform registers with ChargeNet before verification.</p>
        <CopyRow label="Versions URL" value={versionsURL} />
        <div className="field">
          <div className="field-label">Token A (one-time registration token)</div>
          <div className="row wrap">
            <span className="token">{used ? 'Consumed — no longer valid' : revealed ? tokenA : maskToken(tokenA)}</span>
            <button
              className="btn btn-sm"
              type="button"
              disabled={used || !tokenA}
              onClick={() => setRevealed((r) => !r)}
            >
              {revealed ? 'Hide' : 'Reveal'}
            </button>
            <button className="btn btn-sm" type="button" disabled={used || !tokenA} onClick={() => void copy(tokenA, 'Token A copied')}>
              Copy
            </button>
            <button className="btn btn-sm" type="button" disabled={used || busy} onClick={() => void regenerate()}>
              Regenerate
            </button>
          </div>
        </div>
        <Detail label="Country / party id" value={profile.countryCode + ' / ' + profile.partyId} />
        <Detail label="Supported OCPI version" value={profile.ocpiVersion || '2.3.0'} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>2 · Your OCPI endpoint</h2>
        </div>
        <p className="muted prose">Where ChargeNet sends its handshake and pulls your locations and tariffs.</p>
        <Field label="Base URL" hint="Your OCPI API root; ChargeNet appends /versions." error={endpointError}>
          <input className="input" value={baseUrl} placeholder="https://api.cpo.com/ocpi" onChange={(e) => setBaseUrl(e.target.value)} />
        </Field>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void saveEndpoint()}>
          {saving ? 'Saving…' : 'Save endpoint'}
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>3 · Verify the connection</h2>
        </div>
        <p className="muted prose">After your platform registers using Token A, this test checks the stored credentials, versions, locations and tariffs. It does not perform registration.</p>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void runHandshake()}>
          {testing ? 'Testing…' : 'Run handshake test'}
        </button>
        <div style={{ marginTop: '.75rem' }}>
          {testing && steps === null ? <p className="muted prose" role="status">Contacting your platform…</p> : null}
          {steps && steps.map((s) => <StepNode key={s.step} s={s} />)}
          {result ? result.ok ? <div className="banner ok" role="status">{result.message}</div> : <FormError message={result.message} /> : null}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Tokens B & C</h2>
        </div>
        <p className="muted prose">Stored automatically during registration. Shown only as a last-4 hint — the full values never leave ChargeNet.</p>
        <div className="spread small" style={{ padding: '.35rem 0' }}>
          <span className="muted">Token B — ChargeNet authenticates to you</span>
          {profile.tokenBSet ? (
            <span className="row">
              <Badge text="Registered" kind="verified" />
              <span className="token">{'••••' + (profile.tokenBLast4 || '')}</span>
            </span>
          ) : (
            <Badge text="Not set" kind="not-started" />
          )}
        </div>
        <div className="spread small" style={{ padding: '.35rem 0' }}>
          <span className="muted">Token C — you authenticate to ChargeNet</span>
          {profile.tokenCSet ? (
            <span className="row">
              <Badge text="Registered" kind="verified" />
              <span className="token">{'••••' + (profile.tokenCLast4 || '')}</span>
            </span>
          ) : (
            <Badge text="Not set" kind="not-started" />
          )}
        </div>
        <div className="row" style={{ marginTop: '.75rem' }}>
          <button className="btn" type="button" disabled title="Credential rotation is out of scope for this release.">
            Rotate
          </button>
          <button className="btn btn-danger" type="button" disabled={busy || !(profile.tokenBSet || profile.tokenCSet)} onClick={() => void disconnect()}>
            Disconnect
          </button>
        </div>
      </div>

      <div className="card">
        <h3>How the handshake works</h3>
        <ol className="small" style={{ paddingLeft: '1.1rem' }}>
          <li>You share the Versions URL and Token A with your OCPI platform.</li>
          <li>Your platform supplies Token B during registration; ChargeNet uses it to authenticate to your platform.</li>
          <li>ChargeNet returns Token C for your platform to authenticate to ChargeNet.</li>
          <li>Run the handshake test to verify every step end to end.</li>
        </ol>
      </div>
    </div>
  );
}
