import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react';
import { navigate } from '../router.js';
import { useApi, Spinner, ErrorBox, Empty, isoDate, parseDate, MONTH_NAMES, fmtTime, EVENT_TYPES } from '../ui.jsx';
import EventForm from '../components/EventForm.jsx';
import { EventCard } from './Home.jsx';

const WD = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function Agenda(){
  const now = new Date();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [creating, setCreating] = useState(null);
  const groups = useApi('/groups');
  const start = new Date(month); start.setDate(1 - ((month.getDay() + 6) % 7));
  const end = new Date(start); end.setDate(start.getDate() + 41);
  const { data, loading, error } = useApi(`/events?from=${isoDate(start)}&to=${isoDate(end)}`);
  const upcoming = useApi(`/events?from=${isoDate(now)}`);
  const byDay = useMemo(() => {
    const m = {};
    (data?.items || []).forEach(e => { (m[e.event_date] ||= []).push(e); });
    return m;
  }, [data]);
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const today = isoDate(now);
  const shift = n => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const canCreate = groups.data?.items.length > 0;
  return <>
    <header className="page-head">
      <div><span className="eyebrow">Calendario</span><h1>Agenda</h1><p className="muted">Cultos, ensayos y eventos de todos tus grupos. Tocá un día para programar.</p></div>
      <button className="btn primary" disabled={!canCreate} onClick={() => setCreating(today)}><Plus size={17} /> Programar evento</button>
    </header>
    <div className="agenda-layout">
      <section className="panel cal">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mes anterior"><ChevronLeft size={18} /></button>
          <h2>{MONTH_NAMES[month.getMonth()]} {month.getFullYear()}</h2>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Mes siguiente"><ChevronRight size={18} /></button>
          <button className="btn sm" onClick={() => setMonth(new Date(now.getFullYear(), now.getMonth(), 1))}>Hoy</button>
          {loading && <Spinner label="" />}
        </div>
        <ErrorBox error={error} />
        <div className="cal-grid">
          {WD.map(w => <div key={w} className="cal-wd">{w}</div>)}
          {days.map(d => { const k = isoDate(d); const evs = byDay[k] || []; return <div key={k}
            className={`cal-day ${d.getMonth() !== month.getMonth() ? 'out' : ''} ${k === today ? 'today' : ''} ${d.getDay() === 0 || d.getDay() === 6 ? 'we' : ''}`}
            onClick={() => canCreate && setCreating(k)}>
            <span className="dn">{d.getDate()}</span>
            {evs.map(e => <a key={e.id} href={`#/events/${e.id}`} className={`cal-ev t-${e.event_type}`} style={{ '--c': e.group_color || '#1f6feb' }} onClick={ev => ev.stopPropagation()} title={`${e.title} · ${e.group_name}`}>
              {e.event_time && <b>{fmtTime(e.event_time)}</b>} {e.title}</a>)}
          </div>; })}
        </div>
        <div className="legend">{Object.entries(EVENT_TYPES).map(([k, v]) => <span key={k} className={`lg t-${k}`}>{v}</span>)}</div>
      </section>
      <section className="panel">
        <h2>Próximos</h2>
        {upcoming.data && (upcoming.data.items.length ? <div className="stack">{upcoming.data.items.slice(0, 12).map(e => <EventCard key={e.id} e={e} />)}</div> : <Empty icon={CalendarDays} title="Nada programado" />)}
      </section>
    </div>
    {creating && <EventForm groups={groups.data?.items} date={creating} onClose={() => setCreating(null)} onSaved={ev => navigate(`/events/${ev.id}`)} />}
  </>;
}
