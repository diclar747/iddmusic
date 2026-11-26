const TOKEN_KEY = 'idd_token';
const USER_KEY = 'idd_user';

export const session = {
  get token(){ return localStorage.getItem(TOKEN_KEY) || ''; },
  get user(){ try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } },
  save(token, user){ localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); window.dispatchEvent(new Event('idd-session')); },
  clear(){ localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); window.dispatchEvent(new Event('idd-session')); }
};

export class ApiError extends Error { constructor(status, message){ super(message); this.status = status; } }

/** Llama a la API. `body` se envía como JSON; `form` como multipart (FormData). */
export async function api(path, { method = 'GET', body, form, signal } = {}){
  const headers = {};
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch('/api' + path, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined), signal });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'No se pudo conectar con el servidor. ¿Está levantada la API?');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status === 401 && path !== '/auth/login') { session.clear(); throw new ApiError(401, 'Tu sesión venció. Ingresá de nuevo.'); }
  if (!res.ok) throw new ApiError(res.status, data?.error || `Error ${res.status}`);
  return data;
}

const blobCache = new Map();
/** Descarga un archivo protegido y devuelve una URL local (blob:) reutilizable. */
export async function protectedUrl(path){
  if (blobCache.has(path)) return blobCache.get(path);
  const p = fetch('/api' + path, { headers: { Authorization: `Bearer ${session.token}` } })
    .then(r => { if (!r.ok) throw new ApiError(r.status, 'No se pudo abrir el archivo'); return r.blob(); })
    .then(b => URL.createObjectURL(b));
  blobCache.set(path, p);
  p.catch(() => blobCache.delete(path));
  return p;
}
