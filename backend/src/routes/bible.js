// Biblia: versiones en español obtenidas de APIs públicas y guardadas en caché en PostgreSQL.
//  - bolls.life:   GET https://bolls.life/get-text/{VERSION}/{libro}/{capítulo}/   ·  búsqueda: /v2/find/{VERSION}?search=
//  - getbible.net: GET https://api.getbible.net/v2/valera/{libro}/{capítulo}.json  (Reina-Valera 1909, dominio público)
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { auth } from '../middleware/auth.js';
import { bad, HttpError } from '../lib/http.js';
import { BOOKS, parseReference, formatReference } from '../../../frontend/src/lib/bible.js';

export const VERSIONS = [
  { id: 'RV1960', name: 'Reina-Valera 1960', provider: 'bolls', search: true },
  { id: 'NTV', name: 'Nueva Traducción Viviente', provider: 'bolls', search: true },
  { id: 'LBLA', name: 'La Biblia de las Américas', provider: 'bolls', search: true },
  { id: 'RVR1909', name: 'Reina-Valera 1909', provider: 'getbible', code: 'valera', search: false }
];

const r = Router();
r.use(auth);
r.use(rateLimit({ windowMs: 60 * 1000, limit: 120, keyGenerator: req => req.user.id, standardHeaders: true, legacyHeaders: false }));

const cleanText = t => String(t || '')
  .replace(/<S>\d+<\/S>/gi, '').replace(/<sup>.*?<\/sup>/gi, '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
  .replace(/\s+([,;:.!?])/g, '$1').replace(/\s{2,}/g, ' ').replace(/^['"]+|['"]+$/g, '').trim();

async function fetchJson(url){
  let res;
  try { res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'IDD-Music/1.0' }, signal: AbortSignal.timeout(15000) }); }
  catch { throw new HttpError(502, 'No se pudo conectar con el servicio de la Biblia. Revisá la conexión a internet.'); }
  if (!res.ok) throw new HttpError(502, `El servicio de la Biblia respondió ${res.status}`);
  return res.json();
}

/** Devuelve [{verse, text}] del capítulo, desde la caché o descargándolo. */
async function getChapter(versionId, bookId, chapter){
  const version = VERSIONS.find(v => v.id === versionId);
  if (!version) throw bad('Versión no disponible');
  const cached = await db.query('SELECT verses FROM bible_chapters WHERE version=$1 AND book=$2 AND chapter=$3', [version.id, bookId, chapter]);
  if (cached.rowCount) return cached.rows[0].verses;
  let verses;
  if (version.provider === 'bolls') {
    const data = await fetchJson(`https://bolls.life/get-text/${version.id}/${bookId}/${chapter}/`);
    verses = (Array.isArray(data) ? data : []).map(v => ({ verse: v.verse, text: cleanText(v.text) }));
  } else {
    const data = await fetchJson(`https://api.getbible.net/v2/${version.code}/${bookId}/${chapter}.json`);
    verses = (data?.verses || []).map(v => ({ verse: v.verse, text: cleanText(v.text) }));
  }
  verses = verses.filter(v => v.text).sort((a, b) => a.verse - b.verse);
  if (!verses.length) throw new HttpError(404, 'No se encontró ese capítulo en esta versión');
  await db.query('INSERT INTO bible_chapters(version,book,chapter,verses) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [version.id, bookId, chapter, JSON.stringify(verses)]);
  return verses;
}

r.get('/versions', (_req, res) => res.json({ items: VERSIONS.map(({ id, name, search }) => ({ id, name, search })), books: BOOKS.map(({ id, name, chapters }) => ({ id, name, chapters })) }));

/** Pasaje por referencia escrita: ?ref=Juan 3:16-18&version=RV1960 */
r.get('/passage', async (req, res) => {
  const ref = parseReference(req.query.ref);
  if (!ref) throw bad('No entendí la referencia. Probá con "Juan 3:16" o "Sal 23".');
  const version = String(req.query.version || 'RV1960');
  const verses = await getChapter(version, ref.book.id, ref.chapter);
  const last = verses[verses.length - 1].verse;
  if (ref.from && ref.from > last) throw new HttpError(404, `${ref.book.name} ${ref.chapter} tiene ${last} versículos`);
  const to = ref.to ? Math.min(ref.to, last) : null;
  res.json({
    version, book: { id: ref.book.id, name: ref.book.name, chapters: ref.book.chapters }, chapter: ref.chapter, from: ref.from, to,
    reference: formatReference(ref.book, ref.chapter, ref.from, to), verses
  });
});

/** Capítulo por número: ?book=43&chapter=3&version=RV1960 */
r.get('/chapter', async (req, res) => {
  const book = BOOKS.find(b => b.id === Number(req.query.book));
  const chapter = Number(req.query.chapter);
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) throw bad('Libro o capítulo inválido');
  const version = String(req.query.version || 'RV1960');
  res.json({ version, book: { id: book.id, name: book.name, chapters: book.chapters }, chapter, from: null, to: null, reference: formatReference(book, chapter), verses: await getChapter(version, book.id, chapter) });
});

/** Búsqueda por palabras: ?q=amor eterno&version=RV1960 */
r.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q.length < 3) throw bad('Escribí al menos 3 letras para buscar');
  let version = VERSIONS.find(v => v.id === req.query.version && v.search) || VERSIONS[0];
  const data = await fetchJson(`https://bolls.life/v2/find/${version.id}?search=${encodeURIComponent(q)}&match_case=false&match_whole=false&limit=40&page=1`);
  const items = (data?.results || []).map(v => {
    const book = BOOKS.find(b => b.id === v.book);
    return book && { book: book.id, chapter: v.chapter, verse: v.verse, reference: formatReference(book, v.chapter, v.verse), text: cleanText(v.text) };
  }).filter(Boolean);
  res.json({ version: version.id, total: data?.exact_matches ?? data?.total ?? items.length, items });
});

export default r;
