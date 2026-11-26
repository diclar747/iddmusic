import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, X, Upload, Trash2, Radio, Loader2 } from 'lucide-react';
import { api, protectedUrl } from '../api.js';
import { useToast } from '../ui.jsx';
import { prepareImage } from '../lib/themes.js';

/** Sube imágenes de la computadora a la biblioteca del grupo (quedan para todos los integrantes). */
export async function uploadImages(groupId, files){
  const out = [];
  for (const f of files) {
    const form = new FormData(); form.append('file', await prepareImage(f));
    out.push(await api(`/groups/${groupId}/backgrounds`, { method: 'POST', form }));
  }
  return out;
}

function Thumb({ id, onClick, title }){
  const [url, setUrl] = useState(null);
  useEffect(() => { protectedUrl(`/files/backgrounds/${id}`).then(setUrl).catch(() => {}); }, [id]);
  return <button className="mi-img" style={{ backgroundImage: url ? `url(${url})` : 'none' }} onClick={onClick} title={title} />;
}

/** Imágenes: proyectar a pantalla completa (avisos, flyers, fotos), usar de fondo, de pantalla de espera o como logo. */
export default function MediaPanel({ groups, libGroup, setLibGroup, items, reload, settings, set, liveImageId, onProject, onClear, onClose }){
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef(null);
  async function add(list){
    const files = [...list].filter(f => f.type.startsWith('image/'));
    if (!files.length) { toast('Elegí imágenes (JPG, PNG o WEBP)', 'error'); return; }
    if (!libGroup) { toast('Necesitás pertenecer a un grupo para guardar imágenes', 'error'); return; }
    setBusy(true);
    try { const up = await uploadImages(libGroup, files); toast(up.length > 1 ? `${up.length} imágenes agregadas` : 'Imagen agregada'); await reload(); }
    catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }
  async function remove(b){
    if (!confirm(`¿Quitar "${b.original_name}" de la biblioteca del grupo?`)) return;
    try { await api(`/groups/${libGroup}/backgrounds/${b.id}`, { method: 'DELETE' }); if (liveImageId === b.id) onClear(); reload(); } catch (e) { toast(e.message, 'error'); }
  }
  const imgId = b => 'img:' + b.id;
  return <aside className="present-panel">
    <div className="pp-head"><b><ImageIcon size={16} /> Imágenes</b><button className="icon-btn dark" onClick={onClose}><X size={16} /></button></div>
    {groups?.length > 1 && <label className="pp-row"><span>Biblioteca</span><select value={libGroup || ''} onChange={e => setLibGroup(e.target.value)}>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
    <div className={`media-drop ${drag ? 'over' : ''}`} onClick={() => !busy && input.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}>
      {busy ? <><Loader2 className="spin" size={22} /> Subiendo…</> : <><Upload size={22} /><b>Subir imágenes de la computadora</b><small className="muted">Arrastralas acá o tocá para buscarlas · JPG, PNG, WEBP</small></>}
      <input ref={input} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif,image/bmp" onChange={e => { add(e.target.files); e.target.value = ''; }} />
    </div>
    {liveImageId && <div className="pp-foot"><span className="muted small">Hay una imagen en el proyector</span><button className="btn ghost-dark sm" onClick={onClear}><X size={14} /> Quitar del proyector</button></div>}
    {items.length ? <div className="media-grid">{items.map(b => <div key={b.id} className={`media-item ${liveImageId === b.id ? 'live' : ''}`}>
      <Thumb id={b.id} onClick={() => onProject(b)} title="Proyectar a pantalla completa" />
      <div className="mi-name" title={b.original_name}>{b.original_name}</div>
      <div className="mi-acts">
        <button onClick={() => onProject(b)} title="Proyectar a pantalla completa (avisos, flyers, fotos)"><Radio size={11} /> Proyectar</button>
        <button className={settings.theme === imgId(b) ? 'on' : ''} onClick={() => set({ theme: imgId(b), overlay: null })} title="Usar como fondo de la letra">Fondo</button>
        <button className={settings.standbyTheme === imgId(b) ? 'on' : ''} onClick={() => set({ standbyTheme: imgId(b) })} title="Usar como fondo de la pantalla de espera">Espera</button>
        <button className={settings.logoImage === b.id ? 'on' : ''} onClick={() => set({ logoImage: settings.logoImage === b.id ? '' : b.id })} title="Usar como logo (pantalla de espera, fondo con logo y esquina)">Logo</button>
        <button onClick={() => remove(b)} title="Quitar de la biblioteca"><Trash2 size={11} /></button>
      </div>
    </div>)}</div> : <p className="muted small">Todavía no hay imágenes. Subí fotos de la iglesia, paisajes, avisos o el logo. Quedan guardadas en el grupo para todos los integrantes.</p>}
    <p className="muted small">Ideal: imágenes horizontales de 1920×1080. Las grandes se achican solas antes de subir.</p>
  </aside>;
}
