import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';

/** Local resource status: failures retain the last successful value. */
export function useResource<T>(path: string | null) {
  const [result, setResult] = useState<{ path: string; value: T } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const currentPath = useRef(path);
  currentPath.current = path;
  const refresh = useCallback(async () => {
    if (!path || inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true);
    try {
      const value = await api<T>(path, { signal: controller.signal });
      if (mounted.current && currentPath.current === path && !controller.signal.aborted) { setResult({ path, value }); setError(null); setUpdatedAt(new Date()); }
    } catch (err) {
      if (mounted.current && currentPath.current === path && !controller.signal.aborted) setError((err as ApiError).message || 'Please try again.');
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        if (mounted.current && !controller.signal.aborted) setLoading(false);
      }
    }
  }, [path]);
  useEffect(() => {
    mounted.current = true;
    setResult(null); setError(null); setUpdatedAt(null); setLoading(!!path);
    void refresh();
    return () => { mounted.current = false; inFlight.current?.abort(); inFlight.current = null; };
  }, [refresh]);
  return { data: result?.path === path ? result?.value ?? null : null, error, loading: !!path && loading, updatedAt, refresh };
}
