// Plantillas de proyección: degradados modernos y paisajes dibujados en SVG (sin imágenes externas).
const svg = body => `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900' preserveAspectRatio='xMidYMid slice'>${body}</svg>`)}")`;

// Generador pseudoaleatorio determinístico (los paisajes salen siempre iguales).
function rng(seed){ let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function ridge(seed, base, amp, step, color, opacity = 1){
  const r = rng(seed); let d = `M0 ${base}`;
  for (let x = 0; x <= 1600; x += step) d += ` L${x} ${Math.round(base - r() * amp)}`;
  return `<path d='${d} L1600 900 L0 900Z' fill='${color}' opacity='${opacity}'/>`;
}
function softHills(base, amp, color, phase = 0, opacity = 1){
  let d = `M0 ${base}`;
  for (let x = 0; x <= 1600; x += 40) d += ` L${x} ${Math.round(base - amp * Math.sin((x / 1600) * Math.PI * 2 + phase) - amp * 0.4 * Math.sin((x / 400) + phase * 2))}`;
  return `<path d='${d} L1600 900 L0 900Z' fill='${color}' opacity='${opacity}'/>`;
}
function stars(n, seed, maxY = 620){
  const r = rng(seed); let s = '';
  for (let i = 0; i < n; i++) s += `<circle cx='${Math.round(r() * 1600)}' cy='${Math.round(r() * maxY)}' r='${(r() * 1.8 + 0.4).toFixed(1)}' fill='#fff' opacity='${(r() * 0.7 + 0.3).toFixed(2)}'/>`;
  return s;
}
function pines(seed, baseY, count, minH, maxH, color){
  const r = rng(seed); let s = '';
  for (let i = 0; i < count; i++) {
    const x = Math.round((i / count) * 1700 - 50 + r() * 40), h = minH + r() * (maxH - minH), w = h * 0.36, y = baseY + r() * 30;
    s += `<path d='M${x} ${y - h} L${x - w / 2} ${y} L${x + w / 2} ${y}Z M${x} ${y - h * 0.72} L${x - w * 0.62} ${y - h * 0.18} L${x + w * 0.62} ${y - h * 0.18}Z' fill='${color}'/>`;
  }
  return s + `<rect x='0' y='${baseY + 20}' width='1600' height='${900 - baseY}' fill='${color}'/>`;
}
function clouds(seed, n, color, yMax = 500){
  const r = rng(seed); let s = `<filter id='bl'><feGaussianBlur stdDeviation='18'/></filter><g filter='url(#bl)'>`;
  for (let i = 0; i < n; i++) { const cx = r() * 1600, cy = 80 + r() * yMax, w = 140 + r() * 260; s += `<ellipse cx='${cx}' cy='${cy}' rx='${w}' ry='${w * 0.28}' fill='${color}' opacity='${(0.35 + r() * 0.45).toFixed(2)}'/>`; }
  return s + '</g>';
}
const lg = (id, stops, vertical = true) => `<linearGradient id='${id}' x1='0' y1='0' x2='${vertical ? 0 : 1}' y2='${vertical ? 1 : 0}'>${stops.map(([o, c, op = 1]) => `<stop offset='${o}' stop-color='${c}' stop-opacity='${op}'/>`).join('')}</linearGradient>`;

const SCENES = {
  amanecer: svg(`<defs>${lg('s', [[0, '#2b1055'], [0.45, '#d5486b'], [0.75, '#f7a35c'], [1, '#ffd89b']])}<radialGradient id='sun'><stop offset='0' stop-color='#fff6d5'/><stop offset='.55' stop-color='#ffd27a' stop-opacity='.9'/><stop offset='1' stop-color='#ffb347' stop-opacity='0'/></radialGradient></defs>
    <rect width='1600' height='900' fill='url(#s)'/><circle cx='800' cy='590' r='240' fill='url(#sun)'/>
    ${ridge(7, 600, 220, 120, '#7a2f5e', 0.8)}${ridge(11, 700, 150, 90, '#4d2150')}${ridge(23, 800, 90, 70, '#26122f')}`),
  lago: svg(`<defs>${lg('s', [[0, '#7fb2e5'], [0.55, '#cfe6f5'], [1, '#f3efe4']])}${lg('w', [[0, '#9cc3df'], [1, '#2f5d7c']])}</defs>
    <rect width='1600' height='900' fill='url(#s)'/>${clouds(5, 7, '#ffffff', 300)}
    ${ridge(3, 520, 200, 110, '#6d8fb0', 0.75)}${ridge(9, 560, 120, 80, '#456985')}
    <rect y='560' width='1600' height='340' fill='url(#w)'/>
    <g opacity='.35' stroke='#fff' stroke-width='2'>${Array.from({ length: 14 }, (_, i) => `<line x1='${(i * 137) % 1400}' y1='${600 + i * 20}' x2='${(i * 137) % 1400 + 160 + (i % 4) * 40}' y2='${600 + i * 20}'/>`).join('')}</g>
    ${pines(17, 600, 9, 90, 170, '#1f3a2c').replace(/<rect[^>]*>$/, '')}`),
  estrellas: svg(`<defs>${lg('s', [[0, '#050816'], [0.6, '#16213e'], [1, '#3a2d5c']])}<radialGradient id='m'><stop offset='0' stop-color='#fffbe8'/><stop offset='.7' stop-color='#fff3c4' stop-opacity='.35'/><stop offset='1' stop-color='#fff3c4' stop-opacity='0'/></radialGradient></defs>
    <rect width='1600' height='900' fill='url(#s)'/>${stars(260, 42)}<circle cx='1260' cy='180' r='150' fill='url(#m)'/><circle cx='1260' cy='180' r='58' fill='#fffbe8'/>
    ${softHills(760, 60, '#1b1838', 0.5)}${softHills(820, 40, '#0c0b1d', 2)}`),
  bosque: svg(`<defs>${lg('s', [[0, '#cfe3d6'], [0.5, '#9dc3ad'], [1, '#3f6b55']])}</defs>
    <rect width='1600' height='900' fill='url(#s)'/>${clouds(8, 6, '#ffffff', 350)}
    ${pines(31, 560, 22, 160, 260, '#7fa894')}${pines(37, 660, 18, 200, 330, '#4c7a64')}${pines(41, 780, 14, 260, 420, '#1e3d30')}`),
  oceano: svg(`<defs>${lg('s', [[0, '#1d2b64'], [0.5, '#f8a978'], [0.62, '#ffd4a3']])}${lg('w', [[0, '#3b5998'], [1, '#0b1d3a']])}</defs>
    <rect width='1600' height='900' fill='url(#s)'/><circle cx='800' cy='540' r='110' fill='#ffe7b8' opacity='.95'/>
    <rect y='540' width='1600' height='360' fill='url(#w)'/>
    ${[0, 1, 2, 3, 4].map(i => `<path d='M0 ${600 + i * 60} ${Array.from({ length: 9 }, (_, k) => `Q${k * 200 + 100} ${590 + i * 60 - 18 + (i % 2) * 8} ${k * 200 + 200} ${600 + i * 60}`).join(' ')} L1600 900 L0 900Z' fill='#0b1d3a' opacity='${0.25 + i * 0.12}'/>`).join('')}
    <rect x='770' y='560' width='60' height='220' fill='#ffe7b8' opacity='.25'/>`),
  campo: svg(`<defs>${lg('s', [[0, '#f6d365'], [0.6, '#fda085'], [1, '#f5a06a']])}</defs>
    <rect width='1600' height='900' fill='url(#s)'/>${clouds(12, 6, '#fff3e0', 300)}<circle cx='420' cy='420' r='90' fill='#fff2c9' opacity='.9'/>
    ${softHills(600, 50, '#d98a4e', 0.3, 0.8)}${softHills(680, 45, '#b8682f', 1.6)}${softHills(780, 35, '#7a4220', 3.1)}`),
  cielo: svg(`<defs>${lg('s', [[0, '#4facfe'], [1, '#c2e9fb']])}</defs><rect width='1600' height='900' fill='url(#s)'/>${clouds(21, 14, '#ffffff', 700)}`),
  montanas: svg(`<defs>${lg('s', [[0, '#141e30'], [1, '#35577d']])}</defs><rect width='1600' height='900' fill='url(#s)'/>${stars(80, 9, 380)}
    ${ridge(51, 520, 260, 140, '#4a6a8d', 0.7)}${ridge(53, 650, 200, 100, '#2c4566')}${ridge(57, 790, 120, 80, '#152238')}`)
};

/** Cada tema: fondo CSS, color de texto, oscurecimiento para legibilidad. */
export const THEMES = [
  { id: 'aurora', name: 'Aurora', group: 'Degradados', bg: 'linear-gradient(120deg,#0f2027,#2c5364,#1f6f78,#3a1c71,#0f2027)', anim: true, color: '#fff', overlay: 0 },
  { id: 'atardecer-g', name: 'Atardecer', group: 'Degradados', bg: 'linear-gradient(135deg,#4b134f,#c94b4b,#f09819)', anim: true, color: '#fff', overlay: 0.1 },
  { id: 'oceano-g', name: 'Océano', group: 'Degradados', bg: 'linear-gradient(135deg,#0b1d3a,#1a2980,#26d0ce)', anim: true, color: '#fff', overlay: 0.05 },
  { id: 'lavanda', name: 'Lavanda', group: 'Degradados', bg: 'linear-gradient(135deg,#2f0743,#41295a,#8e54e9)', anim: true, color: '#fff', overlay: 0 },
  { id: 'esmeralda', name: 'Esmeralda', group: 'Degradados', bg: 'linear-gradient(135deg,#0b3d3a,#134e5e,#71b280)', anim: true, color: '#fff', overlay: 0.05 },
  { id: 'noche', name: 'Noche', group: 'Degradados', bg: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', anim: true, color: '#fff', overlay: 0 },
  { id: 'logo', name: 'Logo de la iglesia', group: 'Iglesia', bg: 'radial-gradient(ellipse at 50% 110%,#2b4a72 0%,#142a45 55%,#0b1828 100%)', color: '#fff', overlay: 0, watermark: true },
  { id: 'logo-noche', name: 'Logo · noche', group: 'Iglesia', bg: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', anim: true, color: '#fff', overlay: 0, watermark: true },
  { id: 'logo-estrellas', name: 'Logo · estrellas', group: 'Iglesia', bg: SCENES.estrellas, color: '#fff', overlay: 0.2, watermark: true },
  { id: 'iglesia', name: 'Azul y dorado', group: 'Iglesia', bg: 'radial-gradient(ellipse at 50% 120%,#2b4a72 0%,#142a45 55%,#0b1828 100%)', color: '#f2d58c', overlay: 0 },
  { id: 'negro', name: 'Negro', group: 'Minimalista', bg: '#000', color: '#fff', overlay: 0 },
  { id: 'blanco', name: 'Claro', group: 'Minimalista', bg: 'linear-gradient(180deg,#fbf8f1,#efe9dc)', color: '#1b2a3d', overlay: 0, light: true },
  { id: 'amanecer', name: 'Amanecer en la montaña', group: 'Naturaleza', bg: SCENES.amanecer, color: '#fff', overlay: 0.28 },
  { id: 'lago', name: 'Lago sereno', group: 'Naturaleza', bg: SCENES.lago, color: '#fff', overlay: 0.38 },
  { id: 'estrellas', name: 'Noche estrellada', group: 'Naturaleza', bg: SCENES.estrellas, color: '#fff', overlay: 0.1 },
  { id: 'bosque', name: 'Bosque', group: 'Naturaleza', bg: SCENES.bosque, color: '#fff', overlay: 0.4 },
  { id: 'oceano', name: 'Mar al atardecer', group: 'Naturaleza', bg: SCENES.oceano, color: '#fff', overlay: 0.3 },
  { id: 'campo', name: 'Campo dorado', group: 'Naturaleza', bg: SCENES.campo, color: '#fff', overlay: 0.35 },
  { id: 'cielo', name: 'Cielo y nubes', group: 'Naturaleza', bg: SCENES.cielo, color: '#fff', overlay: 0.35 },
  { id: 'montanas', name: 'Montañas de noche', group: 'Naturaleza', bg: SCENES.montanas, color: '#fff', overlay: 0.15 },
  ...LIBRARY()
];

/* ---------- Biblioteca ampliada: generada con código (sin descargar imágenes) ---------- */
function LIBRARY(){
  const out = [];
  // Degradados (se mueven suavemente).
  const GRADS = [
    ['Rubí', '#3a0011,#8e0e00,#e52d27'], ['Fuego', '#f12711,#f5af19'], ['Mango', '#ff8008,#ffc837'], ['Durazno', '#ed4264,#ffedbc'],
    ['Rosa', '#8e2de2,#ff6a88,#ff99ac'], ['Frambuesa', '#4a0d4d,#b0136a,#ff4b8b'], ['Uva', '#1f1c2c,#5b247a,#a044ff'], ['Violeta', '#41295a,#2f0743,#c471ed'],
    ['Índigo', '#000046,#1cb5e0'], ['Celeste', '#2193b0,#6dd5ed'], ['Turquesa', '#0f3443,#34e89e'], ['Menta', '#11998e,#38ef7d'],
    ['Selva', '#093028,#237a57'], ['Oliva', '#1e3c1e,#7a8f3a,#d4c26a'], ['Arena', '#3e2b1f,#a17a50,#e6c79c'], ['Cobre', '#200122,#6f0000,#c46b2a'],
    ['Dorado', '#1c1405,#8a6a1f,#f2d58c'], ['Plata', '#232526,#414345,#8e9eab'], ['Grafito', '#0f0f0f,#2c2c2c,#4b4b4b'], ['Medianoche', '#000000,#0f2027,#203a43'],
    ['Amanecer', '#355c7d,#6c5b7b,#c06c84'], ['Crepúsculo', '#0b486b,#f56217'], ['Pastel', '#a1c4fd,#c2e9fb,#fbc2eb'], ['Algodón', '#ffecd2,#fcb69f']
  ];
  GRADS.forEach(([name, stops], i) => {
    const light = /Pastel|Algodón|Durazno/.test(name);
    out.push({ id: 'g-' + i, name, group: 'Colores', bg: `linear-gradient(${120 + (i % 4) * 20}deg,${stops})`, anim: true, color: light ? '#1b2a3d' : '#fff', overlay: light ? 0 : 0.08, light });
  });
  // Colores sólidos.
  [['Azul marino', '#14213d'], ['Vino', '#4a0e1c'], ['Verde bosque', '#13321f'], ['Café', '#3b2618'], ['Púrpura', '#2d1b4e'], ['Gris oscuro', '#1f2329'], ['Azul real', '#1f3c88'], ['Blanco', '#ffffff']].forEach(([name, c], i) =>
    out.push({ id: 's-' + i, name, group: 'Sólidos', bg: c, color: c === '#ffffff' ? '#111' : '#fff', overlay: 0, light: c === '#ffffff' }));
  // Luces bokeh.
  [['Bokeh dorado', '#1a1206', '#f5c26b'], ['Bokeh azul', '#050b1f', '#5aa9ff'], ['Bokeh rosa', '#1c0612', '#ff7eb3'], ['Bokeh verde', '#04140d', '#59e3a7'], ['Bokeh violeta', '#0f0620', '#b98cff'], ['Bokeh cálido', '#1a0905', '#ff9a5a']].forEach(([name, base, c], i) => {
    const r = rng(100 + i); let s = '';
    for (let k = 0; k < 38; k++) { const rad = 20 + r() * 110; s += `<circle cx='${Math.round(r() * 1600)}' cy='${Math.round(r() * 900)}' r='${Math.round(rad)}' fill='${c}' opacity='${(0.06 + r() * 0.28).toFixed(2)}'/>`; }
    out.push({ id: 'b-' + i, name, group: 'Luces', bg: svg(`<defs><radialGradient id='v' cx='.5' cy='.45' r='.75'><stop offset='0' stop-color='${base}' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='.7'/></radialGradient><filter id='f'><feGaussianBlur stdDeviation='9'/></filter></defs><rect width='1600' height='900' fill='${base}'/><g filter='url(#f)'>${s}</g><rect width='1600' height='900' fill='url(#v)'/>`), color: '#fff', overlay: 0.15 });
  });
  // Rayos de luz desde arriba.
  [['Luz celestial', '#0d1b2a', '#fff6d5'], ['Gloria dorada', '#1b1206', '#ffd27a'], ['Luz azul', '#03101f', '#9fd3ff'], ['Luz violeta', '#120821', '#e2c6ff']].forEach(([name, base, c], i) => {
    let rays = '';
    for (let k = -6; k <= 6; k++) rays += `<path d='M800 -60 L${800 + k * 150 - 60} 900 L${800 + k * 150 + 60} 900Z' fill='${c}' opacity='${(0.05 + (6 - Math.abs(k)) * 0.012).toFixed(3)}'/>`;
    out.push({ id: 'r-' + i, name, group: 'Luces', bg: svg(`<defs><radialGradient id='g' cx='.5' cy='0' r='1'><stop offset='0' stop-color='${c}' stop-opacity='.55'/><stop offset='.6' stop-color='${base}' stop-opacity='0'/></radialGradient><filter id='f'><feGaussianBlur stdDeviation='14'/></filter></defs><rect width='1600' height='900' fill='${base}'/><g filter='url(#f)'>${rays}</g><rect width='1600' height='900' fill='url(#g)'/>`), color: '#fff', overlay: 0.12 });
  });
  // Ondas suaves.
  [['Ondas azules', ['#0b1d3a', '#13315c', '#1d4e89', '#3a7bd5']], ['Ondas violetas', ['#1a0b2e', '#2e1452', '#4d2a7d', '#7b4bb3']], ['Ondas verdes', ['#061a14', '#0e3b2c', '#17614a', '#2e9c74']], ['Ondas atardecer', ['#2b1031', '#6b1f45', '#b3434b', '#f08a4b']], ['Ondas doradas', ['#1a1408', '#3d2e10', '#7a5c1e', '#c9a14a']]].forEach(([name, cs], i) => {
    const waves = cs.slice(1).map((c, k) => softHills(420 + k * 150, 70 - k * 10, c, i + k * 1.3, 0.9)).join('');
    out.push({ id: 'w-' + i, name, group: 'Ondas', bg: svg(`<rect width='1600' height='900' fill='${cs[0]}'/>${waves}`), color: '#fff', overlay: 0.2 });
  });
  // Cruz en el monte.
  [['Cruz al atardecer', ['#2b1055', '#d5486b', '#f7a35c'], '#1a0a1e'], ['Cruz al amanecer', ['#355c7d', '#f8b195', '#ffe3b3'], '#24182b'], ['Cruz de noche', ['#050816', '#16213e', '#3a2d5c'], '#05060d'], ['Cruz dorada', ['#1b1206', '#8a5a1a', '#f2c46d'], '#120c04']].forEach(([name, sky, ground], i) => {
    const cross = `<g fill='${ground}'><rect x='${790}' y='300' width='22' height='300'/><rect x='${730}' y='370' width='142' height='20'/></g>`;
    out.push({ id: 'c-' + i, name, group: 'Cruz', bg: svg(`<defs>${lg('s', sky.map((c, k) => [k / (sky.length - 1), c]))}</defs><rect width='1600' height='900' fill='url(#s)'/>${i === 2 ? stars(160, 77, 520) : `<circle cx='800' cy='590' r='160' fill='#fff3d1' opacity='.35'/>`}${cross}${softHills(640, 40, ground, 1.2)}`), color: '#fff', overlay: 0.25 });
  });
  // Geométricos (low-poly).
  [['Cristal azul', ['#0b1d3a', '#1d4e89', '#3a7bd5']], ['Cristal violeta', ['#1a0b2e', '#4d2a7d', '#9b6bd3']], ['Cristal esmeralda', ['#062018', '#17614a', '#3fc495']], ['Cristal rubí', ['#2a0610', '#7a1430', '#d6455d']]].forEach(([name, cs], i) => {
    const r = rng(300 + i); let tri = '';
    const W = 8, H = 5, pts = [];
    for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) pts.push([x * 200 + (x && x < W ? (r() - 0.5) * 120 : 0), y * 180 + (y && y < H ? (r() - 0.5) * 100 : 0)]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = pts[y * (W + 1) + x], b = pts[y * (W + 1) + x + 1], c = pts[(y + 1) * (W + 1) + x], d = pts[(y + 1) * (W + 1) + x + 1];
      [[a, b, d], [a, d, c]].forEach(t => { tri += `<path d='M${t.map(p => p.map(Math.round).join(' ')).join(' L')}Z' fill='${cs[Math.floor(r() * 3)]}' opacity='${(0.55 + r() * 0.45).toFixed(2)}'/>`; });
    }
    out.push({ id: 'p-' + i, name, group: 'Geométricos', bg: svg(`<rect width='1600' height='900' fill='${cs[0]}'/>${tri}`), color: '#fff', overlay: 0.35 });
  });
  return out;
}

export const FONTS = {
  moderna: { name: 'Moderna', css: "'Segoe UI', 'Helvetica Neue', Arial, system-ui, sans-serif", weight: 700 },
  clasica: { name: 'Clásica', css: "Georgia, 'Times New Roman', serif", weight: 600 },
  redonda: { name: 'Redondeada', css: "'Trebuchet MS', Verdana, sans-serif", weight: 700 },
  fina: { name: 'Elegante', css: "'Segoe UI Light', 'Helvetica Neue', Arial, sans-serif", weight: 300 }
};

export const DEFAULT_SETTINGS = {
  theme: 'amanecer', perSlide: 2, maxChars: 42, size: 1, font: 'moderna', upper: false, label: false, titleSlide: true, position: 'center', overlay: null,
  // Pantalla de espera: se muestra al pausar, entre canciones y al salir de la proyección.
  standbyMode: 'logo', standbyTheme: 'iglesia', standbyTitle: 'Iglesia de Dios', standbySub: 'Bella Vista', standbyLogo: true,
  // Logo: el de la iglesia (llamas) o una imagen propia del grupo (id); opcionalmente en una esquina de cada diapositiva.
  logoImage: '', logoCorner: false,
  // Color del texto ('' = el de la plantilla) y plantilla propia por canción { songId: themeId }.
  textColor: '', songThemes: {}
};
export const TEXT_COLORS = [['', 'El de la plantilla'], ['#ffffff', 'Blanco'], ['#f2d58c', 'Dorado'], ['#ffe9a8', 'Crema'], ['#9fd3ff', 'Celeste'], ['#111111', 'Negro'], ['#1b2a3d', 'Azul oscuro']];
export const STANDBY_MODES = { logo: 'Logo y nombre de la iglesia', fondo: 'Solo el fondo', negro: 'Negro total' };

/** Configuración guardada del presentador (compartida con la ventana del proyector). */
export function savedSettings(){
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('idd_present') || '{}') }; } catch { return DEFAULT_SETTINGS; }
}

export function themeById(id, uploaded = []){
  if (id?.startsWith('img:')) {
    const bg = uploaded.find(b => 'img:' + b.id === id);
    return { id, name: bg?.original_name || 'Imagen', group: 'Imágenes del grupo', imageId: id.slice(4), bg: '#000', color: '#fff', overlay: 0.4 };
  }
  return THEMES.find(t => t.id === id) || THEMES[0];
}

/** Reduce una imagen de la computadora (máx. 1920 px) antes de subirla; mantiene PNG si tiene transparencia posible. */
export async function prepareImage(file){
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" no es una imagen`);
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 3 * 1024 * 1024 && /jpeg|png|webp/.test(file.type)) { bmp.close?.(); return file; }
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  const png = file.type === 'image/png';
  const blob = await new Promise(r => c.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.88));
  return new File([blob], file.name.replace(/\.\w+$/, '') + (png ? '.png' : '.jpg'), { type: blob.type });
}
