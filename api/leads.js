/* GET /api/leads          → listado
   PATCH /api/leads        → { id, etapa?, nota?, responsable? } */
const { autorizado } = require('./_auth');
const store = require('./_store');

const ETAPAS = ['nuevo', 'contactado', 'agendado', 'propuesta', 'ganado', 'perdido'];

module.exports = async (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'no_autorizado' });
  if (!store.configurado()) return res.status(500).json({ error: 'sin_almacen' });

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ leads: await store.listar() });
    }

    if (req.method === 'PATCH') {
      let d = req.body;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
      d = d || {};
      if (!d.id) return res.status(400).json({ error: 'falta_id' });

      const cambios = {};
      if (d.etapa) {
        if (!ETAPAS.includes(d.etapa)) return res.status(400).json({ error: 'etapa_invalida' });
        cambios.etapa = d.etapa;
      }
      if (typeof d.responsable === 'string') cambios.responsable = d.responsable.slice(0, 80);

      if (d.nota) {
        const actual = await store.obtener(d.id);
        if (!actual) return res.status(404).json({ error: 'no_existe' });
        cambios.notas = (actual.notas || []).concat([{
          texto: String(d.nota).slice(0, 1000),
          fecha: new Date().toISOString()
        }]);
      }

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
