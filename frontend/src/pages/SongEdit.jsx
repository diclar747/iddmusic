import React, { useEffect, useMemo, useState } from 'react';
import { Save, HelpCircle, Sparkles } from 'lucide-react';
import { api } from '../api.js';
import { navigate } from '../router.js';
import { useApi, Spinner, ErrorBox, Field, Busy, useToast } from '../ui.jsx';
import ChartView from '../components/ChartView.jsx';
import { parseChart, serializeChart, KEYS } from '../lib/chart.js';

export const CHART_HELP = <div className="help">
  <p><b>Cómo escribir la canción</b></p>
  <p>Escribí los acordes en la línea de arriba de la letra, alineados con la sílaba:</p>
  <pre>{`[Coro]\nG        D/F#     Em\nSanto, santo, santo`}</pre>
  <p>O dentro de la letra entre corchetes:</p>
  <pre>{`[G]Santo, [D/F#]santo, [Em]santo`}</pre>
  <p>Secciones: <code>[Estrofa 1]</code>, <code>[Coro]</code>, <code>[Puente]</code>… Separá secciones con una línea vacía. Funciona con cifrado americano (C, Am7, G/B) y latino (Do, Lam, Sol/Si).</p>
</div>;

/** Formulario reutilizable: metadatos + editor de cifrado con vista previa. */
export function SongFields({ value, onChange, chart, onChart }){
  const set = k => e => onChange({ ...value, [k]: e.target.value });
  const { sections } = useMemo(() => parseChart(chart), [chart]);
  const [help, setHelp] = useState(false);
  return <>
    <div className="row-2">
      <Field label="Título"><input value={value.title || ''} onChange={set('title')} required /></Field>
      <Field label="Autor / compositor"><input value={value.author || ''} onChange={set('author')} /></Field>
    </div>
    <div className="row-4">
      <Field label="Tonalidad"><input list="keys" value={value.original_key || ''} onChange={set('original_key')} placeholder="G" /><datalist id="keys">{KEYS.map(k => <option key={k} value={k} />)}</datalist></Field>
      <Field label="Tempo (BPM)"><input type="number" min="20" max="300" value={value.tempo_bpm ?? ''} onChange={set('tempo_bpm')} /></Field>
      <Field label="Compás"><input value={value.time_signature || ''} onChange={set('time_signature')} placeholder="4/4" /></Field>
      <Field label="Categoría"><input list="cats" value={value.category || ''} onChange={set('category')} placeholder="Adoración" /><datalist id="cats">{['Adoración', 'Alabanza', 'Himno', 'Santa Cena', 'Ofrenda', 'Niños', 'Navidad'].map(c => <option key={c} value={c} />)}</datalist></Field>
    </div>
    <div className="editor">
      <div className="ed-col">
        <div className="ed-head"><b>Letra y acordes</b><button type="button" className="txt-btn" onClick={() => setHelp(h => !h)}><HelpCircle size={15} /> Formato</button></div>
        {help && CHART_HELP}
        <textarea className="mono" spellCheck={false} value={chart} onChange={e => onChart(e.target.value)} placeholder={'[Estrofa 1]\nG          D\nEscribí aquí la letra…'} />
      </div>
      <div className="ed-col">
        <div className="ed-head"><b>Vista previa</b><small className="muted">{sections.length} secciones</small></div>
        <div className="preview"><ChartView sections={sections} fontSize={15} /></div>
      </div>
    </div>
    <Field label="Notas para el grupo"><textarea rows={2} value={value.notes || ''} onChange={set('notes')} placeholder="Dinámica, quién empieza, repeticiones…" /></Field>
  </>;
}

/** Si la canción se creó desde un culto, se suma a su repertorio y se vuelve al culto. */
export async function finishForEvent(eventId, song, toast){
  if (!eventId) return false;
  try { await api(`/events/${eventId}/items`, { method: 'POST', body: { song_id: song.id, performance_key: song.original_key || null } }); toast?.(`"${song.title}" agregada al repertorio`); }
  catch (e) { toast?.(e.message, 'error'); }
  navigate(`/events/${eventId}`);
  return true;
}

export default function SongEdit({ id, groupId, eventId }){
  const toast = useToast();
  const existing = useApi(id ? `/songs/${id}` : null);
  const groups = useApi(id ? null : '/groups');
  const [meta, setMeta] = useState({ title: '', author: '', original_key: '', tempo_bpm: '', time_signature: '', category: '', notes: '', group_id: groupId || '' });
  const [chart, setChart] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (existing.data) { setMeta(existing.data); setChart(serializeChart(existing.data.lyrics_sections)); } }, [existing.data]);
  useEffect(() => { if (!meta.group_id && groups.data?.items[0]) setMeta(m => ({ ...m, group_id: groups.data.items[0].id })); }, [groups.data]);
  if (existing.loading) return <Spinner />;
  if (existing.error) return <ErrorBox error={existing.error} />;

  async function save(e){
    e.preventDefault(); setBusy(true);
    try {
      const { sections } = parseChart(chart);
      const body = { title: meta.title, author: meta.author, original_key: meta.original_key, tempo_bpm: meta.tempo_bpm === '' ? null : meta.tempo_bpm, time_signature: meta.time_signature, category: meta.category, notes: meta.notes, lyrics_sections: sections };
      const s = id ? await api(`/songs/${id}`, { method: 'PATCH', body }) : await api('/songs', { method: 'POST', body: { ...body, group_id: meta.group_id } });
      toast('Canción guardada');
      if (!id && await finishForEvent(eventId, { ...s, title: s.title || meta.title }, toast)) return;
      if (id && eventId) { navigate(`/events/${eventId}`); return; }
      navigate(`/songs/${s.id}`);
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  return <form onSubmit={save}>
    <header className="page-head">
      <div><a className="crumb" href={eventId ? `#/events/${eventId}` : id ? `#/songs/${id}` : `#/groups/${meta.group_id}`}>← {eventId ? 'Volver al culto' : 'Volver'}</a><h1>{id ? 'Editar canción' : 'Nueva canción'}</h1>
        {id && <p className="muted">Cada vez que guardás se conserva la versión anterior en el historial.</p>}</div>
      <div className="head-actions">
        {!id && <a className="btn" href={`#/import?group=${meta.group_id}`}><Sparkles size={16} /> Importar desde PDF/foto</a>}
        <Busy busy={busy} type="submit"><Save size={16} /> Guardar</Busy>
      </div>
    </header>
    <section className="panel form">
      {!id && <Field label="Grupo"><select value={meta.group_id} onChange={e => setMeta({ ...meta, group_id: e.target.value })} required>{groups.data?.items.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>}
      <SongFields value={meta} onChange={setMeta} chart={chart} onChart={setChart} />
    </section>
  </form>;
}
