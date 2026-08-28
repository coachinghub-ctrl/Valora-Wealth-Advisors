/* =========================================================
   VALORA — diagnóstico por pasos y solicitud de cita
   ========================================================= */
(function () {
  'use strict';

  var WHATSAPP = '';                     // mismo número que en script.js
  var HORAS = ['9:00 am', '11:00 am', '2:00 pm', '4:00 pm', '6:00 pm'];
  var DIAS_VISIBLES = 12;

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var pasos   = $$('.ag-step');
  var total   = 8;
  var actual  = 1;
  var ruta    = 'personal';   // la elige la primera pregunta

  // hay pantallas que solo existen para una de las dos rutas
  function aplica(el) {
    if (el.classList.contains('solo-personal')) return ruta === 'personal';
    if (el.classList.contains('solo-empresa'))  return ruta === 'empresa' || ruta === 'ambos';
    return true;
  }
  var datos   = {};
  var puntos  = {};

  /* ---------- navegación ---------- */
  var barra = $('#ag-bar-fill'), num = $('#ag-n'), prog = $('#ag-progress');
  var prev  = $('#ag-prev');

  function pintar() {
    pasos.forEach(function (p) {
      p.classList.toggle('is-on', Number(p.dataset.step) === actual && aplica(p));
    });
    $$('.ag-opt').forEach(function (o) { o.hidden = !aplica(o); });
    barra.style.width = (actual / total * 100) + '%';
    num.textContent = actual;
    prog.setAttribute('aria-valuenow', String(actual));
    prev.hidden = actual === 1;
    var vivo = $('.ag-step.is-on');
    if (vivo) vivo.scrollIntoView({ block: 'nearest' });
  }

  function ir(n) {
    actual = Math.max(1, Math.min(total, n));
    pintar();
  }

  prev.addEventListener('click', function () { ir(actual - 1); });

  /* ---------- opciones de un toque ---------- */
  $$('.ag-opt').forEach(function (b) {
    b.addEventListener('click', function () {
      var paso = b.closest('.ag-step');
      var clave = paso.dataset.key;
      $$('.ag-opt', paso).forEach(function (o) { o.classList.remove('is-sel'); });
      b.classList.add('is-sel');
      datos[clave]  = b.dataset.value;
      puntos[clave] = Number(b.dataset.score || 0);
      if (b.dataset.ruta) ruta = b.dataset.ruta;
      setTimeout(function () { ir(actual + 1); }, 220);
    });
  });

  /* ---------- residencia ---------- */
  var res = $('#ag-res');
  var resBtn = $('.ag-step[data-step="3"] .ag-next');
  res.addEventListener('change', function () {
    resBtn.disabled = !res.value;
    datos.residencia = res.value;
  });
  resBtn.addEventListener('click', function () { if (res.value) ir(actual + 1); });

  /* ---------- días y horas ---------- */
  var SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  (function dias() {
    var cont = $('#ag-days');
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    var puestos = 0;
    while (puestos < DIAS_VISIBLES) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === 0) continue;                     // sin domingos
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ag-chip ag-day';
      b.dataset.value = SEM[d.getDay()] + ' ' + d.getDate() + ' ' + MES[d.getMonth()];
      b.innerHTML = '<span>' + SEM[d.getDay()] + '</span><b>' + d.getDate() + '</b><small>' + MES[d.getMonth()] + '</small>';
      cont.appendChild(b);
      puestos++;
    }
  })();

  (function horas() {
    var cont = $('#ag-times');
    HORAS.forEach(function (h) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ag-chip ag-time';
      b.dataset.value = h;
      b.textContent = h;
      cont.appendChild(b);
    });
  })();

  function elegir(sel, clave) {
    $$(sel).forEach(function (b) {
      b.addEventListener('click', function () {
        $$(sel).forEach(function (o) { o.classList.remove('is-sel'); });
        b.classList.add('is-sel');
        datos[clave] = b.dataset.value;
      });
    });
  }
  elegir('.ag-day', 'dia');
  elegir('.ag-time', 'hora');

  /* ---------- datos que vengan del formulario de la portada ---------- */
  try {
    var guardado = JSON.parse(sessionStorage.getItem('valora_lead') || '{}');
    if (guardado.nombre || guardado.apellido) {
      $('#ag-nombre').value = [guardado.nombre, guardado.apellido].filter(Boolean).join(' ');
    }
    if (guardado.telefono) $('#ag-tel').value = guardado.telefono;
    if (guardado.email)    $('#ag-email').value = guardado.email;
    if (guardado.interes)  datos.interes_inicial = guardado.interes;
    if (guardado.residencia && res) {
      res.value = guardado.residencia;
      if (res.value) { datos.residencia = res.value; resBtn.disabled = false; }
    }
  } catch (e) { /* sessionStorage puede estar bloqueado */ }

  /* ---------- recomendación ---------- */
  function recomendar() {
    var o = datos.objetivo || '', e = datos.etapa || '', p = datos.presupuesto || '';
    if (ruta === 'empresa' || ruta === 'ambos') {
      return ['VALORA Strategy',
        'Tu patrimonio personal y el de tu empresa no pueden diseñarse por separado. ' +
        'Trabajaremos la continuidad del negocio, los acuerdos entre socios y tu propia ' +
        'salida dentro de una sola estructura.'];
    }
    if (/Más de \$500/.test(p) || /colegio o universidad/.test(e) || /no lo tengo claro/.test(o)) {
      return ['VALORA Strategy',
        'Tu situación pide una estructura completa: protección y acumulación diseñadas juntas, ' +
        'con revisión cada año a medida que cambia tu vida.'];
    }
    if (/crecer mi dinero|retiro/.test(o) || /Cerca del retiro/.test(e)) {
      return ['VALORA Accumulation',
        'Lo tuyo es que cada dólar tenga doble función: proteger y construir valor en efectivo ' +
        'que puedas usar en vida, con piso del 0%.'];
    }
    return ['VALORA Protection',
      'Lo primero es la red de seguridad: que tu familia mantenga su ingreso y su estilo de vida ' +
      'pase lo que pase.'];
  }

  /* ---------- envío ---------- */
  var form = $('#ag-form');
  var msg  = $('#ag-msg');
  var send = $('#ag-send');
  var etiqueta = send.innerHTML;

  function aviso(kind, html) { msg.className = 'form-msg ' + kind; msg.innerHTML = html; }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();

    var nombre = $('#ag-nombre').value.trim();
    var tel    = $('#ag-tel').value.trim();
    var email  = $('#ag-email').value.trim();
    var faltan = [];
    if (!datos.dia)  faltan.push('el día');
    if (!datos.hora) faltan.push('la hora');
    if (nombre.length < 3) faltan.push('tu nombre');
    if (tel.length < 6) faltan.push('tu WhatsApp');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) faltan.push('un email válido');
    if (faltan.length) {
      aviso('bad', 'Nos falta ' + faltan.join(', ').replace(/, ([^,]*)$/, ' y $1') + '.');
      return;
    }

    var cuerpo = {
      origen: 'agenda',
      nombre: nombre,
      telefono: tel,
      email: email,
      empresa: $('#ag-trap').value,
      respuestas: datos,
      puntos: puntos,
      pagina: location.href
    };

    send.disabled = true;
    send.innerHTML = 'Enviando…';
    msg.className = 'form-msg';

    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (r) { if (!r.ok) throw new Error('error'); terminar(); })
      .catch(function () {
        aviso('bad', 'No pudimos enviar tu solicitud.' + (WHATSAPP
          ? ' Escríbenos por <a href="https://wa.me/' + WHATSAPP + '" target="_blank" rel="noopener">WhatsApp</a>.'
          : ' Escríbenos a <a href="mailto:info@valorawealthadvisors.com">info@valorawealthadvisors.com</a>.'));
        send.disabled = false;
        send.innerHTML = etiqueta;
      });
  });

  function terminar() {
    var reco = recomendar();
    $('#ag-done-when').textContent = datos.dia + ' · ' + datos.hora + ' (hora de Miami)';
    $('#ag-reco-name').textContent = reco[0];
    $('#ag-reco-text').textContent = reco[1];
    form.hidden = true;
    prog.hidden = true;
    prev.hidden = true;
    $('#ag-done').hidden = false;
    try { sessionStorage.removeItem('valora_lead'); } catch (e) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  pintar();
})();
