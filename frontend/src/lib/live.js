// Sincronización en vivo con los músicos (tablets, teléfonos, segundo Chromecast) a través del servidor.
import { api, session } from '../api.js';

/** Publica repertorio y/o posición. Los errores no interrumpen la proyección. */
export function publishLive(groupId, body){
  if (!groupId) return Promise.resolve(null);
  return api(`/live/${groupId}`, { method: 'PUT', body }).catch(() => null);
}

/**
 * Sigue la sesión en vivo de un grupo (Server-Sent Events leídos con fetch, para mandar el token en el encabezado).
 * Reconecta sola si se corta la red. Devuelve la función para dejar de seguir.
 */
export function subscribeLive(groupId, { onSetlist, onPos, onEnd, onStatus }){
  let stopped = false, ctrl = null, retry = 1000;
  async function run(){
    while (!stopped) {
      ctrl = new AbortController();
      try {
        onStatus?.('connecting');
        const res = await fetch(`/api/live/${groupId}/stream`, { headers: { Authorization: `Bearer ${session.token}` }, signal: ctrl.signal, cache: 'no-store' });
        if (res.status === 401 || res.status === 403) { onStatus?.('denied'); return; }
        if (!res.ok || !res.body) throw new Error('stream');
        onStatus?.('live'); retry = 1000;
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let i;
          while ((i = buf.indexOf('\n\n')) > -1) {
            const block = buf.slice(0, i); buf = buf.slice(i + 2);
            let event = 'message', data = '';
            for (const line of block.split('\n')) {
              if (line.startsWith('event: ')) event = line.slice(7);
              else if (line.startsWith('data: ')) data += line.slice(6);
            }
            if (!data) continue;
            let d; try { d = JSON.parse(data); } catch { continue; }
            if (event === 'setlist') onSetlist?.(d);
            else if (event === 'pos') onPos?.(d);
            else if (event === 'end') onEnd?.();
          }
        }
      } catch (e) { if (stopped || e.name === 'AbortError') return; }
      if (stopped) return;
      onStatus?.('offline');
      await new Promise(r => setTimeout(r, retry));
      retry = Math.min(retry * 2, 10000);
    }
  }
  run();
  return () => { stopped = true; ctrl?.abort(); };
}

export const groupLiveList = () => api('/live');
