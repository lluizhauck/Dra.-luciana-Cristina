/* =====================================================================
   assets.js — imagens do site do cliente (arquivos virtuais "img/...").
   São SVG embutidos para tudo funcionar offline. Os nomes (com pastas)
   são os caminhos que o aluno precisa acertar no src.
   ===================================================================== */
(function () {
  'use strict';
  function svg(txt) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(txt); }

  var tigela = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" width="320" height="240">' +
    '<rect width="320" height="240" fill="#fbf6ee"/>' +
    '<ellipse cx="160" cy="206" rx="118" ry="12" fill="#e7d9c4"/>' +
    '<path d="M42 112 Q160 96 278 112 Q270 196 160 204 Q50 196 42 112Z" fill="#c8794a"/>' +
    '<path d="M42 112 Q160 96 278 112 Q276 126 160 128 Q44 126 42 112Z" fill="#a85f36"/>' +
    '<ellipse cx="160" cy="110" rx="118" ry="22" fill="#3d1533"/>' +
    '<path d="M64 104 Q120 70 160 92 Q200 66 256 104 Q200 118 160 116 Q110 120 64 104Z" fill="#5e2a50"/>' +
    '<g fill="#f6e7a8" stroke="#d9b75a" stroke-width="2">' +
    '<circle cx="118" cy="96" r="13"/><circle cx="146" cy="88" r="13"/><circle cx="176" cy="92" r="13"/>' +
    '</g><g fill="#e2c568"><circle cx="118" cy="96" r="4"/><circle cx="146" cy="88" r="4"/><circle cx="176" cy="92" r="4"/></g>' +
    '<g fill="#b9864b"><rect x="196" y="96" width="8" height="6" rx="2"/><rect x="210" y="100" width="7" height="5" rx="2"/>' +
    '<rect x="202" y="106" width="8" height="5" rx="2"/><rect x="220" y="94" width="6" height="5" rx="2"/><rect x="186" y="104" width="7" height="5" rx="2"/>' +
    '<rect x="228" y="104" width="7" height="5" rx="2"/></g>' +
    '<path d="M96 108 Q130 100 150 110" stroke="#e9b949" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<path d="M246 60 Q262 30 290 26 Q282 54 252 66Z" fill="#2e6a3e"/><path d="M250 64 L284 30" stroke="#1f4a2b" stroke-width="2"/>' +
    '</svg>';

  var logo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 64" width="240" height="64">' +
    '<circle cx="32" cy="32" r="26" fill="#f6e7c8"/>' +
    '<path d="M14 30 Q32 26 50 30 Q48 48 32 50 Q16 48 14 30Z" fill="#c8794a"/>' +
    '<ellipse cx="32" cy="30" rx="18" ry="5" fill="#5e2a50"/>' +
    '<circle cx="27" cy="27" r="3.5" fill="#f6e7a8"/><circle cx="35" cy="26" r="3.5" fill="#f6e7a8"/>' +
    '<path d="M42 16 Q46 8 54 7 Q52 15 44 18Z" fill="#7fbf7f"/>' +
    '<text x="66" y="30" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#f6e7c8">Açaí &amp; Cia</text>' +
    '<text x="67" y="48" font-family="Georgia, serif" font-size="11" letter-spacing="2" fill="#e9b949">DESDE 2019 · SÃO LUÍS</text>' +
    '</svg>';

  window.Lab.registrarAssets({
    'img/tigela-acai.svg': svg(tigela),
    'img/logo.svg': svg(logo)
  });
})();
