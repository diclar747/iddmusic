import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Guitar, Minus, Plus, Maximize, Radio, Eye, EyeOff, Crosshair, Sun, Type, WifiOff, Loader2 } from 'lucide-react';
import ChartView from '../components/ChartView.jsx';
import { transposeSections, transposeChord } from '../lib/chart.js';
import { subscribeLive, groupLiveList } from '../lib/live.js';
import { isCastReceiver, listenAsReceiver } from '../lib/cast.js';

const pref = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };

const WHAT = { espera: 'Pantalla de espera', pausa: 'Pantalla de espera', texto: 'Texto en pantalla', biblia: 'Biblia en pantalla', imagen: 'Imagen en pantalla' };

/**
 * Vista para músicos: la canción que se está proyectando, CON acordes, siguiendo en vivo la sección actual.
 * Se abre en tablets/teléfonos (#/musicos) o se transmite a un segundo Chromecast (modo TV).
 */
export default function Musicians({ groupId: initialGroup, tv: tvParam }){
  const receiver = isCastReceiver();
  const tv = receiver || tvParam;
  const [groupId, setGroupId] = useState(initialGroup || (receiver ? null : pref('idd_mus_group', null)));
  const [sessions, setSessions] = useState(null);
  const [setlist, setSetlist] = useState(null);
  const [pos, setPos] = useState(null);
  const [status, setStatus] = useState('idle');
  const [view, setView] = useState(null);           // índice de canción elegida a mano (null = sigue el vivo)
  const [follow, setFollow] = useState(true);
  const [size, setSize] = useState(() => pref('idd_mus_size', tv ? 30 : 20));
  const [chords, setChords] = useState(() => pref('idd_mus_chords', true));
  const [shifts, setShifts] = useState(() => pref('idd_mus_shift', {}));
  const [awake, setAwake] = useState(false);
  const [ready, setReady] = useState(!receiver);   // en el TV espera el token que manda el presentador
  const bodyRef = useRef(null);

  useEffect(() => save('idd_mus_size', size), [size]);
  useEffect(() => save('idd_mus_chords', chords), [chords]);
  useEffect(() => save('idd_mus_shift', shifts), [shifts]);
  useEffect(() => { if (groupId && !receiver) save('idd_mus_group', groupId); }, [groupId]);
  useEffect(() => { document.title = 'SION Music · Músicos'; }, []);

  // Modo TV (Chromecast): el presentador manda el token y el grupo a seguir.
  useEffect(() => {
    if (!receiver) return;
    listenAsReceiver(d => {
      if (d.type === 'auth') setReady(true);
      if (d.type === 'live' && d.groupId) setGroupId(d.groupId);
    });
  }, []);

  // Lista de grupos con proyección en vivo (para elegir a quién seguir).
  useEffect(() => {
    if (!ready || receiver) return;
    const load = () => groupLiveList().then(d => {
      setSessions(d.items);
      setGroupId(g => g && d.items.some(x => x.group_id === g) ? g : (d.items.find(x => x.active) || d.items[0])?.group_id || null);
    }).catch(() => setSessions([]));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [ready]);

  useEffect(() => {
    if (!ready || !groupId) return;
    setSetlist(null); setPos(null); setView(null);
    return subscribeLive(groupId, { onSetlist: setSetlist, onPos: setPos, onEnd: () => { setSetlist(null); setPos(null); }, onStatus: setStatus });
  }, [ready, groupId]);

  const liveSong = pos?.song ?? 0;
  const shown = follow || view === null ? liveSong : view;
  const song = setlist?.songs?.[shown];
  const shift = song ? shifts[song.id] || 0 : 0;
  const sections = useMemo(() => song ? transposeSections(song.lyrics_sections, shift) : [], [song, shift]);
  const isLiveSong = shown === liveSong;
  const activeSec = isLiveSong && pos?.what === 'cancion' ? pos.sec ?? -1 : -1;
  const key = song?.original_key ? transposeChord(song.original_key, shift) : null;

  // Lleva la sección en vivo a la vista.
  useEffect(() => {
    if (!follow) return;
    const el = bodyRef.current?.querySelector('.chart-sec.live');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: tv ? 'center' : 'start' });
    else if (pos?.what === 'cancion' && pos.slideKind === 'title') bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSec, shown, follow, pos?.slideKind]);

  // Pantalla siempre encendida en tablets/teléfonos.
  useEffect(() => {
    if (!awake || !navigator.wakeLock) return;
    let lock = null;
    const req = () => navigator.wakeLock.request('screen').then(l => { lock = l; }).catch(() => setAwake(false));
    req();
    const vis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); lock?.release().catch(() => {}); };
  }, [awake]);

  const setShift = d => song && setShifts(s => ({ ...s, [song.id]: ((s[song.id] || 0) + d + 12) % 12 }));
  const pick = i => { setView(i); setFollow(i === liveSong); };
  const groupName = sessions?.find(s => s.group_id === groupId)?.group_name;
  const nextSong = setlist?.songs?.[shown + 1];

  if (receiver && !ready) return <div className="mus tv"><div className="mus-wait"><Guitar size={40} /><b>Vista de músicos</b><span>Conectando con la proyección…</span></div></div>;

  return <div className={`mus ${tv ? 'tv' : ''}`}>
    {!tv && <header className="mus-bar">
      <a className="icon-btn dark" href="#/" title="Salir"><ArrowLeft size={18} /></a>
      <div className="mus-title"><b><Guitar size={16} /> Músicos</b>
        {sessions?.length > 1 ? <select value={groupId || ''} onChange={e => setGroupId(e.target.value)}>{sessions.map(s => <option key={s.group_id} value={s.group_id}>{s.active ? '● ' : ''}{s.group_name}</option>)}</select> : <small>{groupName}</small>}
      </div>
      <span className={`mus-status ${status}`}>{status === 'live' ? (setlist ? <><Radio size={13} /> En vivo</> : 'Esperando proyección') : status === 'offline' ? <><WifiOff size={13} /> Reconectando…</> : status === 'denied' ? 'Sin acceso' : <Loader2 className="spin" size={13} />}</span>
      <div className="mus-tools">
        <button className="icon-btn dark" onClick={() => setShift(-1)} title="Bajar medio tono"><Minus size={16} /></button>
        <span className="mus-key" title="Tono">{key || '—'}{shift ? <small> ({shift > 6 ? shift - 12 : `+${shift}`})</small> : null}</span>
        <button className="icon-btn dark" onClick={() => setShift(1)} title="Subir medio tono"><Plus size={16} /></button>
        <button className="icon-btn dark" onClick={() => setSize(s => Math.max(12, s - 2))} title="Letra más chica"><Type size={13} /></button>
        <button className="icon-btn dark" onClick={() => setSize(s => Math.min(48, s + 2))} title="Letra más grande"><Type size={19} /></button>
        <button className={`icon-btn dark ${chords ? 'on' : ''}`} onClick={() => setChords(c => !c)} title={chords ? 'Ocultar acordes' : 'Mostrar acordes'}>{chords ? <Eye size={16} /> : <EyeOff size={16} />}</button>
        <button className={`icon-btn dark ${follow ? 'on' : ''}`} onClick={() => { setFollow(true); setView(null); }} title="Seguir la proyección"><Crosshair size={16} /></button>
        {'wakeLock' in navigator && <button className={`icon-btn dark ${awake ? 'on' : ''}`} onClick={() => setAwake(a => !a)} title="Mantener la pantalla encendida"><Sun size={16} /></button>}
        <button className="icon-btn dark" onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {})} title="Pantalla completa"><Maximize size={16} /></button>
      </div>
    </header>}

    {setlist?.songs?.length > 0 && !tv && <nav className="mus-setlist">{setlist.songs.map((s, i) => <button key={s.id} className={`${i === shown ? 'on' : ''} ${i === liveSong ? 'live' : ''}`} onClick={() => pick(i)}>
      <span>{i + 1}</span>{s.title}{i === liveSong && <Radio size={11} />}</button>)}</nav>}

    {pos && pos.what !== 'cancion' && <div className={`mus-banner ${pos.what}`}>
      <b>{WHAT[pos.what] || 'En pantalla'}</b>
      {pos.text && <span>{pos.text.lines?.join(' ')}{pos.text.reference && <em> — {pos.text.reference}</em>}</span>}
      {pos.name && <span>{pos.name}</span>}
    </div>}
    {!follow && !isLiveSong && <button className="mus-back" onClick={() => { setFollow(true); setView(null); }}><Crosshair size={14} /> Volver a la canción en vivo{setlist?.songs?.[liveSong] ? `: ${setlist.songs[liveSong].title}` : ''}</button>}

    <main className="mus-body" ref={bodyRef}>
      {!groupId && sessions && <div className="mus-wait"><Guitar size={36} /><b>No pertenecés a ningún grupo todavía</b></div>}
      {groupId && !setlist && <div className="mus-wait"><Guitar size={36} /><b>Esperando la proyección{groupName ? ` de ${groupName}` : ''}</b><span>Cuando alguien proyecte desde IDD Music, acá aparece la canción con acordes y se va siguiendo sola.</span></div>}
      {song && <>
        <div className="mus-head">
          <h1>{song.title}</h1>
          <div className="mus-meta">{key && <span>Tono <b>{key}</b></span>}{song.tempo_bpm && <span>{song.tempo_bpm} BPM</span>}{song.time_signature && <span>{song.time_signature}</span>}{song.author && <span>{song.author}</span>}
            {tv && setlist.songs.length > 1 && <span>{shown + 1}/{setlist.songs.length}</span>}</div>
        </div>
        <ChartView sections={sections} showChords={chords} fontSize={tv ? 'clamp(16px, 2.3vw, 44px)' : size} activeSec={activeSec} />
        {nextSong && <div className="mus-next">Sigue: <b>{nextSong.title}</b>{nextSong.original_key && ` · ${transposeChord(nextSong.original_key, shifts[nextSong.id] || 0)}`}</div>}
      </>}
    </main>
  </div>;
}
