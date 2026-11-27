import React, { useState } from 'react';
import { Music2, CalendarDays, Users, Activity, Plus, Sparkles, Search, Crown, Trash2, Pencil, UserPlus, Image as ImageIcon, LogOut, Copy, MessageCircle, Phone, KeyRound } from 'lucide-react';
import { waLink, fmtPhone } from '../lib/whatsapp.js';
import { initials } from './Profile.jsx';
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
  async function setPassword(m){
    const v = prompt(`Nueva contraseña para ${m.full_name} (mínimo 6 caracteres, fácil de recordar):`, '');
    if (v === null) return;
    if (v.trim().length < 6) { toast('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
    try { await api(`/groups/${group.id}/members/${m.id}`, { method: 'PATCH', body: { password: v.trim() } }); setCreated({ full_name: m.full_name, email: m.email, phone: m.phone, temp_password: v.trim() }); } catch (e) { toast(e.message, 'error'); }
  }
  async function editPhone(m){
    const v = prompt(`WhatsApp de ${m.full_name} (ej.: 0981 123 456). Dejalo vacío para quitarlo.`, m.phone ? fmtPhone(m.phone) : '');
    if (v === null) return;
    try { await api(`/groups/${group.id}/members/${m.id}`, { method: 'PATCH', body: { phone: v } }); toast('WhatsApp actualizado'); reload(); } catch (e) { toast(e.message, 'error'); }
  }
  const accessText = c => `¡Hola ${c.full_name?.split(' ')[0] || ''}! Te sumé al grupo "${group.name}" en SION Music 🎵\n\nIngresá en: ${location.origin}\nCorreo: ${c.email}${c.temp_password ? `\nContraseña: ${c.temp_password}\n\nDespués podés cambiarla en "Mi perfil".` : '\n(Usá tu contraseña de siempre.)'}\n\nTip: abrilo en el teléfono y tocá "Instalar la app".`;
  return <section className="panel">
    <div className="panel-head"><h2>Integrantes</h2>{leader && <button className="btn primary sm" onClick={() => setAdding(true)}><UserPlus size={15} /> Agregar integrante</button>}</div>
    <p className="muted small">Todos los integrantes pueden cargar, editar e importar canciones y armar los repertorios. Los líderes además administran integrantes y el grupo.</p>
    <div className="members">{group.members.map(m => <div key={m.id} className="member">
      <span className="avatar">{initials(m.full_name)}</span>
      <span className="grow"><b>{m.full_name}{m.id === user.id && ' (vos)'}</b><small>{m.phone ? <>{fmtPhone(m.phone)} · </> : null}{m.email}</small></span>
      {m.phone && m.id !== user.id && <a className="wa-btn" href={waLink(m.phone, `Hola ${m.full_name.split(' ')[0]}! 🎵`)} target="_blank" rel="noreferrer" title="Escribir por WhatsApp"><MessageCircle size={16} /><span>WhatsApp</span></a>}
      {leader && <button className="icon-btn" title={m.phone ? 'Cambiar WhatsApp' : 'Agregar WhatsApp'} onClick={() => editPhone(m)}><Phone size={15} /></button>}
      {leader && m.id !== user.id && <button className="icon-btn" title="Poner una contraseña nueva" onClick={() => setPassword(m)}><KeyRound size={15} /></button>}
      {m.group_role === 'leader' ? <span className="pill gold"><Crown size={12} /> Líder</span> : <span className="pill soft">Integrante</span>}
      {leader && m.id !== user.id && <select className="mini" value={m.group_role} onChange={e => setRole(m, e.target.value)}><option value="member">Integrante</option><option value="leader">Líder</option></select>}
      {(leader || m.id === user.id) && <button className="icon-btn danger" title={m.id === user.id ? 'Salir del grupo' : 'Quitar'} onClick={() => remove(m)}>{m.id === user.id ? <LogOut size={16} /> : <Trash2 size={16} />}</button>}
    </div>)}</div>
    {adding && <AddMember group={group} onClose={() => setAdding(false)} onAdded={r => { setAdding(false); reload(); if (r.temp_password || r.phone) setCreated(r); else toast('Integrante agregado'); }} />}
    {created && <Modal title={created.temp_password ? 'Cuenta creada' : 'Integrante agregado'} onClose={() => setCreated(null)}>
      {created.temp_password
        ? <p>Se creó la cuenta de <b>{created.full_name}</b>. Enviale el acceso por WhatsApp (o copialo):</p>
        : <p><b>{created.full_name}</b> ya tenía cuenta y ahora es parte del grupo. Avisale por WhatsApp:</p>}
      <div className="cred"><div><small>Correo (para ingresar)</small><b>{created.email}</b></div>
        {created.temp_password && <div><small>Contraseña</small><b>{created.temp_password}</b></div>}
        {created.phone && <div><small>WhatsApp</small><b>{fmtPhone(created.phone)}</b></div>}</div>
      <div className="actions">
        <button className="btn" onClick={() => { navigator.clipboard?.writeText(accessText(created)); toast('Copiado'); }}><Copy size={15} /> Copiar</button>
        {created.phone && <a className="btn wa" href={waLink(created.phone, accessText(created))} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Enviar por WhatsApp</a>}
      </div>
      {created.temp_password && <p className="muted small">Esta contraseña no se vuelve a mostrar. La persona puede cambiarla en “Mi perfil”.</p>}
    </Modal>}
  </section>;
}

function AddMember({ group, onClose, onAdded }){
  const toast = useToast();
  const [f, setF] = useState({ full_name: '', phone: '', email: '', password: '', group_role: 'member' });
  const [busy, setBusy] = useState(false);
  async function save(e){
    e.preventDefault(); setBusy(true);
    try { onAdded(await api(`/groups/${group.id}/members`, { method: 'POST', body: f })); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  return <Modal title="Agregar integrante" onClose={onClose}>
    <form className="form" onSubmit={save}>
      <Field label="Nombre completo" hint="Si la persona todavía no tiene cuenta, se crea con una contraseña temporal."><input value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} placeholder="Ej.: Ana Benítez" /></Field>
      <Field label="WhatsApp" hint="Para avisarle y enviarle el acceso por WhatsApp."><input type="tel" inputMode="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="0981 123 456" /></Field>
      <Field label="Correo electrónico" hint="Es el usuario para iniciar sesión."><input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required placeholder="nombre@gmail.com" /></Field>
      <Field label="Contraseña" hint="Opcional. Poné una fácil de recordar (mín. 6). Si la dejás vacía se genera una, por ejemplo Gloria2468. Después la persona la cambia en su perfil."><input value={f.password} onChange={e => setF({ ...f, password: e.target.value })} minLength={6} placeholder="Ej.: Alaba2024" autoComplete="new-password" /></Field>
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
