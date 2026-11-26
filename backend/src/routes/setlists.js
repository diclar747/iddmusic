import {Router} from 'express';
import db from '../db.js';
import {auth,allow} from '../middleware/auth.js';
const r=Router();
r.get('/',auth,async(req,res)=>{
 const q=await db.query('SELECT * FROM setlists ORDER BY event_date DESC LIMIT 100');
 res.json({items:q.rows});
});
r.post('/',auth,allow('super_admin','music_admin','worship_director'),async(req,res)=>{
 const {title,event_date,event_time,group_id,notes}=req.body||{};
 if(!title||!event_date) return res.status(400).json({error:'Título y fecha son obligatorios'});
 const q=await db.query('INSERT INTO setlists(title,event_date,event_time,group_id,notes,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[title,event_date,event_time||null,group_id||null,notes||null,req.user.id]);
 res.status(201).json(q.rows[0]);
});
r.post('/:id/items',auth,allow('super_admin','music_admin','worship_director'),async(req,res)=>{
 const {song_id,position,performance_key,notes}=req.body||{};
 const q=await db.query('INSERT INTO setlist_items(setlist_id,song_id,position,performance_key,notes) VALUES($1,$2,$3,$4,$5) RETURNING *',[req.params.id,song_id,position,performance_key||null,notes||null]);
 res.status(201).json(q.rows[0]);
});
export default r;
