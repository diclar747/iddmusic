// Instalación como app (PWA) y pantalla de inicio.
import { useEffect, useState } from 'react';

let deferred = null;
const subs = new Set();
const notify = () => subs.forEach(f => f());
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; notify(); });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
}

export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** { canInstall, ios, installed, install() } — en iPhone/iPad la instalación es manual (Compartir → Agregar a inicio). */
export function useInstall(){
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(n => n + 1); subs.add(f); return () => subs.delete(f); }, []);
  const installed = isStandalone();
  return {
    installed,
    canInstall: !installed && !!deferred,
    ios: !installed && isIOS(),
    async install(){ if (!deferred) return false; deferred.prompt(); const r = await deferred.userChoice.catch(() => null); deferred = null; notify(); return r?.outcome === 'accepted'; }
  };
}

/** Oculta la pantalla de inicio cuando la app ya está lista (mínimo ~0,9 s para que se vea la animación). */
export function hideSplash(){
  const el = document.getElementById('splash');
  if (!el) return;
  // La ventana del proyector y la pantalla del TV no muestran la pantalla de inicio.
  if (/^#/screen/.test(location.hash) || (/^#/musicos/.test(location.hash) && /cast=1|tv=1/.test(location.href))) { el.remove(); return; }
  const wait = Math.max(0, 900 - performance.now());
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 600); }, wait);
}
