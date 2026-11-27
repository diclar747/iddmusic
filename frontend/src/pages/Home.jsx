import React, { useState } from 'react';
import { CalendarDays, Users, Sparkles, Plus, Music2, MapPin, Clock, ChevronRight, Search, Library, MonitorPlay, Guitar } from 'lucide-react';
import { navigate } from '../router.js';
import { themeById } from '../lib/themes.js';
import { useApi, Spinner, ErrorBox, Empty, fmtShort, fmtTime, relDay, EVENT_TYPES, isoDate } from '../ui.jsx';

export function EventCard({ e }){
  const d = fmtShort(e.event_date);
  return <a className="event-card" href={`#/events/${e.id}`}>
    <span className="datebox" style={{ '--c': e.group_color || '#1f6feb' }}><small>{d.weekday}</small><b>{d.day}</b><small>{d.month}</small></span>
    <span className="ev-main">
      <span className="ev-top"><span className={`pill t-${e.event_type}`}>{EVENT_TYPES[e.event_type] || e.event_type}</span>{relDay(e.event_date) && <span className="pill soft">{relDay(e.event_date)}</span>}</span>
      <b>{e.title}</b>
      <small>{e.group_name}{e.event_time && <> · <Clock size={12} /> {fmtTime(e.event_time)}{e.end_time && `–${fmtTime(e.end_time)}`}</>}{e.location && <> · <MapPin size={12} /> {e.location}</>}</small>
    </span>
    <span className="ev-count"><Music2 size={14} /> {e.song_count}</span>
    <ChevronRight size={18} className="muted" />
  </a>;
}

export function SongRow({ s, extra }){
  return <a className="song-row" href={`#/songs/${s.id}`}>
    <span className="song-icon"><Music2 size={18} /></span>
    <span className="grow"><b>{s.title}</b><small>{s.author || 'Autor no indicado'}{s.group_name && ` · ${s.group_name}`}</small></span>
    {s.status === 'review' && <span className="pill warn">Revisar</span>}
    {s.original_key && <span className="key">{s.original_key}</span>}
    {extra}
  </a>;
}

export default function Home({ user }){
  const today = isoDate(new Date());
  const events = useApi(`/events?from=${today}`);
  const groups = useApi('/groups');
  const songs = useApi('/songs?sort=recent');
  const [q, setQ] = useState('');
  const first = groups.data?.items?.[0];
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const next = events.data?.items?.[0];
  return <>
    <section className="hero" style={{ backgroundImage: themeById('c-0').bg }}>
      <div className="hero-shade" />
      <div className="hero-body">
        <span className="eyebrow">{hello}</span>
        <h1>¡Bienvenido, {user.fullName.split(' ')[0]}!</h1>
        <p>Que la música nos una en la presencia de Dios.</p>
        <form className="hero-search" onSubmit={e => { e.preventDefault(); navigate('/songs' + (q.trim() ? '?q=' + encodeURIComponent(q.trim()) : '')); }}>
          <Search size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar canciones, autores o una frase…" />
        </form>
        {next && <a className="hero-next" href={`#/events/${next.id}`}><CalendarDays size={16} /> Próximo: <b>{next.title}</b> · {relDay(next.event_date) || `${fmtShort(next.event_date).weekday} ${fmtShort(next.event_date).day}`}{next.event_time && ` · ${fmtTime(next.event_time)}`}</a>}
      </div>
    </section>
    <div className="tiles">
      <a href="#/songs"><span><Library /></span><b>Cancionero</b><small>Letras y acordes</small></a>
      <a href="#/present/free"><span><MonitorPlay /></span><b>Proyectar</b><small>Letra, Biblia, avisos</small></a>
      <a href="#/musicos"><span><Guitar /></span><b>Músicos</b><small>Acordes en vivo</small></a>
      <a href="#/agenda"><span><CalendarDays /></span><b>Agenda</b><small>Cultos y ensayos</small></a>
      <a href="#/groups"><span><Users /></span><b>Mis grupos</b><small>Integrantes y música</small></a>
      <a href={first ? `#/import?group=${first.id}` : '#/import'}><span><Sparkles /></span><b>Importar</b><small>Buscar, PDF o foto</small></a>
    </div>
    <div className="grid-2">
      <section className="panel">
        <div className="panel-head"><h2>Próximos eventos</h2><a href="#/agenda" className="link">Ver agenda</a></div>
        {events.loading ? <Spinner /> : <ErrorBox error={events.error} />}
        {events.data && (events.data.items.length ? <div className="stack">{events.data.items.slice(0, 6).map(e => <EventCard key={e.id} e={e} />)}</div>
          : <Empty icon={CalendarDays} title="No hay eventos programados"><a href="#/agenda">Programar uno</a></Empty>)}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Canciones recientes</h2><a href="#/songs" className="link">Ver todas</a></div>
        {songs.loading ? <Spinner /> : <ErrorBox error={songs.error} />}
        {songs.data && (songs.data.items.length ? <div>{songs.data.items.slice(0, 7).map(s => <SongRow key={s.id} s={s} />)}</div>
          : <Empty icon={Music2} title="Todavía no hay canciones">{first ? <a href={`#/songs/new?group=${first.id}`}><Plus size={14} /> Cargar la primera</a> : <a href="#/groups">Creá un grupo para empezar</a>}</Empty>)}
      </section>
    </div>
  </>;
}
