import React, { useState } from 'react';
import { Search, Link2, Loader2, User, Music2, ChevronLeft } from 'lucide-react';
import { api } from '../api.js';

const isSongUrl = s => /lacuerda\.net\/[a-z0-9_]+\/[a-z0-9_]+(-\d+)?(\.shtml)?\/?$/i.test(s.trim());
const isArtistUrl = s => /lacuerda\.net\/[a-z0-9_]+\/?$/i.test(s.trim());

/** Buscar en LaCuerda o pegar la dirección de una canción: trae letra y acordes al editor para revisar y guardar. */
export default function LaCuerdaPanel({ onLoad }){
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(null); // url que se está cargando
  const [error, setError] = useState('');
  const [res, setRes] = useState(null);
  const [prev, setPrev] = useState(null);       // resultados anteriores (para volver desde un artista)

  async function load(url){
    setLoading(url); setError('');
    try { onLoad(await api(`/import/lacuerda?url=${encodeURIComponent(url)}`)); }
    catch (e) { setError(e.status === 404 ? `${e.message} Probá con otra versión.` : e.message); }
    finally { setLoading(null); }
  }
  async function openArtist(url){
    setBusy(true); setError('');
    try { setPrev(res); setRes(await api(`/import/lacuerda/artist?url=${encodeURIComponent(url)}`)); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function submit(e){
    e?.preventDefault();
    const text = q.trim();
    if (!text) return;
    if (isSongUrl(text)) return load(text);
    if (isArtistUrl(text)) return openArtist(text);
    setBusy(true); setError(''); setPrev(null);
    try { setRes(await api(`/import/lacuerda/search?q=${encodeURIComponent(text)}`)); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const songs = res?.items || [];
  return <section className="panel lc-panel">
    <div className="panel-head"><h2><Music2 size={18} /> Desde LaCuerda</h2><a className="muted small" href="https://acordes.lacuerda.net/" target="_blank" rel="noreferrer">acordes.lacuerda.net ↗</a></div>
    <p className="muted small">Pegá la dirección de una canción de LaCuerda o buscá por canción o artista. Se carga la letra con los acordes para que la revises, corrijas y la guardes en el grupo.</p>
    <form className="lc-search" onSubmit={submit}>
      {isSongUrl(q) ? <Link2 size={17} /> : <Search size={17} />}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="https://acordes.lacuerda.net/… · o: Eres rey de los cielos · Marcos Witt" />
      <button className="btn primary sm" type="submit" disabled={busy || !q.trim()}>{busy || (loading && isSongUrl(q)) ? <Loader2 className="spin" size={15} /> : isSongUrl(q) ? 'Cargar' : 'Buscar'}</button>
    </form>
    {error && <div className="error-box">{error}</div>}

    {res && <div className="lc-results">
      <div className="lc-head">
        {prev && <button className="btn sm" onClick={() => { setRes(prev); setPrev(null); }}><ChevronLeft size={14} /> Volver</button>}
        <small className="muted">{res.artist ? `${res.artist} · ${songs.length} canciones` : songs.length ? `${res.total > songs.length ? `${songs.length} de ${res.total}` : songs.length} resultados` : 'Sin canciones encontradas'}</small>
      </div>
      {res.artists?.length > 0 && <div className="lc-artists">{res.artists.map(a => <button key={a.url} className="chip" onClick={() => openArtist(a.url)}><User size={13} /> {a.name} <small>{a.songs}</small></button>)}</div>}
      {songs.map(s => {
        const chords = s.versions.filter(v => v.type === 'R' || v.type === 'K');
        return <div key={s.url} className="lc-item">
          <div className="lc-t"><b>{s.title}</b><small>{s.artist}</small></div>
          <div className="lc-v">{(chords.length ? chords : s.versions.slice(0, 1)).map((v, i) => <button key={v.url} className="btn sm" disabled={!!loading} onClick={() => load(v.url)} title={v.type_name}>
            {loading === v.url ? <Loader2 className="spin" size={13} /> : null}{chords.length > 1 ? `Versión ${i + 1}` : 'Cargar'}{v.type === 'K' ? ' (piano)' : ''}</button>)}</div>
        </div>;
      })}
    </div>}
    <p className="muted small">Las letras pertenecen a sus autores: usalas para el ministerio de tu iglesia (para proyectar en público, verificá la licencia, por ejemplo CCLI).</p>
  </section>;
}
