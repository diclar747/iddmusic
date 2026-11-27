import React, { useMemo, useRef, useState } from 'react';
import { Pencil, Trash2, MonitorPlay, MapPin, Clock, X, Plus, Music2, ExternalLink, GripVertical, Search, Sparkles, FilePlus2, Users, Guitar, Check } from 'lucide-react';
import { api } from '../api.js';
import { navigate } from '../router.js';
import { useApi, Spinner, ErrorBox, useToast, fmtDate, fmtTime, relDay, EVENT_TYPES } from '../ui.jsx';
import EventForm from '../components/EventForm.jsx';
import { KEYS } from '../lib/chart.js';

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Reordenar arrastrando (mouse y pantallas táctiles) desde la manija ⋮⋮ de cada fila. */
function useSortable(items, onDrop){
  const [drag, setDrag] = useState(null); // { from, to }
  const listRef = useRef(null);
  function start(i, ev){
    ev.preventDefault();
    const rows = [...listRef.current.children];
    const mids = rows.map(r => { const b = r.getBoundingClientRect(); return b.top + b.height / 2; });
    let to = i;
    setDrag({ from: i, to: i });
    const move = e => {
      const y = e.clientY;
      to = mids.filter(m => m < y).length;
      if (to > i) to -= 1;
      to = Math.max(0, Math.min(items.length - 1, to));
      setDrag({ from: i, to });
      const box = listRef.current.getBoundingClientRect();
      if (y < 80) window.scrollBy(0, -12); else if (y > window.innerHeight - 60) window.scrollBy(0, 12);
      void box;
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      setDrag(null);
      if (to !== i) onDrop(i, to);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  // Orden visible mientras se arrastra.
  const view = useMemo(() => {
    if (!drag || drag.from === drag.to) return items.map((it, i) => ({ it, i }));
    const a = items.map((it, i) => ({ it, i }));
    const [m] = a.splice(drag.from, 1); a.splice(drag.to, 0, m);
    return a;
  }, [items, drag]);
  return { listRef, start, drag, view };
}

export default function EventView({ id }){
  const toast = useToast();
  const ev = useApi(`/events/${id}`);
  const [editing, setEditing] = useState(false);
  const e = ev.data;
  const group = useApi(e ? `/groups/${e.group_id}` : null);
  const library = useApi(e ? '/songs' : null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(null);

  const call = async (path, opts, msg) => { try { const r = await api(path, opts); if (msg) toast(msg); ev.reload(); return r; } catch (err) { toast(err.message, 'error'); } };
  const items = e?.items || [];
  const reorder = (from, to) => {
    const ids = items.map(x => x.id);
    const [m] = ids.splice(from, 1); ids.splice(to, 0, m);
    ev.setData({ ...e, items: ids.map(x => items.find(it => it.id === x)) });
    call(`/events/${id}/order`, { method: 'PUT', body: { item_ids: ids } });
  };
  const sort = useSortable(items, reorder);
  const inSet = new Set(items.map(i => i.song_id));
  const titles = new Set(items.map(i => norm(i.title)));
  const results = useMemo(() => {
    const all = library.data?.items || [];
    const mine = all.filter(s => s.group_id === e?.group_id);
    const list = q ? all.filter(s => norm(`${s.title} ${s.author} ${s.group_name}`).includes(norm(q))) : mine;
    return [...list].sort((a, b) => (a.group_id === e?.group_id ? 0 : 1) - (b.group_id === e?.group_id ? 0 : 1)).slice(0, 40);
  }, [library.data, q, e?.group_id]);

  if (ev.loading && !e) return <Spinner />;
  if (ev.error) return <ErrorBox error={ev.error} />;

  async function addSong(s){
    setAdding(s.id);
    await call(`/events/${id}/items`, { method: 'POST', body: { song_id: s.id, performance_key: s.original_key } }, s.group_id === e.group_id ? `"${s.title}" agregada` : `"${s.title}" copiada al grupo y agregada`);
    setAdding(null);
  }
  const update = (item, patch) => call(`/events/${id}/items/${item.id}`, { method: 'PATCH', body: patch });
  async function remove(){
    if (!confirm(`¿Eliminar "${e.title}"?`)) return;
    try { await api(`/events/${id}`, { method: 'DELETE' }); toast('Evento eliminado'); navigate(`/groups/${e.group_id}/agenda`); } catch (err) { toast(err.message, 'error'); }
  }
  const back = `event=${id}&group=${e.group_id}`;

  return <>
    <header className="page-head">
      <div>
        <a className="crumb" href="#/agenda">← Agenda</a>
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
        <a className={`btn primary ${!items.length ? 'disabled' : ''}`} href={items.length ? `#/present/event/${id}` : undefined}><MonitorPlay size={16} /> Proyectar repertorio</a>
        <a className="btn" href="#/musicos" title="Vista con acordes para los músicos"><Guitar size={16} /> Músicos</a>
        <button className="icon-btn" title="Editar" onClick={() => setEditing(true)}><Pencil size={17} /></button>
        <button className="icon-btn danger" title="Eliminar" onClick={remove}><Trash2 size={17} /></button>
      </div>
    </header>

    <a className="ev-group" href={`#/groups/${e.group_id}`} style={{ '--c': group.data?.color || 'var(--gold)' }}>
      <span className="eg-dot" /><span><small>Grupo a cargo</small><b>{e.group_name}</b></span>
      <span className="eg-members"><Users size={14} /> {group.data?.members.length ?? '…'} integrantes</span>
    </a>
    {e.notes && <div className="banner info pre">{e.notes}</div>}

    <div className="ev-layout">
      <section className="panel">
        <div className="panel-head"><h2>Repertorio</h2><small className="muted">{items.length} {items.length === 1 ? 'canción' : 'canciones'}{items.length > 1 && ' · arrastrá ⋮⋮ para ordenar'}</small></div>
        {items.length ? <ol className="rep-list" ref={sort.listRef}>{sort.view.map(({ it, i }, pos) => <li key={it.id} className={`rep-item ${sort.drag?.from === i ? 'dragging' : ''}`}>
          <button className="rep-grip" onPointerDown={x => sort.start(i, x)} title="Arrastrar para ordenar" aria-label="Arrastrar para ordenar"><GripVertical size={18} /></button>
          <span className="rep-pos">{pos + 1}</span>
          <span className="rep-main">
            <a href={`#/songs/${it.song_id}${it.performance_key ? `?key=${encodeURIComponent(it.performance_key)}` : ''}`} className="rep-title">{it.title} <ExternalLink size={13} /></a>
            <small>{it.author || 'Autor no indicado'}{it.song_status === 'review' && ' · ⚠ revisar transcripción'}</small>
            <input className="inline-note" defaultValue={it.notes || ''} placeholder="Nota (ej.: entra solo el piano)…" onBlur={x => x.target.value !== (it.notes || '') && update(it, { notes: x.target.value })} />
          </span>
          <span className="rep-fields">
            <label className="mini-field"><small>Tono</small>
              <select value={it.performance_key || ''} onChange={x => update(it, { performance_key: x.target.value })}>
                <option value="">—</option>{[...new Set([it.performance_key, it.original_key, ...KEYS].filter(Boolean))].map(k => <option key={k} value={k}>{k}{k === it.original_key ? ' (orig.)' : ''}</option>)}
              </select></label>
            <label className="mini-field"><small>Dirige</small>
              <select value={it.assigned_to || ''} onChange={x => update(it, { assigned_to: x.target.value || null })}>
                <option value="">—</option>{group.data?.members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select></label>
          </span>
          <button className="icon-btn sm danger rep-del" onClick={() => confirm(`¿Quitar "${it.title}" del repertorio?`) && call(`/events/${id}/items/${it.id}`, { method: 'DELETE' })} aria-label="Quitar" title="Quitar del repertorio"><X size={14} /></button>
        </li>)}</ol> : <div className="rep-empty"><Music2 size={28} /><b>Todavía no hay canciones para este culto</b><span>Buscalas en el cancionero, creá una nueva o importala desde internet, PDF o foto.</span></div>}
      </section>

      <section className="panel ev-add">
        <div className="panel-head"><h2><Plus size={18} /> Agregar canciones</h2></div>
        <div className="ev-add-actions">
          <a className="btn primary" href={`#/songs/new?${back}`}><FilePlus2 size={16} /> Nueva canción</a>
          <a className="btn" href={`#/import?${back}`}><Sparkles size={16} /> Buscar o importar</a>
        </div>
        <div className="lc-search"><Search size={16} /><input value={q} onChange={x => setQ(x.target.value)} placeholder="Buscar en el cancionero de la iglesia…" /></div>
        <div className="ev-results">
          {library.loading && <Spinner />}
          {library.data && !results.length && <p className="muted small">{q ? 'No se encontraron canciones. Creala con “Nueva canción” o buscala con “Buscar o importar”.' : 'El grupo todavía no tiene canciones: buscá en el cancionero o creá una nueva.'}</p>}
          {results.map(s => { const added = inSet.has(s.id) || (s.group_id !== e.group_id && titles.has(norm(s.title))); return <button key={s.id} className={`ev-res ${added ? 'added' : ''}`} disabled={added || adding === s.id} onClick={() => addSong(s)}>
            <Music2 size={16} /><span className="grow"><b>{s.title}</b><small>{[s.author, s.group_id !== e.group_id && s.group_name].filter(Boolean).join(' · ')}</small></span>
            {s.original_key && <em>{s.original_key}</em>}
            {added ? <span className="ev-ok"><Check size={14} /> En el repertorio</span> : <span className="ev-plus"><Plus size={15} /></span>}
          </button>; })}
        </div>
      </section>
    </div>
    {editing && <EventForm event={e} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); ev.reload(); }} />}
  </>;
}
