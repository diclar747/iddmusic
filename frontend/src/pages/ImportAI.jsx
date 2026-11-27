import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Upload, FileText, X, Save, RotateCcw, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../api.js';
import { navigate } from '../router.js';
import { useApi, Field, Busy, useToast, ErrorBox } from '../ui.jsx';
import { SongFields } from './SongEdit.jsx';
import { parseChart } from '../lib/chart.js';
import { SONG_TEXT_ACCEPT, isSongText, readTextFile, songFromText } from '../lib/files.js';
import LaCuerdaPanel from '../components/LaCuerdaPanel.jsx';

const MAX_PAGES = 8;
const MAX_SIDE = 2200;

/** Reduce imágenes grandes a JPEG para que la subida sea rápida y no supere el límite de Niro (12 MB). */
async function shrinkImage(blob, name){
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  if (scale === 1 && blob.size < 4 * 1024 * 1024) { bmp.close?.(); return new File([blob], name, { type: blob.type }); }
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const out = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
  return new File([out], name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

/** Convierte cada página de un PDF en imagen (funciona con PDFs escaneados y con texto). */
async function pdfToImages(file){
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  const n = Math.min(doc.numPages, MAX_PAGES);
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2.5, MAX_SIDE / Math.max(base.width, base.height)) });
    const c = document.createElement('canvas'); c.width = viewport.width; c.height = viewport.height;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    pages.push(new File([blob], `${file.name.replace(/\.pdf$/i, '')}-p${i}.jpg`, { type: 'image/jpeg' }));
  }
  return { pages, total: doc.numPages };
}

export default function ImportAI({ groupId }){
  const toast = useToast();
  const groups = useApi('/groups');
  const status = useApi('/import/status');
  const [group, setGroup] = useState(groupId || '');
  const [originals, setOriginals] = useState([]); // archivos tal cual los subió el usuario (se adjuntan a la canción)
  const [pages, setPages] = useState([]); // [{file, url, state: idle|working|done|error, error}]
  const [preparing, setPreparing] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState(null);
  const [chart, setChart] = useState('');
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState(false);
  const [bulk, setBulk] = useState(null); // varias canciones de texto a guardar de una vez
  const input = useRef(null);
  async function saveBulk(){
    if (!group) { toast('Elegí el grupo', 'error'); return; }
    setSaving(true);
    let ok = 0;
    for (const s of bulk) {
      try {
        await api('/songs', { method: 'POST', body: { group_id: group, source: 'manual', status: 'review', title: s.title, author: s.author, original_key: s.original_key, tempo_bpm: Number(s.tempo_bpm) || null, time_signature: s.time_signature, lyrics_sections: s.lyrics_sections } });
        ok++;
      } catch (e) { toast(`${s.title}: ${e.message}`, 'error'); }
    }
    setSaving(false);
    toast(`${ok} canciones guardadas en el grupo`);
    if (ok) navigate(`/groups/${group}`);
  }
  useEffect(() => { if (!group && groups.data?.items[0]) setGroup(groups.data.items[0].id); }, [groups.data]);
  useEffect(() => () => pages.forEach(p => URL.revokeObjectURL(p.url)), []);

  async function addFiles(list){
    // Archivos de texto / ChordPro: se leen directo, sin IA y sin costo.
    const texts = [...list].filter(isSongText);
    if (texts.length) {
      const songs = [];
      for (const f of texts) { const s = songFromText(await readTextFile(f), f.name); if (s.lyrics_sections.length) songs.push({ ...s, file: f }); }
      if (!songs.length) toast('No se encontró letra en el archivo', 'error');
      else if (songs.length === 1) {
        const s = songs[0];
        setOriginals([s.file]); setResult(null); setBulk(null);
        setMeta({ title: s.title, author: s.author, original_key: s.original_key, tempo_bpm: s.tempo_bpm, time_signature: s.time_signature, category: '', notes: '' });
        setChart(s.chart); toast('Archivo abierto: revisalo y guardalo');
      } else { setBulk(songs); setMeta(null); }
    }
    const files = [...list].filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'));
    if (!files.length) { if (!texts.length) toast('Elegí un PDF, imágenes (JPG, PNG, WEBP) o archivos de texto / ChordPro', 'error'); return; }
    setPreparing(true);
    try {
      const out = [];
      for (const f of files) {
        if (f.type === 'application/pdf') {
          const { pages: imgs, total } = await pdfToImages(f);
          if (total > MAX_PAGES) toast(`El PDF tiene ${total} páginas: se transcriben las primeras ${MAX_PAGES}.`);
          out.push(...imgs);
        } else out.push(await shrinkImage(f, f.name));
      }
      setOriginals(o => [...o, ...files]);
      setPages(p => [...p, ...out.map(file => ({ file, url: URL.createObjectURL(file), state: 'idle' }))].slice(0, MAX_PAGES));
      setResult(null); setMeta(null);
    } catch (e) { toast('No se pudo leer el archivo: ' + e.message, 'error'); }
    finally { setPreparing(false); }
  }

  function clearAll(){ pages.forEach(p => URL.revokeObjectURL(p.url)); setPages([]); setOriginals([]); setResult(null); setMeta(null); setChart(''); }

  async function transcribe(){
    setRunning(true);
    const parts = [];
    let first = null, cost = 0;
    const next = pages.map(p => ({ ...p, state: 'idle', error: null }));
    setPages(next);
    for (let i = 0; i < next.length; i++) {
      setPages(ps => ps.map((p, j) => j === i ? { ...p, state: 'working' } : p));
      try {
        const form = new FormData(); form.append('file', next[i].file);
        const r = await api('/import/transcribe', { method: 'POST', form });
        parts.push(r.chart); cost += Number(r.cost || 0);
        if (!first) first = r; else first = { ...first, title: first.title || r.title, author: first.author || r.author, key: first.key || r.key, tempo_bpm: first.tempo_bpm || r.tempo_bpm, time_signature: first.time_signature || r.time_signature };
        setPages(ps => ps.map((p, j) => j === i ? { ...p, state: 'done' } : p));
      } catch (e) {
        setPages(ps => ps.map((p, j) => j === i ? { ...p, state: 'error', error: e.message } : p));
        if (e.status === 503 || e.status === 401) { toast(e.message, 'error'); break; }
      }
    }
    setRunning(false);
    if (!parts.length) { toast('No se pudo transcribir ninguna página', 'error'); return; }
    setResult({ cost, pages: parts.length });
    setMeta({ title: first.title || originals[0]?.name.replace(/\.\w+$/, '') || 'Canción importada', author: first.author || '', original_key: first.key || '', tempo_bpm: first.tempo_bpm || '', time_signature: first.time_signature || '', category: '', notes: '' });
    setChart(parts.join('\n\n'));
    toast('Transcripción lista: revisala y guardala');
  }

  async function save(e){
    e.preventDefault();
    if (!group) { toast('Elegí el grupo', 'error'); return; }
    setSaving(true);
    try {

      const { sections } = parseChart(chart);
      const song = await api('/songs', { method: 'POST', body: { group_id: group, source: result ? 'ai_import' : 'manual', status: 'review', title: meta.title, author: meta.author, original_key: meta.original_key, tempo_bpm: meta.tempo_bpm === '' ? null : meta.tempo_bpm, time_signature: meta.time_signature, category: meta.category, notes: meta.notes, lyrics_sections: sections } });
      if (originals.length) {
        const form = new FormData(); originals.forEach(f => form.append('files', f));
        await api(`/songs/${song.id}/files`, { method: 'POST', form }).catch(err => toast('La canción se guardó, pero no se pudo adjuntar el original: ' + err.message, 'error'));
      }
      toast('Canción guardada en el grupo');
      navigate(`/songs/${song.id}`);
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  const aiOff = status.data && !status.data.ai_enabled;
  function fromLaCuerda(s){
    clearAll(); setBulk(null);
    setMeta({ title: s.title || 'Canción', author: s.author || '', original_key: s.key || '', tempo_bpm: '', time_signature: '', category: '', notes: '' });
    setChart(s.chart);
    toast(`"${s.title}" cargada desde LaCuerda: revisá los acordes y guardala`);
    setTimeout(() => document.querySelector('.import-layout form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  return <>
    <header className="page-head">
      <div><span className="eyebrow"><Sparkles size={12} /> LaCuerda · Niro IA · archivos</span><h1>Importar canciones</h1>
        <p className="muted">Traé canciones desde LaCuerda, desde un PDF o foto (la IA las transcribe) o desde archivos de texto. Siempre revisás y editás letra y acordes antes de guardarlas en el grupo.</p></div>
    </header>
    <LaCuerdaPanel onLoad={fromLaCuerda} />
    {aiOff && <div className="banner warn"><AlertTriangle size={18} /> La transcripción con IA no está configurada en el servidor (falta <code>NIRO_API_KEY</code> en <code>backend/.env</code>).</div>}
    <div className={`import-layout ${meta ? 'has-result' : ''}`}>
      <section className="panel">
        <Field label="Guardar en el grupo"><select value={group} onChange={e => setGroup(e.target.value)}>{groups.data?.items.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
        <div className={`drop ${drag ? 'over' : ''}`} onClick={() => input.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}>
          {preparing ? <><Loader2 className="spin" size={28} /><b>Preparando páginas…</b></> : <><Upload size={28} /><b>Arrastrá aquí el PDF, las fotos o los archivos de canciones</b><small>o tocá para buscar en la computadora · PDF, JPG, PNG, WEBP (con IA) · TXT y ChordPro .cho/.crd/.pro (directo, sin IA)</small></>}
          <input ref={input} type="file" hidden multiple accept={`application/pdf,image/jpeg,image/png,image/webp,${SONG_TEXT_ACCEPT}`} onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>
        {bulk && <div>
          <h3>{bulk.length} canciones listas para guardar</h3>
          <div className="bulk-list">{bulk.map((s, i) => <div key={i}><span><b>{s.title}</b>{s.author && <small className="muted"> · {s.author}</small>}</span><small className="muted">{s.lyrics_sections.length} secciones{s.original_key ? ` · ${s.original_key}` : ''}</small></div>)}</div>
          <div className="actions"><button className="btn" onClick={() => setBulk(null)}><X size={15} /> Cancelar</button><Busy busy={saving} onClick={saveBulk}><Save size={16} /> Guardar todas en el grupo</Busy></div>
        </div>}
        {pages.length > 0 && <>
          <div className="pages">{pages.map((p, i) => <figure key={p.url} className={`page st-${p.state}`}>
            <img src={p.url} alt={`Página ${i + 1}`} />
            <figcaption>Pág. {i + 1} {p.state === 'working' && <Loader2 className="spin" size={13} />}{p.state === 'done' && <CheckCircle2 size={13} />}{p.state === 'error' && <AlertTriangle size={13} />}</figcaption>
            {p.error && <small className="perr">{p.error}</small>}
            {!running && <button className="rm" onClick={() => setPages(ps => ps.filter((_, j) => j !== i))} aria-label="Quitar"><X size={13} /></button>}
          </figure>)}</div>
          <div className="actions">
            <button className="btn" onClick={clearAll} disabled={running}><RotateCcw size={15} /> Empezar de nuevo</button>
            <Busy busy={running} onClick={transcribe} disabled={aiOff || !pages.length}><Sparkles size={16} /> {running ? 'Transcribiendo…' : meta ? 'Volver a transcribir' : 'Transcribir con IA'}</Busy>
          </div>
          <p className="muted small">Cada página consume créditos de Niro. Fotos nítidas, derechas y con buena luz dan mejores resultados.</p>
        </>}
      </section>
      {meta && <form className="panel form" onSubmit={save}>
        <div className="panel-head"><h2>Revisá y editá</h2>{result && <small className="muted">{result.pages} pág. transcriptas{result.cost ? ` · costo ${result.cost.toFixed(4)}` : ''}</small>}</div>
        <div className="banner info"><FileText size={16} /> Se guardará como <b>“Revisar transcripción”</b> y el archivo original quedará adjunto para comparar.</div>
        <SongFields value={meta} onChange={setMeta} chart={chart} onChart={setChart} />
        <div className="actions"><button type="button" className="btn" onClick={() => { if (confirm("¿Descartar esta canción sin guardarla?")) { clearAll(); window.scrollTo({ top: 0, behavior: "smooth" }); } }} disabled={saving}><X size={16} /> Cancelar</button><Busy busy={saving} type="submit"><Save size={16} /> Guardar en el grupo</Busy></div>
      </form>}
    </div>
    <ErrorBox error={groups.error} />
  </>;
}
