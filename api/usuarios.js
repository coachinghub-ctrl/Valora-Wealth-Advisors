/* Gestión del equipo. Solo administradores.
   GET     lista
   POST    { email, nombre, rol, clave }   alta
   PATCH   { email, rol?, activo?, clave? } cambios                */
const { sesion, esAdmin, nuevaClave } = require('./_auth');
const store = require('./_store');

const ROLES = ['admin', 'agente'];
const publico = (u) => ({ email: u.email, nombre: u.nombre, rol: u.rol,
                          activo: u.activo !== false, creado: u.creado });

module.exports = async (req, res) => {
  const s = sesion(req);
  if (!s) return res.status(401).json({ error: 'no_autorizado' });
  if (!esAdmin(s)) return res.status(403).json({ error: 'solo_admin' });
  if (!store.configurado()) return res.status(500).json({ error: 'sin_almacen' });

  try {
    if (req.method === 'GET') {
      const lista = await store.listarUsuarios();
      return res.status(200).json({ usuarios: lista.map(publico) });
    }

    let d = req.body;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
    d = d || {};
    const email = String(d.email || '').toLowerCase().trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
      return res.status(400).json({ error: 'email_invalido' });
    }

    if (req.method === 'POST') {
      if (await store.obtenerUsuario(email)) return res.status(409).json({ error: 'ya_existe' });
      if (!ROLES.includes(d.rol)) return res.status(400).json({ error: 'rol_invalido' });
      if (String(d.clave || '').length < 10) return res.status(400).json({ error: 'clave_corta' });
      const { sal, hash } = nuevaClave(d.clave);
      const u = await store.guardarUsuario({
        email, nombre: String(d.nombre || '').slice(0, 80) || email,
        rol: d.rol, sal, hash, activo: true,
        debeCambiar: true, creado: new Date().toISOString()
      });
      return res.status(201).json({ usuario: publico(u) });
    }

    if (req.method === 'PATCH') {
      const u = await store.obtenerUsuario(email);
      if (!u) return res.status(404).json({ error: 'no_existe' });

      const cambios = { ...u };
      if (d.rol) {
        if (!ROLES.includes(d.rol)) return res.status(400).json({ error: 'rol_invalido' });
        // que no se quede el sistema sin ningún administrador
        if (u.rol === 'admin' && d.rol !== 'admin') {
          const admins = (await store.listarUsuarios())
            .filter((x) => x.rol === 'admin' && x.activo !== false);
          if (admins.length <= 1) return res.status(409).json({ error: 'ultimo_admin' });
        }
        cambios.rol = d.rol;
      }
      if (typeof d.activo === 'boolean') {
        if (u.rol === 'admin' && d.activo === false) {
          const admins = (await store.listarUsuarios())
            .filter((x) => x.rol === 'admin' && x.activo !== false);
          if (admins.length <= 1) return res.status(409).json({ error: 'ultimo_admin' });
        }
        cambios.activo = d.activo;
      }
      if (d.clave) {
        if (String(d.clave).length < 10) return res.status(400).json({ error: 'clave_corta' });
        const { sal, hash } = nuevaClave(d.clave);
        cambios.sal = sal; cambios.hash = hash; cambios.debeCambiar = true;
      }
      if (typeof d.nombre === 'string') cambios.nombre = d.nombre.slice(0, 80);

      const guardado = await store.guardarUsuario(cambios);
      return res.status(200).json({ usuario: publico(guardado) });
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('usuarios', e);
    return res.status(500).json({ error: 'error_interno' });
  }
};
