// Libros de la Biblia en español y lector de referencias ("Juan 3:16", "Jn 3.16-18", "1 Co 13:4-7", "Sal 23").
// Compartido entre frontend y backend.

export const BOOKS = [
  ['Génesis', 50, 'gn gen'], ['Éxodo', 40, 'ex exo'], ['Levítico', 27, 'lv lev'], ['Números', 36, 'nm num'], ['Deuteronomio', 34, 'dt deut'],
  ['Josué', 24, 'jos'], ['Jueces', 21, 'jue jc'], ['Rut', 4, 'rt'], ['1 Samuel', 31, '1s 1sa 1sam'], ['2 Samuel', 24, '2s 2sa 2sam'],
  ['1 Reyes', 22, '1r 1re 1rey'], ['2 Reyes', 25, '2r 2re 2rey'], ['1 Crónicas', 29, '1cr 1cro'], ['2 Crónicas', 36, '2cr 2cro'], ['Esdras', 10, 'esd'],
  ['Nehemías', 13, 'neh'], ['Ester', 10, 'est'], ['Job', 42, 'jb'], ['Salmos', 150, 'sal sl salmo'], ['Proverbios', 31, 'pr prov pro'],
  ['Eclesiastés', 12, 'ec ecl'], ['Cantares', 8, 'cnt cant cantar cantardeloscantares'], ['Isaías', 66, 'is isa'], ['Jeremías', 52, 'jr jer'], ['Lamentaciones', 5, 'lm lam'],
  ['Ezequiel', 48, 'ez eze'], ['Daniel', 12, 'dn dan'], ['Oseas', 14, 'os'], ['Joel', 3, 'jl'], ['Amós', 9, 'am'],
  ['Abdías', 1, 'abd'], ['Jonás', 4, 'jon'], ['Miqueas', 7, 'mi miq'], ['Nahúm', 3, 'nah'], ['Habacuc', 3, 'hab'],
  ['Sofonías', 3, 'sof'], ['Hageo', 2, 'hag'], ['Zacarías', 14, 'zac'], ['Malaquías', 4, 'mal'], ['Mateo', 28, 'mt mat'],
  ['Marcos', 16, 'mr mc mar'], ['Lucas', 24, 'lc luc'], ['Juan', 21, 'jn jua'], ['Hechos', 28, 'hch hech'], ['Romanos', 16, 'ro rom'],
  ['1 Corintios', 16, '1co 1cor'], ['2 Corintios', 13, '2co 2cor'], ['Gálatas', 6, 'ga gal'], ['Efesios', 6, 'ef efe'], ['Filipenses', 4, 'fil flp'],
  ['Colosenses', 4, 'col'], ['1 Tesalonicenses', 5, '1ts 1tes'], ['2 Tesalonicenses', 3, '2ts 2tes'], ['1 Timoteo', 6, '1ti 1tim'], ['2 Timoteo', 4, '2ti 2tim'],
  ['Tito', 3, 'tit'], ['Filemón', 1, 'flm filem'], ['Hebreos', 13, 'he heb'], ['Santiago', 5, 'stg sant'], ['1 Pedro', 5, '1p 1pe 1ped'],
  ['2 Pedro', 3, '2p 2pe 2ped'], ['1 Juan', 5, '1jn 1jua'], ['2 Juan', 1, '2jn 2jua'], ['3 Juan', 1, '3jn 3jua'], ['Judas', 1, 'jud'],
  ['Apocalipsis', 22, 'ap apoc']
].map(([name, chapters, abbr], i) => ({ id: i + 1, name, chapters, abbr: abbr.split(' ') }));

export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const key = s => norm(s).replace(/[^a-z0-9]/g, '');
const ALIASES = new Map();
for (const b of BOOKS) {
  ALIASES.set(key(b.name), b);
  for (const a of b.abbr) ALIASES.set(a, b);
  // "primera de corintios", "1ra corintios", "i corintios"
  const m = b.name.match(/^(\d) (.+)$/);
  if (m) {
    const words = { 1: ['primera', 'primero', 'primer', '1ra', '1ro', 'i'], 2: ['segunda', 'segundo', '2da', '2do', 'ii'], 3: ['tercera', 'tercero', '3ra', '3ro', 'iii'] }[m[1]];
    for (const w of words) { ALIASES.set(key(w + m[2]), b); ALIASES.set(key(w + 'de' + m[2]), b); }
  }
}

export function findBook(text){
  const k = key(text);
  if (!k) return null;
  if (ALIASES.has(k)) return ALIASES.get(k);
  // Prefijo del nombre completo: "filip" → Filipenses, "1 cori" → 1 Corintios
  const hits = BOOKS.filter(b => key(b.name).startsWith(k));
  return hits.length >= 1 && k.length >= 2 ? hits[0] : null;
}

/**
 * Lee una referencia. Devuelve { book, chapter, from, to } o null.
 * Acepta "Juan 3:16", "Juan 3.16", "Juan 3 16", "Jn 3:16-18", "Salmo 23", "1 Co 13:4-7", "Juan 1,3".
 */
export function parseReference(input){
  const s = String(input || '').trim().replace(/\s+/g, ' ');
  const m = s.match(/^((?:[1-3]|i{1,3})?\s*[^\d]+?)\.?\s*(\d{1,3})(?:\s*[:.,\s]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?\s*$/i);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > book.chapters) return null;
  const from = m[3] ? Number(m[3]) : null;
  const to = m[4] ? Math.max(Number(m[4]), from) : from;
  return { book, chapter, from, to };
}

export const formatReference = (book, chapter, from, to) =>
  `${book.name} ${chapter}${from ? `:${from}${to && to !== from ? `-${to}` : ''}` : ''}`;
