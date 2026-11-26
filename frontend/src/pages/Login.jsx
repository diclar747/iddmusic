import React, { useState } from 'react';
import { Music2, LogIn } from 'lucide-react';
import { api, session } from '../api.js';
import { Busy } from '../ui.jsx';


export default function Login(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function login(creds){
    setError(''); setBusy(true);
    try { const d = await api('/auth/login', { method: 'POST', body: creds }); session.save(d.token, d.user); window.location.hash = '/'; }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="login-wrap">
    <form className="login-card" onSubmit={e => { e.preventDefault(); login({ email, password }); }}>
      <div className="logo big"><Music2 size={30} /></div>
      <div className="brand-title">IDD MUSIC</div>
      <p className="sub">Iglesia de Dios · Bella Vista</p>
      <h1>Ingresar</h1>
      <label className="field"><span>Correo electrónico</span><input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label className="field"><span>Contraseña</span><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      {error && <div className="error-box">{error}</div>}
      <Busy busy={busy} type="submit">Ingresar <LogIn size={17} /></Busy>
      <small className="muted">Acceso privado para integrantes invitados por un líder de grupo.</small>
    </form>
  </div>;
}
