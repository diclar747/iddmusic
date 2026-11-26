// Transmisión a Chromecast / Google TV / Android TV (y pantallas que Chrome ofrezca en "Transmitir").
// Usa la Presentation API de Chrome/Edge: el navegador busca los dispositivos de la red (mDNS),
// muestra su propia lista para elegir y dibuja la página receptora enviándola al dispositivo.
// Hay dos salidas independientes (cada una a su propio Chromecast):
//   publicCast → #/screen   letra SIN acordes para la congregación
//   musicCast  → #/musicos  letra CON acordes para los músicos
// Las conexiones viven a nivel de la aplicación: siguen activas al cambiar de canción o de evento.
import { session } from '../api.js';

const MAX_MSG = 48 * 1024; // Chrome limita el tamaño de cada mensaje: los grandes (imágenes) se mandan en partes.
export const castSupported = () => typeof window !== 'undefined' && typeof window.PresentationRequest === 'function' && window.isSecureContext;
export const isCastReceiver = () => !!navigator.presentation?.receiver;

function createCaster(route, idKey, { isDefault = false } = {}){
  let request = null, conn = null, availability = null, lastState = null, init = null, seq = 0;
  const state = { supported: castSupported(), available: null, searching: false, status: 'idle', error: '' };
  const listeners = new Set();
  const emit = () => { const s = { ...state }; listeners.forEach(f => f(s)); };
  const url = () => `${location.origin}${location.pathname}?cast=1#${route}`;

  function rawSend(msg){
    if (!conn || conn.state !== 'connected') return;
    const text = JSON.stringify(msg);
    try {
      if (text.length <= MAX_MSG) { conn.send(text); return; }
      const id = ++seq, n = Math.ceil(text.length / MAX_MSG);
      for (let i = 0; i < n; i++) conn.send(JSON.stringify({ type: 'chunk', id, i, n, data: text.slice(i * MAX_MSG, (i + 1) * MAX_MSG) }));
    } catch { /* la conexión se cerró en el medio */ }
  }
  function attach(c){
    if (conn && conn !== c && conn.state === 'connected') { try { conn.close(); } catch { /* */ } }
    conn = c;
    try { localStorage.setItem(idKey, c.id); } catch { /* */ }
    const sync = () => {
      if (conn !== c) return;
      state.status = c.state === 'connected' ? 'connected' : c.state === 'connecting' ? 'connecting' : 'idle';
      if (c.state === 'connected') { state.error = ''; rawSend({ type: 'auth', token: session.token }); if (init) rawSend(init); if (lastState) rawSend(lastState); }
      if (c.state === 'terminated') { localStorage.removeItem(idKey); conn = null; }
      if (c.state === 'closed') conn = null;
      emit();
    };
    c.onconnect = sync; c.onclose = sync; c.onterminate = sync;
    sync();
  }
  async function watchAvailability(){
    if (!request) return;
    state.searching = true; emit();
    try {
      availability = await request.getAvailability();
      state.available = availability.value;
      availability.onchange = () => { state.available = availability.value; emit(); };
    } catch { state.available = 'unknown'; } // no informa en segundo plano; igual se puede abrir la lista
    state.searching = false; emit();
  }
  function ensure(){
    if (request || !state.supported) return request;
    request = new PresentationRequest([url()]);
    // El menú de Chrome "Transmitir…" usa la pantalla pública (en vez de duplicar la pestaña).
    if (isDefault) { try { navigator.presentation.defaultRequest = request; } catch { /* */ } }
    request.addEventListener('connectionavailable', e => attach(e.connection));
    watchAvailability();
    const saved = localStorage.getItem(idKey);
    if (saved) request.reconnect(saved).then(attach).catch(() => localStorage.removeItem(idKey));
    return request;
  }
  return {
    /** Suscribe a cambios de estado; devuelve la función para desuscribir. */
    onState(fn){ ensure(); listeners.add(fn); fn({ ...state }); return () => listeners.delete(fn); },
    /** Abre la lista de dispositivos de Chrome (debe llamarse desde un clic). */
    async start(){
      if (!ensure()) return;
      state.status = 'connecting'; state.error = ''; emit();
      try { attach(await request.start()); }
      catch (e) {
        state.status = conn?.state === 'connected' ? 'connected' : 'idle';
        state.error = e.name === 'NotAllowedError' || e.name === 'AbortError' ? ''
          : e.name === 'NotFoundError' ? 'No se encontró ningún dispositivo. Verificá que el Chromecast/TV esté encendido y en la misma red Wi-Fi que esta computadora.'
          : `No se pudo conectar: ${e.message}`;
        emit();
      }
    },
    stop(){ try { conn?.terminate(); } catch { /* */ } localStorage.removeItem(idKey); conn = null; state.status = 'idle'; emit(); },
    /** Vuelve a buscar dispositivos (por ejemplo, después de encender el TV). */
    rescan(){ if (!state.supported) return; if (availability) availability.onchange = null; request = null; state.available = null; ensure(); },
    /** Envía el estado actual (y lo recuerda para cuando se conecte). */
    send(msg){ if (msg?.type === 'state') lastState = msg; rawSend(msg); },
    /** Mensaje que se manda cada vez que se conecta (por ejemplo, qué grupo seguir). */
    setInit(msg){ init = msg; rawSend(msg); }
  };
}

export const publicCast = createCaster('/screen', 'idd_cast_id', { isDefault: true });
export const musicCast = createCaster('/musicos', 'idd_cast_music_id');

// Compatibilidad con la salida pública.
export const onCastState = fn => publicCast.onState(fn);
export const startCast = () => publicCast.start();
export const stopCast = () => publicCast.stop();
export const rescan = () => publicCast.rescan();
export const castSend = msg => publicCast.send(msg);

/* ---------- Lado receptor (la página que se dibuja para el TV) ---------- */
export function listenAsReceiver(onMessage){
  const parts = new Map();
  const add = c => {
    c.onmessage = e => {
      let d; try { d = JSON.parse(e.data); } catch { return; }
      if (d.type === 'chunk') {
        const p = parts.get(d.id) || []; p[d.i] = d.data; parts.set(d.id, p);
        if (p.filter(x => x !== undefined).length < d.n) return;
        parts.delete(d.id);
        try { d = JSON.parse(p.join('')); } catch { return; }
      }
      if (d.type === 'auth' && d.token) { try { localStorage.setItem('idd_token', d.token); } catch { /* */ } }
      onMessage(d);
    };
  };
  navigator.presentation.receiver.connectionList.then(list => {
    list.connections.forEach(add);
    list.onconnectionavailable = e => add(e.connection);
  });
}
