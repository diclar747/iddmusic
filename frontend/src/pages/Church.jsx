import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Phone, MessageCircle, Mail, Globe, Clock, Pencil, Save, X, Upload, Trash2, Crown, Guitar, Church as ChurchIcon, Navigation } from 'lucide-react';
import { api } from '../api.js';
import { Field, Busy, useToast, Spinner } from '../ui.jsx';
import { useChurch, setChurch, churchImage } from '../components/TopBar.jsx';
import { BrandMark } from '../components/Brand.jsx';
import { waLink, fmtPhone } from '../lib/whatsapp.js';
import { prepareImage, themeById } from '../lib/themes.js';

const EMPTY = { name: '', branch: '', slogan: '', address: '', city: '', maps_url: '', phone: '', email: '', pastor: '', pastor_phone: '', leader: '', leader_phone: '', schedule: '', website: '' };

/** Datos de la iglesia: dirección, teléfonos, pastor, encargado de alabanza, horarios y foto. */
export default function Church(){
  const toast = useToast();
  const church = useChurch();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => { api('/church').then(setChurch).catch(() => {}); }, []);
  useEffect(() => { if (church) setF({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map(k => [k, church[k] && k.endsWith('phone') ? fmtPhone(church[k]) : church[k] || ''])) }); }, [church, edit]);
  if (!church) return <Spinner />;
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const mapUrl = church.maps_url || (church.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${church.address} ${church.city}`)}` : '');

  async function save(e){
    e.preventDefault(); setBusy(true);
    try { setChurch(await api('/church', { method: 'PUT', body: f })); setEdit(false); toast('Datos de la iglesia guardados'); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  async function upload(file){
    if (!file) return;
    setBusy(true);
    try { const form = new FormData(); form.append('file', await prepareImage(file)); setChurch(await api('/church/image', { method: 'POST', form })); toast('Foto actualizada'); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  async function removeImage(){
    if (!confirm('¿Quitar la foto de la iglesia?')) return;
    try { setChurch(await api('/church/image', { method: 'DELETE' })); } catch (err) { toast(err.message, 'error'); }
  }
  const img = churchImage(church);
  const Person = ({ icon: Icon, role, name, phone }) => name || phone ? <div className="ch-card">
    <span className="ch-ico"><Icon size={20} /></span>
    <span className="grow"><small>{role}</small><b>{name || '—'}</b>{phone && <em>{fmtPhone(phone)}</em>}</span>
    {phone && <a className="wa-btn" href={waLink(phone)} target="_blank" rel="noreferrer"><MessageCircle size={16} /><span>WhatsApp</span></a>}
  </div> : null;

  return <>
    <section className="ch-hero" style={{ backgroundImage: img ? `url(${img})` : themeById('c-0').bg }}>
      <div className="hero-shade" />
      <div className="ch-hero-body">
        {img ? null : <BrandMark size={84} />}
        <div><span className="eyebrow">Nuestra iglesia</span><h1>{church.name}</h1><p>{church.branch}</p>{church.slogan && <em>{church.slogan}</em>}</div>
      </div>
      {church.can_edit && !edit && <div className="ch-hero-actions">
        <button className="btn sm" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={15} /> {img ? 'Cambiar foto' : 'Subir foto de la iglesia'}</button>
        {img && <button className="btn sm" onClick={removeImage}><Trash2 size={15} /></button>}
        <button className="btn primary sm" onClick={() => setEdit(true)}><Pencil size={15} /> Editar datos</button>
        <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e => { upload(e.target.files[0]); e.target.value = ''; }} />
      </div>}
    </section>

    {edit ? <form className="panel form" onSubmit={save}>
      <div className="panel-head"><h2>Editar datos de la iglesia</h2></div>
      <div className="row-2">
        <Field label="Nombre"><input value={f.name} onChange={set('name')} required /></Field>
        <Field label="Sede / congregación"><input value={f.branch} onChange={set('branch')} placeholder="Bella Vista" /></Field>
      </div>
      <Field label="Frase"><input value={f.slogan} onChange={set('slogan')} /></Field>
      <div className="row-2">
        <Field label="Dirección"><input value={f.address} onChange={set('address')} placeholder="Calle y número" /></Field>
        <Field label="Ciudad"><input value={f.city} onChange={set('city')} placeholder="Bella Vista, Itapúa" /></Field>
      </div>
      <Field label="Enlace de Google Maps (opcional)" hint="Si lo dejás vacío, se busca la dirección."><input value={f.maps_url} onChange={set('maps_url')} placeholder="https://maps.app.goo.gl/…" /></Field>
      <div className="row-2">
        <Field label="Teléfono / WhatsApp de la iglesia"><input type="tel" value={f.phone} onChange={set('phone')} placeholder="0981 123 456" /></Field>
        <Field label="Correo de la iglesia"><input type="email" value={f.email} onChange={set('email')} /></Field>
      </div>
      <div className="row-2">
        <Field label="Pastor"><input value={f.pastor} onChange={set('pastor')} /></Field>
        <Field label="WhatsApp del pastor"><input type="tel" value={f.pastor_phone} onChange={set('pastor_phone')} placeholder="0981 123 456" /></Field>
      </div>
      <div className="row-2">
        <Field label="Encargado de alabanza"><input value={f.leader} onChange={set('leader')} /></Field>
        <Field label="WhatsApp del encargado"><input type="tel" value={f.leader_phone} onChange={set('leader_phone')} placeholder="0981 123 456" /></Field>
      </div>
      <Field label="Horarios de culto" hint="Un horario por renglón."><textarea rows={4} value={f.schedule} onChange={set('schedule')} placeholder={'Domingo 09:00 · Culto general\nMiércoles 19:30 · Oración\nSábado 18:00 · Ensayo'} /></Field>
      <Field label="Página web o redes"><input value={f.website} onChange={set('website')} placeholder="https://facebook.com/…" /></Field>
      <div className="actions"><button type="button" className="btn" onClick={() => setEdit(false)}><X size={15} /> Cancelar</button><Busy busy={busy} type="submit"><Save size={15} /> Guardar</Busy></div>
    </form> : <div className="ch-grid">
      <section className="panel">
        <h2><ChurchIcon size={18} /> Contacto</h2>
        <div className="ch-list">
          {church.address && <div className="ch-card"><span className="ch-ico"><MapPin size={20} /></span><span className="grow"><small>Dirección</small><b>{church.address}</b>{church.city && <em>{church.city}</em>}</span>
            {mapUrl && <a className="btn sm" href={mapUrl} target="_blank" rel="noreferrer"><Navigation size={14} /> Cómo llegar</a>}</div>}
          {church.phone && <div className="ch-card"><span className="ch-ico"><Phone size={20} /></span><span className="grow"><small>Teléfono</small><b>{fmtPhone(church.phone)}</b></span>
            <a className="btn sm" href={`tel:${church.phone}`}><Phone size={14} /> Llamar</a><a className="wa-btn" href={waLink(church.phone)} target="_blank" rel="noreferrer"><MessageCircle size={16} /><span>WhatsApp</span></a></div>}
          {church.email && <div className="ch-card"><span className="ch-ico"><Mail size={20} /></span><span className="grow"><small>Correo</small><b>{church.email}</b></span><a className="btn sm" href={`mailto:${church.email}`}>Escribir</a></div>}
          {church.website && <div className="ch-card"><span className="ch-ico"><Globe size={20} /></span><span className="grow"><small>Web / redes</small><b>{church.website.replace(/^https?:\/\//, '')}</b></span><a className="btn sm" href={church.website} target="_blank" rel="noreferrer">Abrir</a></div>}
          {!church.address && !church.phone && !church.email && <p className="muted">Todavía no se cargaron los datos de contacto.{church.can_edit && ' Tocá “Editar datos”.'}</p>}
        </div>
      </section>
      <section className="panel">
        <h2><Crown size={18} /> Liderazgo</h2>
        <div className="ch-list">
          <Person icon={Crown} role="Pastor" name={church.pastor} phone={church.pastor_phone} />
          <Person icon={Guitar} role="Encargado de alabanza" name={church.leader} phone={church.leader_phone} />
          {!church.pastor && !church.leader && <p className="muted">Todavía no se cargaron el pastor ni el encargado.</p>}
        </div>
        {church.schedule && <><h2 className="mt"><Clock size={18} /> Horarios</h2>
          <ul className="ch-schedule">{church.schedule.split('\n').filter(l => l.trim()).map((l, i) => <li key={i}>{l}</li>)}</ul></>}
      </section>
    </div>}
  </>;
}
