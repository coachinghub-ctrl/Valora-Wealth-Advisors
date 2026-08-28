/* POST /api/sesion   entrar     { email, clave }
   GET                quién soy
   PUT                cambiar mi propia contraseña { claveActual, clave }
   DELETE             salir                                          */
const { crearCookie, cookieVacia, sesion, nuevaClave, claveCorrecta } = require('./_auth');
const store = require('./_store');

const publico = (u) => ({ email: u.email, nombre: u.nombre, rol: u.rol });

module.exports = async (req, res) => {
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookieVacia());
    return res.status(200).json({ ok: true });
  }

  const s = sesion(req);

  if (req.method === 'GET') {
    if (!s) return res.status(401).json({ ok: false });
    if (!store.configurado()) return res.status(500).json({ error: 'sin_almacen' });
    const u = await store.obtenerUsuario(s.email);
    if (!u || u.activo === false) return res.status(401).json({ ok: false });
    return res.status(200).json({ ok: true, usuario: publico(u) });
  }

  if (!process.env.ADMIN_SECRET) return res.status(500).json({ error: 'no_configurado' });
  if (!store.configurado()) return res.status(500).json({ error: 'sin_almacen' });

  let d = req.body;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  d = d || {};

  /* ---------- cambiar la propia contraseña ---------- */
  if (req.method === 'PUT') {
    if (!s) return res.status(401).json({ error: 'no_autorizado' });
    const u = await store.obtenerUsuario(s.email);
    if (!claveCorrecta(d.claveActual, u)) return res.status(401).json({ error: 'clave_incorrecta' });
    if (String(d.clave || '').length < 10) return res.status(400).json({ error: 'clave_corta' });
    const { sal, hash } = nuevaClave(d.clave);
    await store.guardarUsuario({ ...u, sal, hash, debeCambiar: false });
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  /* ---------- entrar ---------- */
  await new Promise((r) => setTimeout(r, 600));   // un respiro contra la fuerza bruta

  const email = String(d.email || '').toLowerCase().trim();
  let u = await store.obtenerUsuario(email);

  // la primera cuenta se siembra desde las variables de entorno
  if (!u && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD &&
      email === String(process.env.ADMIN_EMAIL).toLowerCase().trim() &&
      String(d.clave || '') === process.env.ADMIN_PASSWORD) {
    const { sal, hash } = nuevaClave(d.clave);
    u = await store.guardarUsuario({
      email, nombre: 'Administrador', rol: 'admin', sal, hash,
      activo: true, creado: new Date().toISOString()
    });
  }

  if (!u || u.activo === false || !claveCorrecta(d.clave, u)) {
    return res.status(401).json({ error: 'credenciales' });
  }

  res.setHeader('Set-Cookie', crearCookie(u));
  return res.status(200).json({ ok: true, usuario: publico(u) });
};
