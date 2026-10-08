import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setOnUnauthorized } from '../api';
import { clearSandboxTrace } from '../ui/sandboxTrace';
import { toast } from '../ui/toast';
import { CPOProfile, PortalUser } from '../types';

interface AuthValue {
  user: PortalUser | null;
  profile: CPOProfile | null;
  loading: boolean;
  boot: () => Promise<void>;
  logout: () => Promise<void>;
  setProfile: (p: CPOProfile | null) => void;
  homePath: () => string;
}

const AuthContext = createContext<AuthValue>(null as unknown as AuthValue);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [profile, setProfile] = useState<CPOProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const boot = useCallback(async () => {
    setLoading(true);
    try {
      const u = await api<PortalUser>('/admin/api/me');
      setUser(u);
      if (u.role === 'CPO') {
        try {
          setProfile(await api<CPOProfile>('/admin/api/cpo'));
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
    } catch {
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/admin/api/logout', { method: 'POST' });
    } catch {
      /* The server clears the cookie even if the response is lost. */
    }
    clearSandboxTrace();
    setUser(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      clearSandboxTrace();
      setUser(null);
      setProfile(null);
      toast('Your session expired. Please sign in again.', 'error');
    });
    void boot();
    return () => setOnUnauthorized(null);
  }, [boot]);

  const homePath = useCallback((): string => {
    if (!user) return '/login';
    if (user.role === 'SUPER_ADMIN') return '/admin';
    return profile && profile.handshakeStatus === 'VERIFIED' ? '/overview' : '/credentials';
  }, [user, profile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, boot, logout, setProfile, homePath }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}
