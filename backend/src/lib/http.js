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

/** Normaliza un número de WhatsApp: "0981 123 456" → "+595981123456" (Paraguay por defecto). Vacío → null. */
export function normPhone(v){
  if (v === undefined) return undefined;
  let s = String(v || '').trim();
  if (!s) return null;
  const plus = s.startsWith('+') || s.startsWith('00');
  s = s.replace(/\D/g, '');
  if (s.startsWith('00')) s = s.slice(2);
  if (!plus) {
    if (s.startsWith('0')) s = '595' + s.slice(1);        // 0981123456 → 595981123456
    else if (s.length === 9 && s.startsWith('9')) s = '595' + s; // 981123456 → 595981123456
  }
  if (s.length < 8 || s.length > 15) throw new HttpError(400, 'El número de WhatsApp no parece válido (ej.: 0981 123 456)');
  return '+' + s;
}
