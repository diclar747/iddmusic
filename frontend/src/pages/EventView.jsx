import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Trash2, MonitorPlay, MapPin, Clock, X, Plus, Music2, ExternalLink, GripVertical, Search, Sparkles, FilePlus2, Users, Guitar, Check, ChevronLeft, ChevronRight, Minus } from 'lucide-react';
import { api } from '../api.js';
import { navigate } from '../router.js';
import { useApi, Spinner, ErrorBox, useToast, fmtDate, fmtTime, relDay, EVENT_TYPES } from '../ui.jsx';
import EventForm from '../components/EventForm.jsx';
import { KEYS, transposeSections, transposeChord, keyDistance } from '../lib/chart.js';
import ChartView from '../components/ChartView.jsx';
import ChurchSongbook from '../components/ChurchSongbook.jsx';
import { useChurch, churchCover } from '../components/TopBar.jsx';

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

/** Panel de una canción del repertorio: vista previa en el tono del culto, proyectar desde ahí, editar o abrir. */
function SongSheet({ eventId, items, index, onIndex, onClose, onKey }){
  const it = items[index];
  const song = useApi(it ? `/songs/${it.song_id}` : null);
  const s = song.data?.id === it?.song_id ? song.data : null;
  const [shift, setShift] = useState(0);
  const [chords, setChords] = useState(true);
  useEffect(() => { setShift(s && it.performance_key && s.original_key ? keyDistance(s.original_key, it.performance_key) : 0); }, [s?.id, it?.performance_key]);
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onClose]);
  const sections = useMemo(() => transposeSections(s?.lyrics_sections, shift), [s, shift]);
  if (!it) return null;
  const key = s?.original_key ? transposeChord(s.original_key, shift) : it.performance_key;
  const keyQ = key ? `?key=${encodeURIComponent(key)}` : '';
  return <>
    <div className="song-sheet-back" onClick={onClose} />
    <aside className="song-sheet" role="dialog" aria-label={it.title}>
      <div className="ss-head">
        <button className="icon-btn ss-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        <div className="ss-top"><span className="rep-pos">{index + 1}</span><span><h2>{it.title}</h2><small>{it.author || 'Autor no indicado'}{key && ` · Tono ${key}`}</small></span></div>
        <div className="ss-nav">
          <button disabled={index === 0} onClick={() => onIndex(index - 1)}><ChevronLeft size={15} /> Anterior</button>
          <button disabled={index === items.length - 1} onClick={() => onIndex(index + 1)}>Siguiente <ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="ss-actions">
        <a className="btn gold wide" href={`#/present/event/${eventId}?song=${it.song_id}`}><MonitorPlay size={17} /> Proyectar desde esta canción</a>
        <a className="btn" href={`#/songs/${it.song_id}/edit?event=${eventId}`}><Pencil size={16} /> Editar letra y acordes</a>
        <a className="btn" href={`#/songs/${it.song_id}${keyQ}`}><ExternalLink size={16} /> Abrir canción</a>
      </div>
      <div className="ss-tools">
        <div className="tgroup"><span className="tlabel">Tono</span>
          <button onClick={() => setShift(x => Math.max(-11, x - 1))} title="Bajar medio tono"><Minus size={15} /></button>
          <b className="tval">{key || (shift > 0 ? `+${shift}` : shift)}</b>
          <button onClick={() => setShift(x => Math.min(11, x + 1))} title="Subir medio tono"><Plus size={15} /></button>
        </div>
        <div className="tgroup">
          <button className={chords ? 'on txt' : 'txt'} onClick={() => setChords(true)}>Letra + acordes</button>
          <button className={!chords ? 'on txt' : 'txt'} onClick={() => setChords(false)}>Solo letra</button>
        </div>
        {key && key !== (it.performance_key || s?.original_key) && <button className="btn sm gold ss-save" onClick={() => onKey(it, key)}><Check size={14} /> Usar {key} en este culto</button>}
      </div>
      <div className="ss-body">
        {song.loading && !s ? <Spinner /> : song.error ? <ErrorBox error={song.error} /> : s && <ChartView sections={sections} showChords={chords} fontSize={16} />}
      </div>
    </aside>
  </>;
}

export default function EventView({ id }){
  const toast = useToast();
  const ev = useApi(`/events/${id}`);
  const [editing, setEditing] = useState(false);
  const e = ev.data;
  const group = useApi(e ? `/groups/${e.group_id}` : null);
  const [adding, setAdding] = useState(null);
  const [open, setOpen] = useState(null); // id del ítem abierto en el panel
  const church = useChurch();
  const closeSheet = useCallback(() => setOpen(null), []);

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

  if (ev.loading && !e) return <Spinner />;
  if (ev.error) return <ErrorBox error={ev.error} />;

  async function addSong(s){
    setAdding(s.id);
    await call(`/events/${id}/items`, { method: 'POST', body: { song_id: s.id, performance_key: s.original_key } }, (s.group_ids || [s.group_id]).includes(e.group_id) ? `"${s.title}" agregada` : `"${s.title}" copiada al grupo y agregada`);
    setAdding(null);
  }
  const update = (item, patch) => call(`/events/${id}/items/${item.id}`, { method: 'PATCH', body: patch });
  async function remove(){
    if (!confirm(`¿Eliminar "${e.title}"?`)) return;
    try { await api(`/events/${id}`, { method: 'DELETE' }); toast('Evento eliminado'); navigate(`/groups/${e.group_id}/agenda`); } catch (err) { toast(err.message, 'error'); }
  }
  const back = `event=${id}&group=${e.group_id}`;

  return <>
    <header className="page-head cover" style={{ '--cover': churchCover(church) }}>
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
        {items.length ? <ol className="rep-list" ref={sort.listRef}>{sort.view.map(({ it, i }, pos) => <li key={it.id} className={`rep-item ${sort.drag?.from === i ? 'dragging' : ''} ${open === it.id ? 'open' : ''}`} onClick={x => { if (!x.target.closest('button,a,input,select,label,textarea')) setOpen(it.id); }} title="Tocá para ver, proyectar o editar">
          <button className="rep-grip" onPointerDown={x => sort.start(i, x)} title="Arrastrar para ordenar" aria-label="Arrastrar para ordenar"><GripVertical size={18} /></button>
          <span className="rep-pos">{pos + 1}</span>
          <span className="rep-main">
            <button type="button" className="rep-title" onClick={() => setOpen(it.id)}>{it.title}</button>
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
        <h3 className="ev-sb-title">Cancionero de la iglesia</h3>
        <ChurchSongbook prefer={e.group_id} refresh={items.length} onPick={addSong} busyId={adding} isAdded={x => inSet.has(x.id) || titles.has(norm(x.title))} />
      </section>
    </div>
    {open && items.some(x => x.id === open) && <SongSheet eventId={id} items={items} index={items.findIndex(x => x.id === open)} onIndex={i => setOpen(items[i].id)} onClose={closeSheet} onKey={(it, k) => update(it, { performance_key: k })} />}
    {editing && <EventForm event={e} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); ev.reload(); }} />}
  </>;
}
