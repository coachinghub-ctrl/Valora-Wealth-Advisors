/* =========================================================
   POST /api/lead — recibe el formulario y lo envía por correo.
   Variables de entorno en Vercel:
     RESEND_API_KEY  clave de Resend
     LEAD_TO         destino, p.ej. info@valorawealthadvisors.com
     LEAD_FROM       remitente verificado, p.ej. VALORA <web@valorawealthadvisors.com>
   ========================================================= */

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').slice(0, 400);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  let d = req.body;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  d = d || {};

  // trampa anti-spam: si viene lleno, fingimos éxito y no hacemos nada
  if (d.empresa) return res.status(200).json({ ok: true });

  const email = String(d.email || '').trim();
  const telefono = String(d.telefono || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) || telefono.length < 6) {
    return res.status(400).json({ error: 'datos_incompletos' });
  }

  const key = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_TO;
  const from = process.env.LEAD_FROM;
  if (!key || !to || !from) {
    console.error('lead: faltan RESEND_API_KEY / LEAD_TO / LEAD_FROM');
    return res.status(500).json({ error: 'no_configurado' });
  }

  const nombre = [d.nombre, d.apellido].filter(Boolean).join(' ') || 'Sin nombre';
  const filas = [
    ['Nombre', nombre],
    ['WhatsApp / Teléfono', telefono],
    ['Email', email],
    ['Qué le interesa', d.interes],
    ['Dónde reside', d.residencia],
    ['Página', d.pagina]
  ];

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#081D42;padding:28px">
      <div style="max-width:560px;margin:auto;background:#fff;border-radius:6px;padding:28px">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:.2em;color:#A8873A;text-transform:uppercase">
          Nuevo diagnóstico solicitado
        </p>
        <h1 style="margin:0 0 22px;font-size:22px;color:#081D42">${esc(nombre)}</h1>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#3A4A66">
          ${filas.map(([k, v]) => `
            <tr>
              <td style="padding:10px 0;border-top:1px solid #eee;width:38%;color:#6B7B94">${esc(k)}</td>
              <td style="padding:10px 0;border-top:1px solid #eee">${esc(v) || '—'}</td>
            </tr>`).join('')}
        </table>
        <p style="margin:24px 0 0;font-size:12px;color:#6B7B94">
          Compromiso: responder por WhatsApp en menos de 24 horas.
        </p>
      </div>
    </div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: to.split(',').map((s) => s.trim()),
        reply_to: email,
        subject: `VALORA · Nuevo diagnóstico — ${nombre}`,
        html
      })
    });
    if (!r.ok) {
      console.error('resend', r.status, await r.text());
      return res.status(502).json({ error: 'envio_fallido' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('lead', e);
    return res.status(500).json({ error: 'error_interno' });
  }
};
