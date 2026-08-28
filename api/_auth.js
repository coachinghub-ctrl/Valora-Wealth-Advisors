/* =========================================================
   Identidad del Operating System.
   Cuentas individuales con rol, contraseña con scrypt y cookie
   firmada que transporta quién eres y qué puedes hacer.

   Variables de entorno:
     ADMIN_SECRET     cadena larga y aleatoria para firmar la sesión
     ADMIN_EMAIL      correo del primer administrador
     ADMIN_PASSWORD   su contraseña inicial
   Las dos últimas solo sirven para crear esa primera cuenta; a partir
   de ahí los usuarios viven en el almacén.
   ========================================================= */
const crypto = require('crypto');

const COOKIE = 'valora_os';
const HORAS = 12;

const secreto = () => process.env.ADMIN_SECRET || '';

function iguales(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* ---------- contraseñas ---------- */
function hashear(clave, sal) {
  return crypto.scryptSync(String(clave), sal, 64).toString('hex');
}
function nuevaClave(clave) {
  const sal = crypto.randomBytes(16).toString('hex');
  return { sal, hash: hashear(clave, sal) };
}
function claveCorrecta(clave, usuario) {
  if (!usuario || !usuario.sal || !usuario.hash || !clave) return false;
  try { return iguales(hashear(clave, usuario.sal), usuario.hash); } catch { return false; }
}

/* ---------- sesión ---------- */
const firmar = (dato) => crypto.createHmac('sha256', secreto()).update(dato).digest('hex');

function crearCookie(u) {
  const exp = Date.now() + HORAS * 3600 * 1000;
  const dato = [encodeURIComponent(u.email), u.rol, exp].join('|');
  const valor = encodeURIComponent(dato + '.' + firmar(dato));
  return `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${HORAS * 3600}`;
}
const cookieVacia = () =>
  `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

function sesion(req) {
  if (!secreto()) return null;
  const bruto = req.headers.cookie || '';
  const par = bruto.split(';').map((s) => s.trim()).find((s) => s.startsWith(COOKIE + '='));
  if (!par) return null;
  let valor;
  try { valor = decodeURIComponent(par.slice(COOKIE.length + 1)); } catch { return null; }
  const corte = valor.lastIndexOf('.');
  if (corte < 0) return null;
  const dato = valor.slice(0, corte);
  const sig = valor.slice(corte + 1);
  try { if (!iguales(sig, firmar(dato))) return null; } catch { return null; }
  const [email, rol, exp] = dato.split('|');
  if (!email || !rol || Number(exp) < Date.now()) return null;
  return { email: decodeURIComponent(email), rol };
}

const esAdmin = (s) => Boolean(s && s.rol === 'admin');

module.exports = { crearCookie, cookieVacia, sesion, esAdmin, nuevaClave, claveCorrecta, hashear };
