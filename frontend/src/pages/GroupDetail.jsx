import React, { useState } from 'react';
import { Music2, CalendarDays, Users, Activity, Plus, Sparkles, Search, Crown, Trash2, Pencil, UserPlus, Image as ImageIcon, LogOut, Copy } from 'lucide-react';
import { api } from '../api.js';
import { navigate } from '../router.js';
import { useApi, Spinner, ErrorBox, Empty, Tabs, Modal, Field, Busy, useToast, fmtAgo, isoDate } from '../ui.jsx';
import { SongRow, EventCard } from './Home.jsx';
import { GroupForm } from './Groups.jsx';
import EventForm from '../components/EventForm.jsx';
import Backgrounds from '../components/Backgrounds.jsx';

const ACTIONS = {
  'group.create': 'creó el grupo', 'group.update': 'editó el grupo', 'member.add': 'agregó a un integrante', 'member.remove': 'quitó a un integrante', 'member.leave': 'salió del grupo',
  'song.create': 'cargó la canción', 'song.import': 'importó con IA', 'song.update': 'editó', 'song.delete': 'eliminó', 'song.restore': 'restauró una versión de',
  'file.upload': 'adjuntó archivos a', 'event.create': 'programó', 'event.update': 'editó el evento', 'event.delete': 'eliminó el evento', 'event.add_song': 'agregó una canción a'
};

export default function GroupDetail({ id, tab, user }){
  const toast = useToast();
  const g = useApi(`/groups/${id}`);
  const [editing, setEditing] = useState(false);
  if (g.loading && !g.data) return <Spinner />;
  if (g.error) return <ErrorBox error={g.error} />;
  const group = g.data;
  const leader = group.my_role === 'leader';
  const setTab = t => navigate(`/groups/${id}/${t}`, { replace: true });
  async function remove(){
    if (!confirm(`¿Eliminar el grupo "${group.name}" con todas sus canciones, eventos y archivos? No se puede deshacer.`)) return;
    try { await api(`/groups/${id}`, { method: 'DELETE' }); toast('Grupo eliminado'); navigate('/groups'); } catch (e) { toast(e.message, 'error'); }
  }
  return <>
    <header className="page-head group-head" style={{ '--c': group.color || '#1f6feb' }}>
      <div><a className="crumb" href="#/groups">← Mis grupos</a><h1><span className="dot" />{group.name}</h1><p className="muted">{group.description}</p></div>
      <div className="head-actions">
        <a className="btn" href={`#/import?group=${id}`}><Sparkles size={16} /> Importar con IA</a>
        <a className="btn primary" href={`#/songs/new?group=${id}`}><Plus size={16} /> Nueva canción</a>
        {leader && <button className="icon-btn" title="Editar grupo" onClick={() => setEditing(true)}><Pencil size={17} /></button>}
        {leader && <button className="icon-btn danger" title="Eliminar grupo" onClick={remove}><Trash2 size={17} /></button>}
      </div>
    </header>
    <Tabs value={tab} onChange={setTab} tabs={[['songs', 'Canciones', Music2], ['agenda', 'Agenda', CalendarDays], ['members', 'Integrantes', Users, group.members.length], ['backgrounds', 'Fondos de proyección', ImageIcon], ['activity', 'Actividad', Activity]]} />
    {tab === 'songs' && <GroupSongs id={id} />}
    {tab === 'agenda' && <GroupAgenda id={id} />}
    {tab === 'members' && <Members group={group} leader={leader} user={user} reload={g.reload} />}
    {tab === 'backgrounds' && <section className="panel"><Backgrounds groupId={id} /></section>}
    {tab === 'activity' && <GroupActivity id={id} />}
    {editing && <GroupForm group={group} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); g.reload(); }} />}
  </>;
}

function GroupSongs({ id }){
  const [q, setQ] = useState('');
  const { data, loading, error } = useApi(`/songs?group_id=${id}&q=${encodeURIComponent(q)}`);
  return <section className="panel">
    <div className="searchbar"><Search size={18} /><input placeholder="Buscar por título, autor o letra…" value={q} onChange={e => setQ(e.target.value)} /></div>
    {loading && !data && <Spinner />}<ErrorBox error={error} />
    {data && (data.items.length ? data.items.map(s => <SongRow key={s.id} s={{ ...s, group_name: null }} />)
      : <Empty icon={Music2} title={q ? 'Sin resultados' : 'El grupo todavía no tiene canciones'}>{!q && <span>Cargá una a mano o <a href={`#/import?group=${id}`}>importala desde un PDF o foto con IA</a>.</span>}</Empty>)}
  </section>;
}

function GroupAgenda({ id }){
  const { data, loading, error, reload } = useApi(`/events?group_id=${id}`);
  const [creating, setCreating] = useState(false);
  const today = isoDate(new Date());
  const upcoming = data?.items.filter(e => e.event_date >= today) || [];
  const past = data?.items.filter(e => e.event_date < today).reverse() || [];
  return <section className="panel">
    <div className="panel-head"><h2>Próximos</h2><button className="btn primary sm" onClick={() => setCreating(true)}><Plus size={15} /> Programar</button></div>
    {loading && <Spinner />}<ErrorBox error={error} />
    {data && (upcoming.length ? <div className="stack">{upcoming.map(e => <EventCard key={e.id} e={e} />)}</div> : <Empty icon={CalendarDays} title="Sin eventos próximos" />)}
    {past.length > 0 && <><h3 className="mt">Anteriores</h3><div className="stack faded">{past.slice(0, 10).map(e => <EventCard key={e.id} e={e} />)}</div></>}
    {creating && <EventForm groupId={id} onClose={() => setCreating(false)} onSaved={ev => navigate(`/events/${ev.id}`)} />}
  </section>;
}

function Members({ group, leader, user, reload }){
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState(null);
  async function setRole(m, role){ try { await api(`/groups/${group.id}/members/${m.id}`, { method: 'PATCH', body: { group_role: role } }); reload(); } catch (e) { toast(e.message, 'error'); } }
  async function remove(m){
    const self = m.id === user.id;
    if (!confirm(self ? '¿Salir de este grupo?' : `¿Quitar a ${m.full_name} del grupo?`)) return;
    try { await api(`/groups/${group.id}/members/${m.id}`, { method: 'DELETE' }); if (self) navigate('/groups'); else reload(); } catch (e) { toast(e.message, 'error'); }
  }
  return <section className="panel">
    <div className="panel-head"><h2>Integrantes</h2>{leader && <button className="btn primary sm" onClick={() => setAdding(true)}><UserPlus size={15} /> Agregar integrante</button>}</div>
    <p className="muted small">Todos los integrantes pueden cargar, editar e importar canciones y armar los repertorios. Los líderes además administran integrantes y el grupo.</p>
    <div className="members">{group.members.map(m => <div key={m.id} className="member">
      <span className="avatar">{m.full_name.split(' ').map(x => x[0]).slice(0, 2).join('')}</span>
      <span className="grow"><b>{m.full_name}{m.id === user.id && ' (vos)'}</b><small>{m.email}</small></span>
      {m.group_role === 'leader' ? <span className="pill gold"><Crown size={12} /> Líder</span> : <span className="pill soft">Integrante</span>}
      {leader && m.id !== user.id && <select className="mini" value={m.group_role} onChange={e => setRole(m, e.target.value)}><option value="member">Integrante</option><option value="leader">Líder</option></select>}
      {(leader || m.id === user.id) && <button className="icon-btn danger" title={m.id === user.id ? 'Salir del grupo' : 'Quitar'} onClick={() => remove(m)}>{m.id === user.id ? <LogOut size={16} /> : <Trash2 size={16} />}</button>}
    </div>)}</div>
    {adding && <AddMember group={group} onClose={() => setAdding(false)} onAdded={r => { setAdding(false); reload(); if (r.temp_password) setCreated(r); else toast('Integrante agregado'); }} />}
    {created && <Modal title="Cuenta creada" onClose={() => setCreated(null)}>
      <p>Se creó una cuenta nueva. Compartí estos datos con la persona para que ingrese (puede cambiar la contraseña en su perfil):</p>
      <div className="cred"><div><small>Correo</small><b>{created.email}</b></div><div><small>Contraseña temporal</small><b>{created.temp_password}</b></div>
        <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(`IDD Music\nCorreo: ${created.email}\nContraseña: ${created.temp_password}\n${location.origin}`); toast('Copiado'); }}><Copy size={14} /> Copiar</button></div>
      <p className="muted small">Esta contraseña no se vuelve a mostrar.</p>
    </Modal>}
  </section>;
}

function AddMember({ group, onClose, onAdded }){
  const toast = useToast();
  const [f, setF] = useState({ email: '', full_name: '', group_role: 'member' });
  const [busy, setBusy] = useState(false);
  async function save(e){
    e.preventDefault(); setBusy(true);
    try { onAdded(await api(`/groups/${group.id}/members`, { method: 'POST', body: f })); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  return <Modal title="Agregar integrante" onClose={onClose}>
    <form className="form" onSubmit={save}>
      <Field label="Correo electrónico"><input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required /></Field>
      <Field label="Nombre completo" hint="Necesario solo si la persona todavía no tiene cuenta: se crea con una contraseña temporal."><input value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} /></Field>
      <Field label="Rol en el grupo"><select value={f.group_role} onChange={e => setF({ ...f, group_role: e.target.value })}><option value="member">Integrante (carga y edita música)</option><option value="leader">Líder (además administra el grupo)</option></select></Field>
      <div className="actions"><button type="button" className="btn" onClick={onClose}>Cancelar</button><Busy busy={busy} type="submit">Agregar</Busy></div>
    </form>
  </Modal>;
}

function GroupActivity({ id }){
  const { data, loading, error } = useApi(`/groups/${id}/activity`);
  return <section className="panel">
    {loading && <Spinner />}<ErrorBox error={error} />
    {data && (data.items.length ? <ul className="activity">{data.items.map(a => <li key={a.id}>
      <b>{a.actor || 'Alguien'}</b> {ACTIONS[a.action] || a.action} {a.details?.title && <i>“{a.details.title}”</i>}{a.details?.song && <> <i>“{a.details.song}”</i></>}
      <small>{fmtAgo(a.created_at)}</small></li>)}</ul> : <Empty icon={Activity} title="Sin actividad todavía" />)}
  </section>;
}
