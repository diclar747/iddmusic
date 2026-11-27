import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize, Coffee, X, Palette, Type, PenLine, MessageSquareText, Save, Radio, Trash2, BookOpen, Cast, Image as ImageIcon, FolderOpen, Upload } from 'lucide-react';
import { api } from '../api.js';
import { Spinner, ErrorBox, useToast } from '../ui.jsx';
import Stage from '../components/Stage.jsx';
import { useChurch, churchLogo } from '../components/TopBar.jsx';
import { SION_MARK, APP_NAME } from '../lib/brand.js';
import BiblePanel from '../components/BiblePanel.jsx';
import OutputPanel, { useCast } from '../components/OutputPanel.jsx';
import MediaPanel from '../components/MediaPanel.jsx';
import { castSend, musicCast, isCastReceiver, listenAsReceiver } from '../lib/cast.js';
import { publishLive } from '../lib/live.js';
import { SONG_TEXT_ACCEPT, isSongText, readTextFile, songFromText } from '../lib/files.js';
import { lyricSlides, parseChart, serializeChart } from '../lib/chart.js';
import { THEMES, FONTS, DEFAULT_SETTINGS, STANDBY_MODES, TEXT_COLORS, themeById, savedSettings } from '../lib/themes.js';

const CHANNEL = 'idd-present';
const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n']);
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p']);
const QUICK = [
  { title: '', lines: ['Bienvenidos'], reference: '@iglesia' },
  { title: '', lines: ['Oremos'], reference: '' },
  { title: '', lines: ['Tiempo de adoración'], reference: '' },
  { title: '', lines: ['Diezmos y ofrendas'], reference: '“Dios ama al dador alegre” · 2 Corintios 9:7' },
  { title: '', lines: ['Santa Cena'], reference: '' },
  { title: '', lines: ['Lectura de la Palabra'], reference: '' },
  { title: '', lines: ['¡Dios te bendiga!'], reference: 'Te esperamos la próxima semana' }
];

/** Arma las diapositivas: portada de cada canción + letra (sin acordes) en frases cortas + pausa entre canciones. */
function buildSlides(songs, s){
  const out = [];
  songs.forEach((song, si) => {
    if (s.titleSlide) out.push({ kind: 'title', title: song.title, author: song.author && !/demo|ejemplo/i.test(song.author) ? song.author : '', song: si, songTitle: song.title });
    lyricSlides(song.lyrics_sections, s.perSlide, s.maxChars).forEach(sl => out.push({ kind: 'lyrics', ...sl, song: si, songTitle: song.title }));
    out.push({ kind: 'blank', song: si, songTitle: song.title });
  });
  return out;
}
const standbySlide = s => ({ kind: 'standby', mode: s.standbyMode, title: s.standbyTitle, sub: s.standbySub, logo: s.standbyLogo });
const standbyThemeOf = (s, theme, uploaded) => s.standbyTheme === 'same' ? theme : themeById(s.standbyTheme, uploaded);

export default function Presenter({ kind, id }){
  const toast = useToast();
  const [songs, setSongs] = useState(null);
  const [title, setTitle] = useState('');
  const [groupId, setGroupId] = useState(null);
  const [backHref, setBackHref] = useState('#/');
  const [error, setError] = useState(null);
  const [rawSettings, setSettings] = useState(savedSettings);
  // Valores de la iglesia: logo y nombre para la pantalla de espera (si no se escribieron otros).
  const church = useChurch();
  const settings = useMemo(() => ({ ...rawSettings, churchLogo: churchLogo(church) || SION_MARK, standbyTitle: rawSettings.standbyTitle || church?.name || APP_NAME, standbySub: rawSettings.standbySub || church?.branch || '' }), [rawSettings, church]);
  const [index, setIndex] = useState(0);
  const [hold, setHold] = useState(false);          // pantalla de espera activa
  const [override, setOverride] = useState(null);   // { items:[diapositivas], i } texto libre o versículos en vivo
  const [allSongs, setAllSongs] = useState(null);
  const [panel, setPanel] = useState(null);         // 'style' | 'edit' | 'text' | 'bible' | 'media' | 'output'
  const [uploaded, setUploaded] = useState([]);
  const [groups, setGroups] = useState([]);
  const [libGroup, setLibGroup] = useState(null);   // grupo cuya biblioteca de imágenes se usa
  const [screenOpen, setScreenOpen] = useState(false);
  const cast = useCast();
  const stageRef = useRef(null);
  const channel = useRef(null);
  const listRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        if (kind === 'free') {
          const g = await api('/groups');
          setSongs([]); setTitle('Proyección libre'); setGroupId(g.items[0]?.id || null); setBackHref('#/');
        } else if (kind === 'event') {
          const ev = await api(`/events/${id}`);
          const list = await Promise.all(ev.items.map(it => api(`/songs/${it.song_id}`)));
          setSongs(list); setTitle(ev.title); setGroupId(ev.group_id); setBackHref(`#/events/${id}`);
        } else {
          const s = await api(`/songs/${id}`);
          setSongs([s]); setTitle(s.title); setGroupId(s.group_id); setBackHref(`#/songs/${id}`);
        }
      } catch (e) { setError(e); }
    })();
  }, [kind, id]);
  useEffect(() => { api('/groups').then(d => setGroups(d.items)).catch(() => {}); }, []);
  useEffect(() => { if (groupId) setLibGroup(groupId); }, [groupId]);
  const loadImages = useCallback(() => libGroup ? api(`/groups/${libGroup}/backgrounds`).then(d => setUploaded(d.items)).catch(() => {}) : Promise.resolve(), [libGroup]);
  useEffect(() => { loadImages(); }, [loadImages]);
  useEffect(() => { localStorage.setItem('idd_present', JSON.stringify(rawSettings)); }, [rawSettings]);

  const slides = useMemo(() => songs ? buildSlides(songs, settings) : [], [songs, settings]);
  const theme = themeById(settings.theme, uploaded);
  const sbTheme = standbyThemeOf(settings, theme, uploaded);
  const sbSlide = standbySlide(settings);
  const cur = slides[Math.min(index, slides.length - 1)];
  const nextSlide = slides[index + 1];
  useEffect(() => { if (index > slides.length - 1) setIndex(Math.max(0, slides.length - 1)); }, [slides.length]);

  // Lo que se ve en el proyector ahora.
  const ov = override?.items[override.i];
  // Cada canción puede tener su propia plantilla (como un PowerPoint por canción).
  const themeOfSong = si => { const id = songs?.[si]?.id; const t = id && settings.songThemes?.[id]; return t ? themeById(t, uploaded) : theme; };
  const live = hold ? { slide: sbSlide, theme: sbTheme, what: 'espera' }
    : ov ? { slide: ov, theme, what: ov.bible ? 'biblia' : ov.kind === 'image' ? 'imagen' : 'texto' }
    : !cur || cur.kind === 'blank' ? { slide: sbSlide, theme: sbTheme, what: 'pausa' } : { slide: cur, theme: themeOfSong(cur.song), what: 'cancion' };
  const ovNext = override?.items[override.i + 1];
  const nextView = ovNext ? { slide: ovNext, theme } : !nextSlide || nextSlide.kind === 'blank' ? { slide: sbSlide, theme: sbTheme } : { slide: nextSlide, theme: themeOfSong(nextSlide.song) };

  const go = useCallback(d => {
    if (hold) { setHold(false); return; }
    if (override) { // versículos / texto: avanza dentro de la secuencia y al terminar vuelve a la canción donde estaba
      const ni = override.i + d;
      setOverride(ni >= 0 && ni < override.items.length ? { ...override, i: ni } : null);
      return;
    }
    setIndex(i => Math.max(0, Math.min(slides.length - 1, i + d)));
  }, [slides.length, hold, override]);
  const handleKey = useCallback((key, e) => {
    if (NEXT_KEYS.has(key)) { e?.preventDefault(); go(1); }
    else if (PREV_KEYS.has(key)) { e?.preventDefault(); go(-1); }
    else if (key === 'b' || key === 'B' || key === '.' || key === 'w' || key === 'W') setHold(h => !h);
    else if (key === 'Escape') { setOverride(null); setHold(false); }
    else if (key === 'Home') { setIndex(0); setHold(false); setOverride(null); }
    else if (key === 'End') setIndex(slides.length - 1);
    else if (key === 'f' || key === 'F') stageRef.current?.requestFullscreen?.().catch(() => {});
  }, [go, slides.length]);

  // Teclado / control remoto de presentaciones (envían flechas o AvPág/RePág; el botón "pantalla en blanco" envía B o punto).
  useEffect(() => {
    const k = e => { if (e.target.closest?.('input,select,textarea') || e.ctrlKey || e.metaKey || e.altKey) return; handleKey(e.key, e); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [handleKey]);

  // Sincronización con la ventana del proyector.
  const stateMsg = useRef(null);
  const handleKeyRef = useRef(handleKey);
  handleKeyRef.current = handleKey;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL); channel.current = ch;
    ch.onmessage = ({ data }) => {
      if (data.type === 'hello') { setScreenOpen(true); ch.postMessage(stateMsg.current); }
      if (data.type === 'key') handleKeyRef.current(data.key);
      if (data.type === 'bye') setScreenOpen(false);
    };
    // Al salir de la proyección, el proyector queda en la pantalla de espera (no en negro).
    return () => {
      const s = settingsRef.current;
      const bye = { type: 'state', slide: standbySlide(s), theme: standbyThemeOf(s, themeById(s.theme), []), settings: s };
      ch.postMessage(bye); castSend(bye);
      ch.close();
    };
  }, []);
  useEffect(() => {
    stateMsg.current = { type: 'state', slide: live.slide, theme: live.theme, settings };
    channel.current?.postMessage(stateMsg.current);
    castSend(stateMsg.current); // Chromecast / TV
  }, [JSON.stringify(live.slide), live.theme, settings]);
  useEffect(() => { listRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }, [index]);

  // ---- Músicos: repertorio con acordes y posición en vivo (tablets, teléfonos y segundo Chromecast) ----
  const liveGroup = groupId || groups[0]?.id || null;
  const setlistBody = useMemo(() => songs && { title, songs: songs.map(s => ({ id: s.id, title: s.title, author: s.author && !/demo|ejemplo/i.test(s.author) ? s.author : '', original_key: s.original_key, tempo_bpm: s.tempo_bpm, time_signature: s.time_signature, lyrics_sections: s.lyrics_sections })) }, [songs, title]);
  const posBody = {
    what: live.what, song: cur?.song ?? 0, sec: cur?.sec ?? -1, part: cur?.part ?? 0, parts: cur?.parts ?? 0, label: cur?.label || '', slideKind: cur?.kind,
    text: ov && ov.kind === 'text' ? { title: ov.title || '', lines: ov.lines, reference: ov.reference || '' } : null, name: ov?.name || ''
  };
  const posKey = JSON.stringify(posBody);
  const publishedRef = useRef({});
  publishedRef.current = { setlist: setlistBody, pos: posBody };
  useEffect(() => { if (liveGroup && setlistBody) { const t = setTimeout(() => publishLive(liveGroup, { setlist: setlistBody }), 250); return () => clearTimeout(t); } }, [liveGroup, setlistBody]);
  useEffect(() => { if (liveGroup && songs) publishLive(liveGroup, { pos: posBody }); }, [liveGroup, posKey]);
  useEffect(() => {
    if (!liveGroup) return;
    musicCast.setInit({ type: 'live', groupId: liveGroup });
    // Reenvía todo cada 2 minutos (por si la API se reinició o un músico entró tarde).
    const t = setInterval(() => publishLive(liveGroup, publishedRef.current), 120000);
    return () => { clearInterval(t); publishLive(liveGroup, { pos: { ...publishedRef.current.pos, what: 'espera' } }); };
  }, [liveGroup]);

  const set = patch => setSettings(s => ({ ...s, ...patch }));
  const togglePanel = p => setPanel(x => x === p ? null : p);

  async function saveSong(si, chart){
    const song = songs[si];
    const { sections } = parseChart(chart);
    if (song.local) { // canción abierta desde la computadora: se actualiza solo en esta proyección
      setSongs(list => list.map((s, i) => i === si ? { ...s, lyrics_sections: sections } : s));
      toast('Letra actualizada en pantalla (canción temporal)');
      return;
    }
    const updated = await api(`/songs/${song.id}`, { method: 'PATCH', body: { lyrics_sections: sections, change_note: 'Editado desde la proyección' } });
    setSongs(list => list.map((s, i) => i === si ? { ...s, ...updated } : s));
    toast('Letra guardada y actualizada en pantalla');
  }
  /** Guarda en el grupo una canción que se abrió desde un archivo de la computadora. */
  async function keepSong(si){
    const song = songs[si];
    const gid = libGroup || groupId || groups[0]?.id;
    if (!gid) { toast('No tenés un grupo donde guardarla', 'error'); return; }
    const saved = await api('/songs', { method: 'POST', body: { group_id: gid, source: 'manual', status: 'review', title: song.title, author: song.author, original_key: song.original_key, time_signature: song.time_signature, tempo_bpm: song.tempo_bpm || null, lyrics_sections: song.lyrics_sections } });
    setSongs(list => list.map((s, i) => i === si ? saved : s));
    toast(`"${saved.title}" guardada en ${groups.find(g => g.id === gid)?.name || 'el grupo'}`);
  }

  if (error) return <div className="present-wrap"><ErrorBox error={error} /><a href={backHref}>Volver</a></div>;
  if (!songs) return <div className="present-wrap"><Spinner /></div>;
  const songStarts = slides.map((s, i) => [s, i]).filter(([s, i]) => i === 0 || slides[i - 1].song !== s.song);
  const liveLabel = { espera: 'Pantalla de espera', pausa: 'Pantalla de espera', texto: 'Texto libre', imagen: `Imagen · ${ov?.name || ''}`, biblia: `${ov?.reference}${override?.items.length > 1 ? ` (${override.i + 1}/${override.items.length})` : ''}`, cancion: cur?.songTitle }[live.what];
  async function addSong(songId){
    if (!songId) return;
    try { const s = await api(`/songs/${songId}`); setSongs(list => [...list, s]); toast(`"${s.title}" agregada a esta proyección`); } catch (e) { toast(e.message, 'error'); }
  }
  async function openFiles(list){
    const files = [...list];
    const texts = files.filter(isSongText);
    if (files.length > texts.length) toast('Los PDF y fotos de partituras se pasan con “Importar con IA”; acá se abren archivos de texto o ChordPro.', 'error');
    const added = [];
    for (const f of texts) {
      const s = songFromText(await readTextFile(f), f.name);
      if (s.lyrics_sections.length) added.push({ ...s, id: `local-${Date.now()}-${added.length}`, local: true });
    }
    if (added.length) { setSongs(l => [...l, ...added]); toast(added.length > 1 ? `${added.length} canciones abiertas` : `"${added[0].title}" abierta para proyectar`); }
    else if (texts.length) toast('No se encontró letra en el archivo', 'error');
  }
  const outLabel = cast.status === 'connected' ? (screenOpen ? 'TV + proyector' : 'Transmitiendo') : screenOpen ? 'Proyector conectado' : 'Proyector / TV';
  const live_ = cast.status === 'connected' || screenOpen;

  return <div className="present-wrap">
    <header className="present-bar">
      <a className="btn ghost-dark" href={backHref}><ArrowLeft size={16} /> Salir</a>
      <div className="pb-title"><b>{title}</b><small>{slides.length ? `${index + 1} / ${slides.length}` : 'Sin letra'} · {cur?.songTitle}</small></div>
      <div className="pb-actions">
        <button className={`btn ghost-dark ${panel === 'bible' ? 'on' : ''}`} onClick={() => togglePanel('bible')}><BookOpen size={16} /> Biblia</button>
        {songs.length > 0 && <button className={`btn ghost-dark ${panel === 'edit' ? 'on' : ''}`} onClick={() => togglePanel('edit')}><PenLine size={16} /> Editar letra</button>}
        <button className={`btn ghost-dark ${panel === 'text' ? 'on' : ''}`} onClick={() => togglePanel('text')}><MessageSquareText size={16} /> Texto libre</button>
        <button className={`btn ghost-dark ${panel === 'media' ? 'on' : ''}`} onClick={() => togglePanel('media')}><ImageIcon size={16} /> Imágenes</button>
        <button className={`btn ghost-dark ${panel === 'style' ? 'on' : ''}`} onClick={() => togglePanel('style')}><Palette size={16} /> Plantilla</button>
        <button className="btn ghost-dark" onClick={() => stageRef.current?.requestFullscreen?.().catch(() => {})} title="Pantalla completa (F)"><Maximize size={16} /></button>
        <button className={`btn ${live_ ? 'live' : 'gold'} ${panel === 'output' ? 'on' : ''}`} onClick={() => togglePanel('output')} title="Chromecast, Smart TV o proyector por HDMI"><Cast size={16} /> {outLabel}</button>
      </div>
    </header>
    <div className={`present-body ${panel ? 'with-panel' : ''}`}>
      <aside className="slide-list" ref={listRef}>
        {!songs.length && <p className="muted small sl-empty">Sin canciones todavía. Usá <b>Biblia</b>, <b>Texto libre</b> o <b>Imágenes</b>, o agregá una canción.</p>}
        {songStarts.map(([s, start]) => <div key={start} className="sl-song">
          <div className="sl-song-title">{s.songTitle}{songs[s.song]?.local && <span className="sl-local">temporal · <button className="link-btn" onClick={() => keepSong(s.song).catch(e => toast(e.message, 'error'))}>guardar en el grupo</button></span>}</div>
          {slides.map((sl, i) => sl.song === s.song && <button key={i} className={`sl ${i === index ? 'on' : ''} ${i === index && live.what !== 'cancion' ? 'dim' : ''} k-${sl.kind}`} onClick={() => { setIndex(i); setHold(false); setOverride(null); }}>
            <span className="sl-n">{i + 1}</span>
            <span className="sl-t">{sl.kind === 'title' ? <i>Portada: {sl.title}</i> : sl.kind === 'blank' ? <i>— pantalla de espera —</i> : <>{sl.label && <small>{sl.label}</small>}{sl.lines.join(' / ')}</>}</span>
          </button>)}
        </div>)}
        <div className="add-row">
          <select className="add-live" value="" onFocus={() => !allSongs && api('/songs').then(d => setAllSongs(d.items)).catch(() => setAllSongs([]))} onChange={e => addSong(e.target.value)}>
            <option value="">+ Agregar canción del cancionero…</option>
            {allSongs?.map(s => <option key={s.id} value={s.id}>{s.title}{s.group_name ? ` · ${s.group_name}` : ''}</option>)}
          </select>
          <label className="add-file" title="Archivos .txt o ChordPro (.cho, .chopro, .crd, .pro)"
            onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); openFiles(e.dataTransfer.files); }}>
            <FolderOpen size={15} /> Abrir de la computadora…
            <input ref={fileRef} type="file" hidden multiple accept={SONG_TEXT_ACCEPT} onChange={e => { openFiles(e.target.files); e.target.value = ''; }} />
          </label>
        </div>
      </aside>
      <main className="present-main">
        <div className={`live-tag ${live.what}`}><Radio size={13} /> En el proyector: <b>{liveLabel}</b>{cast.status === 'connected' && <span className="muted"> · transmitiendo a TV</span>}</div>
        <div className="stage-frame" ref={stageRef} onClick={e => { const r = e.currentTarget.getBoundingClientRect(); go(e.clientX - r.left > r.width / 3 ? 1 : -1); }}>
          <Stage slide={live.slide} theme={live.theme} settings={settings} />
        </div>
        <div className="present-controls">
          <button className="btn big" onClick={() => go(-1)} disabled={index === 0 && !hold && !(override?.i > 0)}><ChevronLeft size={22} /> Anterior</button>
          <button className={`btn big ${hold ? 'gold' : ''}`} onClick={() => setHold(h => !h)} title="Tecla B o el botón de pantalla en blanco del control"><Coffee size={18} /> {hold ? 'Volver a la letra' : 'Pantalla de espera'}</button>
          <button className="btn big primary" onClick={() => go(1)} disabled={index >= slides.length - 1 && !hold && !override}>Siguiente <ChevronRight size={22} /></button>
        </div>
        <div className="next-row">
          <div className="next-prev"><small>Sigue</small><div className="mini-stage"><Stage slide={nextView.slide} theme={nextView.theme} settings={settings} animate={false} /></div></div>
          <p className="hint">Avanzá con <kbd>→</kbd> <kbd>Espacio</kbd> o el control remoto · Volvé con <kbd>←</kbd> · <kbd>B</kbd> pantalla de espera · <kbd>Esc</kbd> quita el versículo, texto o imagen · <kbd>F</kbd> pantalla completa.<br />
            Para el proyector o el TV tocá <b>{outLabel}</b>: transmití a un <b>Chromecast</b> o abrí la ventana en la pantalla <b>HDMI</b>. Desde acá seguís controlando; al salir, queda la pantalla de espera.</p>
        </div>
      </main>
      {panel === 'edit' && <EditPanel songs={songs} current={cur?.song ?? 0} onSave={saveSong} onClose={() => setPanel(null)} />}
      {panel === 'bible' && <BiblePanel liveRef={ov?.bible ? ov.reference : null} onProject={(items, i) => { setOverride({ items, i }); setHold(false); }} onClose={() => setPanel(null)} />}
      {panel === 'text' && <TextPanel override={override} setOverride={o => { setOverride(o ? { items: [o], i: 0 } : null); setHold(false); }} theme={theme} settings={settings} onClose={() => setPanel(null)} />}
      {panel === 'media' && <MediaPanel groups={groups} libGroup={libGroup} setLibGroup={setLibGroup} items={uploaded} reload={loadImages} settings={settings} set={set}
        liveImageId={ov?.kind === 'image' ? ov.imageId : null} onProject={b => { setOverride({ items: [{ kind: 'image', imageId: b.id, name: b.original_name }], i: 0 }); setHold(false); }}
        onClear={() => setOverride(null)} onClose={() => setPanel(null)} />}
      {panel === 'style' && <StylePanel settings={settings} set={set} reset={() => setSettings(DEFAULT_SETTINGS)} theme={theme} uploaded={uploaded} song={cur && songs[cur.song]} openMedia={() => setPanel('media')} onClose={() => setPanel(null)} />}
      {panel === 'output' && <OutputPanel screenOpen={screenOpen} liveGroup={liveGroup} onClose={() => setPanel(null)} />}
    </div>
  </div>;
}

/* ---------- Editar letra sin salir de la proyección ---------- */
function EditPanel({ songs, current, onSave, onClose }){
  const toast = useToast();
  const [si, setSi] = useState(current);
  const [chart, setChart] = useState(() => serializeChart(songs[current]?.lyrics_sections));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const pick = n => { if (dirty && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) return; setSi(n); setChart(serializeChart(songs[n].lyrics_sections)); setDirty(false); };
  const count = useMemo(() => lyricSlides(parseChart(chart).sections, 2).length, [chart]);
  async function save(){
    setBusy(true);
    try { await onSave(si, chart); setDirty(false); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }
  return <aside className="present-panel wide">
    <div className="pp-head"><b><PenLine size={16} /> Editar letra</b><button className="icon-btn dark" onClick={onClose}><X size={16} /></button></div>
    {songs.length > 1 && <label className="pp-row"><span>Canción</span><select value={si} onChange={e => pick(Number(e.target.value))}>{songs.map((s, i) => <option key={s.id} value={i}>{i + 1}. {s.title}</option>)}</select></label>}
    <p className="muted small">Corregí o agregá letra. Las líneas de acordes y los nombres de sección (<code>[Coro]</code>) <b>no</b> se proyectan. Separá secciones con una línea vacía.</p>
    <textarea className="pp-text mono" spellCheck={false} value={chart} onChange={e => { setChart(e.target.value); setDirty(true); }} />
    <div className="pp-foot"><small className="muted">{count} diapositivas de letra</small>
      <button className="btn gold sm" onClick={save} disabled={!dirty || busy}><Save size={15} /> {busy ? 'Guardando…' : 'Guardar y actualizar'}</button></div>
    <p className="muted small">Se guarda en la canción del grupo (queda la versión anterior en el historial).</p>
  </aside>;
}

/* ---------- Texto libre: versículos, avisos, mensajes ---------- */
function TextPanel({ override, setOverride, theme, settings, onClose }){
  const church = useChurch();
  const churchRef = [church?.name, church?.branch].filter(Boolean).join(' · ');
  const [t, setT] = useState({ title: '', body: '', reference: '' });
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem('idd_texts') || '[]'); } catch { return []; } });
  const slideOf = x => ({ kind: 'text', title: x.title?.trim() || '', lines: (x.body ?? x.lines?.join('\n') ?? '').split('\n'), reference: x.reference?.trim() || '' });
  function project(x){
    const s = slideOf(x);
    if (!s.lines.some(l => l.trim())) return;
    setOverride(s);
    const item = { title: s.title, body: s.lines.join('\n'), reference: s.reference };
    const next = [item, ...recent.filter(r => r.body !== item.body || r.reference !== item.reference)].slice(0, 10);
    setRecent(next); localStorage.setItem('idd_texts', JSON.stringify(next));
  }
  const removeRecent = i => { const next = recent.filter((_, j) => j !== i); setRecent(next); localStorage.setItem('idd_texts', JSON.stringify(next)); };
  return <aside className="present-panel">
    <div className="pp-head"><b><MessageSquareText size={16} /> Texto libre</b><button className="icon-btn dark" onClick={onClose}><X size={16} /></button></div>
    <p className="muted small">Escribí un versículo, un aviso o un mensaje y proyectalo al instante. Con <kbd>→</kbd> o <kbd>Esc</kbd> volvés a la canción.</p>
    <input className="pp-input" placeholder="Encabezado (opcional) · ej.: Versículo del día" value={t.title} onChange={e => setT({ ...t, title: e.target.value })} />
    <textarea className="pp-text" rows={5} placeholder="Texto a proyectar…" value={t.body} onChange={e => setT({ ...t, body: e.target.value })} />
    <input className="pp-input" placeholder="Referencia (opcional) · ej.: Juan 3:16" value={t.reference} onChange={e => setT({ ...t, reference: e.target.value })} />
    {t.body.trim() && <div className="mini-stage"><Stage slide={slideOf(t)} theme={theme} settings={settings} animate={false} /></div>}
    <div className="pp-foot">
      {override ? <button className="btn ghost-dark sm" onClick={() => setOverride(null)}><X size={14} /> Quitar del proyector</button> : <span />}
      <button className="btn gold sm" onClick={() => project(t)} disabled={!t.body.trim()}><Radio size={14} /> Proyectar ahora</button>
    </div>
    <h4>Mensajes rápidos</h4>
    <div className="quick-msgs">{QUICK.map((q, i) => <button key={i} className="btn ghost-dark sm" onClick={() => project({ ...q, reference: q.reference === '@iglesia' ? churchRef : q.reference, body: q.lines.join('\n') })}>{q.lines[0]}</button>)}</div>
    {recent.length > 0 && <><h4>Usados recientemente</h4><div className="recent">{recent.map((r, i) => <div key={i} className="recent-item">
      <button onClick={() => project(r)} title="Proyectar">{r.title && <small>{r.title}</small>}{r.body.split('\n')[0]}{r.reference && <small> — {r.reference}</small>}</button>
      <button className="icon-btn dark sm" onClick={() => setT(r)} title="Editar"><PenLine size={13} /></button>
      <button className="icon-btn dark sm" onClick={() => removeRecent(i)} title="Quitar"><Trash2 size={13} /></button>
    </div>)}</div></>}
  </aside>;
}

/* ---------- Plantilla, texto y pantalla de espera ---------- */
function StylePanel({ settings, set, reset, theme, uploaded, openMedia, song, onClose }){
  const sample = { kind: 'lyrics', lines: ['Santo, santo'] };
  const [scope, setScope] = useState('all');   // 'all' | 'song'
  const groups = ['Todas', ...new Set(THEMES.map(t => t.group)), 'Mis imágenes'];
  const [cat, setCat] = useState('Todas');
  const songTheme = song && settings.songThemes?.[song.id];
  const selected = scope === 'song' && song ? songTheme : settings.theme;
  const apply = id => scope === 'song' && song ? set({ songThemes: { ...settings.songThemes, [song.id]: id } }) : set({ theme: id, overlay: null });
  const Thumb = ({ t }) => <button className={`theme-thumb ${selected === t.id ? 'on' : ''}`} onClick={() => apply(t.id)} title={t.name}>
    <Stage slide={sample} theme={t} settings={{ ...settings, overlay: null, logoCorner: false }} animate={false} /><span>{t.name}</span></button>;
  const visible = cat === 'Todas' ? THEMES : THEMES.filter(t => t.group === cat);
  return <aside className="present-panel">
    <div className="pp-head"><b><Palette size={16} /> Plantilla</b><button className="icon-btn dark" onClick={onClose}><X size={16} /></button></div>

    <h4><Coffee size={14} /> Pantalla de espera</h4>
    <div className="mini-stage"><Stage slide={standbySlide(settings)} theme={standbyThemeOf(settings, theme, uploaded)} settings={settings} animate={false} /></div>
    <label className="pp-row"><span>Mostrar</span><select value={settings.standbyMode} onChange={e => set({ standbyMode: e.target.value })}>{Object.entries(STANDBY_MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    {settings.standbyMode !== 'negro' && <label className="pp-row"><span>Fondo</span><select value={settings.standbyTheme} onChange={e => set({ standbyTheme: e.target.value })}>
      <option value="same">El mismo de la letra</option>
      {THEMES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      {uploaded.map(b => <option key={b.id} value={'img:' + b.id}>Imagen: {b.original_name}</option>)}
    </select></label>}
    {settings.standbyMode === 'logo' && <>
      <input className="pp-input" value={settings.standbyTitle} onChange={e => set({ standbyTitle: e.target.value })} placeholder="Título" />
      <input className="pp-input" value={settings.standbySub} onChange={e => set({ standbySub: e.target.value })} placeholder="Subtítulo / mensaje" />
      <label className="pp-check"><input type="checkbox" checked={settings.standbyLogo} onChange={e => set({ standbyLogo: e.target.checked })} /> Mostrar el logo</label>
    </>}

    <h4><Palette size={14} /> Fondo de la letra · {THEMES.length + uploaded.length} diseños</h4>
    {song && <div className="seg-toggle">
      <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>Todas las canciones</button>
      <button className={scope === 'song' ? 'on' : ''} onClick={() => setScope('song')}>Solo «{song.title}»</button>
    </div>}
    {scope === 'song' && songTheme && <button className="link-btn small" onClick={() => { const { [song.id]: _, ...rest } = settings.songThemes; set({ songThemes: rest }); }}>Quitar el fondo propio de esta canción</button>}
    <div className="cat-chips">{groups.map(g => <button key={g} className={cat === g ? 'on' : ''} onClick={() => setCat(g)}>{g}</button>)}</div>
    {cat !== 'Mis imágenes' && <div className="theme-grid">{visible.map(t => <Thumb key={t.id} t={t} />)}</div>}
    {(cat === 'Todas' || cat === 'Mis imágenes') && <>
      {cat === 'Todas' && <h4>Mis imágenes</h4>}
      {uploaded.length > 0 && <div className="theme-grid">{uploaded.map(b => <Thumb key={b.id} t={themeById('img:' + b.id, uploaded)} />)}</div>}
      <button className="btn ghost-dark sm" onClick={openMedia}><Upload size={14} /> Subir imágenes de la computadora</button>
    </>}
    <label className="pp-row"><span>Color del texto</span><select value={settings.textColor} onChange={e => set({ textColor: e.target.value })}>{TEXT_COLORS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>

    <h4>Logo</h4>
    <label className="pp-row"><span>Logo</span><select value={settings.logoImage} onChange={e => set({ logoImage: e.target.value })}>
      <option value="">Logo de la iglesia</option>
      {uploaded.map(b => <option key={b.id} value={b.id}>Imagen: {b.original_name}</option>)}
    </select></label>
    <label className="pp-check"><input type="checkbox" checked={settings.logoCorner} onChange={e => set({ logoCorner: e.target.checked })} /> Logo chico en la esquina de cada diapositiva</label>
    <p className="muted small">Las plantillas del grupo <b>Iglesia</b> muestran el logo de fondo. Para usar tu propio logo, subilo en <b>Imágenes</b> y tocá “Logo”.</p>

    <h4><Type size={14} /> Texto</h4>
    <label className="pp-row"><span>Líneas por diapositiva</span><select value={settings.perSlide} onChange={e => set({ perSlide: Number(e.target.value) })}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
    <label className="pp-row"><span>Cortar frases largas</span><select value={settings.maxChars} onChange={e => set({ maxChars: Number(e.target.value) })}><option value={0}>No</option><option value={30}>Cortas (30)</option><option value={42}>Medias (42)</option><option value={60}>Largas (60)</option></select></label>
    <label className="pp-row"><span>Tamaño</span><input type="range" min="0.6" max="1.6" step="0.05" value={settings.size} onChange={e => set({ size: Number(e.target.value) })} /></label>
    <label className="pp-row"><span>Tipografía</span><select value={settings.font} onChange={e => set({ font: e.target.value })}>{Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.name}</option>)}</select></label>
    <label className="pp-row"><span>Posición</span><select value={settings.position} onChange={e => set({ position: e.target.value })}><option value="center">Centro</option><option value="bottom">Abajo (transmisión)</option><option value="top">Arriba</option></select></label>
    <label className="pp-row"><span>Oscurecer fondo</span><input type="range" min="0" max="0.8" step="0.05" value={settings.overlay ?? theme.overlay ?? 0} onChange={e => set({ overlay: Number(e.target.value) })} /></label>
    <label className="pp-check"><input type="checkbox" checked={settings.upper} onChange={e => set({ upper: e.target.checked })} /> MAYÚSCULAS</label>
    <label className="pp-check"><input type="checkbox" checked={settings.titleSlide} onChange={e => set({ titleSlide: e.target.checked })} /> Portada con el título de cada canción</label>
    <label className="pp-check"><input type="checkbox" checked={settings.label} onChange={e => set({ label: e.target.checked })} /> Mostrar nombre de la sección (Coro, Estrofa…)</label>
    <button className="btn ghost-dark sm" onClick={reset}>Restablecer todo</button>
  </aside>;
}

/** Ventana que va al proyector: solo muestra lo que está en vivo, sin controles. */
export function ScreenWindow(){
  const [state, setState] = useState(() => { const s = savedSettings(); return { slide: standbySlide(s), theme: standbyThemeOf(s, themeById(s.theme), []), settings: s }; });
  const receiver = isCastReceiver(); // dibujada por Chrome para un Chromecast / TV
  const [hint, setHint] = useState(!receiver);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    document.title = 'SION Music · Proyector';
    if (receiver) { listenAsReceiver(data => { if (data.type === 'state' && data.slide) { setState(data); setConnected(true); } }); return; }
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = ({ data }) => { if (data.type === 'state' && data.slide) { setState(data); setConnected(true); } };
    ch.postMessage({ type: 'hello' });
    const k = e => { ch.postMessage({ type: 'key', key: e.key }); if ([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp'].includes(e.key)) e.preventDefault(); };
    const bye = () => ch.postMessage({ type: 'bye' });
    window.addEventListener('keydown', k);
    window.addEventListener('beforeunload', bye);
    const t = setTimeout(() => setHint(false), 6000);
    return () => { bye(); ch.close(); window.removeEventListener('keydown', k); window.removeEventListener('beforeunload', bye); clearTimeout(t); };
  }, []);
  const toggleFs = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); setHint(false); };
  return <div className="screen-window" onDoubleClick={toggleFs}>
    <Stage slide={state.slide} theme={state.theme} settings={state.settings} />
    {hint && <div className="screen-hint">Arrastrá esta ventana al proyector y hacé <b>doble clic</b> para pantalla completa{!connected && <><br />Esperando la ventana de control…</>}</div>}
  </div>;
}
