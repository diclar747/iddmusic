// Abrir canciones desde archivos de la computadora (sin IA): .txt, ChordPro (.cho, .chopro, .chordpro, .crd, .pro).
import { parseChart } from './chart.js';

export const SONG_TEXT_ACCEPT = '.txt,.cho,.chopro,.chordpro,.crd,.pro,.onsong,text/plain';
export const isSongText = f => /\.(txt|cho|chopro|chordpro|crd|pro|onsong)$/i.test(f.name) || f.type === 'text/plain';

/** Lee texto respetando acentos: UTF-8 y, si no lo es, Windows-1252 (archivos del Bloc de notas antiguos). */
export async function readTextFile(file){
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
  catch { return new TextDecoder('windows-1252').decode(buf); }
}

/** Texto de cifrado → datos de canción. Usa {title:}/{artist:}/{key:} si están; si no, el nombre del archivo. */
export function songFromText(text, filename = ''){
  text = text.replace(/\r\n?/g, '\n');
  const { meta } = parseChart(text);
  // Las directivas de metadatos pasan a los campos de la canción; el resto queda como cifrado editable.
  text = text.split('\n').filter(l => !/^\s*\{\s*(title|t|artist|subtitle|st|key|tempo|time)\s*:/i.test(l)).join('\n').replace(/^\s*\n/, '');
  const { sections } = parseChart(text);
  let title = meta.title || '';
  let chart = text;
  if (!title) {
    // Primera línea corta que no sea acorde ni encabezado → título; si no, el nombre del archivo.
    const first = text.split(/\r?\n/).find(l => l.trim());
    const firstParsed = first && parseChart(first).sections[0]?.lines[0];
    if (first && first.trim().length <= 60 && firstParsed && !firstParsed.chords.length && !/^[[{]/.test(first.trim()) && text.split(/\r?\n/).filter(l => l.trim()).length > 2) {
      title = first.trim(); chart = text.replace(first, '').replace(/^\s*\n/, '');
    } else title = filename.replace(/\.\w+$/, '').replace(/[_-]+/g, ' ').trim() || 'Canción';
  }
  const parsed = chart === text ? sections : parseChart(chart).sections;
  return { title, author: meta.author || '', original_key: meta.key || '', tempo_bpm: meta.tempo_bpm || '', time_signature: meta.time_signature || '', chart: chart.trim(), lyrics_sections: parsed };
}
