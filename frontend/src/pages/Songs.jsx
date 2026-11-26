import React, { useState } from 'react';
import { Search, Music2 } from 'lucide-react';
import { useApi, Spinner, ErrorBox, Empty } from '../ui.jsx';
import { SongRow } from './Home.jsx';

export default function Songs(){
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const groups = useApi('/groups');
  const { data, loading, error } = useApi(`/songs?q=${encodeURIComponent(q)}${group ? `&group_id=${group}` : ''}`);
  return <>
    <header className="page-head"><div><span className="eyebrow">Biblioteca</span><h1>Cancionero</h1><p className="muted">Todas las canciones de tus grupos.</p></div></header>
    <section className="panel">
      <div className="filters">
        <div className="searchbar grow"><Search size={18} /><input autoFocus placeholder="Buscar por título, autor o una frase de la letra…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <select value={group} onChange={e => setGroup(e.target.value)}><option value="">Todos los grupos</option>{groups.data?.items.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
      </div>
      {loading && !data && <Spinner />}<ErrorBox error={error} />
      {data && (data.items.length ? data.items.map(s => <SongRow key={s.id} s={s} />) : <Empty icon={Music2} title="No se encontraron canciones" />)}
    </section>
  </>;
}
