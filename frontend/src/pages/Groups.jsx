import React, { useState } from 'react';
import { Users, Plus, Music2, CalendarDays, Crown } from 'lucide-react';
import { api } from '../api.js';
import { navigate } from '../router.js';
import { useApi, Spinner, ErrorBox, Empty, Modal, Field, Busy, useToast, fmtDate } from '../ui.jsx';

const COLORS = ['#1f6feb', '#c2410c', '#15803d', '#7c3aed', '#be185d', '#0e7490', '#b45309'];

export function GroupForm({ group, onClose, onSaved }){
  const toast = useToast();
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [color, setColor] = useState(group?.color || COLORS[0]);
  const [busy, setBusy] = useState(false);
  async function save(e){
    e.preventDefault(); setBusy(true);
    try {
      const g = await api(group ? `/groups/${group.id}` : '/groups', { method: group ? 'PATCH' : 'POST', body: { name, description, color } });
      toast(group ? 'Grupo actualizado' : 'Grupo creado'); onSaved(g);
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  return <Modal title={group ? 'Editar grupo' : 'Nuevo grupo'} onClose={onClose}>
    <form className="form" onSubmit={save}>
      <Field label="Nombre del grupo"><input value={name} onChange={e => setName(e.target.value)} placeholder="Alabanza del fin de semana" required /></Field>
      <Field label="Descripción"><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Para qué es el grupo, días de ensayo…" /></Field>
      <Field label="Color"><div className="swatches">{COLORS.map(c => <button type="button" key={c} className={c === color ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />)}</div></Field>
      <div className="actions"><button type="button" className="btn" onClick={onClose}>Cancelar</button><Busy busy={busy} type="submit">{group ? 'Guardar' : 'Crear grupo'}</Busy></div>
    </form>
  </Modal>;
}

export default function Groups(){
  const { data, loading, error } = useApi('/groups');
  const [creating, setCreating] = useState(false);
  return <>
    <header className="page-head">
      <div><span className="eyebrow">Equipos musicales</span><h1>Mis grupos</h1><p className="muted">Cada grupo tiene sus canciones, agenda e integrantes. Todos los integrantes pueden cargar y editar.</p></div>
      <button className="btn primary" onClick={() => setCreating(true)}><Plus size={17} /> Nuevo grupo</button>
    </header>
    {loading && <Spinner />}<ErrorBox error={error} />
    {data && (data.items.length ? <div className="cards">{data.items.map(g =>
      <a key={g.id} className="group-card" href={`#/groups/${g.id}`} style={{ '--c': g.color || '#1f6feb' }}>
        <span className="gc-band" />
        <b>{g.name}{g.my_role === 'leader' && <Crown size={14} className="gold" title="Sos líder" />}</b>
        <p className="muted clamp">{g.description || 'Sin descripción'}</p>
        <span className="gc-stats"><span><Users size={14} /> {g.member_count}</span><span><Music2 size={14} /> {g.song_count}</span>
          <span><CalendarDays size={14} /> {g.next_event_date ? fmtDate(g.next_event_date) : 'Sin eventos'}</span></span>
      </a>)}</div>
      : <Empty icon={Users} title="Todavía no tenés grupos"><button className="btn primary" onClick={() => setCreating(true)}>Crear el primero</button></Empty>)}
    {creating && <GroupForm onClose={() => setCreating(false)} onSaved={g => navigate(`/groups/${g.id}`)} />}
  </>;
}
