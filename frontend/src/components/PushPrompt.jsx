// Aviso al entrar: "¿Querés recibir el versículo del día?" (notificaciones push a las 6:00).
import React, { useEffect, useState } from 'react';
import { BellRing, X, Sunrise } from 'lucide-react';
import { pushState, enablePush, pushSnoozed, snoozePush } from '../lib/push.js';
import { useToast } from '../ui.jsx';
import { BrandMark } from './Brand.jsx';

export default function PushPrompt(){
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (pushSnoozed() || /cast=1/.test(location.search)) return;
    const t = setTimeout(() => pushState().then(s => {
      if (s === 'off' && Notification.permission === 'default') setShow(true);
    }).catch(() => {}), 4000);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  const later = () => { snoozePush(7); setShow(false); };
  async function yes(){
    setBusy(true);
    try {
      await enablePush();
      setShow(false);
      toast('¡Listo! Mañana a las 6:00 te llega tu versículo del día.');
    } catch (e) { toast(e.message, 'error'); snoozePush(30); setShow(false); }
    finally { setBusy(false); }
  }
  return <div className="push-ask" role="dialog" aria-labelledby="push-ask-t">
    <div className="push-card">
      <button className="push-x" onClick={later} aria-label="Cerrar"><X size={18} /></button>
      <div className="push-glow"><span className="push-icon"><BellRing size={30} /></span></div>
      <h2 id="push-ask-t">¿Querés recibir el <span>versículo del día</span>?</h2>
      <p>Todas las mañanas a las <b>6:00</b> te enviamos <b>2 versículos bíblicos</b> elegidos para vos, para empezar el día con la Palabra.</p>
      <div className="push-demo" aria-hidden="true">
        <BrandMark size={34} />
        <span><b>Tu versículo del día</b><small>«Todo lo puedo en Cristo que me fortalece.» Filipenses 4:13</small></span>
        <em><Sunrise size={13} /> 6:00</em>
      </div>
      <button className="btn primary push-yes" disabled={busy} onClick={yes}><BellRing size={18} /> {busy ? 'Activando…' : 'Sí, quiero recibirlos'}</button>
      <button className="push-later" onClick={later}>Ahora no</button>
    </div>
  </div>;
}
