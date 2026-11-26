const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const LATIN_SHARP = ['Do','Do#','Re','Re#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'];
const LATIN_FLAT = ['Do','Reb','Re','Mib','Mi','Fa','Solb','Sol','Lab','La','Sib','Si'];
const NOTES = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
const LATIN = { Do:0, Re:2, Mi:4, Fa:5, Sol:7, La:9, Si:11 };
const ROOT = /^(Do|Re|Mi|Fa|Sol|La|Si|[A-G])(#|b)?/;

function shiftNote(note, steps){
  const m = note.match(ROOT);
  if (!m) return note;
  const [whole, base, acc = ''] = m;
  const latin = base in LATIN;
  let n = latin ? LATIN[base] : NOTES[base];
  n += acc === '#' ? 1 : acc === 'b' ? -1 : 0;
  n = (((n + steps) % 12) + 24) % 12;
  const flat = acc === 'b';
  const table = latin ? (flat ? LATIN_FLAT : LATIN_SHARP) : (flat ? FLAT : SHARP);
  return table[n] + note.slice(whole.length);
}

/** Transpone un acorde (cifrado americano o latino, con bajo opcional: G/B, Sol/Si). */
export function transposeChord(chord, steps){
  if (!chord || typeof chord !== 'string' || !steps) return chord;
  const i = chord.indexOf('/');
  return i > 0 ? shiftNote(chord.slice(0, i), steps) + '/' + shiftNote(chord.slice(i + 1), steps) : shiftNote(chord, steps);
}

export function transposeSections(sections, steps){
  return (sections || []).map(s => ({ ...s, lines: (s.lines || []).map(line => ({ ...line, chords: (line.chords || []).map(c => ({ ...c, name: transposeChord(c.name, steps) })) })) }));
}

/** Normaliza y valida la estructura de secciones (letra + acordes con posición). */
export function sanitizeSections(input){
  if (!Array.isArray(input)) return [];
  return input.slice(0, 200).map(s => ({
    type: String(s?.type || 'verse').slice(0, 30),
    label: String(s?.label || '').slice(0, 80),
    lines: (Array.isArray(s?.lines) ? s.lines : []).slice(0, 400).map(l => ({
      text: String(l?.text ?? '').slice(0, 500),
      chords: (Array.isArray(l?.chords) ? l.chords : []).slice(0, 60)
        .filter(c => c && c.name)
        .map(c => ({ name: String(c.name).slice(0, 20), position: Math.max(0, Math.min(500, parseInt(c.position, 10) || 0)) }))
    }))
  }));
}
