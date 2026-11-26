// Crea usuarios demo, un grupo con canciones y eventos para este fin de semana. Es idempotente:
// si el usuario demo ya existe, no duplica datos (usá --reset para borrar y recrear los datos demo).
import bcrypt from 'bcryptjs';
import db, { tx } from './db.js';
import { parseChart } from '../../frontend/src/lib/chart.js';

export const DEMO_PASSWORD = 'Demo12345!';
const USERS = [
  { email: 'demo@iddmusic.local', name: 'Usuario Demo', roles: ['super_admin', 'worship_director'] },
  { email: 'ana@iddmusic.local', name: 'Ana Benítez (voz)', roles: ['member'] },
  { email: 'carlos@iddmusic.local', name: 'Carlos Giménez (guitarra)', roles: ['member'] }
];

const SONGS = [
  { title: 'Santo, Santo, Santo', author: 'Reginald Heber / John B. Dykes (dominio público)', key: 'D', tempo: 72, time: '4/4', category: 'Himno', chart: `[Estrofa 1]
D       Bm      G     D
Santo, Santo, Santo, Señor omnipotente,
A      D     Em   A
siempre el labio mío loores te dará;
D       Bm      G      D
Santo, Santo, Santo, te adoro reverente,
G      D      A     D
Dios en tres personas, bendita Trinidad.

[Estrofa 2]
D       Bm      G       D
Santo, Santo, Santo, la inmensa muchedumbre
A        D        Em      A
de ángeles que cumplen tu santa voluntad,
D      Bm        G         D
ante ti se postra bañada de tu lumbre,
G       D       A      D
ante ti que has sido, que eres y serás.` },
  { title: 'Castillo fuerte es nuestro Dios', author: 'Martín Lutero (dominio público)', key: 'C', tempo: 84, time: '4/4', category: 'Himno', chart: `[Estrofa 1]
[C]Castillo [G]fuerte es [C]nuestro [F]Dios,
[C]defensa y [G]buen es[C]cudo;
[C]con su po[G]der nos [C]libra[F]rá
[C]en todo [G]trance a[C]gudo.

[Coro]
[Am]Con furia y con [Em]afán
[F]acósanos Sa[C]tán;
[F]por armas de[C]ja ver
[G]astucia y gran po[C]der;
[F]cual él no [G]hay en la [C]tierra.` },
  { title: 'Gracia que me alcanzó (demo)', author: 'Canción de ejemplo IDD Music', key: 'G', tempo: 68, time: '6/8', category: 'Adoración', chart: `[Intro]
G  D/F#  Em  C

[Estrofa 1]
G              D/F#
Tu gracia me alcanzó en el valle,
Em              C
tu luz brilló en mi oscuridad,
G              D/F#
tu voz me llamó por mi nombre
Em          C        D
y hoy canto tu fidelidad.

[Coro]
C         G
Te alabaré, te alabaré,
Em            D
con todo lo que soy,
C          G
mi corazón te entregaré,
Em      D        G
Señor, tuyo es mi hoy.

[Puente]
Em    C       G      D
Nada me separará de tu amor (x2)` }
];

function weekend(){
  const d = new Date(); d.setHours(12, 0, 0, 0);
  const sat = new Date(d); sat.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
  const fri = new Date(sat); fri.setDate(sat.getDate() - 1);
  const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return { fri: iso(fri), sat: iso(sat), sun: iso(sun) };
}

const reset = process.argv.includes('--reset');
const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
await tx(async c => {
  const existing = await c.query('SELECT id FROM users WHERE email=$1', [USERS[0].email]);
  if (existing.rowCount && !reset) { console.log('Los datos demo ya existen (usá "npm run seed -- --reset" para recrearlos).'); return; }
  if (reset) {
    await c.query(`DELETE FROM setlists WHERE group_id IN (SELECT id FROM groups WHERE created_by IN (SELECT id FROM users WHERE email = ANY($1)))`, [USERS.map(u => u.email)]);
    await c.query(`DELETE FROM groups WHERE created_by IN (SELECT id FROM users WHERE email = ANY($1))`, [USERS.map(u => u.email)]);
    await c.query(`DELETE FROM audit_logs WHERE actor_user_id IN (SELECT id FROM users WHERE email = ANY($1))`, [USERS.map(u => u.email)]);
    await c.query(`DELETE FROM users WHERE email = ANY($1)`, [USERS.map(u => u.email)]);
  }
  const ids = [];
  for (const u of USERS) {
    const q = await c.query("INSERT INTO users(full_name,email,password_hash,status) VALUES($1,$2,$3,'active') RETURNING id", [u.name, u.email, hash]);
    ids.push(q.rows[0].id);
    for (const role of u.roles) await c.query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code=$2', [q.rows[0].id, role]);
  }
  const [demo, ana, carlos] = ids;
  const g = await c.query("INSERT INTO groups(name,description,color,created_by) VALUES('Alabanza Domingo','Grupo de alabanza del culto dominical. Ensayo los sábados 18:00.','#1f6feb',$1) RETURNING id", [demo]);
  const g2 = await c.query("INSERT INTO groups(name,description,color,created_by) VALUES('Jóvenes en Adoración','Banda del culto de jóvenes de los viernes.','#c2410c',$1) RETURNING id", [demo]);
  const gid = g.rows[0].id;
  await c.query("INSERT INTO group_members(group_id,user_id,group_role) VALUES($1,$2,'leader'),($1,$3,'member'),($1,$4,'member'),($5,$2,'leader'),($5,$3,'member')", [gid, demo, ana, carlos, g2.rows[0].id]);

  const songIds = [];
  for (const s of SONGS) {
    const { sections } = parseChart(s.chart);
    const q = await c.query(`INSERT INTO songs(group_id,title,author,category,original_key,tempo_bpm,time_signature,lyrics_sections,status,source,created_by,updated_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'published','manual',$9,$9) RETURNING id`, [gid, s.title, s.author, s.category, s.key, s.tempo, s.time, JSON.stringify(sections), demo]);
    songIds.push(q.rows[0].id);
  }
  const w = weekend();
  const ensayo = await c.query(`INSERT INTO setlists(group_id,title,event_type,event_date,event_time,end_time,location,notes,created_by)
    VALUES($1,'Ensayo general','ensayo',$2,'18:00','20:00','Templo · Bella Vista','Repasar entradas del coro y finales.',$3) RETURNING id`, [gid, w.sat, demo]);
  const culto = await c.query(`INSERT INTO setlists(group_id,title,event_type,event_date,event_time,end_time,location,notes,created_by)
    VALUES($1,'Culto dominical','culto',$2,'09:00','11:00','Templo · Bella Vista','Llegar 8:15 para prueba de sonido.',$3) RETURNING id`, [gid, w.sun, demo]);
  await c.query(`INSERT INTO setlists(group_id,title,event_type,event_date,event_time,location,created_by)
    VALUES($1,'Culto de jóvenes','culto',$2,'20:00','Salón de jóvenes',$3)`, [g2.rows[0].id, w.fri, demo]);
  for (const evId of [ensayo.rows[0].id, culto.rows[0].id]) {
    await c.query(`INSERT INTO setlist_items(setlist_id,song_id,position,performance_key,notes,assigned_to) VALUES
      ($1,$2,1,'G','Entrada con teclado solo',$5),($1,$3,2,'C',NULL,$6),($1,$4,3,'D','Final lento',$5)`, [evId, songIds[2], songIds[1], songIds[0], ana, carlos]);
  }
  await c.query("INSERT INTO audit_logs(actor_user_id,action,entity_type,group_id,details) VALUES($1,'group.create','group',$2,'{\"name\":\"Alabanza Domingo\"}')", [demo, gid]);
  console.log('Datos demo creados.');
  console.log(`  Usuario demo: ${USERS[0].email} / ${DEMO_PASSWORD}`);
  console.log(`  Integrantes:  ${USERS[1].email}, ${USERS[2].email} (misma contraseña)`);
  console.log(`  Eventos: ensayo ${w.sat} 18:00 · culto ${w.sun} 09:00`);
});
await db.end();
