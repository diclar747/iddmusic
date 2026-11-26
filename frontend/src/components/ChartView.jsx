import React from 'react';

/** Divide una línea en segmentos [{chord, text}] según la posición de cada acorde. */
function segments(line){
  const text = line.text || '';
  const chords = [...(line.chords || [])].sort((a, b) => a.position - b.position);
  if (!chords.length) return [{ chord: null, text }];
  const out = [];
  if (chords[0].position > 0) out.push({ chord: null, text: text.slice(0, chords[0].position) });
  chords.forEach((c, i) => {
    const end = i + 1 < chords.length ? chords[i + 1].position : text.length;
    out.push({ chord: c.name, text: text.slice(c.position, Math.max(end, c.position)) });
  });
  return out;
}

/** Muestra letra con acordes encima (o solo letra si showChords=false). */
export default function ChartView({ sections, showChords = true, fontSize = 17, activeSec = -1 }){
  if (!sections?.length) return <div className="empty small">Todavía no hay letra cargada.</div>;
  return <div className="chart" style={{ fontSize }}>
    {sections.map((s, i) => <section key={i} className={`chart-sec t-${s.type} ${i === activeSec ? 'live' : ''}`}>
      {s.label && <div className="sec-label">{s.label}</div>}
      {(s.lines || []).map((l, j) => {
        const onlyChords = !(l.text || '').trim();
        if (!showChords) return onlyChords ? null : <div key={j} className="cl">{l.text}</div>;
        return <div key={j} className={`cl ${onlyChords ? 'only-chords' : ''} ${l.chords?.length ? 'has-chords' : ''}`}>
          {segments(l).map((seg, k) => <span key={k} className="seg">
            {l.chords?.length > 0 && <b className="chord">{seg.chord || ' '}</b>}
            <span className="lyr">{seg.text || (seg.chord ? '  ' : '')}</span>
          </span>)}
        </div>;
      })}
    </section>)}
  </div>;
}
