import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="auth-card" style={{ textAlign: 'center' }}>
      <h1>Page not found</h1>
      <p className="muted">That screen does not exist.</p>
      <Link className="btn btn-primary" to="/overview">
        Back to the portal
      </Link>
    </div>
  );
}
