import React, { useState } from 'react';
import { api } from '../api.js';
import { Modal, Field, Busy, useToast, EVENT_TYPES } from '../ui.jsx';

/** Crear o editar un evento (culto, ensayo…). `groups` permite elegir grupo al crear. */
export default function EventForm({ event, groups, groupId, date, onClose, onSaved }){
  const toast = useToast();
  const [f, setF] = useState({
    group_id: event?.group_id || groupId || groups?.[0]?.id || '',
    title: event?.title || '', event_type: event?.event_type || 'culto', event_date: event?.event_date || date || '',
    event_time: event?.event_time?.slice(0, 5) || '', end_time: event?.end_time?.slice(0, 5) || '', location: event?.location || '', notes: event?.notes || ''
  });
  const [busy, setBusy] = useState(false);
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }));
  async function save(e){
    e.preventDefault(); setBusy(true);
    try {
      const body = { ...f, event_time: f.event_time || null, end_time: f.end_time || null };
      const saved = event ? await api(`/events/${event.id}`, { method: 'PATCH', body }) : await api('/events', { method: 'POST', body });
      toast(event ? 'Evento actualizado' : 'Evento programado');
      onSaved?.(saved);
    } catch (err) { toast(err.message, 'error'); }
    finally { setBusy(false); }
  }
  return <Modal title={event ? 'Editar evento' : 'Programar evento'} onClose={onClose}>
    <form className="form" onSubmit={save}>
      {!event && groups && <Field label="Grupo"><select value={f.group_id} onChange={set('group_id')} required>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>}
      <div className="row-2">
        <Field label="Título"><input value={f.title} onChange={set('title')} placeholder="Culto dominical" required /></Field>
        <Field label="Tipo"><select value={f.event_type} onChange={set('event_type')}>{Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      <div className="row-3">
        <Field label="Fecha"><input type="date" value={f.event_date} onChange={set('event_date')} required /></Field>
        <Field label="Desde"><input type="time" value={f.event_time} onChange={set('event_time')} /></Field>
        <Field label="Hasta"><input type="time" value={f.end_time} onChange={set('end_time')} /></Field>
      </div>
      <Field label="Lugar"><input value={f.location} onChange={set('location')} placeholder="Templo · Bella Vista" /></Field>
      <Field label="Notas para el grupo"><textarea rows={3} value={f.notes} onChange={set('notes')} placeholder="Horario de llegada, vestimenta, prueba de sonido…" /></Field>
      <div className="actions"><button type="button" className="btn" onClick={onClose}>Cancelar</button><Busy busy={busy} type="submit">{event ? 'Guardar cambios' : 'Programar'}</Busy></div>
    </form>
  </Modal>;
}
