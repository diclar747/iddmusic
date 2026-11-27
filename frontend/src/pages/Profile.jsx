import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, UserRound, Eye, EyeOff, ShieldCheck, Church } from 'lucide-react';
import { api, session } from '../api.js';
import { Field, Busy, useToast } from '../ui.jsx';
import { fmtPhone } from '../lib/whatsapp.js';

const ROLE_NAMES = { super_admin: 'Administrador general', music_admin: 'Administrador musical', worship_director: 'Director de alabanza', editor: 'Editor', member: 'Integrante' };
export const initials = name => String(name || '?').split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase();

export default function Profile({ user, section }){
  const toast = useToast();
  const [name, setName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ? fmtPhone(user.phone) : '');
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState('');
  const pwRef = useRef(null);
  useEffect(() => { if (section === 'password') setTimeout(() => { pwRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); pwRef.current?.querySelector('input')?.focus(); }, 150); }, [section]);
  useEffect(() => { api('/auth/me').then(me => { if (me.phone) setPhone(fmtPhone(me.phone)); session.save(session.token, { ...session.user, ...me }); }).catch(() => {}); }, []);

  async function saveData(e){
    e.preventDefault(); setBusy('data');
    try {
      const r = await api('/auth/me', { method: 'PATCH', body: { full_name: name, phone } });
      session.save(session.token, { ...user, fullName: name.trim(), phone: r.phone });
      setPhone(r.phone ? fmtPhone(r.phone) : '');
      toast('Datos guardados');
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(''); }
  }
  async function savePw(e){
    e.preventDefault();
    if (pw.new_password !== pw.confirm) { toast('Las contraseñas nuevas no coinciden', 'error'); return; }
    setBusy('pw');
    try { await api('/auth/change-password', { method: 'POST', body: pw }); toast('Contraseña cambiada'); setPw({ current_password: '', new_password: '', confirm: '' }); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(''); }
  }
  const strength = pw.new_password.length >= 12 && /\d/.test(pw.new_password) && /[A-Za-z]/.test(pw.new_password) ? 'Fuerte' : pw.new_password.length >= 8 ? 'Aceptable' : pw.new_password ? 'Muy corta' : '';
  return <>
    <section className="profile-head">
      <span className="avatar xl">{initials(user.fullName)}</span>
      <div><span className="eyebrow">Mi cuenta</span><h1>{user.fullName}</h1>
        <p className="muted">{user.email}{user.phone && ` · ${fmtPhone(user.phone)}`}</p>
        <div className="role-pills">{(user.roles || []).map(r => <span key={r} className="pill soft"><ShieldCheck size={12} /> {ROLE_NAMES[r] || r}</span>)}</div></div>
      <a className="btn" href="#/iglesia"><Church size={16} /> Datos de la iglesia</a>
    </section>
    <div className="grid-2">
      <form className="panel form" onSubmit={saveData}><h2><UserRound size={18} /> Mis datos</h2>
        <Field label="Nombre completo"><input value={name} onChange={e => setName(e.target.value)} required /></Field>
        <Field label="WhatsApp" hint="Para que el grupo pueda escribirte."><input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0981 123 456" /></Field>
        <Field label="Correo (usuario para ingresar)"><input value={user.email} disabled /></Field>
        <div className="actions"><Busy busy={busy === 'data'} type="submit">Guardar</Busy></div></form>
      <form className="panel form" onSubmit={savePw} ref={pwRef} id="password"><h2><KeyRound size={18} /> Cambiar contraseña</h2>
        <Field label="Contraseña actual"><input type={show ? 'text' : 'password'} autoComplete="current-password" value={pw.current_password} onChange={e => setPw({ ...pw, current_password: e.target.value })} required /></Field>
        <Field label="Nueva contraseña" hint={strength ? `Seguridad: ${strength}` : 'Mínimo 8 caracteres'}><input type={show ? 'text' : 'password'} autoComplete="new-password" value={pw.new_password} onChange={e => setPw({ ...pw, new_password: e.target.value })} required minLength={8} /></Field>
        <Field label="Repetir nueva contraseña"><input type={show ? 'text' : 'password'} autoComplete="new-password" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} required /></Field>
        <div className="actions"><button type="button" className="btn" onClick={() => setShow(s => !s)}>{show ? <EyeOff size={15} /> : <Eye size={15} />} {show ? 'Ocultar' : 'Mostrar'}</button><Busy busy={busy === 'pw'} type="submit">Cambiar contraseña</Busy></div></form>
    </div>
  </>;
}
