/* =========================================================
   POST /api/lead
   Recibe tanto el formulario de la portada como el diagnóstico
   de /agenda, califica el lead en el servidor y lo envía por correo.

   Variables de entorno en Vercel:
     RESEND_API_KEY  clave de Resend
     LEAD_TO         destino, p.ej. info@valorawealthadvisors.com
     LEAD_FROM       remitente verificado, p.ej. VALORA <web@valorawealthadvisors.com>
   ========================================================= */

const store = require('./_store');

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').slice(0, 400);

/* El puntaje se recalcula aquí: lo que llega del navegador no se usa. */
const TABLA = {
  ruta:     { 'Personal y familiar': 1, 'Empresarial': 2, 'Los dos': 3 },
  objetivo: { 'Proteger a mi familia si yo falto': 2, 'Hacer crecer mi dinero': 2,
              'Prepararme para el retiro': 2, 'Proteger la continuidad de mi empresa': 3,
              'Todavía no lo tengo claro': 1 },
  etapa:    { 'Empezando · sin hijos': 1, 'Con hijos pequeños': 3,
              'Hijos en colegio o universidad': 3, 'Cerca del retiro': 2,
              'Arrancando · aún soy yo solo': 1, 'En crecimiento · con equipo': 3,
              'Consolidada · con socios': 3, 'Pensando en la salida o la sucesión': 3 },
  estatus:  { 'Ciudadano': 3, 'Residente · green card': 3, 'Visa de trabajo': 2,
              'ITIN': 2, 'Vivo fuera de USA': 2, 'Prefiero conversarlo': 1 },
  presupuesto: { 'Menos de $100': 1, '$100 – $250': 2, '$250 – $500': 3,
                 'Más de $500': 4, 'Aún no lo sé': 1 },
  urgencia: { 'Este mes': 4, 'En los próximos 3 meses': 2, 'Solo estoy explorando': 0 }
};
const MAXIMO = 20;

function calificar(r) {
  if (!r || typeof r !== 'object') return null;
  let total = 0;
  for (const clave of Object.keys(TABLA)) total += TABLA[clave][r[clave]] || 0;
  const nivel = total >= 15 ? 'PRIORITARIO' : total >= 9 ? 'SEGUIMIENTO' : 'NUTRIR';
  return { total, maximo: MAXIMO, nivel };
}

const COLOR = { PRIORITARIO: '#1F7A4C', SEGUIMIENTO: '#A8873A', NUTRIR: '#6B7B94' };

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  let d = req.body;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  d = d || {};

  // trampa anti-spam: si viene llena, fingimos éxito y no hacemos nada
  if (d.empresa) return res.status(200).json({ ok: true });

  const email = String(d.email || '').trim();
  const telefono = String(d.telefono || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) || telefono.length < 6) {
    return res.status(400).json({ error: 'datos_incompletos' });
  }

  const r = d.respuestas || null;
  const score = calificar(r);
  const esCita = d.origen === 'agenda';
  const nombre = [d.nombre, d.apellido].filter(Boolean).join(' ').trim() || 'Sin nombre';

  const filas = [
    ['Nombre', nombre],
    ['WhatsApp', telefono],
    ['Email', email]
  ];
  if (esCita && r) {
    filas.push(
      ['Cita solicitada', [r.dia, r.hora].filter(Boolean).join(' · ') + ' (ET)'],
      ['Patrimonio', r.ruta],
      ['Prioridad', r.objetivo],
      ['Momento', r.etapa],
      ['Reside en', r.residencia],
      ['Situación en USA', r.estatus],
      ['Capacidad mensual', r.presupuesto],
      ['Cuándo empezar', r.urgencia]
    );
    if (r.interes_inicial) filas.push(['Interés declarado en la web', r.interes_inicial]);
  } else {
    filas.push(['Qué le interesa', d.interes], ['Dónde reside', d.residencia]);
  }
  filas.push(['Página', d.pagina]);

  const cinta = score ? `
    <table style="width:100%;border-collapse:collapse;margin:0 0 22px">
      <tr><td style="background:${COLOR[score.nivel]};color:#fff;padding:11px 16px;border-radius:5px;
        font-size:12px;letter-spacing:.16em;font-weight:700">
        ${score.nivel} · ${score.total}/${score.maximo}
      </td></tr>
    </table>` : '';

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#081D42;padding:28px">
      <div style="max-width:580px;margin:auto;background:#fff;border-radius:6px;padding:28px">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:.2em;color:#A8873A;text-transform:uppercase">
          ${esCita ? 'Cita solicitada' : 'Nuevo contacto desde la web'}
        </p>
        <h1 style="margin:0 0 20px;font-size:22px;color:#081D42">${esc(nombre)}</h1>
        ${cinta}
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#3A4A66">
          ${filas.filter(([, v]) => v).map(([k, v]) => `
            <tr>
              <td style="padding:10px 0;border-top:1px solid #eee;width:40%;color:#6B7B94">${esc(k)}</td>
              <td style="padding:10px 0;border-top:1px solid #eee">${esc(v)}</td>
            </tr>`).join('')}
        </table>
        <p style="margin:24px 0 0;font-size:12px;color:#6B7B94">
          Compromiso: confirmar por WhatsApp en menos de 24 horas.
        </p>
      </div>
    </div>`;

  // 1) al CRM. Si el almacén falla, el correo sale igual: no perdemos el lead.
  let guardado = null;
  if (store.configurado()) {
    try {
      guardado = await store.guardarOFusionar({
        nombre, email, telefono,
        origen: esCita ? 'agenda' : 'formulario',
        interes: d.interes || null,
        residencia: (r && r.residencia) || d.residencia || null,
        respuestas: r || null,
        score,
        pagina: d.pagina || null
      });
    } catch (e) {
      console.error('lead: no se pudo guardar en el CRM', e);
    }
  }

  // 2) al correo del equipo
  const key = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_TO;
  const from = process.env.LEAD_FROM;
  if (!key || !to || !from) {
    console.error('lead: faltan RESEND_API_KEY / LEAD_TO / LEAD_FROM');
    // si al menos quedó en el CRM, para quien envía el formulario es un éxito
    if (guardado) return res.status(200).json({ ok: true, id: guardado.id, aviso: 'sin_correo' });
    return res.status(500).json({ error: 'no_configurado' });
  }

  const asunto = esCita
    ? `[${score ? score.nivel : 'SIN CALIFICAR'}] Cita — ${nombre}`
    : `VALORA · Nuevo contacto — ${nombre}`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: to.split(',').map((s) => s.trim()),
        reply_to: email,
        subject: asunto,
        html
      })
    });
    if (!resp.ok) {
      console.error('resend', resp.status, await resp.text());
      return res.status(502).json({ error: 'envio_fallido' });
    }
    return res.status(200).json({ ok: true, nivel: score ? score.nivel : null, id: guardado ? guardado.id : null });
  } catch (e) {
    console.error('lead', e);
    return res.status(500).json({ error: 'error_interno' });
  }
};
