/* POST /api/sesion  → entra al panel     DELETE → sale */
const { crearCookie, cookieVacia, claveCorrecta, autorizado } = require('./_auth');

module.exports = async (req, res) => {
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookieVacia());
    return res.status(200).json({ ok: true });
  }
  if (req.method === 'GET') {
    return res.status(autorizado(req) ? 200 : 401).json({ ok: autorizado(req) });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SECRET) {
    return res.status(500).json({ error: 'no_configurado' });
  }

  let d = req.body;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }

  // un respiro contra la fuerza bruta
  await new Promise((r) => setTimeout(r, 600));

  if (!claveCorrecta((d || {}).clave)) {
    return res.status(401).json({ error: 'clave_incorrecta' });
  }
  res.setHeader('Set-Cookie', crearCookie());
  return res.status(200).json({ ok: true });
};
