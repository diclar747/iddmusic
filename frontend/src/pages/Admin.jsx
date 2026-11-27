import React, { useState } from 'react';
import { ShieldCheck, Plus, Power, CalendarPlus, Trash2, KeyRound, MessageCircle, Copy, Search, Users, Music2, Church as ChurchIcon, CalendarClock, Pencil, Inbox, Check, RotateCcw, Mail, MapPin } from 'lucide-react';
import { api } from '../api.js';
import { useApi, Spinner, ErrorBox, Modal, Field, Busy, useToast, Empty } from '../ui.jsx';
import { BrandMark } from '../components/Brand.jsx';
import { waLink, fmtPhone } from '../lib/whatsapp.js';
import { APP_NAME } from '../lib/brand.js';

const PLANS = [[1, '1 mes'], [3, '3 meses'], [6, '6 meses'], [12, '1 año']];
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = d => d ? d.split('-').reverse().join('/') : 'sin vencimiento';
const daysLeft = d => d ? Math.round((new Date(d + 'T12:00') - new Date(today() + 'T12:00')) / 86400000) : null;

function statusOf(c){
  if (c.status !== 'active') return ['bad', 'Desactivada'];
  if (c.expired) return ['bad', 'Vencida'];
  const d = daysLeft(c.plan_until);
  if (d !== null && d <= 7) return ['warn2', `Vence en ${d} día${d === 1 ? '' : 's'}`];
  return ['ok', 'Activa'];
}
const accessText = (church, a) => `¡Bienvenidos a ${APP_NAME}! 🎵\n\nIglesia: ${church}\nIngresá en: ${location.origin}/#/\nUsuario: ${a.email}\nContraseña: ${a.password}\n\nDespués podés cambiarla en "Mi perfil". Desde "Mi iglesia" cargás el logo, los colores y los datos de la iglesia.`;

/** Panel del administrador de SION Music: todas las iglesias, planes y accesos. */
export default function Admin({ user }){
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/platform/churches');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [access, setAccess] = useState(null);     // { church, admin } para mostrar/enviar el acceso
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  if (!user.roles?.includes('platform_admin')) return <div className="panel"><h2>Solo para el administrador de {APP_NAME}</h2></div>;

  async function patch(c, body, msg){
    try { await api(`/platform/churches/${c.id}`, { method: 'PATCH', body }); toast(msg); reload(); } catch (e) { toast(e.message, 'error'); }
  }
  async function resetAdmin(c){
    const pw = prompt(`Nueva contraseña para el administrador de ${c.name} (mínimo 6). Dejala vacía y se genera una fácil de recordar.`, '');
    if (pw === null) return;
    try { const r = await api(`/platform/churches/${c.id}/reset-admin`, { method: 'POST', body: { password: pw } }); setAccess({ church: c.name, admin: r.admin }); } catch (e) { toast(e.message, 'error'); }
  }
  const items = (data?.items || []).filter(c => !q || `${c.name} ${c.branch} ${c.admins.map(a => a.email).join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  const all = data?.items || [];
  const active = all.filter(c => statusOf(c)[0] !== 'bad').length;

  return <>
    <header className="page-head">
      <div><span className="eyebrow"><ShieldCheck size={12} /> Administración de {APP_NAME}</span><h1>Iglesias</h1><p className="muted">Creá iglesias, activalas por 1, 3, 6 o 12 meses, desactivalas o eliminalas.</p></div>
      <button className="btn primary" onClick={() => setCreating(true)}><Plus size={16} /> Nueva iglesia</button>
    </header>
    <div className="admin-stats">
      <div><small>Iglesias</small><b>{all.length}</b></div>
      <div><small>Activas</small><b>{active}</b></div>
      <div><small>Usuarios</small><b>{all.reduce((a, c) => a + c.users, 0)}</b></div>
      <div><small>Canciones</small><b>{all.reduce((a, c) => a + c.songs, 0)}</b></div>
    </div>
    <section className="panel">
      <div className="lc-search" style={{ marginBottom: 14 }}><Search size={17} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar iglesia, sede o correo del administrador…" /></div>
      {loading && <Spinner />}<ErrorBox error={error} />
      {data && !items.length && <Empty icon={ChurchIcon} title="No hay iglesias">Creá la primera con “Nueva iglesia”.</Empty>}
      {items.map(c => { const [cls, label] = statusOf(c); const admin = c.admins[0]; return <div key={c.id} className={`church-row ${cls === 'bad' ? 'off' : ''}`}>
        <BrandMark size={52} src={c.logo_src} />
        <div className="cr-main">
          <b>{c.name}</b>{c.branch && <small>{c.branch}</small>}
          <div className="cr-meta">
            <span className={`pill ${cls}`}>{label}</span>
            <span className="pill soft"><CalendarClock size={12} /> {c.plan_until ? `Hasta ${fmtDate(c.plan_until)}` : 'Sin vencimiento'}</span>
            <span className="pill soft"><Users size={12} /> {c.users}</span>
            <span className="pill soft"><Music2 size={12} /> {c.songs}</span>
          </div>
          {admin && <small style={{ marginTop: 6 }}>Admin: {admin.full_name} · {admin.email}{admin.phone && ` · ${fmtPhone(admin.phone)}`}</small>}
          {c.notes && <small className="muted">{c.notes}</small>}
        </div>
        <div className="cr-acts">
          <select className="mini" value="" onChange={e => e.target.value && patch(c, { extend_months: Number(e.target.value) }, `${c.name}: plan extendido`)} title="Activar / extender el plan">
            <option value="">+ Extender…</option>{PLANS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
          </select>
          {c.status === 'active'
            ? <button className="btn sm" onClick={() => confirm(`¿Desactivar ${c.name}? Sus usuarios no podrán ingresar.`) && patch(c, { status: 'inactive' }, `${c.name} desactivada`)}><Power size={14} /> Desactivar</button>
            : <button className="btn sm primary" onClick={() => patch(c, { status: 'active' }, `${c.name} activada`)}><Power size={14} /> Activar</button>}
          <button className="btn sm" onClick={() => setEditing(c)} title="Editar"><Pencil size={14} /></button>
          <button className="btn sm" onClick={() => resetAdmin(c)} title="Nueva contraseña para el administrador"><KeyRound size={14} /></button>
          {c.id !== user.church_id && <button className="btn sm danger" onClick={() => setDeleting(c)} title="Eliminar iglesia"><Trash2 size={14} /></button>}
        </div>
      </div>; })}
    </section>

    <Requests onCreate={r => setCreating({ name: r.church || '', admin_name: r.name || '', admin_phone: r.phone || '', admin_email: r.email || '', notes: [r.city, r.message].filter(Boolean).join(' · ').slice(0, 400) })} />

    {creating && <CreateChurch initial={creating === true ? null : creating} onClose={() => setCreating(false)} onCreated={r => { setCreating(false); reload(); setAccess({ church: r.church.name, admin: r.admin }); }} />}
    {editing && <EditChurch church={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); toast('Iglesia actualizada'); }} />}
    {deleting && <DeleteChurch church={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); reload(); toast('Iglesia eliminada'); }} />}
    {access && <Modal title="Acceso del administrador" onClose={() => setAccess(null)}>
      <p>Enviá estos datos al administrador de <b>{access.church}</b>:</p>
      <div className="cred"><div><small>Usuario</small><b>{access.admin.email}</b></div><div><small>Contraseña</small><b>{access.admin.password}</b></div>{access.admin.phone && <div><small>WhatsApp</small><b>{fmtPhone(access.admin.phone)}</b></div>}</div>
      <div className="actions">
        <button className="btn" onClick={() => { navigator.clipboard?.writeText(accessText(access.church, access.admin)); toast('Copiado'); }}><Copy size={15} /> Copiar</button>
        {access.admin.phone && <a className="btn wa" href={waLink(access.admin.phone, accessText(access.church, access.admin))} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Enviar por WhatsApp</a>}
      </div>
    </Modal>}
  </>;
}

/** Solicitudes de información que llegan desde la página pública. */
function Requests({ onCreate }){
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/platform/requests');
  const [all, setAll] = useState(false);
  async function act(r, body){
    try { body ? await api(`/platform/requests/${r.id}`, { method: 'PATCH', body }) : await api(`/platform/requests/${r.id}`, { method: 'DELETE' }); reload(); }
    catch (e) { toast(e.message, 'error'); }
  }
  const items = (data?.items || []).filter(r => all || r.status === 'new');
  const when = d => new Date(d).toLocaleString('es-PY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const reply = r => `¡Hola ${r.name.split(' ')[0]}! Te escribimos de ${APP_NAME} por la solicitud de información que nos dejaste${r.church ? ` para ${r.church}` : ''}. 🎵`;
  return <section className="panel requests">
    <div className="panel-head"><h2><Inbox size={18} /> Solicitudes de información {data?.pending > 0 && <span className="pill warn2">{data.pending} nuevas</span>}</h2>
      <label className="sb-check"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> Ver también las atendidas</label></div>
    <p className="muted small">Llegan desde el formulario “Solicitar información” de la página pública (sion.cd.com.py/inicio).</p>
    {loading && <Spinner />}<ErrorBox error={error} />
    {data && !items.length && <Empty icon={Inbox} title={all ? 'Todavía no llegaron solicitudes' : 'No hay solicitudes pendientes'}>Cuando alguien complete el formulario, aparece acá.</Empty>}
    {items.map(r => <div key={r.id} className={`req-row ${r.status === 'done' ? 'off' : ''}`}>
      <div className="cr-main">
        <b>{r.name}{r.church && <> · <span>{r.church}</span></>}</b>
        <div className="cr-meta">
          {r.status === 'new' ? <span className="pill warn2">Nueva</span> : <span className="pill ok">Atendida</span>}
          <span className="pill soft"><CalendarClock size={12} /> {when(r.created_at)}</span>
          {r.city && <span className="pill soft"><MapPin size={12} /> {r.city}</span>}
          {r.phone && <span className="pill soft"><MessageCircle size={12} /> {fmtPhone(r.phone)}</span>}
          {r.email && <span className="pill soft"><Mail size={12} /> {r.email}</span>}
        </div>
        {r.message && <p className="req-msg">{r.message}</p>}
      </div>
      <div className="cr-acts">
        {r.phone && <a className="btn sm wa" href={waLink(r.phone, reply(r))} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Responder</a>}
        {r.email && <a className="btn sm" href={`mailto:${r.email}?subject=${encodeURIComponent(APP_NAME)}&body=${encodeURIComponent(reply(r))}`} title="Responder por correo"><Mail size={14} /></a>}
        <button className="btn sm" onClick={() => onCreate(r)} title="Crear la iglesia con estos datos"><Plus size={14} /> Crear iglesia</button>
        {r.status === 'new' ? <button className="btn sm primary" onClick={() => act(r, { status: 'done' })}><Check size={14} /> Atendida</button>
          : <button className="btn sm" onClick={() => act(r, { status: 'new' })} title="Volver a pendiente"><RotateCcw size={14} /></button>}
        <button className="btn sm danger" onClick={() => confirm(`¿Borrar la solicitud de ${r.name}?`) && act(r)} title="Borrar"><Trash2 size={14} /></button>
      </div>
    </div>)}
  </section>;
}

function CreateChurch({ initial, onClose, onCreated }){
  const toast = useToast();
  const [f, setF] = useState({ name: '', branch: '', months: 1, admin_name: '', admin_phone: '', admin_email: '', admin_password: '', notes: '', ...(initial || {}) });
  const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  async function save(e){
    e.preventDefault(); setBusy(true);
    try { onCreated(await api('/platform/churches', { method: 'POST', body: f })); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  return <Modal title="Nueva iglesia" onClose={onClose}>
    <form className="form" onSubmit={save}>
      <div className="row-2"><Field label="Nombre de la iglesia"><input value={f.name} onChange={set('name')} required placeholder="Iglesia …" /></Field>
        <Field label="Sede / ciudad"><input value={f.branch} onChange={set('branch')} /></Field></div>
      <Field label="Plan"><div className="modes">{[[0, 'Sin vencimiento'], ...PLANS].map(([m, l]) => <button type="button" key={m} className={Number(f.months) === m ? 'on' : ''} onClick={() => setF({ ...f, months: m })}>{l}</button>)}</div></Field>
      <h3 className="mt">Administrador de la iglesia</h3>
      <div className="row-2"><Field label="Nombre"><input value={f.admin_name} onChange={set('admin_name')} required /></Field>
        <Field label="WhatsApp"><input type="tel" value={f.admin_phone} onChange={set('admin_phone')} placeholder="0981 123 456" /></Field></div>
      <div className="row-2"><Field label="Correo (usuario para ingresar)"><input type="email" value={f.admin_email} onChange={set('admin_email')} required /></Field>
        <Field label="Contraseña" hint="Opcional: si la dejás vacía se genera una fácil de recordar (ej.: Gloria2468)."><input value={f.admin_password} onChange={set('admin_password')} minLength={6} placeholder="Ej.: Alaba2024" /></Field></div>
      <Field label="Notas internas (opcional)"><textarea rows={2} value={f.notes} onChange={set('notes')} placeholder="Contacto, forma de pago…" /></Field>
      <div className="actions"><button type="button" className="btn" onClick={onClose}>Cancelar</button><Busy busy={busy} type="submit"><Plus size={15} /> Crear iglesia</Busy></div>
    </form>
  </Modal>;
}

function EditChurch({ church, onClose, onSaved }){
  const toast = useToast();
  const [f, setF] = useState({ name: church.name, branch: church.branch || '', plan_until: church.plan_until || '', notes: church.notes || '' });
  const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  async function save(e){
    e.preventDefault(); setBusy(true);
    try { await api(`/platform/churches/${church.id}`, { method: 'PATCH', body: { ...f, plan_until: f.plan_until || null } }); onSaved(); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  return <Modal title={`Editar ${church.name}`} onClose={onClose}>
    <form className="form" onSubmit={save}>
      <div className="row-2"><Field label="Nombre"><input value={f.name} onChange={set('name')} required /></Field><Field label="Sede / ciudad"><input value={f.branch} onChange={set('branch')} /></Field></div>
      <Field label="Vence el" hint="Dejalo vacío para que no venza."><input type="date" value={f.plan_until} onChange={set('plan_until')} /></Field>
      <Field label="Notas internas"><textarea rows={3} value={f.notes} onChange={set('notes')} /></Field>
      <div className="actions"><button type="button" className="btn" onClick={onClose}>Cancelar</button><Busy busy={busy} type="submit">Guardar</Busy></div>
    </form>
  </Modal>;
}

function DeleteChurch({ church, onClose, onDeleted }){
  const toast = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  async function del(e){
    e.preventDefault(); setBusy(true);
    try { await api(`/platform/churches/${church.id}`, { method: 'DELETE', body: { confirm: name } }); onDeleted(); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  return <Modal title="Eliminar iglesia" onClose={onClose}>
    <form className="form" onSubmit={del}>
      <div className="error-box">Se borran <b>para siempre</b> todos sus usuarios ({church.users}), grupos, canciones ({church.songs}), eventos y archivos. No se puede deshacer.</div>
      <Field label={`Para confirmar, escribí: ${church.name}`}><input value={name} onChange={e => setName(e.target.value)} autoFocus /></Field>
      <div className="actions"><button type="button" className="btn" onClick={onClose}>Cancelar</button>
        <Busy busy={busy} type="submit" className="btn danger-solid" disabled={name.trim().toLowerCase() !== church.name.trim().toLowerCase()}><Trash2 size={15} /> Eliminar definitivamente</Busy></div>
    </form>
  </Modal>;
}
