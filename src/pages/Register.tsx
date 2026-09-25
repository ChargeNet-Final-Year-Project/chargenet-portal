// Server field errors reopen the wizard step that owns the field.
import { ChangeEvent, FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Field, FormError } from '../ui/components';
import { toast } from '../ui/toast';

const BANKS = ['Maybank', 'CIMB', 'Public Bank', 'RHB', 'Hong Leong', 'AmBank', 'Other'];
const STEP_TITLES = ['Company', 'Account', 'Billing', 'Review'];

const FIELD_STEP: Record<string, number> = {
  companyName: 0,
  countryCode: 0,
  partyId: 0,
  baseUrl: 0,
  contactName: 1,
  contactEmail: 1,
  password: 1,
  'bank.bankName': 2,
  'bank.accountHolder': 2,
  'bank.accountNo': 2,
  payoutCycle: 2,
};

interface FormState {
  companyName: string;
  countryCode: string;
  partyId: string;
  baseUrl: string;
  contactName: string;
  contactEmail: string;
  password: string;
  confirm: string;
  bankName: string;
  accountHolder: string;
  accountNo: string;
  payoutCycle: string;
}

export default function Register() {
  const { boot } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    companyName: '',
    countryCode: 'MY',
    partyId: '',
    baseUrl: '',
    contactName: '',
    contactEmail: '',
    password: '',
    confirm: '',
    bankName: 'Maybank',
    accountHolder: '',
    accountNo: '',
    payoutCycle: 'MONTHLY',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set =
    (k: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate(current: number): boolean {
    const errs: Record<string, string> = {};
    if (current === 0) {
      if (!form.companyName.trim()) errs.companyName = 'Company name is required.';
      if (!/^[A-Za-z]{2}$/.test(form.countryCode.trim())) errs.countryCode = 'Country code must be two letters.';
      if (!/^[A-Za-z0-9]{3}$/.test(form.partyId.trim())) errs.partyId = 'Party id must be exactly 3 letters or digits.';
    } else if (current === 1) {
      if (!form.contactName.trim()) errs.contactName = 'Contact name is required.';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.contactEmail.trim())) errs.contactEmail = 'Enter a valid email address.';
      if (form.password.length < 8) errs.password = 'Password must be at least 8 characters.';
      if (form.confirm !== form.password) errs.confirm = 'Passwords do not match.';
    } else if (current === 2) {
      if (!form.accountHolder.trim()) errs.bank_accountHolder = 'Account holder is required.';
      if (!/^[0-9]{8,20}$/.test(form.accountNo.trim())) errs.bank_accountNo = 'Account number must be 8–20 digits.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function payload() {
    return {
      companyName: form.companyName.trim(),
      partyId: form.partyId.trim().toUpperCase(),
      countryCode: form.countryCode.trim().toUpperCase(),
      baseUrl: form.baseUrl.trim(),
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      password: form.password,
      bank: { bankName: form.bankName, accountHolder: form.accountHolder.trim(), accountNo: form.accountNo.trim() },
      payoutCycle: form.payoutCycle,
    };
  }

  function next() {
    if (validate(step)) setStep(step + 1);
  }

  function back() {
    setStep(Math.max(0, step - 1));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!form.password) {
      setStep(1);
      return;
    }
    setFieldErrors({});
    setError(null);
    setSubmitting(true);
    try {
      await api('/admin/api/register', { method: 'POST', body: payload() });
      toast('Welcome to ChargeNet — connect your OCPI platform next.', 'ok');
      await boot();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.fields && Object.keys(apiErr.fields).length) {
        const mapped: Record<string, string> = {};
        let firstStep: number | undefined;
        for (const [path, msg] of Object.entries(apiErr.fields)) {
          mapped[path.replace(/\./g, '_')] = msg;
          if (firstStep === undefined && FIELD_STEP[path] !== undefined) firstStep = FIELD_STEP[path];
        }
        setFieldErrors(mapped);
        setStep(firstStep ?? 0);
      } else {
        setError(apiErr.message);
      }
      setSubmitting(false);
    }
  }

  const review = payload();

  return (
    <div className="auth">
      <div className="auth-card wide">
        <div className="auth-logo">
          <span className="dot">CN</span>
          <span>ChargeNet Partner Portal</span>
        </div>
        <h1>Register your company</h1>
        <p className="muted">Three steps, then connect your OCPI platform.</p>

        <div className="stepper">
          {STEP_TITLES.map((title, i) => (
            <span key={title} style={{ display: 'contents' }}>
              <span aria-current={i === step ? 'step' : undefined} className={'step' + (i === step ? ' active' : i < step ? ' done' : '')}>
                <span className="n">{i < step ? '✓' : String(i + 1)}</span>
                {title}
              </span>
              {i < STEP_TITLES.length - 1 ? <span className="sep" aria-hidden="true" /> : null}
            </span>
          ))}
        </div>

        <form noValidate onSubmit={submit}>
          <FormError message={error} />

          {step === 0 && (
            <section className="stack">
              <Field required label="Company name" error={fieldErrors.companyName}>
                <input className="input" name="companyName" placeholder="AcmeCharge Sdn Bhd" autoComplete="organization" value={form.companyName} onChange={set('companyName')} />
              </Field>
              <div className="field-grid">
                <Field required label="Country code" hint="The company registration country. Station countries and tariff currencies are independent." error={fieldErrors.countryCode}>
                  <select className="select" name="countryCode" value={form.countryCode} onChange={set('countryCode')}><option value="MY">Malaysia (MY)</option><option value="SG">Singapore (SG)</option><option value="TH">Thailand (TH)</option></select>
                </Field>
                <Field required label="Party ID" hint="Your OCPI party id, e.g. VLT. Exactly 3 letters or digits." error={fieldErrors.partyId}>
                  <input className="input" name="partyId" maxLength={3} placeholder="ACM" style={{ textTransform: 'uppercase' }} value={form.partyId} onChange={set('partyId')} />
                </Field>
              </div>
              <Field label="CPO base URL (optional)" hint="Your OCPI API root; ChargeNet appends /versions. You can add this later.">
                <input className="input" name="baseUrl" type="url" placeholder="https://api.cpo.com/ocpi" value={form.baseUrl} onChange={set('baseUrl')} />
              </Field>
            </section>
          )}

          {step === 1 && (
            <section className="stack">
              <Field required label="Contact name" error={fieldErrors.contactName}>
                <input className="input" name="contactName" autoComplete="name" placeholder="Jane Tan" value={form.contactName} onChange={set('contactName')} />
              </Field>
              <Field required label="Email" error={fieldErrors.contactEmail}>
                <input className="input" name="contactEmail" type="email" autoComplete="email" placeholder="jane@acme.my" value={form.contactEmail} onChange={set('contactEmail')} />
              </Field>
              <div className="field-grid">
                <Field required label="Password" hint="At least 8 characters." error={fieldErrors.password}>
                  <input className="input" name="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
                </Field>
                <Field required label="Confirm password" error={fieldErrors.confirm}>
                  <input className="input" name="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
                </Field>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="stack">
              <Field label="Bank" hint="Where ChargeNet sends your payouts.">
                <select className="select" name="bankName" value={form.bankName} onChange={set('bankName')}>
                  {BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
              <Field required label="Account holder" error={fieldErrors.bank_accountHolder}>
                <input className="input" name="bank_accountHolder" autoComplete="name" placeholder="AcmeCharge Sdn Bhd" value={form.accountHolder} onChange={set('accountHolder')} />
              </Field>
              <Field required label="Account number" hint="8–20 digits." error={fieldErrors.bank_accountNo}>
                <input className="input" name="bank_accountNo" inputMode="numeric" placeholder="1234567890" value={form.accountNo} onChange={set('accountNo')} />
              </Field>
              <Field label="Payout cycle">
                <select className="select" name="payoutCycle" value={form.payoutCycle} onChange={set('payoutCycle')}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
              </Field>
              <div className="banner info">
                <div>
                  <strong>Platform fee</strong>
                  ChargeNet charges 5 % per completed session, settled net of the fee.
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="stack">
              <h3>Check your details</h3>
              <div className="spread small">
                <span className="muted">Company</span>
                <span>{review.companyName || '—'}</span>
              </div>
              <div className="spread small">
                <span className="muted">Country / party id</span>
                <span>{review.countryCode + ' / ' + review.partyId}</span>
              </div>
              <div className="spread small">
                <span className="muted">Base URL</span>
                <span>{review.baseUrl || '—'}</span>
              </div>
              <div className="spread small">
                <span className="muted">Contact</span>
                <span>{review.contactName + ' · ' + review.contactEmail}</span>
              </div>
              <div className="spread small">
                <span className="muted">Bank</span>
                <span>{review.bank.bankName + ' · ' + review.bank.accountHolder}</span>
              </div>
              <div className="spread small">
                <span className="muted">Account number</span>
                <span>{review.bank.accountNo}</span>
              </div>
              <div className="spread small">
                <span className="muted">Payout cycle</span>
                <span>{review.payoutCycle}</span>
              </div>
            </section>
          )}

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
            {step > 0 && (
              <button className="btn" type="button" onClick={back}>
                Back
              </button>
            )}
            {step < 3 ? (
              <button className="btn btn-primary" type="button" onClick={next}>
                Next
              </button>
            ) : (
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Creating your account…' : 'Create account'}
              </button>
            )}
          </div>
        </form>

        <p className="muted prose" style={{ marginTop: '1rem' }}>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
