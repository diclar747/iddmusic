import React, { useEffect, useState } from 'react';
import { Cast, MonitorUp, X, RefreshCw, Monitor, Power, Tv, Info, Guitar, Copy, ExternalLink } from 'lucide-react';
import { onCastState, startCast, stopCast, rescan, musicCast } from '../lib/cast.js';

/** Estado de la transmisión (Chromecast) para cualquier componente. */
export function useCast(){
  const [s, setS] = useState({ supported: false, available: null, status: 'idle', error: '' });
  useEffect(() => onCastState(setS), []);
  return s;
}

/** Salida para músicos: letra CON acordes en tablets/teléfonos o en un segundo Chromecast. */
function MusiciansOutput({ liveGroup }){
  const [c, setC] = useState({ supported: false, status: 'idle', error: '' });
  const [copied, setCopied] = useState(false);
  useEffect(() => musicCast.onState(setC), []);
  const url = `${location.origin}${location.pathname}#/musicos${liveGroup ? '/' + liveGroup : ''}`;
  const copy = () => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  return <section className="out-sec">
    <h4><Guitar size={15} /> Músicos · letra con acordes</h4>
    <p className="muted small">El proyector público muestra la letra <b>sin</b> acordes. Los músicos ven la misma canción <b>con acordes</b>, siguiendo sola la sección que se proyecta.</p>
    <div className="out-status"><span className={`dot ${c.status === 'connected' ? 'ok' : c.status === 'connecting' ? 'wait' : ''}`} />{c.status === 'connected' ? 'Transmitiendo la vista de músicos a un segundo dispositivo' : 'En tablets y teléfonos: abrir este enlace e ingresar'}</div>
    <div className="out-link"><code>{url}</code><button className="icon-btn dark sm" onClick={copy} title="Copiar enlace"><Copy size={13} /></button><a className="icon-btn dark sm" href={url.replace(location.origin + location.pathname, '')} target="_blank" rel="noreferrer" title="Abrir"><ExternalLink size={13} /></a></div>
    {copied && <small className="muted">Enlace copiado</small>}
    {c.supported && <div className="out-btns">
      {c.status === 'connected' ? <button className="btn ghost-dark sm" onClick={() => musicCast.stop()}><Power size={14} /> Dejar de transmitir (músicos)</button>
        : <button className="btn gold sm" onClick={() => musicCast.start()} disabled={c.status === 'connecting'}><Cast size={14} /> Transmitir acordes a otro Chromecast</button>}
    </div>}
    {c.error && <div className="bible-err">{c.error}</div>}
  </section>;
}

/** Abre (o mueve) la ventana del proyector; si se indica una pantalla, la ocupa entera. */
export function openScreenWindow(scr){
  const feat = scr ? `popup,left=${scr.availLeft},top=${scr.availTop},width=${scr.availWidth},height=${scr.availHeight}` : 'popup,width=1280,height=720';
  const w = window.open('#/screen', 'idd-screen', feat);
  if (!w) { alert('El navegador bloqueó la ventana. Permití ventanas emergentes para este sitio (ícono en la barra de direcciones).'); return null; }
  if (scr) { try { w.moveTo(scr.availLeft, scr.availTop); w.resizeTo(scr.availWidth, scr.availHeight); } catch { /* */ } }
  w.focus();
  return w;
}

const castLine = c => c.status === 'connected' ? ['ok', 'Transmitiendo al dispositivo']
  : c.status === 'connecting' ? ['wait', 'Conectando… elegí el dispositivo en la lista de Chrome']
  : c.searching || c.available === null ? ['wait', 'Buscando dispositivos en la red…']
  : c.available === true ? ['ok', 'Hay dispositivos de transmisión disponibles']
  : c.available === false ? ['off', 'No se encontraron dispositivos en la red']
  : ['', 'Tocá “Transmitir” para ver los dispositivos'];

export default function OutputPanel({ screenOpen, liveGroup, onClose }){
  const cast = useCast();
  const [screens, setScreens] = useState(null);
  const [scrErr, setScrErr] = useState('');
  const extended = typeof window.screen.isExtended === 'boolean' ? window.screen.isExtended : null;
  const [dot, line] = castLine(cast);

  async function detectScreens(){
    setScrErr('');
    if (!('getScreenDetails' in window)) { setScrErr('Este navegador no puede listar las pantallas. Usá “Abrir ventana” y arrastrala al proyector.'); return; }
    try {
      const d = await window.getScreenDetails();
      const list = () => setScreens([...d.screens].sort((a, b) => a.left - b.left));
      list(); d.onscreenschange = list;
    } catch { setScrErr('Para ubicar la ventana sola, permití “Administración de ventanas” cuando el navegador lo pregunte.'); }
  }
  useEffect(() => {
    // Si el permiso ya fue concedido, lista las pantallas sin preguntar.
    navigator.permissions?.query({ name: 'window-management' }).then(p => { if (p.state === 'granted') detectScreens(); }).catch(() => {});
  }, []);

  return <aside className="present-panel">
    <div className="pp-head"><b><Cast size={16} /> Proyector y TV</b><button className="icon-btn dark" onClick={onClose}><X size={16} /></button></div>

    <section className="out-sec">
      <h4><Tv size={15} /> Chromecast · Google TV · Smart TV</h4>
      {cast.supported ? <>
        <div className="out-status"><span className={`dot ${dot}`} />{line}</div>
        <div className="out-btns">
          {cast.status === 'connected' ? <>
            <button className="btn gold sm" onClick={startCast}><Cast size={14} /> Cambiar de dispositivo</button>
            <button className="btn ghost-dark sm" onClick={stopCast}><Power size={14} /> Dejar de transmitir</button>
          </> : <button className="btn gold sm" onClick={startCast} disabled={cast.status === 'connecting'}><Cast size={14} /> Transmitir a un dispositivo</button>}
          <button className="btn ghost-dark sm" onClick={rescan} title="Volver a buscar (por ejemplo, después de encender el TV)"><RefreshCw size={14} /> Buscar de nuevo</button>
        </div>
        {cast.error && <div className="bible-err">{cast.error}</div>}
        <p className="muted small">Chrome busca los dispositivos de tu red y te muestra la lista: elegí el Chromecast o TV. La transmisión sigue activa aunque cambies de canción o de evento. También funciona desde el menú de Chrome <b>⋮ → Transmitir…</b></p>
      </> : <p className="muted small"><Info size={13} /> Para transmitir a Chromecast abrí SION Music en <b>Google Chrome</b> o <b>Microsoft Edge</b> (<code>{location.origin}</code>). Este navegador no tiene la función de transmitir.</p>}
    </section>

    <MusiciansOutput liveGroup={liveGroup} />

    <section className="out-sec">
      <h4><Monitor size={15} /> Proyector o TV por cable (HDMI)</h4>
      <div className="out-status"><span className={`dot ${screenOpen ? 'ok' : ''}`} />{screenOpen ? 'Ventana del proyector abierta y sincronizada' : extended ? 'Se detectó una segunda pantalla' : extended === false ? 'Solo hay una pantalla conectada' : 'Ventana del proyector cerrada'}</div>
      {screens?.length > 0 && <div className="screens">{screens.map((s, i) => <button key={i} onClick={() => openScreenWindow(s)}>
        <span className="scr" style={{ borderColor: s.isPrimary ? '#8fa0b6' : 'var(--gold-2)' }} />
        <span><b>{s.label || `Pantalla ${i + 1}`}</b><small>{s.width}×{s.height}{s.isPrimary ? ' · principal (esta)' : ' · proyectar acá'}{s.isInternal ? ' · integrada' : ''}</small></span>
      </button>)}</div>}
      <div className="out-btns">
        {!screens && <button className="btn gold sm" onClick={detectScreens}><Monitor size={14} /> Detectar pantallas</button>}
        <button className="btn ghost-dark sm" onClick={() => openScreenWindow()}><MonitorUp size={14} /> {screenOpen ? 'Traer la ventana' : 'Abrir ventana'}</button>
      </div>
      {scrErr && <p className="muted small">{scrErr}</p>}
      <p className="muted small">Configurá Windows en <b>Extender</b> (tecla <kbd>Win</kbd>+<kbd>P</kbd>). Elegí la pantalla del proyector y la ventana se abre ahí; hacé <b>doble clic</b> sobre ella (o tecla <kbd>F</kbd>) para pantalla completa.</p>
    </section>
  </aside>;
}
