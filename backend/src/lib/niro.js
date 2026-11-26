// Cliente de la API de Niro IA (https://niro.cnid.com.py/docs).
// Endpoint usado: POST /api/v1/vision/extract (multipart: file, mode, question) con Authorization: Bearer <key>.
import { HttpError } from './http.js';

const BASE = (process.env.NIRO_BASE_URL || 'https://niro.cnid.com.py').replace(/\/+$/, '');

export const niroConfigured = () => !!process.env.NIRO_API_KEY;

export const MUSIC_PROMPT = `Sos un transcriptor musical experto. La imagen es una hoja de canción: letra con acordes (cifrado), partitura o solo letra.
Transcribí TODO el contenido fielmente, sin inventar nada que no esté en la imagen.
Respondé ÚNICAMENTE con un objeto JSON válido (sin texto antes ni después y sin bloques de código), con esta forma exacta:
{"title": string o null, "author": string o null, "key": string o null, "tempo_bpm": número o null, "time_signature": string o null, "chart": string}
Reglas para "chart":
- Formato ChordPro: cada acorde entre corchetes inmediatamente antes de la sílaba donde suena. Ejemplo: "[G]Santo, santo, [D/F#]santo es el [Em]Señor".
- Cada sección empieza con su nombre entre llaves en una línea propia, por ejemplo {Intro}, {Estrofa 1}, {Pre-coro}, {Coro}, {Puente}, {Final}.
- Separá las secciones con una línea en blanco. Respetá los saltos de línea de la letra original.
- Conservá el cifrado tal como aparece (americano C D E... o latino Do Re Mi...). Incluí indicaciones como (x2) si aparecen.
- Si hay compases solo de acordes (intro, interludio), escribilos como "[G] [D] [Em] [C]".
- Si es una partitura sin letra, describí los acordes por compás separados por " | ".
"key" es la tonalidad (ej. "G", "Em", "Sol") si está indicada o es evidente por los acordes.`;

/** Envía un archivo a Niro y devuelve { text, data, cost, model, latencyMs }. */
export async function niroVisionExtract(buffer, filename, mimeType, question = MUSIC_PROMPT){
  if (!niroConfigured()) throw new HttpError(503, 'La transcripción con IA no está configurada (falta NIRO_API_KEY en backend/.env)');
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), filename || 'archivo');
  form.append('mode', 'text');
  form.append('question', question);
  let res;
  try {
    res = await fetch(`${BASE}/api/v1/vision/extract`, {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.NIRO_API_KEY}` }, body: form, signal: AbortSignal.timeout(120000)
    });
  } catch (e) {
    throw new HttpError(502, 'No se pudo conectar con Niro IA: ' + (e.name === 'TimeoutError' ? 'tiempo de espera agotado' : e.message));
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.error?.message || body?.error || body?.message || res.statusText;
    const msg = res.status === 401 ? 'La API Key de Niro no es válida o fue revocada'
      : res.status === 402 ? 'La organización de Niro no tiene saldo suficiente en la wallet'
      : `Niro IA respondió ${res.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
    throw new HttpError(502, msg);
  }
  return body;
}

/** Interpreta la respuesta del modelo: intenta JSON; si no, usa el texto como cifrado. */
export function parseMusicResponse(body){
  const raw = typeof body?.text === 'string' ? body.text : (typeof body?.answer === 'string' ? body.answer : '');
  let obj = body?.data && typeof body.data === 'object' && typeof body.data.chart === 'string' ? body.data : null;
  if (!obj) {
    const stripped = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const a = stripped.indexOf('{'), b = stripped.lastIndexOf('}');
    if (a >= 0 && b > a) { try { obj = JSON.parse(stripped.slice(a, b + 1)); } catch { obj = null; } }
  }
  if (!obj || typeof obj.chart !== 'string') obj = { chart: raw };
  const tempo = parseInt(obj.tempo_bpm, 10);
  return {
    title: obj.title ? String(obj.title).slice(0, 240) : null,
    author: obj.author ? String(obj.author).slice(0, 240) : null,
    key: obj.key ? String(obj.key).slice(0, 12) : null,
    tempo_bpm: Number.isInteger(tempo) && tempo >= 20 && tempo <= 300 ? tempo : null,
    time_signature: obj.time_signature ? String(obj.time_signature).slice(0, 10) : null,
    chart: String(obj.chart || '').replace(/\r\n/g, '\n').trim()
  };
}
