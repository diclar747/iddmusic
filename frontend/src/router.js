import { useEffect, useState } from 'react';

function parse(){
  const raw = decodeURIComponent(window.location.hash.replace(/^#/, '')) || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/', parts: path.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function useRoute(){
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => { setRoute(parse()); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(to, { replace } = {}){
  const hash = '#' + to;
  if (replace) window.location.replace(hash); else window.location.hash = to;
}

export const href = to => '#' + to;
