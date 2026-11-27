// Quien entra a sion.cd.com.py sin sesión y sin una dirección interna ve la página pública (/inicio).
// La app instalada, los enlaces internos (#/...), el TV y quien ya ingresó van directo al sistema.
(function(){
  try {
    if (location.hash.length > 1 || /cast=1/.test(location.search)) return;
    if (localStorage.getItem('idd_token')) return;
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
    location.replace('/inicio');
  } catch (e) { /* sin acceso al almacenamiento: queda en el sistema */ }
})();
