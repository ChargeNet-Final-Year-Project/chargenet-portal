import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Field, FormError } from '../ui/components';

export default function Login() {
  const { boot } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await api('/admin/api/login', { method: 'POST', body: { email: email.trim(), password } });
      await boot();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.fields) setFieldErrors(apiErr.fields);
      setError(apiErr.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="dot">CN</span>
          <span>ChargeNet Partner Portal</span>
        </div>
        <h1>Sign in</h1>
        <p className="muted">Manage your OCPI credentials, network and payouts.</p>
        <form noValidate onSubmit={onSubmit}>
          <FormError message={error} />
          <Field required label="Email" error={fieldErrors.email}>
            <input
              className="input"
              type="email"
              name="email"
              autoComplete="username"
              placeholder="you@company.my"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </Field>
          <Field required label="Password" error={fieldErrors.password}>
            <input
              className="input"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="muted prose" style={{ marginTop: '1rem' }}>
          No account yet? <Link to="/register">Register your company</Link>
        </p>
      </div>
    </div>
  );
}
