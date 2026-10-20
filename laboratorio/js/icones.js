/* =====================================================================
   icones.js — ícones SVG inline, todos em traço fino (1.6px), 24x24.
   Uso: Lab.icone('play') → string SVG; Lab.iconeEl('play') → elemento.
   No HTML: <span data-icone="play"></span> é preenchido ao carregar.
   ===================================================================== */
(function () {
  'use strict';
  var P = {
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    chat: '<path d="M4 5.5h16v10H9.5L5 19.5v-4H4z"/>',
    ajuda: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6"/><path d="M12 16.6v.4"/>',
    mapa: '<path d="M4 6.5l5-2 6 2 5-2v13l-5 2-6-2-5 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
    diario: '<path d="M6 4h11a1 1 0 0 1 1 1v15H7a1 1 0 0 1-1-1z"/><path d="M6 17h12M9.5 8h5M9.5 11h5"/>',
    relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    fechar: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    celular: '<rect x="7.5" y="3.5" width="9" height="17" rx="2"/><path d="M11 17.5h2"/>',
    tablet: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M11 17.5h2"/>',
    desktop: '<rect x="3.5" y="4.5" width="17" height="11" rx="1.5"/><path d="M9 19.5h6M12 15.5v4"/>',
    ajustar: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/>',
    inspecionar: '<path d="M5 4.5l13 5-5.5 2-2 5.5z"/><path d="M13 13l5 5"/>',
    recarregar: '<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19 4.5V8h-3.5"/>',
    seta: '<path d="M9 6l6 6-6 6"/>',
    voltar: '<path d="M15 6l-6 6 6 6"/>',
    cadeado: '<rect x="6" y="10.5" width="12" height="9" rx="1.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    sair: '<path d="M14 4.5H6.5v15H14"/><path d="M11 12h9M17 9l3 3-3 3"/>',
    arquivo: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4"/>',
    alerta: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5M12 17v.3"/>',
    nuvem: '<path d="M7.5 18.5h9.5a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7.5 18.5z"/>',
    terminal: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M7.5 10l2.5 2-2.5 2M12 14.5h4"/>',
    olho: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    lista: '<path d="M9 7h11M9 12h11M9 17h11"/><path d="M4.5 7h.5M4.5 12h.5M4.5 17h.5"/>',
    banco: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
    usuario: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5a7 7 0 0 1 14 0"/>',
    raio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17"/><circle cx="12" cy="12" r="3.5"/>'
  };
  function icone(nome, classe) {
    return '<svg class="ico ' + (classe || '') + '" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[nome] || '') + '</svg>';
  }
  function iconeEl(nome, classe) {
    var s = document.createElement('span');
    s.className = 'ico-caixa';
    s.innerHTML = icone(nome, classe);
    return s.firstChild;
  }
  function preencher(raiz) {
    Array.prototype.forEach.call((raiz || document).querySelectorAll('[data-icone]'), function (n) {
      if (!n.firstChild || n.firstChild.nodeName !== 'svg') n.insertAdjacentHTML('afterbegin', icone(n.getAttribute('data-icone')));
    });
  }
  window.Lab = window.Lab || {};
  window.Lab.icone = icone;
  window.Lab.iconeEl = iconeEl;
  window.Lab.preencherIcones = preencher;
  document.addEventListener('DOMContentLoaded', function () { preencher(); });
})();
