// Marca y apariencia de cada iglesia en SION Music: paleta de colores, modo claro/oscuro, logo y portada.
export const APP_NAME = 'SION Music';
export const APP_TAGLINE = 'Un lugar de adoración y presencia de Dios';
export const SION_MARK = '/icons/sion-mark.png';

/** Paletas: base (menú, botones, portada) + acento (detalles dorados). */
export const PALETTES = [
  { id: 'azul-dorado', name: 'Azul y dorado', navy: '#142a45', navy2: '#1d3a5e', navy3: '#294360', dark: '#0d1d33', gold: '#b58a36', gold2: '#e7c77a' },
  { id: 'bordo', name: 'Bordó', navy: '#3d0f1c', navy2: '#5a1a2b', navy3: '#73263a', dark: '#2a0912', gold: '#b8873a', gold2: '#ecc879' },
  { id: 'esmeralda', name: 'Esmeralda', navy: '#0d3a30', navy2: '#135244', navy3: '#1d6b58', dark: '#082720', gold: '#b8913a', gold2: '#e6c77d' },
  { id: 'violeta', name: 'Violeta', navy: '#2a1748', navy2: '#3b2163', navy3: '#4e2e80', dark: '#1c0f33', gold: '#c08a3e', gold2: '#f0c987' },
  { id: 'turquesa', name: 'Turquesa', navy: '#0b3a44', navy2: '#0f5161', navy3: '#17697c', dark: '#06262d', gold: '#1f9e90', gold2: '#7fe0d3' },
  { id: 'grafito', name: 'Grafito y naranja', navy: '#1d2126', navy2: '#2a3037', navy3: '#3a424b', dark: '#121518', gold: '#d9772b', gold2: '#f5a964' },
  { id: 'rosa', name: 'Rosa', navy: '#47173a', navy2: '#612150', navy3: '#7a2d66', dark: '#2f0e26', gold: '#c9748f', gold2: '#f3b2c6' },
  { id: 'cielo', name: 'Cielo', navy: '#10345a', navy2: '#18497a', navy3: '#22609c', dark: '#0a2340', gold: '#3f8fd6', gold2: '#9ccbf5' },
  { id: 'negro-dorado', name: 'Negro y dorado', navy: '#151515', navy2: '#242424', navy3: '#333333', dark: '#0a0a0a', gold: '#c9a646', gold2: '#ecd58d' }
];
export const paletteById = id => PALETTES.find(p => p.id === id) || PALETTES[0];

/** Portadas para el inicio (escenas de la biblioteca de fondos) o la foto propia de la iglesia. */
export const COVERS = ['c-0', 'c-1', 'c-2', 'c-3', 'amanecer', 'montanas', 'estrellas', 'lago', 'campo', 'oceano', 'b-0', 'r-1', 'w-0', 'p-0'];

const MODE_KEY = 'sion_mode';        // preferencia del usuario: 'light' | 'dark' | 'auto' | '' (= la de la iglesia)
const BRAND_KEY = 'sion_brand';      // última marca vista (para pintar la pantalla de inicio antes de cargar)
export const userMode = () => localStorage.getItem(MODE_KEY) || '';
export function setUserMode(m){ if (m) localStorage.setItem(MODE_KEY, m); else localStorage.removeItem(MODE_KEY); applyTheme(lastChurch); }

let lastChurch = null;
const darkQuery = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : null;
darkQuery?.addEventListener?.('change', () => applyTheme(lastChurch));

export function effectiveMode(church){
  const m = userMode() || church?.mode || 'light';
  return m === 'auto' ? (darkQuery?.matches ? 'dark' : 'light') : m;
}

/** Aplica la paleta y el modo de la iglesia a toda la app. */
export function applyTheme(church){
  lastChurch = church || lastChurch;
  const p = paletteById(lastChurch?.theme);
  const r = document.documentElement;
  r.style.setProperty('--navy', p.navy); r.style.setProperty('--navy-2', p.navy2); r.style.setProperty('--navy-3', p.navy3);
  r.style.setProperty('--navy-dark', p.dark); r.style.setProperty('--gold', p.gold); r.style.setProperty('--gold-2', p.gold2);
  const mode = effectiveMode(lastChurch);
  r.dataset.mode = mode;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', p.dark);
  if (church) try { localStorage.setItem(BRAND_KEY, JSON.stringify({ name: church.name, branch: church.branch, logo_src: church.logo_src, theme: church.theme, mode: church.mode })); } catch { /* */ }
}
export const cachedBrand = () => { try { return JSON.parse(localStorage.getItem(BRAND_KEY) || 'null'); } catch { return null; } };
export const forgetBrand = () => localStorage.removeItem(BRAND_KEY);

/** Colores de SION Music (pantalla de ingreso), sin tocar la marca guardada de la iglesia. */
export function resetTheme(){
  const p = PALETTES[0], r = document.documentElement;
  r.style.setProperty('--navy', p.navy); r.style.setProperty('--navy-2', p.navy2); r.style.setProperty('--navy-3', p.navy3);
  r.style.setProperty('--navy-dark', p.dark); r.style.setProperty('--gold', p.gold); r.style.setProperty('--gold-2', p.gold2);
  r.dataset.mode = 'light';
}
