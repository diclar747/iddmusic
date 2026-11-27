import React from 'react';
import { Plus, Sparkles } from 'lucide-react';
import ChurchSongbook from '../components/ChurchSongbook.jsx';

export default function Songs({ initialQ = '' }){
  return <>
    <header className="page-head"><div><span className="eyebrow">Biblioteca</span><h1>Cancionero</h1><p className="muted">Todas las canciones de todos los grupos de la iglesia, con las veces que ya se tocaron.</p></div>
      <div className="head-actions"><a className="btn primary" href="#/songs/new"><Plus size={16} /> Nueva canción</a><a className="btn" href="#/import"><Sparkles size={16} /> Buscar o importar</a></div>
    </header>
    <section className="panel">
      <ChurchSongbook per={20} initialQ={initialQ} />
    </section>
  </>;
}
