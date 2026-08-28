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
  var yo = null;
  var equipo = [];
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

  function entrar(usuario) {
    yo = usuario || yo;
    gate.hidden = true;
    app.hidden = false;
    if (yo) {
      $('#cr-yo').innerHTML = '<b>' + esc(yo.nombre || yo.email) + '</b>' +
        '<span>' + (yo.rol === 'admin' ? 'Administrador' : 'Agente') + '</span>';
      $('#cr-equipo').hidden = yo.rol !== 'admin';
    }
    cargar();
    if (yo && yo.rol === 'admin') cargarEquipo();
  }

  $('#cr-login').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var btn = $('#cr-enter'), msg = $('#cr-gate-msg');
    btn.disabled = true; btn.textContent = 'Comprobando…'; msg.textContent = '';
    fetch('/api/sesion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('#cr-email').value.trim(), clave: $('#cr-pass').value })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok) return entrar(res.j.usuario);
        msg.textContent =
          res.j.error === 'no_configurado' ? 'El panel no está configurado: falta ADMIN_SECRET en Vercel.'
          : res.j.error === 'sin_almacen'  ? 'Falta conectar el almacén de contactos en Vercel.'
          : 'Correo o contraseña incorrectos.';
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
      .then(function (d) { leads = d.leads || []; if (d.yo) yo = Object.assign({}, yo, d.yo); pintar(); })
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
    var extra = [r.ruta, r.presupuesto, r.residencia || l.residencia].filter(Boolean).join(' · ');
    var cita = r.dia ? '📅 ' + r.dia + ' · ' + (r.hora || '') : '';
    return '<button class="cr-card" data-id="' + esc(l.id) + '">' +
      '<div class="cr-card-top"><b>' + esc(l.nombre || 'Sin nombre') + '</b>' +
        '<span class="cr-tag ' + nivel + '">' + (nivel === 'SIN' ? 'sin calificar' : nivel) + '</span></div>' +
      '<p>' + esc(linea) + (extra ? '<br>' + esc(extra) : '') + '</p>' +
      (cita ? '<p class="cr-when">' + esc(cita) + '</p>' : '') +
      '<p class="cr-when">' + esc(hace(l.creado)) +
        (l.responsableNombre ? ' · ' + esc(l.responsableNombre) : '') + '</p>' +
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

  /* ---------- equipo ---------- */
  var team = $('#cr-team');

  function cargarEquipo() {
    return fetch('/api/usuarios')
      .then(function (r) { return r.ok ? r.json() : { usuarios: [] }; })
      .then(function (d) { equipo = d.usuarios || []; pintarEquipo(); });
  }

  function pintarEquipo() {
    var cont = $('#cr-team-list');
    if (!cont) return;
    cont.innerHTML = equipo.map(function (u) {
      var yoMismo = yo && u.email === yo.email;
      return '<div class="cr-user' + (u.activo ? '' : ' inactivo') + '">' +
        '<span class="cr-u-datos"><b>' + esc(u.nombre || u.email) + '</b>' +
          '<small>' + esc(u.email) + '</small></span>' +
        '<select data-email="' + esc(u.email) + '" class="cr-rol"' + (yoMismo ? ' disabled' : '') + '>' +
          '<option value="agente"' + (u.rol === 'agente' ? ' selected' : '') + '>Agente</option>' +
          '<option value="admin"' + (u.rol === 'admin' ? ' selected' : '') + '>Administrador</option>' +
        '</select>' +
        (yoMismo ? '' :
          '<button class="cr-toggle" data-email="' + esc(u.email) + '" data-activo="' + u.activo + '">' +
            (u.activo ? 'Desactivar' : 'Reactivar') + '</button>') +
      '</div>';
    }).join('') || '<p class="cr-p-when">Todavía no hay nadie más.</p>';

    $$('.cr-rol', cont).forEach(function (sel) {
      sel.addEventListener('change', function () {
        guardarUsuario({ email: sel.dataset.email, rol: sel.value });
      });
    });
    $$('.cr-toggle', cont).forEach(function (b) {
      b.addEventListener('click', function () {
        guardarUsuario({ email: b.dataset.email, activo: b.dataset.activo !== 'true' });
      });
    });
  }

  function guardarUsuario(cambios) {
    return fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok && res.j.error === 'ultimo_admin') {
          alert('No puedes dejar el sistema sin ningún administrador activo.');
        }
        return cargarEquipo();
      });
  }

  $('#cr-equipo').addEventListener('click', function () {
    team.hidden = false; document.body.style.overflow = 'hidden'; cargarEquipo();
  });
  $('#cr-team-close').addEventListener('click', function () {
    team.hidden = true; document.body.style.overflow = '';
  });

  $('#cr-team-new').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var msg = $('#nu-msg');
    msg.textContent = '';
    fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: $('#nu-nombre').value.trim(),
        email: $('#nu-email').value.trim(),
        rol: $('#nu-rol').value,
        clave: $('#nu-clave').value
      })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) {
          msg.textContent =
            res.j.error === 'ya_existe'   ? 'Ese correo ya tiene cuenta.'
            : res.j.error === 'clave_corta' ? 'La contraseña necesita al menos 10 caracteres.'
            : res.j.error === 'email_invalido' ? 'Ese correo no es válido.'
            : 'No se pudo crear la cuenta.';
          return;
        }
        msg.textContent = 'Cuenta creada. Pásale la contraseña por un canal seguro.';
        $('#cr-team-new').reset();
        cargarEquipo();
      });
  });

  $('#cr-mi-clave').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var msg = $('#mc-msg');
    msg.textContent = '';
    fetch('/api/sesion', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claveActual: $('#mc-actual').value, clave: $('#mc-nueva').value })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        msg.textContent = res.ok ? 'Contraseña cambiada.'
          : res.j.error === 'clave_corta' ? 'Necesita al menos 10 caracteres.'
          : 'La contraseña actual no es correcta.';
        if (res.ok) $('#cr-mi-clave').reset();
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
        fila('Patrimonio', r.ruta) + fila('Prioridad', r.objetivo) + fila('Momento', r.etapa) +
        fila('Situación en USA', r.estatus) + fila('Capacidad mensual', r.presupuesto) +
        fila('Cuándo empezar', r.urgencia) +
        fila('Cita solicitada', r.dia ? r.dia + ' · ' + (r.hora || '') : '') : '') +

      (l.interes ? '<p class="cr-p-sec">Interés declarado</p>' + fila('En la web', l.interes) : '') +

      (yo && yo.rol === 'admin'
        ? '<p class="cr-p-sec">Responsable</p>' +
          '<select class="cr-p-stage" id="cr-resp">' +
            '<option value="">Sin asignar</option>' +
            equipo.filter(function (u) { return u.activo; }).map(function (u) {
              return '<option value="' + esc(u.email) + '"' +
                (l.responsable === u.email ? ' selected' : '') + '>' +
                esc(u.nombre || u.email) + '</option>';
            }).join('') +
          '</select>'
        : (l.responsableNombre
            ? '<p class="cr-p-sec">Responsable</p>' + fila('Asignado a', l.responsableNombre)
            : '')) +

      '<p class="cr-p-sec">Etapa</p>' +
      '<select class="cr-p-stage" id="cr-stage">' +
        ETAPAS.map(function (e) {
          return '<option value="' + e[0] + '"' + ((l.etapa || 'nuevo') === e[0] ? ' selected' : '') + '>' + esc(e[1]) + '</option>';
        }).join('') +
      '</select>' +

      '<p class="cr-p-sec">Archivos</p>' +
      '<div class="cr-files" id="cr-files">' +
        ((l.archivos || []).length
          ? l.archivos.map(function (a, i) {
              return '<div class="cr-file">' +
                '<a href="/api/archivos?lead=' + encodeURIComponent(l.id) + '&i=' + i + '">' +
                  esc(a.nombre) + '</a>' +
                '<small>' + Math.round((a.tamano || 0) / 1024) + ' KB · ' + esc(hace(a.fecha)) + '</small>' +
                '<button class="cr-file-x" data-i="' + i + '" aria-label="Borrar">✕</button>' +
              '</div>';
            }).join('')
          : '<p class="cr-p-when">Sin archivos todavía.</p>') +
      '</div>' +
      '<label class="cr-file-add" for="cr-file-in">Subir archivo<input id="cr-file-in" type="file" ' +
        'accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.txt,.csv,.docx,.xlsx"></label>' +
      '<p class="cr-p-msg" id="cr-file-msg">Máximo 3 MB. Solo el equipo puede abrirlos.</p>' +

      '<p class="cr-p-sec">Notas</p>' +
      '<div class="cr-notes">' +
        ((l.notas || []).length
          ? l.notas.slice().reverse().map(function (n) {
              return '<div class="cr-note">' + esc(n.texto) +
                '<time>' + esc(hace(n.fecha)) +
                (n.autor ? ' <span class="cr-nota-autor">· ' + esc(n.autor) + '</span>' : '') +
                '</time></div>';
            }).join('')
          : '<p class="cr-p-when">Sin notas todavía.</p>') +
      '</div>' +
      '<textarea class="cr-note-new" id="cr-note" placeholder="Qué se habló, próximos pasos…"></textarea>' +
      '<button class="btn btn-gold cr-p-save" id="cr-save">Guardar</button>' +
      '<p class="cr-p-msg" id="cr-save-msg"></p>' +
      '<button class="cr-p-diag" id="cr-diag">Sesión de diagnóstico · perfil financiero</button>';

    panel.hidden = false;
    veil.hidden = false;
    $('#cr-save').addEventListener('click', guardar);
    $('#cr-file-in').addEventListener('change', subirArchivo);
    $$('.cr-file-x').forEach(function (b) {
      b.addEventListener('click', function () { borrarArchivo(Number(b.dataset.i)); });
    });
    $('#cr-diag').addEventListener('click', function () { abrirPerfil(l); });
  }

  /* ---------- archivos del cliente ---------- */
  function refrescar(lead) {
    leads = leads.map(function (x) { return x.id === lead.id ? lead : x; });
    pintar();
    abrir(lead.id);
  }

  function subirArchivo(ev) {
    var f = ev.target.files && ev.target.files[0];
    if (!f || !abierto) return;
    var msg = $('#cr-file-msg');
    if (f.size > 3 * 1024 * 1024) { msg.textContent = 'Ese archivo pasa de 3 MB.'; return; }
    msg.textContent = 'Subiendo…';

    var lector = new FileReader();
    lector.onload = function () {
      var datos = String(lector.result).split(',')[1];
      fetch('/api/archivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: abierto.id, nombre: f.name, tipo: f.type, datos: datos })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j.error || '');
          refrescar(res.j.lead);
        })
        .catch(function (e) {
          $('#cr-file-msg').textContent =
            /tipo_no_admitido/.test(e.message) ? 'Ese tipo de archivo no se admite.'
            : /sin_blob/.test(e.message) ? 'Falta conectar el almacén de archivos en Vercel.'
            : 'No se pudo subir.';
        });
    };
    lector.readAsDataURL(f);
  }

  function borrarArchivo(i) {
    if (!abierto || !confirm('¿Borrar este archivo? No se puede deshacer.')) return;
    fetch('/api/archivos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: abierto.id, i: i })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.lead) refrescar(j.lead); });
  }

  function guardar() {
    if (!abierto) return;
    var btn = $('#cr-save'), msg = $('#cr-save-msg');
    var cambios = { id: abierto.id, etapa: $('#cr-stage').value };
    var resp = $('#cr-resp');
    if (resp) cambios.responsable = resp.value;
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

  /* =========================================================
     Sesión de diagnóstico · perfil financiero
     ========================================================= */
  var BLOQUES = [
    ['Ingresos del hogar', 'ingresos', [
      ['titular',  'Ingreso neto mensual (titular)'],
      ['pareja',   'Ingreso neto de la pareja'],
      ['otros',    'Otros ingresos']
    ]],
    ['Gastos fijos', 'gastos', [
      ['vivienda',  'Renta o hipoteca'],
      ['servicios', 'Servicios y teléfono'],
      ['comida',    'Alimentación'],
      ['transporte','Transporte y auto'],
      ['educacion', 'Colegios y educación'],
      ['seguros',   'Seguros actuales'],
      ['otros',     'Otros gastos']
    ]],
    ['Pagos de deuda al mes', 'deudas', [
      ['tarjetas',   'Tarjetas de crédito'],
      ['auto',       'Préstamo de auto'],
      ['personal',   'Préstamo personal'],
      ['estudiantil','Préstamo estudiantil']
    ]],
    ['Lo que ya tiene', 'activos', [
      ['ahorro',     'Ahorro disponible'],
      ['retiro',     '401(k) o retiro'],
      ['deudaTotal', 'Saldo total de deudas'],
      ['coberturaActual', 'Cobertura de vida actual']
    ]],
    ['La empresa · si la hay', 'empresa', [
      ['valor',      'Valor estimado del negocio'],
      ['participacion', 'Valor de su participación'],
      ['socios',     'Nº de socios'],
      ['deudaEmp',   'Deuda de la empresa'],
      ['retiroEmp',  'Retiro mensual del negocio']
    ]]
  ];

  var hoja = $('#cr-sheet');
  var perfilDe = null;

  function num(v) { var n = parseFloat(String(v).replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; }
  function money(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function abrirPerfil(l) {
    perfilDe = l;
    var p = l.perfil || {};
    $('#cr-sheet-name').textContent = l.nombre || 'Sin nombre';

    $('#cr-sheet-cols').innerHTML = BLOQUES.map(function (b) {
      var datos = p[b[1]] || {};
      return '<section class="cr-bloque"><h3>' + esc(b[0]) + '</h3>' +
        b[2].map(function (c) {
          var esDinero = c[0] !== 'socios';
          return '<div class="cr-linea"><label for="f-' + b[1] + '-' + c[0] + '">' + esc(c[1]) + '</label>' +
            '<span class="' + (esDinero ? 'cr-money' : 'cr-cifra') + '">' +
            '<input id="f-' + b[1] + '-' + c[0] + '" type="text" inputmode="decimal" ' +
            'data-g="' + b[1] + '" data-c="' + c[0] + '" value="' + (datos[c[0]] || '') + '"></span></div>';
        }).join('') +
        '<div class="cr-sub"><span>Subtotal</span><b data-sub="' + b[1] + '">$0</b></div>' +
      '</section>';
    }).join('');

    $$('#cr-sheet-cols input').forEach(function (i) {
      i.addEventListener('input', calcular);
    });
    calcular();
    hoja.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function leerPerfil() {
    var p = {};
    $$('#cr-sheet-cols input').forEach(function (i) {
      p[i.dataset.g] = p[i.dataset.g] || {};
      if (i.value.trim()) p[i.dataset.g][i.dataset.c] = i.value.trim();
    });
    return p;
  }

  function calcular() {
    var p = leerPerfil();
    var suma = function (g) {
      return Object.keys(p[g] || {}).reduce(function (t, k) { return t + num(p[g][k]); }, 0);
    };

    var ingreso = suma('ingresos');
    var gasto   = suma('gastos');
    var deuda   = suma('deudas');
    var ahorro  = num((p.activos || {}).ahorro);
    var partic  = num((p.empresa || {}).participacion);
    var deudaEmp= num((p.empresa || {}).deudaEmp);
    var socios  = num((p.empresa || {}).socios);
    var deudaTotal = num((p.activos || {}).deudaTotal);
    var cobActual  = num((p.activos || {}).coberturaActual);

    BLOQUES.forEach(function (b) {
      var el = $('[data-sub="' + b[1] + '"]');
      if (!el) return;
      if (b[1] === 'activos') el.textContent = money(ahorro + num((p.activos || {}).retiro));
      else if (b[1] === 'empresa') el.textContent = money(num((p.empresa || {}).valor));
      else el.textContent = money(suma(b[1]));
    });

    var excedente = ingreso - gasto - deuda;
    var tasa   = ingreso ? excedente / ingreso : 0;
    var carga  = ingreso ? deuda / ingreso : 0;
    var meses  = (gasto + deuda) ? ahorro / (gasto + deuda) : 0;

    // prima sugerida: la mitad del excedente, con techo del 15% del ingreso
    var prima = Math.max(0, Math.min(excedente * 0.5, ingreso * 0.15));
    // cobertura: deudas + diez años de ingreso del titular, menos lo que ya tiene
    var titular = num((p.ingresos || {}).titular);
    var cobertura = Math.max(0, deudaTotal + titular * 12 * 10 - cobActual);

    var luz = function (v, bien, ojo, alRevés) {
      var ok = alRevés ? v <= bien : v >= bien;
      var med = alRevés ? v <= ojo : v >= ojo;
      return ok ? 'bien' : med ? 'ojo' : 'mal';
    };

    $('#cr-resumen').innerHTML =
      '<div class="cr-kpi"><p>Ingreso del hogar</p><b>' + money(ingreso) + '</b>' +
        '<small>Gastos ' + money(gasto) + ' · deuda ' + money(deuda) + '</small></div>' +

      '<div class="cr-kpi destacado"><p>Capacidad de ahorro</p><b>' + money(excedente) + '</b>' +
        '<small>Lo que queda libre cada mes</small></div>' +

      '<div class="cr-kpi"><p>Prima sugerida</p><b>' + money(prima) + '</b>' +
        '<small>Mitad del excedente, con techo del 15% del ingreso</small></div>' +

      '<div class="cr-kpi"><p>Cobertura a cubrir</p><b>' + money(cobertura) + '</b>' +
        '<small>Deudas + diez años de ingreso, menos la cobertura actual</small></div>' +

      (partic ? '<div class="cr-kpi"><p>A cubrir en la empresa</p><b>' +
          money(partic + deudaEmp) + '</b><small>Su participación más la deuda del negocio' +
          (socios ? ' · ' + socios + (socios === 1 ? ' socio' : ' socios') : '') +
          '. Es el monto que un Buy-Sell debería financiar.</small></div>' : '') +

      '<div class="cr-ratios">' +
        '<div class="cr-ratio"><i class="cr-luz ' + luz(tasa, .15, .05) + '"></i>' +
          '<span>Tasa de ahorro</span><b>' + Math.round(tasa * 100) + '%</b></div>' +
        '<div class="cr-ratio"><i class="cr-luz ' + luz(carga, .20, .36, true) + '"></i>' +
          '<span>Carga de deuda</span><b>' + Math.round(carga * 100) + '%</b></div>' +
        '<div class="cr-ratio"><i class="cr-luz ' + luz(meses, 6, 3) + '"></i>' +
          '<span>Colchón de emergencia</span><b>' + meses.toFixed(1) + ' meses</b></div>' +
      '</div>';
  }

  function cerrarPerfil() {
    hoja.hidden = true;
    document.body.style.overflow = '';
    perfilDe = null;
  }
  $('#cr-sheet-close').addEventListener('click', cerrarPerfil);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !hoja.hidden) cerrarPerfil(); });

  $('#cr-sheet-save').addEventListener('click', function () {
    if (!perfilDe) return;
    var btn = $('#cr-sheet-save');
    btn.disabled = true; btn.textContent = 'Guardando…';
    fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: perfilDe.id, perfil: leerPerfil() })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error();
        leads = leads.map(function (x) { return x.id === res.j.lead.id ? res.j.lead : x; });
        pintar();
        btn.textContent = 'Guardado';
        setTimeout(function () { btn.textContent = 'Guardar perfil'; }, 1600);
      })
      .catch(function () { btn.textContent = 'No se pudo guardar'; })
      .then(function () { btn.disabled = false; });
  });

  /* ---------- arranque: ¿ya hay sesión? ---------- */
  fetch('/api/sesion')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { if (d && d.ok) entrar(d.usuario); })
    .catch(function () {});
})();
