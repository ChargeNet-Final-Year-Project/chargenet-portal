// The masked account number means "unchanged" until the operator replaces it.
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Field, LoadNotice, FormError } from '../ui/components';
import { toast } from '../ui/toast';
import { fmtDate } from '../ui/format';
import { CPOProfile } from '../types';

const BANKS = ['Maybank', 'CIMB', 'Public Bank', 'RHB', 'Hong Leong', 'AmBank', 'Other'];

export default function Company() {
  const { profile, setProfile } = useAuth();
  const [loading, setLoading] = useState(!profile);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [colorHex, setColorHex] = useState('');
  const [bankName, setBankName] = useState('Other');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [payoutCycle, setPayoutCycle] = useState('MONTHLY');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Direct navigation may arrive before the shell has loaded the profile.
  const loadProfile = useCallback(async () => {
    setLoading(true);
    try { setProfile(await api<CPOProfile>('/admin/api/cpo')); setLoadError(null); }
    catch (error) { setLoadError((error as ApiError).message); }
    finally { setLoading(false); }
  }, [setProfile]);
  useEffect(() => { if (!profile) void loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setContactEmail(profile.contactEmail);
    setBaseUrl(profile.baseUrl);
    setColorHex(profile.colorHex);
    setBankName(BANKS.includes(profile.bankName) ? profile.bankName : 'Other');
    setAccountHolder(profile.bankAccountHolder);
    setAccountNo(profile.bankAccountNo);
    setPayoutCycle(profile.payoutCycle || 'MONTHLY');
  }, [profile]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSubmitError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      const updated = await api<CPOProfile>('/admin/api/cpo', {
        method: 'PUT',
        body: {
          name: name.trim(),
          contactEmail: contactEmail.trim(),
          baseUrl: baseUrl.trim(),
          colorHex: colorHex.trim(),
          payoutCycle,
          bank: { bankName, accountHolder: accountHolder.trim(), accountNo: accountNo.trim() },
        },
      });
      setProfile(updated);
      setAccountNo(updated.bankAccountNo);
      toast('Company details saved.', 'ok');
    } catch (err) {
      const apiErr = err as ApiError;
      if (Object.keys(apiErr.fields).length) {
        const mapped: Record<string, string> = {};
        for (const [path, msg] of Object.entries(apiErr.fields)) mapped[path.replace(/\./g, '_')] = msg;
        setFieldErrors(mapped);
      } else {
        setSubmitError(apiErr.message);
      }
    }
    setSaving(false);
  }

  if (!profile) return <div className="stack"><h1>Company & billing</h1><LoadNotice loading={loading} error={loadError} hasData={false} onRetry={() => void loadProfile()} label="company profile" /></div>;

  return (
    <div className="stack">
      <h1>Company & billing</h1>
      <form noValidate className="stack" onSubmit={onSubmit}>
        <FormError message={submitError} />
        <div className="card">
          <div className="card-head">
            <h2>Company</h2>
          </div>
          <div className="field-grid">
            <Field required label="Company name" error={fieldErrors.name}>
              <input className="input" name="name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field required label="Contact email" error={fieldErrors.contactEmail}>
              <input className="input" name="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </Field>
          </div>
          <div className="field-grid">
            <Field label="Base URL" hint="Your OCPI API root; ChargeNet appends /versions." error={fieldErrors.baseUrl}>
              <input className="input" name="baseUrl" value={baseUrl} placeholder="https://api.cpo.com/ocpi" onChange={(e) => setBaseUrl(e.target.value)} />
            </Field>
            <Field label="Brand colour" hint="Used in the driver app." error={fieldErrors.colorHex}>
              <input className="input" name="colorHex" value={colorHex} placeholder="#5B21B6" onChange={(e) => setColorHex(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Billing & payouts</h2>
          </div>
          <div className="field-grid">
            <Field label="Bank" error={fieldErrors.bank_bankName}>
              <select className="select" name="bank_bankName" value={bankName} onChange={(e) => setBankName(e.target.value)}>
                {BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
            <Field required label="Account holder" error={fieldErrors.bank_accountHolder}>
              <input className="input" name="bank_accountHolder" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
            </Field>
          </div>
          <div className="field-grid">
            <Field required label="Account number" hint="Shown masked; type a new number to replace it." error={fieldErrors.bank_accountNo}>
              <input className="input" name="bank_accountNo" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} />
            </Field>
            <Field label="Payout cycle" hint="How often ChargeNet pays out your net share.">
              <select className="select" name="payoutCycle" value={payoutCycle} onChange={(e) => setPayoutCycle(e.target.value)}>
                <option value="MONTHLY">Monthly</option>
                <option value="WEEKLY">Weekly</option>
              </select>
            </Field>
          </div>
          <p className="muted prose">
            Onboarded {fmtDate(profile.createdAt)} · country {profile.countryCode} · party {profile.partyId}
          </p>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
