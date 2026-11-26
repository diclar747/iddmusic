import React from 'react';
import { CalendarDays, Users, Sparkles, Plus, Music2, MapPin, Clock, ChevronRight } from 'lucide-react';
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
  const first = groups.data?.items?.[0];
  return <>
    <header className="page-head">
      <div><span className="eyebrow">Cancionero digital</span><h1>¡Hola, {user.fullName.split(' ')[0]}!</h1><p className="muted">Organizá tus grupos, ensayos y repertorios en un solo lugar.</p></div>
    </header>
    <div className="quick">
      <a href={first ? `#/songs/new?group=${first.id}` : '#/groups'}><Plus /><b>Nueva canción</b><small>Escribir letra y acordes</small></a>
      <a href={first ? `#/import?group=${first.id}` : '#/import'}><Sparkles /><b>Importar con IA</b><small>Desde PDF o foto</small></a>
      <a href="#/agenda"><CalendarDays /><b>Agenda</b><small>Cultos y ensayos</small></a>
      <a href="#/groups"><Users /><b>Mis grupos</b><small>Integrantes y música</small></a>
    </div>
    <div className="grid-2">
      <section className="panel">
        <div className="panel-head"><h2>Próximos eventos</h2><a href="#/agenda" className="link">Ver agenda</a></div>
        {events.loading ? <Spinner /> : <ErrorBox error={events.error} />}
        {events.data && (events.data.items.length ? <div className="stack">{events.data.items.slice(0, 6).map(e => <EventCard key={e.id} e={e} />)}</div>
          : <Empty icon={CalendarDays} title="No hay eventos programados"><a href="#/agenda">Programar uno</a></Empty>)}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Actualizadas recientemente</h2><a href="#/songs" className="link">Cancionero</a></div>
        {songs.loading ? <Spinner /> : <ErrorBox error={songs.error} />}
        {songs.data && (songs.data.items.length ? <div>{songs.data.items.slice(0, 7).map(s => <SongRow key={s.id} s={s} />)}</div>
          : <Empty icon={Music2} title="Todavía no hay canciones">Creá un grupo y cargá la primera.</Empty>)}
      </section>
    </div>
  </>;
}
