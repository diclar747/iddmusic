import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, FolderOpen, Loader2, Music2, X } from 'lucide-react';
import { api } from '../api.js';

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Buscador para sumar canciones a la proyección (del cancionero o desde un archivo de la computadora). */
export default function SongPicker({ onPick, onFiles, accept, inSet = [] }){
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [all, setAll] = useState(null);
  const ref = useRef(null);
  const fileRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    if (!all) api('/songs').then(d => setAll(d.items)).catch(() => setAll([]));
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = e => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const items = useMemo(() => (all || []).filter(s => !q || norm(`${s.title} ${s.author} ${s.group_name}`).includes(norm(q))).slice(0, 60), [all, q]);
  return <div className="sp-picker" ref={ref}>
    <button className={`sp-add ${open ? 'on' : ''}`} onClick={() => setOpen(o => !o)}>{open ? <X size={16} /> : <Plus size={16} />} Agregar canción</button>
    {open && <div className="sp-menu">
      <div className="sp-search"><Search size={15} /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar en el cancionero…" onKeyDown={e => { if (e.key === 'Enter' && items[0]) { onPick(items[0].id); setOpen(false); setQ(''); } }} /></div>
      <div className="sp-list">
        {!all && <div className="sp-empty"><Loader2 className="spin" size={16} /> Cargando…</div>}
        {all && !items.length && <div className="sp-empty">No se encontraron canciones</div>}
        {items.map(s => { const added = inSet.includes(s.id); return <button key={s.id} className={added ? 'added' : ''} onClick={() => { onPick(s.id); setOpen(false); setQ(''); }}>
          <Music2 size={15} /><span className="grow"><b>{s.title}</b><small>{[s.author, s.group_name].filter(Boolean).join(' · ')}</small></span>
          {s.original_key && <em>{s.original_key}</em>}{added && <i>en la lista</i>}
        </button>; })}
      </div>
      <button className="sp-file" onClick={() => fileRef.current?.click()}><FolderOpen size={15} /> Abrir de la computadora (.txt, ChordPro)…</button>
      <input ref={fileRef} type="file" hidden multiple accept={accept} onChange={e => { onFiles(e.target.files); e.target.value = ''; setOpen(false); }} />
    </div>}
  </div>;
}
