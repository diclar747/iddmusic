import React, { useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useApi, Spinner, ErrorBox, useToast } from '../ui.jsx';
import Stage from './Stage.jsx';
import { THEMES, DEFAULT_SETTINGS, themeById, prepareImage } from '../lib/themes.js';

/** Galería de plantillas incluidas + imágenes propias del grupo para proyectar. */
export default function Backgrounds({ groupId }){
  const toast = useToast();
  const { data, loading, error, reload } = useApi(`/groups/${groupId}/backgrounds`);
  const [busy, setBusy] = useState(false);
  const sample = { kind: 'lyrics', lines: ['Santo, santo, santo', 'Señor omnipotente'] };
  async function upload(e){
    const files = [...e.target.files]; e.target.value = '';
    setBusy(true);
    try { for (const f of files) { const form = new FormData(); form.append('file', await prepareImage(f)); await api(`/groups/${groupId}/backgrounds`, { method: 'POST', form }); } toast('Fondo agregado'); reload(); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  async function remove(b){ if (!confirm(`¿Quitar "${b.original_name}"?`)) return; try { await api(`/groups/${groupId}/backgrounds/${b.id}`, { method: 'DELETE' }); reload(); } catch (err) { toast(err.message, 'error'); } }
  return <>
    <div className="panel-head"><h2>Fondos de proyección</h2>
      <label className={`btn primary sm ${busy ? 'disabled' : ''}`}><Upload size={15} /> {busy ? 'Subiendo…' : 'Subir imagen propia'}<input type="file" hidden multiple accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={busy} /></label></div>
    <p className="muted small">Estas plantillas se eligen en el modo proyección (botón <b>Proyectar</b> en una canción o en un evento). La letra aparece sin acordes, frase por frase. Subí fotos horizontales (1920×1080 ideal): paisajes, la iglesia, etc.</p>
    {loading && <Spinner />}<ErrorBox error={error} />
    {data?.items.length > 0 && <><h3>Imágenes del grupo</h3><div className="bg-grid">{data.items.map(b => <figure key={b.id}>
      <Stage slide={sample} theme={themeById('img:' + b.id, data.items)} settings={DEFAULT_SETTINGS} animate={false} />
      <figcaption>{b.original_name}<button className="icon-btn sm danger" onClick={() => remove(b)} title="Quitar"><Trash2 size={14} /></button></figcaption></figure>)}</div></>}
    {[...new Set(THEMES.map(t => t.group))].map(g => <div key={g}><h3>{g}</h3><div className="bg-grid">{THEMES.filter(t => t.group === g).map(t => <figure key={t.id}>
      <Stage slide={sample} theme={t} settings={DEFAULT_SETTINGS} animate={false} /><figcaption>{t.name}</figcaption></figure>)}</div></div>)}
  </>;
}
