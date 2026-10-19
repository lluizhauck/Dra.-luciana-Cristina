/* =====================================================================
   css-parser.js — leitor simples de CSS com números de linha.
   A função labParseCSS é autocontida (sem variáveis de fora) porque o
   motor também a injeta, como texto, dentro do iframe do preview.
   ===================================================================== */
function labParseCSS(texto, linhaBase) {
  'use strict';
  linhaBase = linhaBase || 1;
  var src = String(texto);
  // troca comentários por espaços, mantendo as quebras de linha (para as linhas baterem)
  var semCom = src.replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, ' '); });
  var regras = [];
  var comentarios = (src.match(/\/\*[\s\S]*?\*\//g) || []).length;

  function linhaDe(pos) {
    var n = 0;
    for (var i = 0; i < pos; i++) if (semCom.charCodeAt(i) === 10) n++;
    return linhaBase + n;
  }

  function lerBloco(ini, fim, media) {
    var i = ini;
    while (i < fim) {
      var abre = semCom.indexOf('{', i);
      if (abre === -1 || abre >= fim) break;
      var cab = semCom.slice(i, abre);
      // acha a chave que fecha (contando aninhamento)
      var prof = 1, j = abre + 1;
      while (j < fim && prof > 0) {
        var c = semCom.charAt(j);
        if (c === '{') prof++;
        else if (c === '}') prof--;
        j++;
      }
      var fecha = j - 1;
      var cabLimpo = cab.trim();
      var posCab = i + cab.search(/\S|$/);
      if (/^@media/i.test(cabLimpo) || /^@supports/i.test(cabLimpo)) {
        lerBloco(abre + 1, fecha, cabLimpo);
      } else if (cabLimpo.charAt(0) !== '@' && cabLimpo) {
        var corpo = semCom.slice(abre + 1, fecha);
        var decls = [];
        var k = 0, partes = corpo.split(';');
        var pos = abre + 1;
        partes.forEach(function (p) {
          var dois = p.indexOf(':');
          var limpo = p.trim();
          if (limpo) {
            var off = pos + p.search(/\S/);
            if (dois === -1) decls.push({ prop: limpo, valor: '', linha: linhaDe(off), semDoisPontos: true });
            else {
              var valor = p.slice(dois + 1).trim();
              var imp = /!important$/i.test(valor);
              decls.push({ prop: p.slice(0, dois).trim(), valor: valor.replace(/\s*!important$/i, ''), important: imp, linha: linhaDe(off) });
            }
          }
          pos += p.length + 1;
          k++;
        });
        regras.push({ seletor: cabLimpo.replace(/\s+/g, ' '), linha: linhaDe(posCab), fimLinha: linhaDe(fecha), media: media || '', decls: decls, aberta: prof > 0 });
      }
      i = fecha + 1;
    }
  }
  lerBloco(0, semCom.length, '');
  return { regras: regras, comentarios: comentarios };
}

/** normaliza um seletor para comparar o texto do CSS com o selectorText do navegador */
function labNormSeletor(s) {
  'use strict';
  return String(s || '').replace(/["']/g, '').replace(/\s*([,>+~])\s*/g, '$1').replace(/\s+/g, ' ').trim();
}

/** valida uma declaração usando o próprio navegador */
function labDeclValida(prop, valor) {
  'use strict';
  if (!prop || /^--/.test(prop)) return true;
  try {
    if (window.CSS && CSS.supports) return CSS.supports(prop, valor);
  } catch (e) { /* segue */ }
  var d = document.createElement('div').style;
  d.setProperty(prop, valor);
  return d.getPropertyValue(prop) !== '';
}

window.Lab = window.Lab || {};
window.Lab.css = { parse: labParseCSS, norm: labNormSeletor, valida: labDeclValida };
