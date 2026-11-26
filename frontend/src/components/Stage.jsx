import React, { useEffect, useState } from 'react';
import { protectedUrl } from '../api.js';
import { FONTS } from '../lib/themes.js';

function useImage(imageId){
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true; setUrl(null);
    if (imageId) protectedUrl(`/files/backgrounds/${imageId}`).then(u => alive && setUrl(u)).catch(() => alive && setUrl(null));
    return () => { alive = false; };
  }, [imageId]);
  return url;
}

/** Logo institucional (llamas) teñido de dorado sobre cualquier fondo, o una imagen propia del grupo. */
export function Logo({ size, imageId, color = 'linear-gradient(160deg,#f6e2a6,#d6a945 60%,#b58a36)' }){
  const url = useImage(imageId);
  if (imageId) return <div className="stage-logo custom" style={{ width: size, height: size, backgroundImage: url ? `url(${url})` : 'none' }} />;
  return <div className="stage-logo" style={{ width: size, height: size }}><div style={{ background: color }} /></div>;
}

/** Imagen proyectada a pantalla completa: se ve entera, con la misma imagen difuminada de fondo. */
function MediaSlide({ imageId }){
  const url = useImage(imageId);
  if (!url) return null;
  return <div className="stage-media"><div className="sm-back" style={{ backgroundImage: `url(${url})` }} /><img src={url} alt="" /></div>;
}

/**
 * Diapositiva proyectada. Escala con el contenedor (unidades cqh), igual en la vista previa y en el proyector.
 * slide.kind: 'title' | 'lyrics' | 'text' | 'standby' | 'image' | 'blank'
 */
export default function Stage({ slide, theme, settings, black, className = '', animate = true }){
  const img = useImage(theme.imageId);
  const font = FONTS[settings.font] || FONTS.moderna;
  const overlay = settings.overlay ?? theme.overlay ?? 0;
  const size = 7.4 * (settings.size || 1);
  const key = slide ? JSON.stringify(slide) : 'empty';
  const isStandby = slide?.kind === 'standby';
  const isImage = slide?.kind === 'image';
  const logoImage = settings.logoImage || undefined;
  const textLines = slide?.kind === 'text' ? slide.lines.filter(l => l.trim()) : [];
  // Texto libre / versículos: se achica según la cantidad de líneas y de caracteres para que siempre entre.
  const chars = textLines.join(' ').length;
  const textSize = slide?.kind === 'text' ? size * Math.max(0.42, Math.min(1, 4.2 / Math.max(1, textLines.length), Math.sqrt(105 / Math.max(1, chars)))) : size;
  const showLogoBg = theme.watermark && !isImage && !(isStandby && slide.mode === 'logo' && slide.logo);
  const showCorner = settings.logoCorner && slide && !isStandby && !isImage && slide.kind !== 'blank';
  const isColor = /^#|^rgb/.test(theme.bg || '');
  const textColor = settings.textColor && !isStandby ? settings.textColor : theme.color;
  return <div className={`stage ${theme.anim ? 'anim' : ''} ${(theme.light && !settings.textColor) || ['#111111', '#1b2a3d'].includes(settings.textColor) ? 'light' : ''} ${className}`} style={{ backgroundColor: isColor ? theme.bg : '#000', backgroundImage: isColor ? 'none' : theme.bg, backgroundSize: theme.anim ? '300% 300%' : 'cover', backgroundPosition: 'center', color: textColor }}>
    {img && <div className="stage-img" style={{ backgroundImage: `url(${img})` }} />}
    {(isStandby ? (theme.overlay ?? 0) : overlay) > 0 && <div className="stage-overlay" style={{ background: `rgba(0,0,0,${isStandby ? theme.overlay : overlay})` }} />}
    {showLogoBg && <div className="stage-wm"><Logo size="86cqh" imageId={logoImage} /></div>}
    {isImage && !black && <MediaSlide key={slide.imageId} imageId={slide.imageId} />}
    {slide && !black && !isImage && <div key={key} className={`stage-text pos-${isStandby ? 'center' : settings.position} ${animate ? 'fade' : ''}`} style={{ fontFamily: font.css, fontWeight: font.weight }}>
      {slide.kind === 'title' ? <>
        <div className="st-title" style={{ fontSize: `${size * 1.35}cqh` }}>{slide.title}</div>
        {slide.author && <div className="st-author" style={{ fontSize: `${size * 0.48}cqh` }}>{slide.author}</div>}
      </> : slide.kind === 'lyrics' ? <>
        {settings.label && slide.label && <div className="st-label" style={{ fontSize: `${size * 0.4}cqh` }}>{slide.label}</div>}
        <div className="st-lines" style={{ fontSize: `${size}cqh`, textTransform: settings.upper ? 'uppercase' : 'none' }}>{slide.lines.map((l, i) => <div key={i}>{l}</div>)}</div>
      </> : slide.kind === 'text' ? <>
        {slide.title && <div className="st-label" style={{ fontSize: `${size * 0.42}cqh` }}>{slide.title}</div>}
        <div className="st-lines" style={{ fontSize: `${textSize}cqh` }}>{textLines.map((l, i) => <div key={i}>{l}</div>)}</div>
        {slide.reference && <div className="st-ref" style={{ fontSize: `${size * 0.5}cqh` }}>{slide.reference}</div>}
      </> : isStandby && slide.mode === 'logo' ? <div className="standby">
        {slide.logo && <Logo size="34cqh" imageId={logoImage} />}
        {slide.title && <div className="sb-title" style={{ fontSize: `${size * 0.95}cqh` }}>{slide.title}</div>}
        {slide.sub && <div className="sb-sub" style={{ fontSize: `${size * 0.42}cqh` }}>{slide.sub}</div>}
      </div> : null}
    </div>}
    {showCorner && !black && <div className="stage-corner"><Logo size="11cqh" imageId={logoImage} /></div>}
    {(black || (isStandby && slide.mode === 'negro')) && <div className="stage-black" />}
  </div>;
}
