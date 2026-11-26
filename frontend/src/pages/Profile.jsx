import React, { useState } from 'react';
import { api, session } from '../api.js';
import { Field, Busy, useToast } from '../ui.jsx';

export default function Profile({ user }){
  const toast = useToast();
  const [name, setName] = useState(user.fullName);
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [busy, setBusy] = useState('');
  async function saveName(e){
    e.preventDefault(); setBusy('name');
    try { await api('/auth/me', { method: 'PATCH', body: { full_name: name } }); session.save(session.token, { ...user, fullName: name.trim() }); toast('Nombre actualizado'); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(''); }
  }
  async function savePw(e){
    e.preventDefault();
    if (pw.new_password !== pw.confirm) { toast('Las contraseñas nuevas no coinciden', 'error'); return; }
    setBusy('pw');
    try { await api('/auth/change-password', { method: 'POST', body: pw }); toast('Contraseña cambiada'); setPw({ current_password: '', new_password: '', confirm: '' }); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(''); }
  }
  return <>
    <header className="page-head"><div><span className="eyebrow">Cuenta</span><h1>Mi perfil</h1><p className="muted">{user.email}</p></div></header>
    <div className="grid-2">
      <form className="panel form" onSubmit={saveName}><h2>Datos</h2>
        <Field label="Nombre completo"><input value={name} onChange={e => setName(e.target.value)} required /></Field>
        <div className="actions"><Busy busy={busy === 'name'} type="submit">Guardar</Busy></div></form>
      <form className="panel form" onSubmit={savePw}><h2>Cambiar contraseña</h2>
        <Field label="Contraseña actual"><input type="password" autoComplete="current-password" value={pw.current_password} onChange={e => setPw({ ...pw, current_password: e.target.value })} required /></Field>
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres"><input type="password" autoComplete="new-password" value={pw.new_password} onChange={e => setPw({ ...pw, new_password: e.target.value })} required minLength={8} /></Field>
        <Field label="Repetir nueva contraseña"><input type="password" autoComplete="new-password" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} required /></Field>
        <div className="actions"><Busy busy={busy === 'pw'} type="submit">Cambiar contraseña</Busy></div></form>
    </div>
  </>;
}
