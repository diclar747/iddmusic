// Versículo del día: los 2 versículos de hoy para el usuario y el control de las notificaciones de este dispositivo.
import React, { useState } from 'react';
import { BellRing, BellOff, Send, Share2, Sunrise, Smartphone } from 'lucide-react';
import { api } from '../api.js';
import { useApi, Spinner, ErrorBox, Busy, useToast } from '../ui.jsx';
import { usePushState, enablePush, disablePush } from '../lib/push.js';

const fmtDay = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long' }) : '';

export default function Verse(){
  const toast = useToast();
  const { data, loading, error } = useApi('/push/today');
  const state = usePushState();
  const [busy, setBusy] = useState('');
  const run = (k, fn) => async () => { setBusy(k); try { await fn(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); } };
  const share = v => {
    const text = `«${v.text}»\n${v.reference} (${v.version})\n\nVersículo del día · SION Music`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  return <>
    <header className="page-head">
      <div><span className="eyebrow">Para vos, hoy</span><h1>Versículo del día</h1><p className="muted">{data ? fmtDay(data.date) : 'Dos versículos elegidos para empezar el día con la Palabra.'}</p></div>
    </header>
    <ErrorBox error={error} />
    {loading && <Spinner />}
    <div className="verses">
      {data?.items.map((v, i) => <article key={v.reference} className="verse-card">
        <span className="verse-n">{i + 1}</span>
        <blockquote>{v.text}</blockquote>
        <footer><b>{v.reference}</b><small>{v.version}</small>
          <button className="btn sm" onClick={() => share(v)}><Share2 size={15} /> Compartir</button></footer>
      </article>)}
    </div>
    <section className="panel push-panel">
      <span className="push-icon sm">{state === 'on' ? <BellRing size={22} /> : <Sunrise size={22} />}</span>
      <div className="grow">
        <h3>Notificación todas las mañanas</h3>
        {state === 'on' && <p className="muted">Activada en este dispositivo: a las 6:00 te llegan 2 versículos nuevos.</p>}
        {state === 'off' && <p className="muted">Recibí estos versículos cada mañana a las 6:00 como notificación en este dispositivo.</p>}
        {state === 'denied' && <p className="muted">Las notificaciones están bloqueadas en este navegador. Tocá el candado junto a la dirección → Notificaciones → Permitir, y volvé a esta pantalla.</p>}
        {state === 'install' && <p className="muted"><Smartphone size={14} /> En iPhone o iPad primero instalá la app: tocá Compartir → <b>Agregar a inicio</b>, abrila desde el ícono y activá las notificaciones acá.</p>}
        {state === 'unsupported' && <p className="muted">Este navegador no permite notificaciones. Probá con Chrome, Edge o Safari actualizados.</p>}
      </div>
      <div className="push-actions">
        {state === 'off' && <Busy busy={busy === 'on'} onClick={run('on', async () => { await enablePush(); toast('¡Listo! Mañana a las 6:00 te llega tu versículo del día.'); })}><BellRing size={16} /> Activar</Busy>}
        {state === 'on' && <>
          <Busy busy={busy === 'test'} className="btn" onClick={run('test', async () => { await api('/push/test', { method: 'POST' }); toast('Enviado: en unos segundos te llega la notificación.'); })}><Send size={15} /> Enviarme uno ahora</Busy>
          <Busy busy={busy === 'off'} className="btn ghost" onClick={run('off', async () => { await disablePush(); toast('Ya no vas a recibir notificaciones en este dispositivo.'); })}><BellOff size={15} /> Desactivar</Busy>
        </>}
      </div>
    </section>
  </>;
}
