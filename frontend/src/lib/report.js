// Envía al servidor los errores del navegador (quedan en "Registros" del sitio) para poder diagnosticar
// problemas que pasan en la iglesia: pantalla en blanco, transmisión al Chromecast que se corta, etc.
let sent = 0;
const seen = new Set();

export function report(kind, message, extra = {}){
  try {
    const msg = String(message || '').slice(0, 400);
    const key = kind + msg;
    if (seen.has(key) || sent >= 15) return;
    seen.add(key); sent++;
    const body = JSON.stringify({ kind, message: msg, where: location.hash.split('?')[0] + (/cast=1/.test(location.search) ? ' (TV)' : ''), ua: navigator.userAgent, ...extra });
    fetch('/api/client-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch { /* nunca interrumpe la app */ }
}

export function installErrorReporting(){
  window.addEventListener('error', e => {
    if (!e.message || /ResizeObserver loop/.test(e.message)) return;
    report('error', e.message, { stack: e.error?.stack || `${e.filename}:${e.lineno}` });
  });
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason;
    if (r?.name === 'AbortError' || r?.status) return; // cancelaciones y errores de la API ya manejados
    report('promesa', r?.message || String(r), { stack: r?.stack });
  });
}
