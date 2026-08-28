/* =========================================================
   Archivos de la ficha del cliente, sobre Vercel Blob.

   POST    /api/archivos          { id, nombre, tipo, datos }  subir
   GET     /api/archivos?lead&i                                descargar
   DELETE  /api/archivos          { id, i }                    borrar

   Los ficheros NO se enlazan directamente: la URL del blob nunca sale
   del servidor. El panel los pide por este endpoint, que comprueba la
   sesión antes de devolver un solo byte.

   Variable de entorno: BLOB_READ_WRITE_TOKEN
   ========================================================= */
const { sesion, esAdmin } = require('./_auth');
const store = require('./_store');

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const API = 'https://blob.vercel-storage.com';
const MAX = 3 * 1024 * 1024;            // 3 MB: el cuerpo de la función no da para más
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
               'text/plain', 'text/csv',
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
               'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

const limpio = (n) => String(n || 'archivo').replace(/[^\w.\- ]+/g, '_').slice(0, 80);

function puede(lead, s) {
  return esAdmin(s) || lead.responsable === s.email;
}

module.exports = async (req, res) => {
  const s = sesion(req);
  if (!s) return res.status(401).json({ error: 'no_autorizado' });
  if (!store.configurado()) return res.status(500).json({ error: 'sin_almacen' });
  if (!TOKEN) return res.status(500).json({ error: 'sin_blob' });

  try {
    /* ---------- descargar ---------- */
    if (req.method === 'GET') {
      const { lead: id, i } = req.query || {};
      const lead = await store.obtener(id);
      if (!lead) return res.status(404).json({ error: 'no_existe' });
      if (!puede(lead, s)) return res.status(403).json({ error: 'no_es_tuyo' });
      const a = (lead.archivos || [])[Number(i)];
      if (!a) return res.status(404).json({ error: 'sin_archivo' });

      const r = await fetch(a.url);
      if (!r.ok) return res.status(502).json({ error: 'blob_no_responde' });
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader('Content-Type', a.tipo || 'application/octet-stream');
      res.setHeader('Content-Disposition',
        `attachment; filename="${limpio(a.nombre)}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).send(buf);
    }

    let d = req.body;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
    d = d || {};
    const lead = await store.obtener(d.id);
    if (!lead) return res.status(404).json({ error: 'no_existe' });
    if (!puede(lead, s)) return res.status(403).json({ error: 'no_es_tuyo' });

    /* ---------- subir ---------- */
    if (req.method === 'POST') {
      if (!TIPOS.includes(d.tipo)) return res.status(400).json({ error: 'tipo_no_admitido' });
      const bytes = Buffer.from(String(d.datos || ''), 'base64');
      if (!bytes.length) return res.status(400).json({ error: 'vacio' });
      if (bytes.length > MAX) return res.status(413).json({ error: 'demasiado_grande' });

      const ruta = `valora/${lead.id}/${Date.now()}-${limpio(d.nombre)}`;
      const r = await fetch(`${API}/${encodeURI(ruta)}`, {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${TOKEN}`,
          'x-api-version': '7',
          'x-content-type': d.tipo,
          'x-add-random-suffix': '1',
          'x-cache-control-max-age': '0'
        },
        body: bytes
      });
      if (!r.ok) {
        console.error('blob', r.status, await r.text());
        return res.status(502).json({ error: 'subida_fallida' });
      }
      const { url } = await r.json();

      const archivos = (lead.archivos || []).concat([{
        nombre: limpio(d.nombre), tipo: d.tipo, tamano: bytes.length,
        url, por: s.email, fecha: new Date().toISOString()
      }]);
      const guardado = await store.actualizar(lead.id, { archivos });
      return res.status(201).json({ lead: guardado });
    }

    /* ---------- borrar ---------- */
    if (req.method === 'DELETE') {
      const archivos = (lead.archivos || []).slice();
      const a = archivos[Number(d.i)];
      if (!a) return res.status(404).json({ error: 'sin_archivo' });
      await fetch(`${API}/delete`, {
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}`, 'x-api-version': '7',
                   'content-type': 'application/json' },
        body: JSON.stringify({ urls: [a.url] })
      }).catch(function () { /* si el blob ya no está, seguimos */ });
      archivos.splice(Number(d.i), 1);
      const guardado = await store.actualizar(lead.id, { archivos });
      return res.status(200).json({ lead: guardado });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('archivos', e);
    return res.status(500).json({ error: 'error_interno' });
  }
};
