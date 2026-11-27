import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Users, CalendarDays, Home as HomeIcon, Sparkles, LogOut, Library, UserCircle, MonitorPlay, Guitar, Menu, X, Church as ChurchIcon, KeyRound } from 'lucide-react';
import './style.css';
import './mobile.css';
import './chrome.css';
import { session } from './api.js';
import { useRoute, href } from './router.js';
import { ToastProvider } from './ui.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Groups from './pages/Groups.jsx';
import GroupDetail from './pages/GroupDetail.jsx';
import Songs from './pages/Songs.jsx';
import SongView from './pages/SongView.jsx';
import SongEdit from './pages/SongEdit.jsx';
import ImportAI from './pages/ImportAI.jsx';
import Agenda from './pages/Agenda.jsx';
import EventView from './pages/EventView.jsx';
import Profile from './pages/Profile.jsx';
import Presenter, { ScreenWindow } from './pages/Presenter.jsx';
import Musicians from './pages/Musicians.jsx';
import { isCastReceiver } from './lib/cast.js';
import { hideSplash } from './lib/pwa.js';
import { BrandMark, InstallButton } from './components/Brand.jsx';
import TopBar, { NotificationBell } from './components/TopBar.jsx';
import Church from './pages/Church.jsx';

const NAV = [
  ['/', 'Inicio', HomeIcon],
  ['/songs', 'Cancionero', Library],
  ['/groups', 'Mis grupos', Users],
  ['/agenda', 'Agenda', CalendarDays],
  ['/import', 'Importar canciones', Sparkles],
  ['/present/free', 'Proyectar', MonitorPlay],
  ['/musicos', 'Músicos (acordes)', Guitar]
];
// Menú inferior en el teléfono (el resto queda en "Más").
const TABS = [['/', 'Inicio', HomeIcon], ['/songs', 'Canciones', Library], ['/groups', 'Grupos', Users], ['/agenda', 'Agenda', CalendarDays]];

function useSession(){
  const [user, setUser] = useState(session.user);
  useEffect(() => { const on = () => setUser(session.user); window.addEventListener('idd-session', on); return () => window.removeEventListener('idd-session', on); }, []);
  return session.token ? user : null;
}

function Page({ route, user }){
  const [a, b, c] = route.parts;
  if (!a) return <Home user={user} />;
  if (a === 'groups' && !b) return <Groups />;
  if (a === 'groups') return <GroupDetail id={b} tab={c || 'songs'} user={user} />;
  if (a === 'songs' && !b) return <Songs initialQ={route.query.q || ''} />;
  if (a === 'songs' && b === 'new') return <SongEdit groupId={route.query.group} />;
  if (a === 'songs' && c === 'edit') return <SongEdit id={b} />;
  if (a === 'songs') return <SongView id={b} query={route.query} />;
  if (a === 'import') return <ImportAI groupId={route.query.group} />;
  if (a === 'agenda') return <Agenda />;
  if (a === 'events') return <EventView id={b} user={user} />;
  if (a === 'profile') return <Profile user={user} section={b} />;
  if (a === 'iglesia') return <Church />;
  return <div className="panel"><h2>Página no encontrada</h2><a href="#/">Volver al inicio</a></div>;
}

function App(){
  const user = useSession();
  const route = useRoute();
  const [more, setMore] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('idd_nav_collapsed') === '1');
  const toggleNav = () => setCollapsed(c => { localStorage.setItem('idd_nav_collapsed', c ? '0' : '1'); return !c; });
  useEffect(() => { window.scrollTo(0, 0); setMore(false); }, [route.path]);
  useEffect(() => { hideSplash(); }, []);
  if (route.parts[0] === 'screen') return <ScreenWindow />;
  if (route.parts[0] === 'musicos' && isCastReceiver()) return <Musicians tv />;
  if (!user) return <Login />;
  if (route.parts[0] === 'present') return <Presenter kind={route.parts[1]} id={route.parts[2]} query={route.query} />;
  if (route.parts[0] === 'musicos') return <Musicians groupId={route.parts[1]} tv={route.query.tv === '1'} />;
  const active = p => p === '/' ? route.path === '/' : route.path.startsWith(p);
  const title = NAV.find(([p]) => p !== '/' && active(p))?.[1] || (active('/profile') ? 'Mi perfil' : active('/iglesia') ? 'Iglesia' : active('/events') ? 'Evento' : 'IDD Music');
  return <div className={`layout ${collapsed ? "collapsed" : ""}`}>
    <aside className="sidebar">
      <a className="brand" href="#/"><BrandMark /><span><b>IDD <em>MUSIC</em></b><small>Iglesia de Dios · Bella Vista</small></span></a>
      <nav>{NAV.map(([p, label, Icon]) => <a key={p} href={href(p)} className={active(p) ? 'active' : ''} title={label}><Icon size={18} /><span>{label}</span></a>)}
        <a href="#/iglesia" className={active('/iglesia') ? 'active' : ''} title="Iglesia"><ChurchIcon size={18} /><span>Iglesia</span></a></nav>
      <div className="side-foot">
        <InstallButton />
        <a href="#/profile" className={`me ${active('/profile') ? 'active' : ''}`}><UserCircle size={18} /><span>{user.fullName}</span></a>
        <button className="logout" onClick={() => session.clear()}><LogOut size={18} /><span>Salir</span></button>
      </div>
    </aside>

    {/* Teléfono: barra superior */}
    <header className="m-top">
      <a href="#/" className="m-brand"><BrandMark size={34} /><span>{route.path === '/' ? <>IDD <em>MUSIC</em></> : title}</span></a>
      <a href="#/present/free" className="m-icon" title="Proyectar"><MonitorPlay size={20} /></a>
      <NotificationBell dark />
      <a href="#/profile" className="m-icon" title="Mi perfil"><UserCircle size={21} /></a>
    </header>

    <div className="content">
      <TopBar user={user} collapsed={collapsed} onToggle={toggleNav} />
      <main className="main"><Page route={route} user={user} /></main>
    </div>

    {/* Teléfono: menú inferior */}
    <nav className="m-tabs">
      {TABS.map(([p, label, Icon]) => <a key={p} href={href(p)} className={active(p) && !more ? 'on' : ''}><Icon size={21} /><span>{label}</span></a>)}
      <button className={more ? 'on' : ''} onClick={() => setMore(m => !m)}>{more ? <X size={21} /> : <Menu size={21} />}<span>Más</span></button>
    </nav>
    {more && <div className="m-sheet" onClick={() => setMore(false)}><div onClick={e => e.stopPropagation()}>
      <div className="m-sheet-user"><BrandMark size={44} /><span><b>{user.fullName}</b><small>{user.email}</small></span></div>
      {NAV.filter(([p]) => !TABS.some(t => t[0] === p)).map(([p, label, Icon]) => <a key={p} href={href(p)}><Icon size={20} /> {label}</a>)}
      <a href="#/iglesia"><ChurchIcon size={20} /> Datos de la iglesia</a>
      <a href="#/profile"><UserCircle size={20} /> Mi perfil</a>
      <a href="#/profile/password"><KeyRound size={20} /> Cambiar contraseña</a>
      <InstallButton className="sheet" />
      <button onClick={() => session.clear()}><LogOut size={20} /> Salir</button>
    </div></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<ToastProvider><App /></ToastProvider>);
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
