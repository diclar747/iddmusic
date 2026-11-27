// Contraseñas fáciles de recordar (palabra + 4 números), para cuentas nuevas o restablecidas.
import crypto from 'crypto';
const WORDS = ['Gloria', 'Alaba', 'Gracia', 'Sion', 'Salmo', 'Canto', 'Himno', 'Aleluya', 'Hosanna', 'Fe', 'Luz', 'Paz', 'Amor', 'Cielo', 'Roca', 'Vida'];
export function friendlyPassword(){
  const w = WORDS[crypto.randomInt(WORDS.length)];
  return w + String(crypto.randomInt(1000, 10000));
}
