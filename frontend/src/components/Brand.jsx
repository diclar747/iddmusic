import React, { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { useInstall } from '../lib/pwa.js';
import { SION_MARK } from '../lib/brand.js';

/** Logo dentro de un círculo con aro del color de acento: el de la iglesia (src) o el de SION Music. */
export const BrandMark = ({ size = 42, src, fill = false }) => <span className={`brand-mark ${fill && src ? 'fill' : ''}`} style={{ width: size, height: size }}><img src={src || SION_MARK} alt="" className={fill && src ? 'fill' : src && !src.startsWith('/icons/') ? 'custom' : ''} /></span>;

/** Botón "Instalar la app" (Android/PC) o instrucciones para iPhone/iPad. */
export function InstallButton({ className = '' }){
  const pwa = useInstall();
  const [iosHelp, setIosHelp] = useState(false);
  if (pwa.installed || (!pwa.canInstall && !pwa.ios)) return null;
  return <>
    <button type="button" className={`install-btn ${className}`} onClick={() => pwa.canInstall ? pwa.install() : setIosHelp(true)}><Download size={17} /><span>Instalar la app</span></button>
    {iosHelp && <div className="ios-help" onClick={() => setIosHelp(false)}><div onClick={e => e.stopPropagation()}>
      <BrandMark size={56} /><b>Instalar SION Music</b>
      <ol><li>Tocá <Share size={15} /> <b>Compartir</b> en Safari</li><li>Elegí <b>“Agregar a inicio”</b></li><li>Tocá <b>Agregar</b></li></ol>
      <button className="btn primary" onClick={() => setIosHelp(false)}>Entendido</button>
    </div></div>}
  </>;
}
