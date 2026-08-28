/* GET   /api/leads   listado — el agente solo ve lo suyo
   PATCH /api/leads   { id, etapa?, nota?, responsable?, perfil? }     */
const { sesion, esAdmin } = require('./_auth');
const store = require('./_store');

const ETAPAS = ['nuevo', 'contactado', 'agendado', 'propuesta', 'ganado', 'perdido'];

function puedeVer(lead, s) {
  if (esAdmin(s)) return true;
  return lead.responsable === s.email;
}

module.exports = async (req, res) => {
  const s = sesion(req);
  if (!s) return res.status(401).json({ error: 'no_autorizado' });
  if (!store.configurado()) return res.status(500).json({ error: 'sin_almacen' });

  try {
    if (req.method === 'GET') {
      const todos = await store.listar();
      const leads = esAdmin(s) ? todos : todos.filter((l) => l.responsable === s.email);
      return res.status(200).json({ leads, yo: { email: s.email, rol: s.rol } });
    }

    if (req.method === 'PATCH') {
      let d = req.body;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
      d = d || {};
      if (!d.id) return res.status(400).json({ error: 'falta_id' });

      const actual = await store.obtener(d.id);
      if (!actual) return res.status(404).json({ error: 'no_existe' });
      if (!puedeVer(actual, s)) return res.status(403).json({ error: 'no_es_tuyo' });

      const cambios = {};

      if (d.etapa) {
        if (!ETAPAS.includes(d.etapa)) return res.status(400).json({ error: 'etapa_invalida' });
        cambios.etapa = d.etapa;
      }

      // repartir contactos es cosa de administradores
      if (typeof d.responsable === 'string') {
        if (!esAdmin(s)) return res.status(403).json({ error: 'solo_admin' });
        if (d.responsable) {
          const u = await store.obtenerUsuario(d.responsable);
          if (!u || u.activo === false) return res.status(400).json({ error: 'responsable_invalido' });
          cambios.responsable = u.email;
          cambios.responsableNombre = u.nombre || u.email;
        } else {
          cambios.responsable = '';
          cambios.responsableNombre = '';
        }
      }

      if (d.nota) {
        cambios.notas = (actual.notas || []).concat([{
          texto: String(d.nota).slice(0, 1000),
          autor: s.email,
          fecha: new Date().toISOString()
        }]);
      }

      if (d.perfil && typeof d.perfil === 'object') {
        // solo números, y acotado: nada de guardar lo que llegue tal cual
        const limpio = {};
        for (const grupo of ['ingresos', 'gastos', 'deudas', 'activos', 'empresa']) {
          const g = d.perfil[grupo];
          if (!g || typeof g !== 'object') continue;
          limpio[grupo] = {};
          for (const k of Object.keys(g).slice(0, 20)) {
            const n = parseFloat(String(g[k]).replace(/[^\d.-]/g, ''));
            if (!isNaN(n)) limpio[grupo][String(k).slice(0, 30)] = n;
          }
        }
        limpio.actualizado = new Date().toISOString();
        limpio.por = s.email;
        cambios.perfil = limpio;
      }

      // rastro de quién tocó la ficha por última vez
      cambios.tocadoPor = s.email;

      const lead = await store.actualizar(d.id, cambios);
      if (!lead) return res.status(404).json({ error: 'no_existe' });
      return res.status(200).json({ lead });
    }

    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('leads', e);
    return res.status(500).json({ error: 'error_interno' });
  }
};
