import React, { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { useInstall } from '../lib/pwa.js';

/** Logo de la iglesia: llamas doradas dentro de un círculo azul con aro dorado. */
export const BrandMark = ({ size = 42 }) => <span className="brand-mark" style={{ width: size, height: size }}><img src="/icons/flames-gold.png" alt="" /></span>;

/** Botón "Instalar la app" (Android/PC) o instrucciones para iPhone/iPad. */
export function InstallButton({ className = '' }){
  const pwa = useInstall();
  const [iosHelp, setIosHelp] = useState(false);
  if (pwa.installed || (!pwa.canInstall && !pwa.ios)) return null;
  return <>
    <button type="button" className={`install-btn ${className}`} onClick={() => pwa.canInstall ? pwa.install() : setIosHelp(true)}><Download size={17} /><span>Instalar la app</span></button>
    {iosHelp && <div className="ios-help" onClick={() => setIosHelp(false)}><div onClick={e => e.stopPropagation()}>
      <BrandMark size={56} /><b>Instalar IDD Music</b>
      <ol><li>Tocá <Share size={15} /> <b>Compartir</b> en Safari</li><li>Elegí <b>“Agregar a inicio”</b></li><li>Tocá <b>Agregar</b></li></ol>
      <button className="btn primary" onClick={() => setIosHelp(false)}>Entendido</button>
    </div></div>}
  </>;
}
