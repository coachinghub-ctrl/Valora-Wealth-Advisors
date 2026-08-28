/* =========================================================
   Puerta del panel: contraseña compartida y cookie firmada.
   Variables de entorno:
     ADMIN_PASSWORD   la contraseña del equipo
     ADMIN_SECRET     cadena larga y aleatoria para firmar la cookie
   Sin ellas el panel no abre: no hay contraseña por defecto.
   ========================================================= */
const crypto = require('crypto');

const COOKIE = 'valora_admin';
const HORAS = 12;

function firmar(exp) {
  return crypto.createHmac('sha256', process.env.ADMIN_SECRET || '')
    .update(String(exp)).digest('hex');
}

function crearCookie() {
  const exp = Date.now() + HORAS * 3600 * 1000;
  const valor = `${exp}.${firmar(exp)}`;
  return `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${HORAS * 3600}`;
}

function cookieVacia() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function iguales(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function claveCorrecta(intento) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real || !intento) return false;
  return iguales(intento, real);
}

function autorizado(req) {
  if (!process.env.ADMIN_SECRET) return false;
  const bruto = req.headers.cookie || '';
  const par = bruto.split(';').map((s) => s.trim()).find((s) => s.startsWith(COOKIE + '='));
  if (!par) return false;
  const [exp, sig] = par.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  try { return iguales(sig, firmar(exp)); } catch { return false; }
}

module.exports = { crearCookie, cookieVacia, claveCorrecta, autorizado };
