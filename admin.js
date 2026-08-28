/* =========================================================
   VALORA Operating System — panel interno
   ========================================================= */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var ETAPAS = [
    ['nuevo',      'Nuevo'],
    ['contactado', 'Contactado'],
    ['agendado',   'Diagnóstico agendado'],
    ['propuesta',  'Propuesta enviada'],
    ['ganado',     'Cliente'],
    ['perdido',    'Perdido']
  ];

  var leads = [];
  var filtroNivel = '';
  var busqueda = '';
  var abierto = null;

  /* ---------- utilidades ---------- */
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hace(iso) {
    if (!iso) return '';
    var min = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (isNaN(min)) return '';
    if (min < 1) return 'ahora mismo';
    if (min < 60) return 'hace ' + min + ' min';
    var h = Math.round(min / 60);
    if (h < 24) return 'hace ' + h + ' h';
    var d = Math.round(h / 24);
    return d === 1 ? 'ayer' : 'hace ' + d + ' días';
  }

  function tel(t) { return String(t || '').replace(/[^\d]/g, ''); }

  /* ---------- puerta ---------- */
  var gate = $('#cr-gate'), app = $('#cr-app');

  function entrar() {
    gate.hidden = true;
    app.hidden = false;
    cargar();
  }

  $('#cr-login').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var btn = $('#cr-enter'), msg = $('#cr-gate-msg');
    btn.disabled = true; btn.textContent = 'Comprobando…'; msg.textContent = '';
    fetch('/api/sesion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave: $('#cr-pass').value })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok) return entrar();
        msg.textContent = res.j.error === 'no_configurado'
          ? 'El panel no está configurado. Faltan ADMIN_PASSWORD y ADMIN_SECRET en Vercel.'
          : 'Contraseña incorrecta.';
      })
      .catch(function () { msg.textContent = 'No se pudo conectar.'; })
      .then(function () { btn.disabled = false; btn.textContent = 'Entrar'; });
  });

  $('#cr-out').addEventListener('click', function () {
    fetch('/api/sesion', { method: 'DELETE' }).then(function () { location.reload(); });
  });

  /* ---------- datos ---------- */
  function cargar() {
    fetch('/api/leads')
      .then(function (r) {
        if (r.status === 401) { app.hidden = true; gate.hidden = false; throw new Error('401'); }
        return r.json();
      })
      .then(function (d) { leads = d.leads || []; pintar(); })
      .catch(function () {});
  }

  $('#cr-refresh').addEventListener('click', cargar);

  /* ---------- tablero ---------- */
  function visibles() {
    var q = busqueda.toLowerCase();
    return leads.filter(function (l) {
      if (filtroNivel && (!l.score || l.score.nivel !== filtroNivel)) return false;
      if (!q) return true;
      return [l.nombre, l.email, l.telefono].join(' ').toLowerCase().indexOf(q) > -1;
    });
  }

  function pintar() {
    var lista = visibles();
    $('#cr-count').textContent = lista.length + (lista.length === 1 ? ' contacto' : ' contactos');
    $('#cr-empty').hidden = leads.length > 0;

    var board = $('#cr-board');
    board.innerHTML = ETAPAS.map(function (e) {
      var suyos = lista.filter(function (l) { return (l.etapa || 'nuevo') === e[0]; });
      return '<section class="cr-col" data-etapa="' + e[0] + '">' +
        '<div class="cr-col-h"><b>' + esc(e[1]) + '</b><i>' + suyos.length + '</i></div>' +
        '<div class="cr-cards">' + suyos.map(tarjeta).join('') + '</div>' +
      '</section>';
    }).join('');

    $$('.cr-card').forEach(function (c) {
      c.addEventListener('click', function () { abrir(c.dataset.id); });
    });
  }

  function tarjeta(l) {
    var nivel = (l.score && l.score.nivel) || 'SIN';
    var r = l.respuestas || {};
    var linea = r.objetivo || l.interes || '—';
    var extra = [r.presupuesto, r.residencia || l.residencia].filter(Boolean).join(' · ');
    var cita = r.dia ? '📅 ' + r.dia + ' · ' + (r.hora || '') : '';
    return '<button class="cr-card" data-id="' + esc(l.id) + '">' +
      '<div class="cr-card-top"><b>' + esc(l.nombre || 'Sin nombre') + '</b>' +
        '<span class="cr-tag ' + nivel + '">' + (nivel === 'SIN' ? 'sin calificar' : nivel) + '</span></div>' +
      '<p>' + esc(linea) + (extra ? '<br>' + esc(extra) : '') + '</p>' +
      (cita ? '<p class="cr-when">' + esc(cita) + '</p>' : '') +
      '<p class="cr-when">' + esc(hace(l.creado)) + '</p>' +
    '</button>';
  }

  $('#cr-search').addEventListener('input', function (e) { busqueda = e.target.value; pintar(); });
  $$('.cr-f').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.cr-f').forEach(function (o) { o.classList.remove('is-on'); });
      b.classList.add('is-on');
      filtroNivel = b.dataset.nivel;
      pintar();
    });
  });

  /* ---------- ficha ---------- */
  var panel = $('#cr-panel'), veil = $('#cr-veil');

  function cerrar() { panel.hidden = true; veil.hidden = true; abierto = null; }
  $('#cr-close').addEventListener('click', cerrar);
  veil.addEventListener('click', cerrar);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) cerrar(); });

  function fila(k, v) {
    return v ? '<div class="cr-p-row"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>' : '';
  }

  function abrir(id) {
    var l = leads.filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    abierto = l;
    var r = l.respuestas || {};
    var nivel = (l.score && l.score.nivel) || 'SIN';
    var wa = tel(l.telefono);

    $('#cr-panel-body').innerHTML =
      '<span class="cr-tag ' + nivel + '">' + (nivel === 'SIN' ? 'sin calificar' : nivel) +
        (l.score ? ' · ' + l.score.total + '/' + l.score.maximo : '') + '</span>' +
      '<h2 class="cr-p-name">' + esc(l.nombre || 'Sin nombre') + '</h2>' +
      '<p class="cr-p-when">Entró ' + esc(hace(l.creado)) + ' · ' + esc(l.origen || '') + '</p>' +

      '<div class="cr-p-acts">' +
        (wa ? '<a href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') +
        (l.email ? '<a href="mailto:' + esc(l.email) + '">Email</a>' : '') +
      '</div>' +

      '<p class="cr-p-sec">Contacto</p>' +
      fila('Teléfono', l.telefono) + fila('Email', l.email) +
      fila('Reside en', r.residencia || l.residencia) +

      (r.objetivo || r.presupuesto ? '<p class="cr-p-sec">Diagnóstico</p>' +
        fila('Prioridad', r.objetivo) + fila('Etapa de vida', r.etapa) +
        fila('Situación en USA', r.estatus) + fila('Capacidad mensual', r.presupuesto) +
        fila('Cuándo empezar', r.urgencia) +
        fila('Cita solicitada', r.dia ? r.dia + ' · ' + (r.hora || '') : '') : '') +

      (l.interes ? '<p class="cr-p-sec">Interés declarado</p>' + fila('En la web', l.interes) : '') +

      '<p class="cr-p-sec">Etapa</p>' +
      '<select class="cr-p-stage" id="cr-stage">' +
        ETAPAS.map(function (e) {
          return '<option value="' + e[0] + '"' + ((l.etapa || 'nuevo') === e[0] ? ' selected' : '') + '>' + esc(e[1]) + '</option>';
        }).join('') +
      '</select>' +

      '<p class="cr-p-sec">Notas</p>' +
      '<div class="cr-notes">' +
        ((l.notas || []).length
          ? l.notas.slice().reverse().map(function (n) {
              return '<div class="cr-note">' + esc(n.texto) +
                '<time>' + esc(hace(n.fecha)) + '</time></div>';
            }).join('')
          : '<p class="cr-p-when">Sin notas todavía.</p>') +
      '</div>' +
      '<textarea class="cr-note-new" id="cr-note" placeholder="Qué se habló, próximos pasos…"></textarea>' +
      '<button class="btn btn-gold cr-p-save" id="cr-save">Guardar</button>' +
      '<p class="cr-p-msg" id="cr-save-msg"></p>';

    panel.hidden = false;
    veil.hidden = false;
    $('#cr-save').addEventListener('click', guardar);
  }

  function guardar() {
    if (!abierto) return;
    var btn = $('#cr-save'), msg = $('#cr-save-msg');
    var cambios = { id: abierto.id, etapa: $('#cr-stage').value };
    var nota = $('#cr-note').value.trim();
    if (nota) cambios.nota = nota;

    btn.disabled = true; btn.textContent = 'Guardando…'; msg.textContent = '';
    fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error();
        leads = leads.map(function (x) { return x.id === res.j.lead.id ? res.j.lead : x; });
        pintar();
        abrir(res.j.lead.id);
        $('#cr-save-msg').textContent = 'Guardado.';
      })
      .catch(function () { msg.textContent = 'No se pudo guardar.'; })
      .then(function () { btn.disabled = false; btn.textContent = 'Guardar'; });
  }

  /* ---------- arranque: ¿ya hay sesión? ---------- */
  fetch('/api/sesion')
    .then(function (r) { if (r.ok) entrar(); })
    .catch(function () {});
})();
