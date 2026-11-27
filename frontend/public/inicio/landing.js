// Landing de SION Music: menú en el teléfono, formulario "Solicitar información" e instalación como app (PWA).
(function(){
  'use strict';
  var $ = function(id){ return document.getElementById(id); };

  /* ---------- Menú en el teléfono ---------- */
  var menu = $('menubtn'), links = document.querySelector('.links');
  if (menu && links) {
    menu.addEventListener('click', function(){ var on = links.classList.toggle('mobile'); menu.setAttribute('aria-expanded', on); });
    links.addEventListener('click', function(e){ if (e.target.closest('a')) { links.classList.remove('mobile'); menu.setAttribute('aria-expanded', 'false'); } });
  }

  /* ---------- Menú: marca la sección visible ---------- */
  var navLinks = links ? links.querySelectorAll('a[href^="#"]') : [];
  if ('IntersectionObserver' in window && navLinks.length) {
    var mark = function(id){ navLinks.forEach(function(a){ a.classList.toggle('on', a.getAttribute('href') === '#' + id); }); };
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) mark(e.target.id); }); }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(function(a){ var s = document.querySelector(a.getAttribute('href')); if (s) io.observe(s); });
  }

  /* ---------- Planes: completa el mensaje del formulario ---------- */
  document.querySelectorAll('[data-plan]').forEach(function(b){
    b.addEventListener('click', function(){
      var f = $('askform');
      if (f && !f.message.value.trim()) f.message.value = 'Me interesa el plan de ' + b.getAttribute('data-plan') + '. ¿Cuál es el precio para nuestra iglesia?';
      setTimeout(function(){ f && f.name.focus({ preventScroll: true }); }, 600);
    });
  });

  /* ---------- Solicitar información ---------- */
  var form = $('askform'), msg = $('formmsg'), done = $('askdone');
  if (form) form.addEventListener('submit', function(e){
    e.preventDefault();
    var d = {}; new FormData(form).forEach(function(v, k){ d[k] = String(v).trim(); });
    msg.textContent = '';
    if (!d.name) { msg.textContent = 'Contanos tu nombre.'; form.name.focus(); return; }
    if (!d.phone && !d.email) { msg.textContent = 'Dejanos un WhatsApp o un correo para contactarte.'; form.phone.focus(); return; }
    var btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Enviando…';
    fetch('/api/public/info-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) throw new Error(j.error || 'No se pudo enviar'); }); })
      .then(function(){ form.hidden = true; done.hidden = false; done.scrollIntoView({ behavior: 'smooth', block: 'center' }); })
      .catch(function(err){ msg.textContent = (err.message || 'No se pudo enviar') + ' Probá de nuevo o escribinos por WhatsApp.'; })
      .then(function(){ btn.disabled = false; btn.textContent = 'Enviar solicitud →'; });
  });

  /* ---------- Instalar como app (PWA) ---------- */
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) { location.replace('/#/'); return; } // la app instalada abre directo el sistema
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function(){});

  var ua = navigator.userAgent;
  var ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var iosSafari = ios && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  var card = $('pwa'), go = $('pwa-go'), chips = document.querySelectorAll('[data-install]');
  var deferred = null, KEY = 'sion_pwa_later';
  var snoozed = function(){ try { return Date.now() < Number(localStorage.getItem(KEY) || 0); } catch (e) { return false; } };

  function show(force){
    if (!card || (!force && snoozed())) return;
    $('pwa-ios').hidden = !(ios && !deferred);
    go.hidden = ios && !deferred;
    $('pwa-later').textContent = ios && !deferred ? 'Entendido' : 'Ahora no';
    card.hidden = false; document.body.classList.add('pwa-on');
  }
  function hide(snooze){
    card.hidden = true; document.body.classList.remove('pwa-on');
    if (snooze) try { localStorage.setItem(KEY, String(Date.now() + 5 * 86400000)); } catch (e) { /* */ }
  }
  function showChips(){ chips.forEach(function(c){ c.hidden = false; }); }

  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault(); deferred = e; showChips();
    setTimeout(function(){ show(false); }, 2500);
  });
  window.addEventListener('appinstalled', function(){ deferred = null; hide(false); chips.forEach(function(c){ c.hidden = true; }); });
  if (iosSafari) { showChips(); setTimeout(function(){ show(false); }, 3500); }

  go && go.addEventListener('click', function(){
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function(r){ if (r && r.outcome === 'accepted') hide(false); }).catch(function(){});
    deferred = null;
  });
  $('pwa-later') && $('pwa-later').addEventListener('click', function(){ hide(true); });
  $('pwa-x') && $('pwa-x').addEventListener('click', function(){ hide(true); });
  chips.forEach(function(c){ c.addEventListener('click', function(){ if (deferred) go.click(); else show(true); }); });
})();
