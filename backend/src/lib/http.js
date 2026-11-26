export class HttpError extends Error { constructor(status, message){ super(message); this.status = status; } }
export const bad = msg => new HttpError(400, msg);
export const notFound = (msg = 'No encontrado') => new HttpError(404, msg);
export const forbidden = (msg = 'No tenés permisos para esta operación') => new HttpError(403, msg);
export const isUuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
/** Recorta texto; undefined se mantiene (campo no enviado), vacío → null. */
export const clean = (v, max = 500) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};
