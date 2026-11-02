/**
 * Obsidian API Client
 *
 * Typesafe HTTP client interacting with the Obsidian backend API.
 * Uses credentials: 'include' for cookie session management.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly data?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchApi<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  // Dual-channel auth: Attach Bearer token from storage if present (fallback for cookies)
  if (typeof window !== 'undefined') {
    try {
      const storedToken = localStorage.getItem('obsidian_session_token');
      if (storedToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${storedToken}`);
      }
    } catch {}
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 204) {
    return {} as T;
  }

  let json: any = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }

  if (!res.ok) {
    const errorMsg =
      json?.message ||
      (Array.isArray(json?.errors) ? json.errors.join(', ') : res.statusText);
    throw new ApiError(errorMsg, res.status, json);
  }

  return json as T;
}
