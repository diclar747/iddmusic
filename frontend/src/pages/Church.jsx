import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Phone, MessageCircle, Mail, Globe, Clock, Pencil, Save, X, Upload, Trash2, Crown, Guitar, Church as ChurchIcon, Navigation, Palette, Sun, Moon, MonitorSmartphone, Image as ImageIcon, Check } from 'lucide-react';
import { api } from '../api.js';
import { Field, Busy, useToast, Spinner } from '../ui.jsx';
import { useChurch, setChurch, churchLogo, churchCover } from '../components/TopBar.jsx';
import { BrandMark } from '../components/Brand.jsx';
import { waLink, fmtPhone } from '../lib/whatsapp.js';
import { prepareImage, themeById } from '../lib/themes.js';
import { PALETTES, COVERS, SION_MARK } from '../lib/brand.js';

const EMPTY = { name: '', branch: '', slogan: '', address: '', city: '', maps_url: '', phone: '', email: '', pastor: '', pastor_phone: '', leader: '', leader_phone: '', schedule: '', website: '' };
const MODES = [['light', 'Claro', Sun], ['dark', 'Oscuro', Moon], ['auto', 'Automático', MonitorSmartphone]];

/** Datos y apariencia de la iglesia: logo, colores, modo, portada, contacto, pastor, encargado y horarios. */
export default function Church(){
  const toast = useToast();
  const church = useChurch();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState('');
  const logoRef = useRef(null);
  const coverRef = useRef(null);
  useEffect(() => { api('/church').then(setChurch).catch(() => {}); }, []);
  useEffect(() => { if (church) setF({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map(k => [k, church[k] && k.endsWith('phone') ? fmtPhone(church[k]) : church[k] || ''])) }); }, [church, edit]);
  if (!church) return <Spinner />;
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const mapUrl = church.maps_url || (church.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${church.address} ${church.city}`)}` : '');

  async function patch(body, msg){
    try { setChurch(await api('/church', { method: 'PUT', body })); if (msg) toast(msg); }
    catch (err) { toast(err.message, 'error'); }
  }
  async function save(e){
    e.preventDefault(); setBusy('save');
    try { setChurch(await api('/church', { method: 'PUT', body: f })); setEdit(false); toast('Datos de la iglesia guardados'); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(''); }
  }
  async function upload(kind, file){
    if (!file) return;
    setBusy(kind);
    try { const form = new FormData(); form.append('file', await prepareImage(file)); setChurch(await api(`/church/${kind}`, { method: 'POST', form })); toast(kind === 'logo' ? 'Logo actualizado' : 'Portada actualizada'); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(''); }
  }
  async function removeImage(kind){
    if (!confirm(kind === 'logo' ? '¿Quitar el logo? Se usará el de SION Music.' : '¿Quitar la foto de portada?')) return;
    try { setChurch(await api(`/church/${kind}`, { method: 'DELETE' })); } catch (err) { toast(err.message, 'error'); }
  }
  const logo = churchLogo(church);
  const Person = ({ icon: Icon, role, name, phone }) => name || phone ? <div className="ch-card">
    <span className="ch-ico"><Icon size={20} /></span>
    <span className="grow"><small>{role}</small><b>{name || '—'}</b>{phone && <em>{fmtPhone(phone)}</em>}</span>
    {phone && <a className="wa-btn" href={waLink(phone)} target="_blank" rel="noreferrer"><MessageCircle size={16} /><span>WhatsApp</span></a>}
  </div> : null;

  return <>
    <section className="ch-hero" style={{ backgroundImage: churchCover(church) }}>
      <div className="hero-shade" />
      <div className="ch-hero-body">
        <BrandMark size={92} src={logo} />
        <div><span className="eyebrow">Nuestra iglesia</span><h1>{church.name}</h1>{church.branch && <p>{church.branch}</p>}{church.slogan && <em>{church.slogan}</em>}</div>
      </div>
      {church.can_edit && !edit && <div className="ch-hero-actions"><button className="btn primary sm" onClick={() => setEdit(true)}><Pencil size={15} /> Editar datos</button></div>}
    </section>

    {church.can_edit && !edit && <section className="panel">
      <div className="panel-head"><h2><Palette size={18} /> Apariencia</h2><small className="muted">Se aplica a todos los integrantes de la iglesia</small></div>

      <h3 className="mt">Logo</h3>
      <div className="logo-edit">
        <span className="logo-preview"><img src={logo || SION_MARK} alt="" /></span>
        <div className="actions" style={{ margin: 0 }}>
          <button className="btn" onClick={() => logoRef.current?.click()} disabled={!!busy}><Upload size={15} /> {busy === 'logo' ? 'Subiendo…' : logo ? 'Cambiar logo' : 'Subir logo'}</button>
          {logo && <button className="btn" onClick={() => removeImage('logo')}><Trash2 size={15} /> Quitar</button>}
        </div>
        <small className="muted">PNG con fondo transparente queda mejor. Se ve arriba, en el menú, en la pantalla de espera del proyector y al instalar la app.</small>
        <input ref={logoRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={e => { upload('logo', e.target.files[0]); e.target.value = ''; }} />
      </div>

      <h3 className="mt">Colores</h3>
      <div className="palettes">{PALETTES.map(p => <button key={p.id} className={`swatch ${church.theme === p.id ? 'on' : ''}`} onClick={() => patch({ theme: p.id }, `Colores: ${p.name}`)}>
        <i><b style={{ background: `linear-gradient(135deg,${p.navy},${p.navy3})` }} /><em style={{ background: `linear-gradient(135deg,${p.gold},${p.gold2})` }} /></i>
        <span>{church.theme === p.id && <Check size={12} />} {p.name}</span>
      </button>)}</div>

      <h3 className="mt">Modo</h3>
      <div className="modes">{MODES.map(([m, label, Icon]) => <button key={m} className={church.mode === m ? 'on' : ''} onClick={() => patch({ mode: m }, `Modo ${label.toLowerCase()} para la iglesia`)}><Icon size={17} /> {label}</button>)}</div>
      <p className="muted small">Es el modo por defecto. Cada persona puede cambiarlo para sí con el botón ☀/🌙 de arriba.</p>

      <h3 className="mt">Portada del inicio</h3>
      <div className="covers">
        <button className={`cover-opt ${church.cover === 'photo' ? 'on' : ''}`} style={church.cover_src ? { backgroundImage: `url(${church.cover_src})` } : { backgroundColor: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}
          onClick={() => church.cover_src ? patch({ cover: 'photo' }) : coverRef.current?.click()}>
          {!church.cover_src && <ImageIcon size={22} style={{ color: 'var(--muted)' }} />}<span>{busy === 'cover' ? 'Subiendo…' : church.cover_src ? 'Foto de la iglesia' : 'Subir foto'}</span></button>
        {COVERS.map(id => { const t = themeById(id); return <button key={id} className={`cover-opt ${church.cover === id ? 'on' : ''}`} style={{ backgroundImage: t.bg }} onClick={() => patch({ cover: id })}><span>{t.name}</span></button>; })}
      </div>
      <div className="actions">
        <button className="btn" onClick={() => coverRef.current?.click()} disabled={!!busy}><Upload size={15} /> {church.cover_src ? 'Cambiar foto de portada' : 'Subir foto de portada'}</button>
        {church.cover_src && <button className="btn" onClick={() => removeImage('cover')}><Trash2 size={15} /> Quitar foto</button>}
      </div>
      <input ref={coverRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e => { upload('cover', e.target.files[0]); e.target.value = ''; }} />
    </section>}

    {edit ? <form className="panel form" onSubmit={save}>
      <div className="panel-head"><h2>Editar datos de la iglesia</h2></div>
      <div className="row-2">
        <Field label="Nombre"><input value={f.name} onChange={set('name')} required /></Field>
        <Field label="Sede / congregación"><input value={f.branch} onChange={set('branch')} placeholder="Bella Vista" /></Field>
      </div>
      <Field label="Frase"><input value={f.slogan} onChange={set('slogan')} /></Field>
      <div className="row-2">
        <Field label="Dirección"><input value={f.address} onChange={set('address')} placeholder="Calle y número" /></Field>
        <Field label="Ciudad"><input value={f.city} onChange={set('city')} /></Field>
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
      <div className="actions"><button type="button" className="btn" onClick={() => setEdit(false)}><X size={15} /> Cancelar</button><Busy busy={busy === 'save'} type="submit"><Save size={15} /> Guardar</Busy></div>
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
