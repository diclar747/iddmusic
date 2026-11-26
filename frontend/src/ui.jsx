import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from './api.js';

/* ---------- Avisos ---------- */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }){
  const [items, setItems] = useState([]);
  const push = useCallback((message, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setItems(x => [...x, { id, message, kind }]);
    setTimeout(() => setItems(x => x.filter(i => i.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);
  return <ToastCtx.Provider value={push}>{children}
    <div className="toasts">{items.map(t => <div key={t.id} className={`toast ${t.kind}`} onClick={() => setItems(x => x.filter(i => i.id !== t.id))}>{t.message}</div>)}</div>
  </ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Carga de datos ---------- */
export function useApi(path, deps = []){
  const [state, setState] = useState({ data: null, error: null, loading: !!path });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) { setState({ data: null, error: null, loading: false }); return; }
    const ctrl = new AbortController();
    setState(s => ({ ...s, loading: true, error: null }));
    api(path, { signal: ctrl.signal })
      .then(data => setState({ data, error: null, loading: false }))
      .catch(error => { if (error.name !== 'AbortError') setState({ data: null, error, loading: false }); });
    return () => ctrl.abort();
  }, [path, tick, ...deps]);
  return { ...state, reload: () => setTick(t => t + 1), setData: data => setState(s => ({ ...s, data: typeof data === 'function' ? data(s.data) : data })) };
}

/* ---------- Componentes ---------- */
export const Spinner = ({ label = 'Cargando…' }) => <div className="spinner"><Loader2 className="spin" size={20} /> {label}</div>;
export const ErrorBox = ({ error }) => error ? <div className="error-box">{error.message || String(error)}</div> : null;
export const Empty = ({ icon: Icon, title, children }) => <div className="empty">{Icon && <Icon size={30} />}<b>{title}</b>{children && <div>{children}</div>}</div>;

export function Modal({ title, onClose, children, wide, footer }){
  const ref = useRef(null);
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', k);
    ref.current?.querySelector('input,select,textarea')?.focus();
    return () => document.removeEventListener('keydown', k);
  }, []);
  return <div className="modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}>
    <div className={`modal ${wide ? 'wide' : ''}`} ref={ref} role="dialog" aria-label={title}>
      <header><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></header>
      <div className="modal-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </div>
  </div>;
}

export function Field({ label, hint, children, className = '' }){
  return <label className={`field ${className}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Tabs({ tabs, value, onChange }){
  return <div className="tabs" role="tablist">{tabs.map(([id, label, Icon, count]) =>
    <button key={id} role="tab" aria-selected={value === id} className={value === id ? 'active' : ''} onClick={() => onChange(id)}>
      {Icon && <Icon size={16} />}{label}{count != null && <span className="count">{count}</span>}
    </button>)}</div>;
}

export function Busy({ busy, children, className = 'btn primary', ...props }){
  return <button className={className} disabled={busy || props.disabled} {...props}>{busy && <Loader2 className="spin" size={16} />}{children}</button>;
}

/* ---------- Formatos ---------- */
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTH_NAMES = MONTHS;
export const parseDate = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fmtDate = s => { const d = parseDate(s); return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`; };
export const fmtShort = s => { const d = parseDate(s); return { day: d.getDate(), month: MONTHS[d.getMonth()].slice(0, 3), weekday: DAYS[d.getDay()].slice(0, 3) }; };
export const fmtTime = t => t ? String(t).slice(0, 5) : '';
export const fmtAgo = ts => {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'recién'; if (s < 3600) return `hace ${Math.floor(s / 60)} min`; if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400); return d === 1 ? 'ayer' : `hace ${d} días`;
};
export const relDay = s => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((parseDate(s) - today) / 86400000);
  return diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : diff > 1 && diff < 7 ? `En ${diff} días` : diff < 0 ? 'Pasado' : '';
};
export const EVENT_TYPES = { culto: 'Culto', ensayo: 'Ensayo', evento: 'Evento especial', otro: 'Otro' };
export const STATUS = { draft: 'Borrador', review: 'Revisar transcripción', published: 'Lista', archived: 'Archivada' };
