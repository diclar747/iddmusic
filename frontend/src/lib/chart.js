// Cifrado de canciones: convierte texto editable <-> secciones estructuradas.
// Acepta dos formatos (mezclables):
//   1) Acordes encima de la letra (alineados por columna):
//        G        D/F#     Em
//        Santo, santo, santo
//   2) ChordPro en línea:  [G]Santo, [D/F#]santo, [Em]santo
// Secciones:  [Coro]  ·  {Coro}  ·  {c: Coro}  ·  "Coro:" en una línea sola.
// Este archivo no depende del navegador: el backend lo reutiliza para cargar datos demo.

const ROOT = '(?:Do|Re|Mi|Fa|Sol|La|Si|[A-G])(?:#|b)?';
const SUFFIX = '(?:maj|min|dim|aug|sus|add|m|M|°|º|ø|\\+|-)?(?:\\d{1,2})?(?:(?:maj|sus|add|b|#|\\+|-)\\d{1,2})*(?:\\([^)\\s]{1,12}\\))?';
const CHORD_RE = new RegExp(`^${ROOT}${SUFFIX}(?:\\/${ROOT})?$`);
const FILLER_RE = /^(\||\/|-|–|\.|x\d+|\(x\d+\)|\d+x|%|N\.?C\.?)$/i;
const SECTION_WORDS = /^(intro|introducci[oó]n|estrofa|verso|verse|pre-?coro|pre-?chorus|coro|chorus|estribillo|puente|bridge|interludio|instrumental|solo|final|outro|tag|coda|vamp)\b/i;

export const isChord = t => CHORD_RE.test(t);

function sectionType(label){
  const l = (label || '').toLowerCase();
  if (/pre-?coro|pre-?chorus/.test(l)) return 'prechorus';
  if (/coro|chorus|estribillo/.test(l)) return 'chorus';
  if (/puente|bridge/.test(l)) return 'bridge';
  if (/intro/.test(l)) return 'intro';
  if (/interludio|instrumental|solo/.test(l)) return 'instrumental';
  if (/final|outro|coda|tag/.test(l)) return 'outro';
  return 'verse';
}

function headerOf(line){
  const t = line.trim();
  if (/^\{\s*(soc|start_of_chorus)\s*\}$/i.test(t)) return 'Coro';
  if (/^\{\s*(sob|start_of_bridge)\s*\}$/i.test(t)) return 'Puente';
  if (/^\{\s*(sov|start_of_verse)\s*\}$/i.test(t)) return 'Estrofa';
  let m = t.match(/^\{\s*(?:(?:c|comment|ci|soc|start_of_chorus|sov|start_of_verse|sob|start_of_bridge)\s*:\s*)?([^}]*)\}$/i);
  if (m) {
    const inner = m[1].trim();
    if (/^(title|t|artist|subtitle|st|key|tempo|time|capo|eoc|end_of_chorus|eov|end_of_verse|eob|end_of_bridge)\s*(:|$)/i.test(inner)) return null;
    return inner || null;
  }
  m = t.match(/^\[([^\]]+)\]$/);
  if (m && !isChord(m[1].trim()) && !/\]\s*\[/.test(t)) return m[1].trim();
  m = t.match(/^([^:]{2,40}):$/);
  if (m && SECTION_WORDS.test(m[1].trim())) return m[1].trim();
  if (SECTION_WORDS.test(t) && t.length <= 24 && t.split(/\s+/).length <= 3 &&/^[\p{L}\s\d-]+$/u.test(t) && !/[,.;!?¡¿]/.test(t)) return t;
  return null;
}

function directive(line){
  const m = line.trim().match(/^\{\s*(title|t|artist|subtitle|st|key|tempo|time)\s*:\s*([^}]*)\}$/i);
  if (!m) return null;
  const k = m[1].toLowerCase();
  const map = { t: 'title', title: 'title', artist: 'author', subtitle: 'author', st: 'author', key: 'key', tempo: 'tempo_bpm', time: 'time_signature' };
  return [map[k], m[2].trim()];
}

/** Línea con solo acordes (y separadores). Devuelve [{name, position}] o null. */
function chordLine(line){
  if (!line.trim() || line.includes('[')) return null;
  const out = [];
  const re = /\S+/g;
  let m, chords = 0;
  while ((m = re.exec(line))) {
    if (isChord(m[0])) { out.push({ name: m[0], position: m.index }); chords++; }
    else if (FILLER_RE.test(m[0])) continue;
    else return null;
  }
  return chords ? out : null;
}

/** Línea con acordes ChordPro en línea: "[G]Santo [D]santo" → {text, chords}. */
function inlineLine(line){
  if (!/\[[^\]]+\]/.test(line)) return null;
  let text = '';
  const chords = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0, m, found = false;
  while ((m = re.exec(line))) {
    text += line.slice(last, m.index);
    const name = m[1].trim();
    if (isChord(name)) { chords.push({ name, position: text.length }); found = true; }
    else text += m[0];
    last = re.lastIndex;
  }
  text += line.slice(last);
  return found ? { text: text.replace(/\s+$/, ''), chords } : null;
}

/** Texto → { meta, sections } */
export function parseChart(input){
  const lines = String(input || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const meta = {};
  const sections = [];
  let cur = null;
  let pending = null; // acordes esperando su línea de letra
  const ensure = () => { if (!cur) { cur = { type: 'verse', label: '', lines: [] }; sections.push(cur); } return cur; };
  const flush = () => { if (pending) { ensure().lines.push({ text: '', chords: pending }); pending = null; } };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flush(); if (cur && cur.lines.length) cur = null; continue; }
    const d = directive(line);
    if (d) { meta[d[0]] = d[1]; continue; }
    if (/^\{\s*(eoc|end_of_chorus|eov|end_of_verse|eob|end_of_bridge)\s*\}$/i.test(line.trim())) { flush(); cur = null; continue; }
    const h = headerOf(line);
    if (h) { flush(); cur = { type: sectionType(h), label: h, lines: [] }; sections.push(cur); continue; }
    const cl = chordLine(line);
    if (cl) { flush(); pending = cl; continue; }
    const il = inlineLine(line);
    if (il) { flush(); ensure().lines.push(il); continue; }
    ensure().lines.push({ text: line, chords: pending || [] });
    pending = null;
  }
  flush();
  return { meta, sections: sections.filter(s => s.lines.length || s.label) };
}

/** Secciones → texto con acordes encima de la letra (para editar). */
export function serializeChart(sections){
  const out = [];
  for (const s of sections || []) {
    if (out.length) out.push('');
    if (s.label) out.push(`[${s.label}]`);
    for (const l of s.lines || []) {
      const chords = [...(l.chords || [])].sort((a, b) => a.position - b.position);
      if (chords.length) {
        let row = '';
        for (const c of chords) {
          const pos = Math.max(c.position, row.length ? row.length + 1 : 0);
          row = row.padEnd(pos, ' ') + c.name;
        }
        out.push(row);
      }
      if (l.text || !chords.length) out.push(l.text || '');
    }
  }
  return out.join('\n');
}

/* ---------- Transposición ---------- */
const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const LATIN_SHARP = ['Do','Do#','Re','Re#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'];
const LATIN_FLAT = ['Do','Reb','Re','Mib','Mi','Fa','Solb','Sol','Lab','La','Sib','Si'];
const NOTES = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
const LATIN = { Do:0, Re:2, Mi:4, Fa:5, Sol:7, La:9, Si:11 };
export const KEYS = ['C','C#','Db','D','Eb','E','F','F#','Gb','G','Ab','A','Bb','B','Cm','C#m','Dm','D#m','Ebm','Em','Fm','F#m','Gm','G#m','Am','Bbm','Bm'];

function shiftNote(note, steps, preferFlat){
  const m = note.match(/^(Do|Re|Mi|Fa|Sol|La|Si|[A-G])(#|b)?/);
  if (!m) return note;
  const [whole, base, acc = ''] = m;
  const latin = base in LATIN;
  let n = (latin ? LATIN[base] : NOTES[base]) + (acc === '#' ? 1 : acc === 'b' ? -1 : 0);
  n = (((n + steps) % 12) + 24) % 12;
  const flat = preferFlat ?? acc === 'b';
  return (latin ? (flat ? LATIN_FLAT : LATIN_SHARP) : (flat ? FLAT : SHARP))[n] + note.slice(whole.length);
}
export function transposeChord(chord, steps, preferFlat){
  if (!chord || !steps) return chord;
  const i = chord.indexOf('/');
  return i > 0 ? shiftNote(chord.slice(0, i), steps, preferFlat) + '/' + shiftNote(chord.slice(i + 1), steps, preferFlat) : shiftNote(chord, steps, preferFlat);
}
export function transposeSections(sections, steps, preferFlat){
  if (!steps) return sections || [];
  return (sections || []).map(s => ({ ...s, lines: (s.lines || []).map(l => ({ ...l, chords: (l.chords || []).map(c => ({ ...c, name: transposeChord(c.name, steps, preferFlat) })) })) }));
}
/** Semitonos entre dos tonalidades ("G" → "A" = 2). */
export function keyDistance(from, to){
  const v = k => { const m = String(k || '').match(/^(Do|Re|Mi|Fa|Sol|La|Si|[A-G])(#|b)?/); if (!m) return null; return ((m[1] in LATIN ? LATIN[m[1]] : NOTES[m[1]]) + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12; };
  const a = v(from), b = v(to);
  if (a === null || b === null) return 0;
  let d = b - a; if (d > 6) d -= 12; if (d < -6) d += 12;
  return d;
}

/* ---------- Proyección: letra sin acordes, dividida en diapositivas cortas ---------- */
/** Parte una frase larga en dos (o más) por la puntuación o el espacio más cercano al medio. */
export function splitPhrase(line, maxChars){
  if (!maxChars || line.length <= maxChars) return [line];
  const mid = line.length / 2;
  let best = -1, bestScore = Infinity;
  for (let i = 1; i < line.length - 1; i++) {
    const ch = line[i];
    const punct = /[,;:.!?]/.test(ch) && line[i + 1] === ' ';
    if (!punct && ch !== ' ') continue;
    const score = Math.abs(i - mid) - (punct ? line.length * 0.2 : 0);
    if (score < bestScore) { bestScore = score; best = punct ? i + 1 : i; }
  }
  if (best < 0) return [line];
  const a = line.slice(0, best).trim(), b = line.slice(best).trim();
  return [...splitPhrase(a, maxChars), ...splitPhrase(b, maxChars)];
}

/** Letra sin acordes en diapositivas cortas: [{label, type, lines:[...]}]. */
export function lyricSlides(sections, perSlide = 2, maxChars = 0){
  const slides = [];
  (sections || []).forEach((s, sec) => {
    const lyric = (s.lines || [])
      .map(l => (l.text || '').replace(/\s{2,}/g, ' ').replace(/\s*\(?x\d+\)?\s*$/i, '').trim())
      .filter(t => t && /\p{L}/u.test(t))
      .flatMap(t => splitPhrase(t, maxChars));
    if (!lyric.length) return;
    const parts = Math.ceil(lyric.length / perSlide);
    for (let i = 0; i < lyric.length; i += perSlide) slides.push({ label: s.label || '', type: s.type, lines: lyric.slice(i, i + perSlide), sec, part: i / perSlide, parts });
  });
  return slides;
}
