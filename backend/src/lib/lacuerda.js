// Importar cifrados desde LaCuerda (acordes.lacuerda.net): por URL o buscando por canción/artista.
// La página trae la letra con los acordes en <A>…</A> sobre cada renglón: se convierte al formato
// "acordes encima de la letra" del editor, para revisarlo y guardarlo en el grupo.
import { bad, HttpError } from './http.js';

const BASE = 'https://acordes.lacuerda.net';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const TYPES = { R: 'Letra y acordes', T: 'Tablatura', B: 'Bajo', K: 'Teclado', D: 'Batería', H: 'Armónica' };
const SECTION = /^(intro(?:ducci[oó]n)?|verso|estrofa|pre-?coro|precoro|coro|puente|interludio|instrumental|final|outro|solo|tag|refr[aá]n|estribillo|bridge|chorus|verse)\b/i;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', iexcl: '¡', iquest: '¿' };
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e] ?? m);
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const strip = s =>decode(s.replace(/<[^>]*>/g, '')).trim();

async function get(url){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es' }, redirect: 'follow', signal: ctrl.signal });
    if (res.status === 404) throw new HttpError(404, 'LaCuerda no tiene esa página (404). Revisá la dirección.');
    if (!res.ok) throw new HttpError(502, `LaCuerda respondió ${res.status}. Probá de nuevo en un momento.`);
    const buf = Buffer.from(await res.arrayBuffer());
    const cs = /charset=([\w-]+)/i.exec(res.headers.get('content-type') || '')?.[1]?.toLowerCase() || 'utf-8';
    return { html: new TextDecoder(cs === 'iso-8859-1' || cs === 'latin1' ? 'windows-1252' : cs).decode(buf), url: res.url || url };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, e.name === 'AbortError' ? 'LaCuerda tardó demasiado en responder.' : 'No se pudo conectar con LaCuerda. ¿Hay internet en el servidor?');
  } finally { clearTimeout(t); }
}

/** Acepta URLs de lacuerda.net (con o sin https, móvil o escritorio) y devuelve la ruta segura de la canción. */
export function lacuerdaPath(input){
  let u;
  try { u = new URL(/^https?:\/\//i.test(input) ? input : 'https://' + String(input).replace(/^\/+/, '')); } catch { throw bad('Pegá la dirección completa de LaCuerda (por ejemplo https://acordes.lacuerda.net/artista/cancion.shtml)'); }
  if (!/(^|\.)lacuerda\.net$/i.test(u.hostname)) throw bad('La dirección tiene que ser de lacuerda.net');
  const path = u.pathname.replace(/\/+$/, '');
  if (!/^\/[a-z0-9_]+\/[a-z0-9_]+(-\d+)?(\.shtml)?$/i.test(path)) throw bad('Esa dirección no es de una canción de LaCuerda (debería terminar en .shtml)');
  return path.endsWith('.shtml') ? path : path + '.shtml';
}

/** Convierte el bloque <PRE> de LaCuerda en texto de cifrado (acordes encima de la letra) con secciones [Coro]. */
export function preToChart(pre){
  const text = decode(pre
    .replace(/<\/?div[^>]*>/gi, '')
    .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ''))
    .replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  const out = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const t = line.trim();
    const m = t.match(/^([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ \-]{1,24}?\s*\d*)\s*((?:\(\s*\d+\s*x\s*\)|x\s*\d+)?)\s*:\s*(.*)$/)
      || t.match(/^([A-Za-zÁÉÍÓÚÑáéíóúñ-]+\s*\d*)\s*((?:\(\s*\d+\s*x\s*\)|x\s*\d+)?)\s*()$/i); // "VERSO 2", "Coro (2x)" solos en su renglón
    if (m && SECTION.test(m[1].trim())) {
      const label = m[1].trim().toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()) + (m[2] ? ' ' + m[2].replace(/\s+/g, '') : '');
      if (out.length && out[out.length - 1] !== '') out.push('');
      out.push(`[${label}]`);
      if (m[3]?.trim()) out.push(m[3].trim());
      continue;
    }
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Tono aproximado: el primer acorde del cifrado (se puede corregir antes de guardar). */
function guessKey(chart){
  for (const l of chart.split('\n')) {
    if (/^\[/.test(l)) continue;
    const m = l.trim().match(/^([A-G][#b]?)(m(?!aj))?/);
    if (m && /^[A-G][#b]?\S*(\s+[A-G][#b]?\S*)*$/.test(l.trim())) return m[1] + (m[2] ? 'm' : '');
  }
  return '';
}

/** Descarga y convierte una canción. */
export async function fetchLaCuerda(input){
  const path = lacuerdaPath(input);
  const { html } = await get(BASE + path);
  const body = /<div id=['"]?t_body['"]?[^>]*>\s*<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html)?.[1];
  if (!body || !body.replace(/<[^>]*>/g, '').trim()) throw bad('No se encontró el cifrado en esa página (puede ser una tablatura o una página de artista).');
  const title = strip(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] || '') || strip(/<title>([^<,:]*)/i.exec(html)?.[1] || '');
  const author = strip(/<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(html)?.[1] || '');
  const chart = preToChart(body);
  return { title, author, key: guessKey(chart), chart, source_url: BASE + path };
}

const versionsOf = (lcd, base) => {
  const [types = '', nums = ''] = lcd.split('-');
  const out = [];
  for (const ch of nums) {
    const v = Number(ch); const type = types[v - 1];
    if (v && type) out.push({ v, type, type_name: TYPES[type] || type, url: `${base}${v === 1 ? '' : '-' + v}.shtml` });
  }
  return out;
};

/** Canciones de la página de un artista (https://acordes.lacuerda.net/artista/). */
function parseArtistPage(html, artistSlug){
  const artist = strip(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] || artistSlug);
  const items = [];
  for (const li of html.matchAll(/<li id='r\d+' lcd='([^']*)'>\s*<a href="([a-z0-9_]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const base = `${BASE}/${artistSlug}/${li[2]}`;
    items.push({ title: strip(li[3].replace(/<em>[\s\S]*?<\/em>/gi, '')), artist, url: base + '.shtml', versions: versionsOf(li[1], base) });
  }
  return { artist, items };
}

/** Busca en LaCuerda: canciones (con sus versiones), artistas, o directamente las canciones de un artista. */
export async function searchLaCuerda(q, { songsOnly = false } = {}){
  q = String(q || '').trim();
  if (q.length < 2) throw bad('Escribí al menos 2 letras para buscar');
  const { html, url } = await get(`${BASE}/busca.php?exp=${encodeURIComponent(q).replace(/%20/g, '+')}&canc=${songsOnly ? 1 : 0}&ord=0`);
  // Si la búsqueda coincide con un artista, LaCuerda redirige a su página.
  const artistPath = /^\/([a-z0-9_]+)\/?$/i.exec(new URL(url).pathname);
  if (artistPath) { const a = parseArtistPage(html, artistPath[1]); return { items: a.items, artists: [], total: a.items.length, artist: a.artist }; }

  const arr = name => { const m = new RegExp(`var ${name}\\s*=\\s*\\[([^\\]]*)\\]`).exec(html); return m ? [...m[1].matchAll(/'([^']*)'/g)].map(x => x[1]) : []; };
  // LaCuerda mezcla el orden de estas listas en cada visita: se usan solo como conjunto de nombres de archivo.
  const fns = arr('fns');
  const compact = s => s.replace(/_/g, '');
  const fileFor = title => {
    const st = slug(title), sc = compact(st);
    let best = null, score = 0;
    for (const f of fns) {
      const fc = compact(f);
      const s = f === st ? 3 : fc === sc ? 2.5 : (fc.startsWith(sc) || sc.startsWith(fc)) ? 1 + Math.min(fc.length, sc.length) / Math.max(fc.length, sc.length) : 0;
      if (s > score) { score = s; best = f; }
    }
    return best || st;
  };
  const items = [];
  for (const row of html.split(/<tr>/i).slice(1)) {
    const a = /<td>\s*<a href="\/([a-z0-9_]+)\/"[^>]*>([\s\S]*?)<\/a>/i.exec(row);
    if (!a) continue;
    const artist = strip(a[2]);
    for (const li of row.matchAll(/<li id='r(\d+)' lcd='([^']*)'>([\s\S]*?)<\/li>/gi)) {
      const title = strip(li[3]);
      const base = `${BASE}/${a[1]}/${fileFor(title)}`;
      items.push({ title, artist, url: base + '.shtml', versions: versionsOf(li[2], base) });
    }
  }
  const artists = [...html.matchAll(/<li><a class=sb href="\/([a-z0-9_]+)\/"[^>]*>(?:<img[^>]*>)?([\s\S]*?)<\/a><span>(\d+)/gi)]
    .map(m => ({ name: strip(m[2]), url: `${BASE}/${m[1]}/`, songs: Number(m[3]) }));
  // Solo aparecieron artistas: probar también en canciones.
  if (!items.length && artists.length && !songsOnly) { const s = await searchLaCuerda(q, { songsOnly: true }).catch(() => null); if (s?.items.length) return { ...s, artists }; }
  const total = Number(/<span>(\d+)<\/span>\s*resultados/i.exec(html)?.[1] || items.length);
  return { items, artists, total };
}

/** Lista las canciones de un artista. */
export async function artistLaCuerda(input){
  let u; try { u = new URL(/^https?:\/\//i.test(input) ? input : 'https://' + input); } catch { throw bad('Dirección de artista inválida'); }
  if (!/(^|\.)lacuerda\.net$/i.test(u.hostname)) throw bad('La dirección tiene que ser de lacuerda.net');
  const m = /^\/([a-z0-9_]+)\/?$/i.exec(u.pathname);
  if (!m) throw bad('Dirección de artista inválida');
  const { html } = await get(`${BASE}/${m[1]}/`);
  const a = parseArtistPage(html, m[1]);
  return { items: a.items, artists: [], total: a.items.length, artist: a.artist };
}
