// Notificaciones push del versículo del día: permiso, suscripción y estado en este dispositivo.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { isIOS, isStandalone } from './pwa.js';

const LATER = 'sion_push_later';
const subs = new Set();
const changed = () => subs.forEach(f => f());

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
/** En iPhone/iPad las notificaciones solo funcionan con la app instalada (Compartir → Agregar a inicio). */
export const pushNeedsInstall = () => isIOS() && !isStandalone();

function keyBytes(b64){
  const s = (b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function registration(){
  const reg = await navigator.serviceWorker.getRegistration('/') || await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready.then(() => reg);
}

/** 'unsupported' | 'install' (iPhone sin instalar) | 'denied' | 'on' | 'off' */
export async function pushState(){
  if (pushNeedsInstall()) return 'install';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = reg && await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Pide permiso (tiene que llamarse desde un toque del usuario) y suscribe este dispositivo. */
export async function enablePush(){
  if (!pushSupported()) throw new Error('Este navegador no permite notificaciones.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { changed(); throw new Error(perm === 'denied' ? 'Las notificaciones quedaron bloqueadas. Activalas desde la configuración del navegador (el candado junto a la dirección).' : 'No se activaron las notificaciones.'); }
  const reg = await registration();
  const { key } = await api('/push/key');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
  changed();
}

export async function disablePush(){
  const reg = pushSupported() && await navigator.serviceWorker.getRegistration('/');
  const sub = reg && await reg.pushManager.getSubscription();
  if (sub) { await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
  changed();
}

/** Al entrar: si este dispositivo ya está suscrito, lo vuelve a asociar al usuario actual (por si cambió de cuenta). */
export async function syncPush(){
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = reg && await reg.pushManager.getSubscription();
  if (sub) await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } }).catch(() => {});
}

export const pushSnoozed = () => { try { return Date.now() < Number(localStorage.getItem(LATER) || 0); } catch { return false; } };
export const snoozePush = days => { try { localStorage.setItem(LATER, String(Date.now() + days * 86400000)); } catch { /* */ } };

/** Estado de las notificaciones en este dispositivo (se actualiza al activar o desactivar). */
export function usePushState(){
  const [state, setState] = useState(null);
  useEffect(() => {
    const load = () => pushState().then(setState).catch(() => setState('unsupported'));
    load(); subs.add(load);
    return () => subs.delete(load);
  }, []);
  return state;
}
