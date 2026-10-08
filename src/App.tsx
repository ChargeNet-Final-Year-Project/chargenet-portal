// Hash routing avoids server-side rewrite rules for static hosting.
import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Shell from './layout/Shell';
import { Role } from './types';
import Login from './pages/Login';
import Register from './pages/Register';
import Credentials from './pages/Credentials';
import Company from './pages/Company';
import Overview from './pages/Overview';
import Network from './pages/Network';
import Ledger from './pages/Ledger';
import Sandbox from './pages/Sandbox';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

function BootScreen() {
  return (
    <div className="boot">
      <div className="boot-card">
        <h1 className="brand-mark">ChargeNet CPO portal</h1>
        <p className="muted">Loading…</p>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading, homePath } = useAuth();
  if (loading) return <BootScreen />;
  if (user) return <Navigate to={homePath()} replace />;
  return <>{children}</>;
}

function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, homePath } = useAuth();
  if (user && roles && !roles.includes(user.role)) {
    return <Navigate to={homePath()} replace />;
  }
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading, homePath } = useAuth();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homePath()} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <Register />
          </PublicOnly>
        }
      />
      <Route path="/" element={<HomeRedirect />} />

      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route
          path="/overview"
          element={
            <RoleGuard roles={['CPO']}>
              <Overview />
            </RoleGuard>
          }
        />
        <Route
          path="/network"
          element={
            <RoleGuard roles={['CPO']}>
              <Network />
            </RoleGuard>
          }
        />
        <Route
          path="/credentials"
          element={
            <RoleGuard roles={['CPO']}>
              <Credentials />
            </RoleGuard>
          }
        />
        <Route
          path="/company"
          element={
            <RoleGuard roles={['CPO']}>
              <Company />
            </RoleGuard>
          }
        />
        <Route
          path="/ledger"
          element={
            <RoleGuard roles={['CPO']}>
              <Ledger />
            </RoleGuard>
          }
        />
        <Route
          path="/sandbox"
          element={
            <RoleGuard roles={['CPO']}>
              <Sandbox />
            </RoleGuard>
          }
        />
        <Route
          path="/admin"
          element={
            <RoleGuard roles={['SUPER_ADMIN']}>
              <Admin />
            </RoleGuard>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
