/* =========================================================
   VALORA — interacciones de la página
   ========================================================= */
(function () {
  'use strict';

  /* Número de WhatsApp del equipo, en formato internacional sin signos.
     Déjalo vacío y el botón «Hablar con un estratega» lleva al formulario. */
  var WHATSAPP = '';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- header ---------- */
  var hdr = $('#hdr');
  var onScroll = function () { hdr.classList.toggle('scrolled', window.scrollY > 24); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var burger = $('#burger');
  burger.addEventListener('click', function () {
    var open = hdr.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  });
  $$('#nav a, .hdr .btn').forEach(function (a) {
    a.addEventListener('click', function () {
      hdr.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    });
  });

  /* ---------- reveal ---------- */
  var items = $$('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e, i) {
        if (!e.isIntersecting) return;
        var el = e.target;
        setTimeout(function () { el.classList.add('in'); }, Math.min(i, 4) * 70);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- FAQ ---------- */
  $$('.faq-item').forEach(function (item) {
    var btn = $('.faq-q', item);
    var ans = $('.faq-a', item);
    btn.addEventListener('click', function () {
      var open = item.classList.contains('open');
      $$('.faq-item.open').forEach(function (o) {
        o.classList.remove('open');
        $('.faq-q', o).setAttribute('aria-expanded', 'false');
        $('.faq-a', o).style.maxHeight = '';
      });
      if (!open) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        ans.style.maxHeight = ans.scrollHeight + 'px';
      }
    });
  });
  window.addEventListener('resize', function () {
    var open = $('.faq-item.open');
    if (open) $('.faq-a', open).style.maxHeight = $('.faq-a', open).scrollHeight + 'px';
  });

  /* ---------- WhatsApp ---------- */
  if (WHATSAPP) {
    $$('[data-wa]').forEach(function (a) {
      a.href = 'https://wa.me/' + WHATSAPP + '?text=' +
        encodeURIComponent('Hola, quiero hablar con un estratega de VALORA.');
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }

  /* ---------- formulario ---------- */
  var form = $('#lead-form');
  var msg  = $('#form-msg');
  var send = $('#lead-submit');
  var label = send.innerHTML;

  var show = function (kind, html) {
    msg.className = 'form-msg ' + kind;
    msg.innerHTML = html;
  };

  var contactLine = function () {
    return WHATSAPP
      ? ' Escríbenos por <a href="https://wa.me/' + WHATSAPP + '" target="_blank" rel="noopener">WhatsApp</a>.'
      : ' Escríbenos a <a href="mailto:info@valoraprotection.com">info@valoraprotection.com</a>.';
  };

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();

    var bad = false;
    $$('.field', form).forEach(function (f) {
      var input = $('input,select', f);
      if (!input || !input.required) return;
      var ok = input.value.trim() !== '' &&
               (input.type !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(input.value.trim()));
      f.classList.toggle('err', !ok);
      if (!ok && !bad) { bad = true; input.focus(); }
    });
    if (bad) { show('bad', 'Revisa los campos marcados: necesitamos tu teléfono, tu email y tus dos selecciones.'); return; }

    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = String(v).trim(); });
    data.pagina = location.href;

    send.disabled = true;
    send.innerHTML = 'Enviando…';
    msg.className = 'form-msg';

    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error((res.body && res.body.error) || 'error');
        form.reset();
        show('ok', '<b>Recibido.</b> Un VALORA Partner Agent te contactará en menos de 24 horas por WhatsApp. Gracias por confiar en nosotros.');
      })
      .catch(function () {
        show('bad', 'No pudimos enviar tu solicitud en este momento.' + contactLine());
      })
      .then(function () {
        send.disabled = false;
        send.innerHTML = label;
      });
  });

  $$('#lead-form input, #lead-form select').forEach(function (i) {
    i.addEventListener('input', function () { i.closest('.field').classList.remove('err'); });
  });
})();
