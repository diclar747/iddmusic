import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Music2, Users, CalendarDays, Home as HomeIcon, Sparkles, LogOut, Library, UserCircle, MonitorPlay, Guitar } from 'lucide-react';
import './style.css';
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

const NAV = [
  ['/', 'Inicio', HomeIcon],
  ['/groups', 'Mis grupos', Users],
  ['/songs', 'Cancionero', Library],
  ['/agenda', 'Agenda', CalendarDays],
  ['/import', 'Importar canciones', Sparkles],
  ['/present/free', 'Proyectar', MonitorPlay],
  ['/musicos', 'Músicos (acordes)', Guitar]
];

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
  if (a === 'songs' && !b) return <Songs />;
  if (a === 'songs' && b === 'new') return <SongEdit groupId={route.query.group} />;
  if (a === 'songs' && c === 'edit') return <SongEdit id={b} />;
  if (a === 'songs') return <SongView id={b} query={route.query} />;
  if (a === 'import') return <ImportAI groupId={route.query.group} />;
  if (a === 'agenda') return <Agenda />;
  if (a === 'events') return <EventView id={b} user={user} />;
  if (a === 'profile') return <Profile user={user} />;
  return <div className="panel"><h2>Página no encontrada</h2><a href="#/">Volver al inicio</a></div>;
}

function App(){
  const user = useSession();
  const route = useRoute();
  useEffect(() => { window.scrollTo(0, 0); }, [route.path]);
  if (route.parts[0] === 'screen') return <ScreenWindow />;
  if (route.parts[0] === 'musicos' && isCastReceiver()) return <Musicians tv />;
  if (!user) return <Login />;
  if (route.parts[0] === 'present') return <Presenter kind={route.parts[1]} id={route.parts[2]} query={route.query} />;
  if (route.parts[0] === 'musicos') return <Musicians groupId={route.parts[1]} tv={route.query.tv === '1'} />;
  const active = p => p === '/' ? route.path === '/' : route.path.startsWith(p);
  return <div className="layout">
    <aside className="sidebar">
      <a className="brand" href="#/"><span className="logo"><Music2 size={22} /></span><span><b>IDD MUSIC</b><small>Iglesia de Dios · Bella Vista</small></span></a>
      <nav>{NAV.map(([p, label, Icon]) => <a key={p} href={href(p)} className={active(p) ? 'active' : ''}><Icon size={18} /><span>{label}</span></a>)}</nav>
      <div className="side-foot">
        <a href="#/profile" className={`me ${active('/profile') ? 'active' : ''}`}><UserCircle size={18} /><span>{user.fullName}</span></a>
        <button className="logout" onClick={() => session.clear()}><LogOut size={18} /><span>Salir</span></button>
      </div>
    </aside>
    <main className="main"><Page route={route} user={user} /></main>
  </div>;
}

createRoot(document.getElementById('root')).render(<ToastProvider><App /></ToastProvider>);
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
