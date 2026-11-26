import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, X, Search, ChevronLeft, ChevronRight, Radio, Loader2, History } from 'lucide-react';
import { api } from '../api.js';
import { parseReference } from '../lib/bible.js';

const EXAMPLES = ['Juan 3:16', 'Sal 23', 'Ro 8:28', 'Fil 4:13', '1 Co 13:4-7', 'Is 40:31'];

/** Diapositivas de versículos (de a 1 o 2), con referencia abajo. */
export function verseSlides(passage, verses, perSlide){
  const out = [];
  for (let i = 0; i < verses.length; i += perSlide) {
    const chunk = verses.slice(i, i + perSlide);
    const a = chunk[0].verse, b = chunk[chunk.length - 1].verse;
    out.push({
      kind: 'text', bible: true,
      lines: chunk.map(v => (perSlide > 1 ? `${v.verse} ` : '') + v.text),
      reference: `${passage.book.name} ${passage.chapter}:${a}${b !== a ? `-${b}` : ''} · ${passage.version}`
    });
  }
  return out;
}

export default function BiblePanel({ onProject, liveRef, onClose }){
  const [versions, setVersions] = useState([]);
  const [version, setVersion] = useState(() => localStorage.getItem('idd_bible_version') || 'RV1960');
  const [perSlide, setPerSlide] = useState(() => Number(localStorage.getItem('idd_bible_per') || 1));
  const [q, setQ] = useState('');
  const [passage, setPassage] = useState(null);
  const [results, setResults] = useState(null);
  const [sel, setSel] = useState(null); // [desde, hasta]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem('idd_bible_recent') || '[]'); } catch { return []; } });
  const listRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => { api('/bible/versions').then(d => setVersions(d.items)).catch(() => {}); inputRef.current?.focus(); }, []);
  useEffect(() => { localStorage.setItem('idd_bible_version', version); }, [version]);
  useEffect(() => { localStorage.setItem('idd_bible_per', perSlide); }, [perSlide]);
  useEffect(() => { listRef.current?.querySelector('.vsel')?.scrollIntoView({ block: 'center' }); }, [passage]);

  async function load(path, keepSel){
    setBusy(true); setError('');
    try {
      const p = await api(path);
      setPassage(p); setResults(null);
      setSel(keepSel ?? (p.from ? [p.from, p.to || p.from] : null));
      if (p.from) {
        const next = [p.reference, ...recent.filter(r => r !== p.reference)].slice(0, 12);
        setRecent(next); localStorage.setItem('idd_bible_recent', JSON.stringify(next));
      }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const loadRef = (ref, v = version) => load(`/bible/passage?ref=${encodeURIComponent(ref)}&version=${v}`);
  async function submit(e){
    e?.preventDefault();
    const text = q.trim();
    if (!text) return;
    if (parseReference(text)) return loadRef(text);
    setBusy(true); setError('');
    try { const r = await api(`/bible/search?q=${encodeURIComponent(text)}&version=${version}`); setResults(r); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  function changeVersion(v){
    setVersion(v);
    if (passage) load(`/bible/chapter?book=${passage.book.id}&chapter=${passage.chapter}&version=${v}`, sel);
  }
  const chapterNav = d => { const c = passage.chapter + d; if (c >= 1 && c <= passage.book.chapters) load(`/bible/chapter?book=${passage.book.id}&chapter=${c}&version=${version}`); };

  /** Proyecta la selección; si no hay selección, desde el versículo tocado hasta el final del capítulo. */
  function project(startVerse){
    const vs = passage.verses;
    let range = sel && startVerse >= sel[0] && startVerse <= sel[1] ? vs.filter(v => v.verse >= sel[0] && v.verse <= sel[1]) : vs.filter(v => v.verse >= startVerse);
    if (!range.length) return;
    const slides = verseSlides(passage, range, perSlide);
    const startIdx = Math.max(0, slides.findIndex(s => s.reference.includes(`:${startVerse}`)));
    onProject(slides, startIdx);
  }
  function clickVerse(v, e){
    if (e.shiftKey && sel) { setSel([Math.min(sel[0], v.verse), Math.max(sel[1], v.verse)]); return; }
    setSel([v.verse, v.verse]);
    project(v.verse);
  }
  const selLabel = sel && passage ? `${passage.book.name} ${passage.chapter}:${sel[0]}${sel[1] !== sel[0] ? `-${sel[1]}` : ''}` : null;

  return <aside className="present-panel wide bible">
    <div className="pp-head"><b><BookOpen size={16} /> Biblia</b><button className="icon-btn dark" onClick={onClose}><X size={16} /></button></div>
    <form className="bible-search" onSubmit={submit}>
      <Search size={16} />
      <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Juan 3:16 · Sal 23 · o una palabra…" />
      {busy ? <Loader2 className="spin" size={16} /> : <button className="btn gold sm" type="submit">Buscar</button>}
    </form>
    <div className="bible-opts">
      <select value={version} onChange={e => changeVersion(e.target.value)}>{(versions.length ? versions : [{ id: version, name: version }]).map(v => <option key={v.id} value={v.id}>{v.id} · {v.name}</option>)}</select>
      <select value={perSlide} onChange={e => setPerSlide(Number(e.target.value))}><option value={1}>1 versículo por pantalla</option><option value={2}>2 versículos por pantalla</option></select>
    </div>
    {error && <div className="bible-err">{error}</div>}

    {results && <div className="bible-results">
      <div className="muted small">{results.items.length ? `${results.items.length} resultados en ${results.version}` : 'Sin resultados'}</div>
      {results.items.map((r, i) => <button key={i} onClick={() => loadRef(r.reference)}><b>{r.reference}</b> {r.text}</button>)}
    </div>}

    {passage && !results && <>
      <div className="bible-head">
        <button className="icon-btn dark sm" onClick={() => chapterNav(-1)} disabled={passage.chapter <= 1} title="Capítulo anterior"><ChevronLeft size={15} /></button>
        <b>{passage.book.name} {passage.chapter}</b><small>{passage.version}</small>
        <button className="icon-btn dark sm" onClick={() => chapterNav(1)} disabled={passage.chapter >= passage.book.chapters} title="Capítulo siguiente"><ChevronRight size={15} /></button>
        {selLabel && <button className="btn gold sm proj" onClick={() => project(sel[0])}><Radio size={14} /> Proyectar {selLabel}</button>}
      </div>
      <p className="muted small">Tocá un versículo para proyectarlo (después avanzás con <kbd>→</kbd>). <kbd>Shift</kbd>+clic para elegir un rango.</p>
      <div className="verses" ref={listRef}>{passage.verses.map(v => {
        const inSel = sel && v.verse >= sel[0] && v.verse <= sel[1];
        const isLive = liveRef && liveRef.includes(`${passage.book.name} ${passage.chapter}:`) && liveRef.includes(passage.version) && (() => { const m = liveRef.match(/:(\d+)(?:-(\d+))?/); return m && v.verse >= +m[1] && v.verse <= +(m[2] || m[1]); })();
        return <button key={v.verse} className={`verse ${inSel ? 'vsel' : ''} ${isLive ? 'vlive' : ''}`} onClick={e => clickVerse(v, e)}><sup>{v.verse}</sup>{v.text}</button>;
      })}</div>
    </>}

    {!passage && !results && <>
      <h4>Ejemplos</h4><div className="quick-msgs">{EXAMPLES.map(x => <button key={x} className="btn ghost-dark sm" onClick={() => { setQ(x); loadRef(x); }}>{x}</button>)}</div>
      {recent.length > 0 && <><h4><History size={13} /> Recientes</h4><div className="quick-msgs">{recent.map(x => <button key={x} className="btn ghost-dark sm" onClick={() => { setQ(x); loadRef(x); }}>{x}</button>)}</div></>}
      <p className="muted small">Versiones: Reina-Valera 1960, NTV, LBLA (bolls.life) y Reina-Valera 1909 (dominio público). Cada capítulo se descarga una vez y queda guardado para usarlo sin internet.</p>
    </>}
  </aside>;
}
