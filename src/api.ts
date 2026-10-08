// Requests carry the HttpOnly session cookie and expose one error shape to pages.

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8080';

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  code: string;
  fields: Record<string, string>;
  status: number;

  constructor(code: string, message: string, fields: Record<string, string> | undefined, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.fields = fields || {};
    this.status = status;
  }
}

async function toError(res: Response): Promise<ApiError> {
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* Plain-text errors use the fallback below. */
  }
  const raw = (data && (data as { error?: Record<string, unknown> }).error) || {};
  const e = raw as { code?: string; message?: string; fields?: Record<string, string> };
  return new ApiError(
    e.code || 'INTERNAL',
    e.message || `Request failed (${res.status}).`,
    e.fields || {},
    res.status,
  );
}

// A 401 also clears the local authenticated session.
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const { method = 'GET', body, signal } = opts;
  const init: RequestInit = { signal, method, credentials: 'include', headers: {} };
  if (body !== undefined) {
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, init);
  if (res.ok) {
    if (res.status === 204) return null as T;
    const ct = res.headers.get('content-type') || '';
    return (ct.includes('application/json') ? await res.json() : res) as T;
  }
  const err = await toError(res);
  if (res.status === 401 && err.code === 'UNAUTHORIZED') onUnauthorized?.();
  throw err;
}

export async function download(path: string, filename: string): Promise<void> {
  const res = await fetch(BASE + path, { credentials: 'include' });
  if (!res.ok) throw await toError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Credential setup displays the backend origin to the operator.
export function apiBase(): string {
  return BASE;
}
