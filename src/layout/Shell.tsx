import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Badge } from '../ui/components';
import { Role } from '../types';
import { Icon, IconName } from '../ui/icon';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}
const NAV: Record<Role, NavItem[]> = {
  CPO: [
    { path: '/overview', label: 'Overview', icon: 'overview' },
    { path: '/network', label: 'Network', icon: 'network' },
    { path: '/ledger', label: 'Revenue', icon: 'revenue' },
    { path: '/credentials', label: 'Credentials', icon: 'key' },
    { path: '/company', label: 'Company', icon: 'company' },
    { path: '/sandbox', label: 'Sandbox', icon: 'sandbox' },
  ],
  SUPER_ADMIN: [{ path: '/admin', label: 'Partners', icon: 'partners' }],
};

export default function Shell() {
  const { user, profile, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 901px)').matches);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 901px)');
    const update = () => setWide(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (!user) return null;
  const items = NAV[user.role] || [];

  return (
    <div className="app">
      <aside className={'sidebar' + (menuOpen ? ' open' : '')} id="sidebar" hidden={!wide && !menuOpen}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setMenuOpen(false);
            menuButton.current?.focus();
          }
        }}>
        <div className="logo">
          <span className="dot">CN</span>
          <span>
            ChargeNet
            <small>Partner Portal</small>
          </span>
        </div>
        <nav className="nav">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              data-nav={item.path}
              className={({ isActive }) => (isActive ? 'active' : '')}
              onClick={() => setMenuOpen(false)}
            >
              <span className="ico" aria-hidden="true">
                <Icon name={item.icon} />
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="userbox">
          <div className="who">{user.name}</div>
          <div className="muted small">{user.email}</div>
          <div className="row" style={{ marginTop: '.5rem' }}>
            <Badge text={user.role === 'SUPER_ADMIN' ? 'Super admin' : 'CPO'} kind="neutral" />
            <button className="btn btn-sm" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="row">
            <button ref={menuButton} className="btn btn-sm menu-btn" aria-label="Toggle menu" aria-controls="sidebar" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
              <Icon name="menu" />
            </button>
            <span className="portal-context">{user.role === 'SUPER_ADMIN' ? 'Administration' : 'Partner portal'}</span>
          </div>
          <div className="muted small no-wrap">OCPI {profile?.ocpiVersion || '2.3.0'}</div>
        </header>
        <main className="content" id="view">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
