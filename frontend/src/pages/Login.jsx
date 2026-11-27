import React, { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { api, session } from '../api.js';
import { Busy } from '../ui.jsx';
import { BrandMark, InstallButton } from '../components/Brand.jsx';
import { themeById } from '../lib/themes.js';
import { APP_TAGLINE, resetTheme } from '../lib/brand.js';

export default function Login(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { resetTheme(); }, []);
  async function login(creds){
    setError(''); setBusy(true);
    try { const d = await api('/auth/login', { method: 'POST', body: creds }); session.save(d.token, d.user); window.location.hash = '/'; }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="login-wrap" style={{ backgroundImage: themeById('c-0').bg }}>
    <div className="login-shade" />
    <div className="login-hero">
      <BrandMark size={112} />
      <div className="brand-title">SION <em>Music</em></div>
      <p className="sub">Cancionero, proyección y alabanza para tu iglesia</p>
      <p className="slogan">{APP_TAGLINE}</p>
    </div>
    <form className="login-card" onSubmit={e => { e.preventDefault(); login({ email, password }); }}>
      <h1>Ingresar</h1>
      <label className="field"><span>Correo electrónico</span><input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label className="field"><span>Contraseña</span><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      {error && <div className="error-box">{error}</div>}
      <Busy busy={busy} type="submit">Ingresar <LogIn size={17} /></Busy>
      <InstallButton className="light" />
      <small className="muted">Acceso para iglesias registradas en SION Music. Tu usuario te lo da el administrador de tu iglesia.</small>
    </form>
  </div>;
}
