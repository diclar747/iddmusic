import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, Minus, Plus, MonitorPlay, Paperclip, FileText, Image as ImageIcon, Music, History, Eye, EyeOff, CheckCircle2, Upload, X, Download } from 'lucide-react';
import { api, protectedUrl } from '../api.js';
import { navigate } from '../router.js';
import { useApi, Spinner, ErrorBox, Modal, useToast, Busy, fmtAgo, STATUS } from '../ui.jsx';
import ChartView from '../components/ChartView.jsx';
import { transposeSections, transposeChord, keyDistance } from '../lib/chart.js';

export default function SongView({ id, query }){
  const toast = useToast();
  const { data: song, loading, error, reload } = useApi(`/songs/${id}`);
  const [shift, setShift] = useState(0);
  const [flat, setFlat] = useState(false);
  const [size, setSize] = useState(() => Number(localStorage.getItem('idd_font') || 18));
  const [chords, setChords] = useState(true);
  const [history, setHistory] = useState(false);
  const [viewer, setViewer] = useState(null);
  useEffect(() => { localStorage.setItem('idd_font', size); }, [size]);
  useEffect(() => { if (song && query.key) setShift(keyDistance(song.original_key, query.key)); }, [song?.id, query.key]);
  const sections = useMemo(() => transposeSections(song?.lyrics_sections, shift, flat || undefined), [song, shift, flat]);
  if (loading && !song) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const key = song.original_key ? transposeChord(song.original_key, shift, flat || undefined) : null;

  async function remove(){
    if (!confirm(`¿Eliminar "${song.title}" y sus archivos? No se puede deshacer.`)) return;
    try { await api(`/songs/${id}`, { method: 'DELETE' }); toast('Canción eliminada'); navigate(`/groups/${song.group_id}`); } catch (e) { toast(e.message, 'error'); }
  }
  async function approve(){
    try { await api(`/songs/${id}`, { method: 'PATCH', body: { status: 'published', change_note: 'Transcripción revisada' } }); toast('Marcada como revisada'); reload(); } catch (e) { toast(e.message, 'error'); }
  }
  return <>
    <header className="page-head">
      <div>
        <a className="crumb" href={`#/groups/${song.group_id}`}>← {song.group_name}</a>
        <h1>{song.title}</h1>
        <p className="muted">{song.author || 'Autor no indicado'}{song.category && ` · ${song.category}`}</p>
        <div className="meta-pills">
          {key && <span className="pill key-pill">Tono {key}{shift !== 0 && <small> (original {song.original_key})</small>}</span>}
          {song.tempo_bpm && <span className="pill soft">{song.tempo_bpm} BPM</span>}
          {song.time_signature && <span className="pill soft">{song.time_signature}</span>}
          <span className={`pill ${song.status === 'review' ? 'warn' : 'soft'}`}>{STATUS[song.status]}</span>
          {song.source === 'ai_import' && <span className="pill ai">Importada con IA</span>}
        </div>
      </div>
      <div className="head-actions">
        <a className="btn primary" href={`#/present/song/${id}${shift ? `?shift=${shift}` : ''}`}><MonitorPlay size={16} /> Proyectar</a>
        <a className="btn" href={`#/songs/${id}/edit`}><Pencil size={16} /> Editar</a>
        <button className="icon-btn" title="Historial de versiones" onClick={() => setHistory(true)}><History size={17} /></button>
        <button className="icon-btn danger" title="Eliminar" onClick={remove}><Trash2 size={17} /></button>
      </div>
    </header>
    {song.status === 'review' && <div className="banner warn"><span>Esta canción se importó con IA. Revisá letra y acordes contra el original y marcala como revisada.</span>
      <a className="btn sm" href={`#/songs/${id}/edit`}>Revisar</a><button className="btn sm primary" onClick={approve}><CheckCircle2 size={15} /> Marcar revisada</button></div>}
    <div className="song-layout">
      <section className="panel sheet">
        <div className="toolbar">
          <div className="tgroup"><span className="tlabel">Tono</span>
            <button onClick={() => setShift(s => Math.max(-11, s - 1))} title="Bajar medio tono"><Minus size={15} /></button>
            <b className="tval">{shift > 0 ? `+${shift}` : shift}</b>
            <button onClick={() => setShift(s => Math.min(11, s + 1))} title="Subir medio tono"><Plus size={15} /></button>
            {shift !== 0 && <button className="txt" onClick={() => setShift(0)}>Original</button>}
            <button className={`txt ${flat ? 'on' : ''}`} onClick={() => setFlat(f => !f)} title="Preferir bemoles">♭</button>
          </div>
          <div className="tgroup"><span className="tlabel">Letra</span>
            <button onClick={() => setSize(s => Math.max(12, s - 1))}>A−</button><button onClick={() => setSize(s => Math.min(34, s + 1))}>A+</button>
          </div>
          <button className={`chip ${chords ? 'on' : ''}`} onClick={() => setChords(c => !c)}>{chords ? <Eye size={15} /> : <EyeOff size={15} />} Acordes</button>
        </div>
        <ChartView sections={sections} showChords={chords} fontSize={size} />
      </section>
      <aside className="side-col">
        {song.notes && <section className="panel"><h3>Notas</h3><p className="pre">{song.notes}</p></section>}
        <Files song={song} reload={reload} onOpen={setViewer} />
        <section className="panel small muted">
          <div>Cargada por <b>{song.created_by_name || '—'}</b></div>
          <div>Última edición: <b>{song.updated_by_name || '—'}</b> · {fmtAgo(song.updated_at)}</div>
        </section>
      </aside>
    </div>
    {history && <Versions song={song} onClose={() => setHistory(false)} onRestored={() => { setHistory(false); reload(); }} />}
    {viewer && <FileViewer file={viewer} onClose={() => setViewer(null)} />}
  </>;
}

const ICONS = { pdf: FileText, image: ImageIcon, audio: Music, other: Paperclip };
function Files({ song, reload, onOpen }){
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function upload(e){
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    const form = new FormData(); files.forEach(f => form.append('files', f));
    setBusy(true);
    try { await api(`/songs/${song.id}/files`, { method: 'POST', form }); toast('Archivo adjuntado'); reload(); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  async function remove(f){
    if (!confirm(`¿Quitar "${f.original_name}"?`)) return;
    try { await api(`/songs/${song.id}/files/${f.id}`, { method: 'DELETE' }); reload(); } catch (err) { toast(err.message, 'error'); }
  }
  return <section className="panel">
    <div className="panel-head"><h3>Partituras y archivos</h3>
      <label className={`btn sm ${busy ? 'disabled' : ''}`}><Upload size={14} /> {busy ? 'Subiendo…' : 'Adjuntar'}<input type="file" hidden multiple accept="application/pdf,image/*,audio/*" onChange={upload} disabled={busy} /></label></div>
    {song.files.length ? <ul className="files">{song.files.map(f => { const I = ICONS[f.file_type] || Paperclip; return <li key={f.id}>
      <button className="file-open" onClick={() => onOpen(f)}><I size={17} /><span className="grow">{f.original_name}<small>{f.uploaded_by_name} · {f.size_bytes ? `${(f.size_bytes / 1024 / 1024).toFixed(1)} MB` : ''}</small></span></button>
      <button className="icon-btn danger sm" onClick={() => remove(f)} title="Quitar"><X size={14} /></button></li>; })}</ul>
      : <p className="muted small">PDF de partitura, foto del cifrado o audio de referencia para el grupo.</p>}
  </section>;
}

export function FileViewer({ file, onClose }){
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { protectedUrl(`/files/${file.id}`).then(setUrl).catch(setErr); }, [file.id]);
  return <Modal title={file.original_name} onClose={onClose} wide footer={url && <a className="btn sm" href={url} download={file.original_name}><Download size={14} /> Descargar</a>}>
    {err ? <ErrorBox error={err} /> : !url ? <Spinner /> :
      file.file_type === 'pdf' ? <iframe className="viewer" src={url} title={file.original_name} /> :
      file.file_type === 'image' ? <img className="viewer-img" src={url} alt={file.original_name} /> :
      file.file_type === 'audio' ? <audio controls src={url} style={{ width: '100%' }} /> : <a href={url} download={file.original_name}>Descargar</a>}
  </Modal>;
}

function Versions({ song, onClose, onRestored }){
  const toast = useToast();
  const { data, loading, error } = useApi(`/songs/${song.id}/versions`);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  async function restore(v){
    if (!confirm(`¿Restaurar la versión ${v.version_number}? El estado actual queda guardado en el historial.`)) return;
    setBusy(true);
    try { await api(`/songs/${song.id}/versions/${v.id}/restore`, { method: 'POST' }); toast('Versión restaurada'); onRestored(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }
  return <Modal title="Historial de versiones" onClose={onClose} wide>
    {loading && <Spinner />}<ErrorBox error={error} />
    {data && !data.items.length && <p className="muted">Todavía no hay ediciones guardadas.</p>}
    <div className="versions">
      <ul>{data?.items.map(v => <li key={v.id} className={preview?.id === v.id ? 'on' : ''}><button onClick={() => setPreview(v)}>
        <b>v{v.version_number}</b> · {v.change_note}<small>{v.changed_by_name} · {fmtAgo(v.created_at)}</small></button></li>)}</ul>
      <div className="vprev">{preview ? <>
        <div className="panel-head"><b>{preview.snapshot.title}</b><Busy busy={busy} className="btn sm primary" onClick={() => restore(preview)}>Restaurar esta versión</Busy></div>
        <ChartView sections={preview.snapshot.lyrics_sections} fontSize={14} /></> : <p className="muted">Elegí una versión para ver cómo estaba antes de esa edición.</p>}</div>
    </div>
  </Modal>;
}
