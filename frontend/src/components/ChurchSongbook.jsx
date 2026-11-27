import React, { useEffect, useState } from 'react';
import { Search, Music2, Plus, Check, ChevronLeft, ChevronRight, Flame, SortAsc, History, X } from 'lucide-react';
import { useApi, Spinner, ErrorBox, fmtShort } from '../ui.jsx';

const SORTS = [
  { id: 'played', label: 'Más tocadas', icon: Flame },
  { id: 'title', label: 'A – Z', icon: SortAsc },
  { id: 'recent', label: 'Tocadas hace poco', icon: History }
];

const when = d => { if (!d) return ''; const x = fmtShort(d); return `${x.day} ${x.month}`; };

/**
 * Cancionero de toda la iglesia (todos los grupos), con veces tocadas, filtros y paginación.
 * - onPick(song): si se pasa, cada canción tiene botón "+" (agregar al culto).
 * - isAdded(song): marca las que ya están en el repertorio.
 * - prefer: grupo cuya copia se prefiere (el grupo del culto).
 */
export default function ChurchSongbook({ onPick, isAdded = () => false, busyId = null, prefer = '', per = 10, compact = false, initialQ = '', refresh = 0 }){
  const [q, setQ] = useState(initialQ);
  const [dq, setDq] = useState(initialQ);
  const [sort, setSort] = useState('played');
  const [group, setGroup] = useState('');
  const [onlyPlayed, setOnlyPlayed] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(1); }, [dq, sort, group, onlyPlayed]);
  const qs = new URLSearchParams({ q: dq, sort, page, per, ...(group && { group_id: group }), ...(prefer && { prefer }), ...(onlyPlayed && { played: '1' }) });
  const { data, loading, error } = useApi(`/songs/church?${qs}`, [refresh]);

  return <div className={`songbook ${compact ? 'compact' : ''}`}>
    <div className="lc-search sb-search"><Search size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por título o autor…" />{q && <button className="sb-clear" onClick={() => setQ('')} aria-label="Limpiar"><X size={14} /></button>}</div>
    <div className="sb-filters">
      <div className="sb-sorts">{SORTS.map(s => <button key={s.id} className={sort === s.id ? 'on' : ''} onClick={() => setSort(s.id)}><s.icon size={13} /> {s.label}</button>)}</div>
      <div className="sb-row">
        <select value={group} onChange={e => setGroup(e.target.value)} aria-label="Grupo">
          <option value="">Todos los grupos</option>
          {data?.groups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <label className="sb-check"><input type="checkbox" checked={onlyPlayed} onChange={e => setOnlyPlayed(e.target.checked)} /> Solo las que ya tocamos</label>
      </div>
    </div>

    <div className="sb-meta">{data ? <>{data.total} {data.total === 1 ? 'canción' : 'canciones'} en el cancionero de la iglesia</> : ' '}</div>
    <ErrorBox error={error} />
    <div className={`sb-list ${loading ? 'loading' : ''}`}>
      {loading && !data && <Spinner />}
      {data && !data.items.length && <p className="muted small sb-empty">{dq || group || onlyPlayed ? 'No hay canciones con ese filtro.' : 'Todavía no hay canciones en el cancionero.'}</p>}
      {data?.items.map(s => {
        const added = isAdded(s);
        const body = <>
          <span className="sb-icon"><Music2 size={16} /></span>
          <span className="grow sb-main">
            <b>{s.title}</b>
            <small>{[s.author, s.groups].filter(Boolean).join(' · ')}</small>
            <span className="sb-stats">{s.times_played > 0
              ? <><span className="sb-played"><Flame size={12} /> {s.times_played === 1 ? 'Tocada 1 vez' : `Tocada ${s.times_played} veces`}</span><span>· última {when(s.last_played)}</span></>
              : <span className="sb-new">Todavía no se tocó</span>}</span>
          </span>
          {s.original_key && <em className="sb-key">{s.original_key}</em>}
        </>;
        if (!onPick) return <a key={s.id} className="sb-item" href={`#/songs/${s.id}`}>{body}<ChevronRight size={16} className="muted" /></a>;
        return <button key={s.id} className={`sb-item ${added ? 'added' : ''}`} disabled={added || busyId === s.id} onClick={() => onPick(s)} title={added ? 'Ya está en el repertorio' : 'Agregar al repertorio'}>
          {body}
          {added ? <span className="ev-ok"><Check size={14} /> Agregada</span> : <span className="ev-plus"><Plus size={15} /></span>}
        </button>;
      })}
    </div>

    {data && data.pages > 1 && <div className="sb-pager">
      <button className="btn sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15} /> Anterior</button>
      <span>Página <b>{data.page}</b> de {data.pages}</span>
      <button className="btn sm" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Siguiente <ChevronRight size={15} /></button>
    </div>}
  </div>;
}
