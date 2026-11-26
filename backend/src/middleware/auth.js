import jwt from 'jsonwebtoken';
export function auth(req, res, next){
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Autenticación requerida' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Sesión inválida o vencida' }); }
}
export function allow(...roles){
  return (req, res, next) => {
    if (!req.user || !roles.some(r => req.user.roles?.includes(r)))
      return res.status(403).json({ error: 'No tenés permisos para esta operación' });
    next();
  };
}
