import React, { useEffect, useRef, useState } from 'react';
import { Bell, Maximize, Minimize, PanelLeftClose, PanelLeftOpen, UserCircle, KeyRound, Church, LogOut, CalendarDays, Music2, ChevronDown, CheckCheck, Sun, Moon, ShieldCheck } from 'lucide-react';
import { applyTheme, effectiveMode, setUserMode, APP_NAME } from '../lib/brand.js';
import { themeById } from '../lib/themes.js';
import { api, session } from '../api.js';
import { fmtAgo } from '../ui.jsx';
import { BrandMark, InstallButton } from './Brand.jsx';
import { initials } from '../pages/Profile.jsx';

/* ---------- Datos de la iglesia (compartidos en toda la app) ---------- */
let churchCache = null;
const churchSubs = new Set();
export function setChurch(c){ churchCache = c; applyTheme(c); churchSubs.forEach(f => f(c)); }
export const resetChurch = () => { churchCache = null; };
export function useChurch(){
  const [c, setC] = useState(churchCache);
  useEffect(() => {
    churchSubs.add(setC);
    if (!churchCache) api('/church').then(setChurch).catch(() => {});
    return () => churchSubs.delete(setC);
  }, []);
  return c;
}
export const churchLogo = c => c?.logo_src || '';
export const churchFill = c => !!c?.logo_src && c?.logo_fit === 'fill';
export const churchCover = c => c?.cover === 'photo' && c?.cover_src ? `url(${c.cover_src})` : themeById(c?.cover || 'c-0').bg;

/** Logo de la iglesia (o el de SION Music si todavía no cargó uno). */
export function ChurchAvatar({ church, size = 38 }){
  return <BrandMark size={size} src={churchLogo(church)} fill={churchFill(church)} />;
}

/** Modo claro / oscuro / automático (preferencia de cada usuario). */
export function ModeButton({ dark = false }){
  const church = useChurch();
  const [, force] = useState(0);
  const mode = effectiveMode(church);
  const next = mode === 'dark' ? 'light' : 'dark';
  return <button className={`tb-icon ${dark ? 'dark' : ''}`} title={mode === 'dark' ? 'Modo claro' : 'Modo oscuro'} onClick={() => { setUserMode(next); force(n => n + 1); }}>{mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>;
}

/** Menú desplegable que se cierra al tocar afuera. */
function useDropdown(){
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = e => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return [open, setOpen, ref];
}

/* ---------- Campanita de notificaciones ---------- */
const SEEN = 'idd_notif_seen';
const seenSet = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN) || '[]')); } catch { return new Set(); } };
export function NotificationBell({ dark = false }){
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState(seenSet);
  const [open, setOpen, ref] = useDropdown();
  useEffect(() => {
    const load = () => api('/notifications').then(d => setItems(d.items)).catch(() => {});
    load();
    const t = setInterval(load, 120000);
    window.addEventListener('focus', load);
    return () => { clearInterval(t); window.removeEventListener('focus', load); };
  }, []);
  const unread = items.filter(i => !seen.has(i.id)).length;
  function markAll(){
    const s = new Set([...seen, ...items.map(i => i.id)]);
    setSeen(s); localStorage.setItem(SEEN, JSON.stringify([...s].slice(-300)));
  }
  return <div className="dd" ref={ref}>
    <button className={`tb-icon ${dark ? 'dark' : ''}`} onClick={() => setOpen(o => !o)} title="Notificaciones" aria-label={`Notificaciones${unread ? ` (${unread} nuevas)` : ''}`}>
      <Bell size={19} />{unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className="dd-menu notif">
      <div className="dd-head"><b>Notificaciones</b>{unread > 0 && <button className="link-btn" onClick={markAll}><CheckCheck size={14} /> Marcar como leídas</button>}</div>
      {!items.length && <p className="muted small dd-empty">No hay novedades. Acá vas a ver los próximos eventos y lo que tus grupos cargan o editan.</p>}
      {items.map(i => <a key={i.id} href={i.href} className={`notif-item ${seen.has(i.id) ? '' : 'new'}`} onClick={() => { const s = new Set([...seen, i.id]); setSeen(s); localStorage.setItem(SEEN, JSON.stringify([...s].slice(-300))); setOpen(false); }}>
        <span className={`ni-icon ${i.kind}`}>{i.kind === 'event' ? <CalendarDays size={15} /> : <Music2 size={15} />}</span>
        <span className="grow"><b>{i.kind === 'event' ? `Próximo: ${i.title}` : i.title}</b><small>{i.text}{i.at && ` · ${fmtAgo(i.at)}`}</small></span>
      </a>)}
    </div>}
  </div>;
}

/* ---------- Menú del perfil ---------- */
export function ProfileMenu({ user }){
  const [open, setOpen, ref] = useDropdown();
  return <div className="dd" ref={ref}>
    <button className="tb-profile" onClick={() => setOpen(o => !o)} aria-label="Mi cuenta">
      <span className="avatar sm">{initials(user.fullName)}</span><span className="tb-name">{user.fullName}</span><ChevronDown size={15} />
    </button>
    {open && <div className="dd-menu" onClick={() => setOpen(false)}>
      <div className="dd-user"><span className="avatar">{initials(user.fullName)}</span><span><b>{user.fullName}</b><small>{user.email}</small></span></div>
      <a href="#/profile"><UserCircle size={17} /> Mi perfil</a>
      <a href="#/profile/password"><KeyRound size={17} /> Cambiar contraseña</a>
      <a href="#/iglesia"><Church size={17} /> Mi iglesia y apariencia</a>
      {user.roles?.includes('platform_admin') && <a href="#/admin"><ShieldCheck size={17} /> Panel de SION</a>}
      <InstallButton className="menu" />
      <button onClick={() => session.clear()}><LogOut size={17} /> Salir</button>
    </div>}
  </div>;
}

/** Pantalla completa del navegador. */
export function FullscreenButton({ dark = false }){
  const [fs, setFs] = useState(!!document.fullscreenElement);
  useEffect(() => { const f = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  if (!document.documentElement.requestFullscreen) return null;
  return <button className={`tb-icon ${dark ? 'dark' : ''}`} title={fs ? 'Salir de pantalla completa' : 'Pantalla completa'}
    onClick={() => fs ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {})}>{fs ? <Minimize size={18} /> : <Maximize size={18} />}</button>;
}

/** Barra superior (computadora y tablet). */
export default function TopBar({ user, collapsed, onToggle }){
  const church = useChurch();
  return <header className="topbar">
    <button className="tb-icon" onClick={onToggle} title={collapsed ? 'Mostrar el menú' : 'Achicar el menú'}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>
    <a className="tb-church" href="#/iglesia" title="Datos de la iglesia">
      <ChurchAvatar church={church} size={36} />
      <span><b>{church?.name || APP_NAME}</b><small>{church?.branch || ''}{church?.address ? `${church?.branch ? ' · ' : ''}${church.address}` : ''}</small></span>
    </a>
    <div className="tb-right">
      <ModeButton />
      <FullscreenButton />
      <NotificationBell />
      <ProfileMenu user={user} />
    </div>
  </header>;
}
