/**
 * Central API Client & Dynamic URL Resolver
 * 
 * Supports:
 * - Same-origin relative URLs (/api/...) when VITE_API_URL is empty
 * - Cross-origin absolute URLs (e.g. https://api.my-domain.com/api/...) when VITE_API_URL is configured
 */

const RAW_API_URL = (import.meta.env.VITE_API_URL || '').trim();
// Strip trailing slash if present
export const API_BASE_URL = RAW_API_URL.endsWith('/')
  ? RAW_API_URL.slice(0, -1)
  : RAW_API_URL;

/**
 * Resolves an endpoint path to a complete URL based on environment configuration.
 * Prevents double `/api/api` if API_BASE_URL already contains `/api`.
 * @param path Endpoint path, e.g. '/api/login' or 'api/exams'
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) {
    return cleanPath;
  }

  // Avoid duplicate /api prefix if API_BASE_URL ends with /api and cleanPath starts with /api
  if (API_BASE_URL.endsWith('/api') && cleanPath.startsWith('/api/')) {
    return `${API_BASE_URL}${cleanPath.slice(4)}`;
  }

  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Enhanced fetch wrapper with automatic base URL prefixing, standard JSON headers, and safe parsing.
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = getApiUrl(path);
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  // Attach token and role from localStorage if running in browser
  if (typeof window !== 'undefined') {
    if (!headers.has('Authorization')) {
      const token = localStorage.getItem('cbt_token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }
    if (!headers.has('x-user-role')) {
      const role = localStorage.getItem('cbt_user_role');
      if (role) {
        headers.set('x-user-role', role);
      }
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Helper to safely extract JSON or throw a clear error instead of raw [object Object] or HTML.
 */
export async function parseJsonResponse<T = any>(res: Response, fallback?: T): Promise<T> {
  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    let errText = `HTTP Error ${res.status}: ${res.statusText || 'Gagal memproses permintaan'}`;
    try {
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (typeof data === 'string') {
          errText = data;
        } else if (data && typeof data === 'object') {
          const mainError = data.error || data.message || `HTTP ${res.status}`;
          if (data.details && typeof data.details === 'string') {
            errText = `${mainError}\n\n[Details]:\n${data.details}`;
          } else if (typeof data.error === 'string' && data.error && data.error !== '[object Object]') {
            errText = data.error;
          } else if (typeof data.message === 'string' && data.message && data.message !== '[object Object]') {
            errText = data.message;
          } else {
            try {
              errText = JSON.stringify(data, null, 2);
            } catch {
              errText = String(data);
            }
          }
        }
      } else {
        const text = await res.text();
        if (text && text.length < 250 && !text.includes('<!DOCTYPE') && !text.includes('<html')) {
          errText = text;
        } else if (res.status === 404) {
          errText = 'Endpoint backend (/api) tidak ditemukan di server ini. Pastikan Serverless Function Vercel telah aktif.';
        } else if (res.status === 500) {
          errText = 'Terjadi kesalahan pada backend API (500). Periksa koneksi DATABASE_URL di Environment Variables.';
        }
      }
    } catch {
      // ignore
    }
    throw new Error(errText);
  }

  if (!contentType.includes('application/json')) {
    if (fallback !== undefined) return fallback;
    const text = await res.text();
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      throw new Error(
        'Server mengembalikan halaman HTML alih-alih API JSON. Pastikan route Serverless Function /api telah dikonfigurasi di Vercel.'
      );
    }
    throw new Error(`Respon server bukan format JSON (${contentType || 'non-JSON'})`);
  }

  return res.json();
}
