// Enlaces de WhatsApp (abren la app o WhatsApp Web con el mensaje listo para enviar).
export const waDigits = phone => String(phone || '').replace(/\D/g, '');
export const waLink = (phone, text = '') => `https://wa.me/${waDigits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
/** +595981123456 → +595 981 123 456 */
export function fmtPhone(phone){
  const d = waDigits(phone);
  if (!d) return '';
  if (d.startsWith('595') && d.length === 12) return `+595 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  return '+' + d;
}
