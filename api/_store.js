/* =========================================================
   Almacén de leads sobre Upstash Redis (Vercel KV) por REST.
   Sin dependencias: solo fetch. Variables de entorno:
     KV_REST_API_URL
     KV_REST_API_TOKEN
   ========================================================= */

const URL_BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

const CLAVE_INDICE = 'valora:leads';
const clave = (id) => `valora:lead:${id}`;
const claveEmail = (e) => `valora:email:${String(e).toLowerCase().trim()}`;

function configurado() {
  return Boolean(URL_BASE && TOKEN);
}

async function pipeline(comandos) {
  const r = await fetch(`${URL_BASE}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(comandos)
  });
  if (!r.ok) throw new Error(`kv ${r.status}: ${await r.text()}`);
  const salida = await r.json();
  return salida.map((x) => (x && 'result' in x ? x.result : null));
}

function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* Guarda un lead nuevo y lo indexa por fecha. */
async function guardar(lead) {
  const id = lead.id || nuevoId();
  const registro = { ...lead, id, creado: lead.creado || new Date().toISOString() };
  await pipeline([
    ['SET', clave(id), JSON.stringify(registro)],
    ['ZADD', CLAVE_INDICE, String(Date.parse(registro.creado)), id]
  ]);
  return registro;
}

/* Devuelve los leads más recientes primero. */
async function listar(limite = 300) {
  const [ids] = await pipeline([['ZRANGE', CLAVE_INDICE, '0', String(limite - 1), 'REV']]);
  if (!Array.isArray(ids) || !ids.length) return [];
  const [valores] = await pipeline([['MGET', ...ids.map(clave)]]);
  return (valores || [])
    .map((v) => { try { return JSON.parse(v); } catch { return null; } })
    .filter(Boolean);
}

async function obtener(id) {
  const [v] = await pipeline([['GET', clave(id)]]);
  try { return v ? JSON.parse(v) : null; } catch { return null; }
}

/* Aplica cambios parciales: etapa, nota nueva, responsable. */
async function actualizar(id, cambios) {
  const actual = await obtener(id);
  if (!actual) return null;
  const siguiente = { ...actual, ...cambios, id: actual.id, creado: actual.creado,
                      actualizado: new Date().toISOString() };
  await pipeline([['SET', clave(id), JSON.stringify(siguiente)]]);
  return siguiente;
}

/* Un mismo correo no crea dos fichas: el diagnóstico completa la del
   formulario en vez de duplicarla. */
async function guardarOFusionar(lead) {
  const email = lead.email;
  let previo = null;
  if (email) {
    const [id] = await pipeline([['GET', claveEmail(email)]]);
    if (id) previo = await obtener(id);
  }

  if (previo) {
    const cambios = { ...lead, id: previo.id, creado: previo.creado };
    // no pisamos lo que ya sabíamos con campos vacíos
    Object.keys(cambios).forEach((k) => {
      if (cambios[k] === undefined || cambios[k] === '' || cambios[k] === null) delete cambios[k];
    });
    cambios.respuestas = { ...(previo.respuestas || {}), ...(lead.respuestas || {}) };
    cambios.etapa = previo.etapa || 'nuevo';
    return actualizar(previo.id, cambios);
  }

  const registro = await guardar({ ...lead, etapa: lead.etapa || 'nuevo', notas: [] });
  if (email) await pipeline([['SET', claveEmail(email), registro.id]]);
  return registro;
}

module.exports = { configurado, guardar, guardarOFusionar, listar, obtener, actualizar, nuevoId };
