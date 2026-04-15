const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080';

export class ApiError extends Error {
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

// Attempt a single token refresh. Returns the new access token or null on failure.
async function tryRefresh(): Promise<string | null> {
  const rt = localStorage.getItem('refresh_token');
  if (!rt) return null;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token: string; refresh_token: string };
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

function clearAuthAndRedirect() {
  localStorage.removeItem('user');
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.replace('/login');
}

async function doFetch(path: string, options: RequestInit, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token');
  let res = await doFetch(path, options, token);

  // On 401, try refreshing once then retry — but not for auth endpoints themselves
  if (res.status === 401 && !AUTH_PATHS.includes(path)) {
    const newToken = await tryRefresh();
    if (!newToken) {
      clearAuthAndRedirect();
      // Return a never-resolving promise — the redirect will take over
      return new Promise(() => {});
    }
    res = await doFetch(path, options, newToken);
    // If still 401 after refresh, session is truly dead
    if (res.status === 401) {
      clearAuthAndRedirect();
      return new Promise(() => {});
    }
  }

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json();

  if (!res.ok) {
    const body = data as { error?: string; fields?: Record<string, string> };
    throw new ApiError(body.error ?? 'Request failed', res.status, body.fields);
  }

  return data as T;
}
