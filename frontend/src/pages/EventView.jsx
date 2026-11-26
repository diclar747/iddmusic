import React, { useState } from 'react';
import { Pencil, Trash2, MonitorPlay, MapPin, Clock, ArrowUp, ArrowDown, X, Plus, Music2, ExternalLink } from 'lucide-react';
import { api } from '../api.js';
import { navigate } from '../router.js';
import { useApi, Spinner, ErrorBox, Empty, useToast, fmtDate, fmtTime, relDay, EVENT_TYPES } from '../ui.jsx';
import EventForm from '../components/EventForm.jsx';
import { KEYS } from '../lib/chart.js';

export default function EventView({ id }){
  const toast = useToast();
  const ev = useApi(`/events/${id}`);
  const [editing, setEditing] = useState(false);
  const e = ev.data;
  const group = useApi(e ? `/groups/${e.group_id}` : null);
  const songs = useApi(e ? `/songs?group_id=${e.group_id}` : null);
  const [pick, setPick] = useState('');
  if (ev.loading && !e) return <Spinner />;
  if (ev.error) return <ErrorBox error={ev.error} />;

  const call = async (path, opts, msg) => { try { await api(path, opts); if (msg) toast(msg); ev.reload(); } catch (err) { toast(err.message, 'error'); } };
  const add = async () => {
    if (!pick) return;
    const s = songs.data.items.find(x => x.id === pick);
    await call(`/events/${id}/items`, { method: 'POST', body: { song_id: pick, performance_key: s?.original_key } }, 'Canción agregada');
    setPick('');
  };
  const move = (i, d) => {
    const ids = e.items.map(x => x.id); const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    ev.setData({ ...e, items: ids.map(x => e.items.find(it => it.id === x)) });
    call(`/events/${id}/order`, { method: 'PUT', body: { item_ids: ids } });
  };
  const update = (item, patch) => call(`/events/${id}/items/${item.id}`, { method: 'PATCH', body: patch });
  async function remove(){
    if (!confirm(`¿Eliminar "${e.title}"?`)) return;
    try { await api(`/events/${id}`, { method: 'DELETE' }); toast('Evento eliminado'); navigate(`/groups/${e.group_id}/agenda`); } catch (err) { toast(err.message, 'error'); }
  }
  const inSet = new Set(e.items.map(i => i.song_id));
  return <>
    <header className="page-head">
      <div>
        <a className="crumb" href={`#/groups/${e.group_id}/agenda`}>← {e.group_name}</a>
        <h1>{e.title}</h1>
        <div className="meta-pills">
          <span className={`pill t-${e.event_type}`}>{EVENT_TYPES[e.event_type]}</span>
          {relDay(e.event_date) && <span className="pill soft">{relDay(e.event_date)}</span>}
          <span className="pill soft">{fmtDate(e.event_date)}</span>
          {e.event_time && <span className="pill soft"><Clock size={13} /> {fmtTime(e.event_time)}{e.end_time && ` – ${fmtTime(e.end_time)}`}</span>}
          {e.location && <span className="pill soft"><MapPin size={13} /> {e.location}</span>}
        </div>
      </div>
      <div className="head-actions">
        <a className={`btn primary ${!e.items.length ? 'disabled' : ''}`} href={e.items.length ? `#/present/event/${id}` : undefined}><MonitorPlay size={16} /> Proyectar repertorio</a>
        <button className="icon-btn" title="Editar" onClick={() => setEditing(true)}><Pencil size={17} /></button>
        <button className="icon-btn danger" title="Eliminar" onClick={remove}><Trash2 size={17} /></button>
      </div>
    </header>
    {e.notes && <div className="banner info pre">{e.notes}</div>}
    <section className="panel">
      <div className="panel-head"><h2>Repertorio</h2><small className="muted">{e.items.length} canciones</small></div>
      {e.items.length ? <ol className="setlist">{e.items.map((it, i) => <li key={it.id}>
        <span className="pos">{i + 1}</span>
        <span className="grow">
          <a href={`#/songs/${it.song_id}${it.performance_key ? `?key=${encodeURIComponent(it.performance_key)}` : ''}`} className="st-title">{it.title} <ExternalLink size={13} /></a>
          <small>{it.author || ''}{it.song_status === 'review' && ' · ⚠ transcripción sin revisar'}</small>
          <input className="inline-note" defaultValue={it.notes || ''} placeholder="Nota (ej.: entra solo el piano)…" onBlur={x => x.target.value !== (it.notes || '') && update(it, { notes: x.target.value })} />
        </span>
        <label className="mini-field"><small>Tono</small>
          <select value={it.performance_key || ''} onChange={x => update(it, { performance_key: x.target.value })}>
            <option value="">—</option>{[...new Set([it.performance_key, it.original_key, ...KEYS].filter(Boolean))].map(k => <option key={k} value={k}>{k}{k === it.original_key ? ' (orig.)' : ''}</option>)}
          </select></label>
        <label className="mini-field"><small>Dirige</small>
          <select value={it.assigned_to || ''} onChange={x => update(it, { assigned_to: x.target.value || null })}>
            <option value="">—</option>{group.data?.members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select></label>
        <span className="order">
          <button className="icon-btn sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir"><ArrowUp size={14} /></button>
          <button className="icon-btn sm" onClick={() => move(i, 1)} disabled={i === e.items.length - 1} aria-label="Bajar"><ArrowDown size={14} /></button>
          <button className="icon-btn sm danger" onClick={() => call(`/events/${id}/items/${it.id}`, { method: 'DELETE' })} aria-label="Quitar"><X size={14} /></button>
        </span>
      </li>)}</ol> : <Empty icon={Music2} title="Todavía no hay canciones en el repertorio" />}
      <div className="add-song">
        <select value={pick} onChange={x => setPick(x.target.value)}>
          <option value="">Agregar una canción del grupo…</option>
          {songs.data?.items.filter(s => !inSet.has(s.id)).map(s => <option key={s.id} value={s.id}>{s.title}{s.original_key ? ` (${s.original_key})` : ''}</option>)}
        </select>
        <button className="btn primary" onClick={add} disabled={!pick}><Plus size={16} /> Agregar</button>
        <a className="btn" href={`#/songs/new?group=${e.group_id}`}>Nueva canción</a>
      </div>
    </section>
    {editing && <EventForm event={e} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); ev.reload(); }} />}
  </>;
}
