/* =====================================================================
   realce.js — realce de sintaxe próprio (HTML, CSS e JS), sem bibliotecas.
   Cada tokenizador devolve uma lista [{c: classe, t: texto}] que preserva
   o texto original caractere por caractere. Depois a lista é quebrada em
   linhas (<span class="l">), para permitir sublinhar erros por linha.
   ===================================================================== */
(function () {
  'use strict';

  function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ------------------------------------------------------------------ JS
  var KW = /^(var|let|const|function|return|if|else|for|while|do|break|continue|new|this|typeof|instanceof|in|of|switch|case|default|try|catch|finally|throw|class|extends|import|export|async|await|null|undefined|true|false)$/;
  function tokJS(src) {
    var out = [], i = 0, n = src.length, m;
    var re = {
      espaco: /^\s+/, linha: /^\/\/[^\n]*/, bloco: /^\/\*[\s\S]*?(\*\/|$)/,
      str: /^(["'])(?:\\.|(?!\1)[^\\\n])*\1?/, tpl: /^`(?:\\.|[^\\`])*`?/,
      num: /^(?:0x[\da-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i, id: /^[A-Za-z_$][\w$]*/
    };
    while (i < n) {
      var r = src.slice(i);
      if ((m = re.espaco.exec(r))) out.push({ c: '', t: m[0] });
      else if ((m = re.linha.exec(r)) || (m = re.bloco.exec(r))) out.push({ c: 't-com', t: m[0] });
      else if ((m = re.str.exec(r)) || (m = re.tpl.exec(r))) out.push({ c: 't-str', t: m[0] });
      else if ((m = re.num.exec(r))) out.push({ c: 't-num', t: m[0] });
      else if ((m = re.id.exec(r))) {
        var depois = r.slice(m[0].length);
        var c = KW.test(m[0]) ? 't-kw' : /^\s*\(/.test(depois) ? 't-fn' : /^(document|window|console|localStorage|JSON|Math)$/.test(m[0]) ? 't-obj' : '';
        out.push({ c: c, t: m[0] });
      } else out.push({ c: /[{}()[\];,.]/.test(r[0]) ? 't-pon' : 't-op', t: r[0] });
      i += out[out.length - 1].t.length;
    }
    return out;
  }

  // ----------------------------------------------------------------- CSS
  function tokCSS(src) {
    var out = [], i = 0, n = src.length, prof = 0, emValor = false, m;
    while (i < n) {
      var r = src.slice(i);
      if ((m = /^\s+/.exec(r))) out.push({ c: '', t: m[0] });
      else if ((m = /^\/\*[\s\S]*?(\*\/|$)/.exec(r))) out.push({ c: 't-com', t: m[0] });
      else if ((m = /^(["'])(?:\\.|(?!\1)[^\\\n])*\1?/.exec(r))) out.push({ c: 't-str', t: m[0] });
      else if (r[0] === '{') { prof++; emValor = false; out.push({ c: 't-pon', t: '{' }); }
      else if (r[0] === '}') { prof = Math.max(0, prof - 1); emValor = false; out.push({ c: 't-pon', t: '}' }); }
      else if (r[0] === ';') { emValor = false; out.push({ c: 't-pon', t: ';' }); }
      else if (prof > 0 && !emValor && /^[^;{}]*\{/.test(r) && !/^\s*[\w-]+\s*:[^;{}]*;/.test(r)) {
        m = /^[^{]+/.exec(r);
        out.push({ c: 't-sel', t: m[0] });
      }
      else if (r[0] === ':' && prof > 0 && !emValor) { emValor = true; out.push({ c: 't-pon', t: ':' }); }
      else if (prof === 0) {
        m = /^@[\w-]+/.exec(r) || /^[^{};\/"']+/.exec(r) || /^./.exec(r);
        out.push({ c: m[0][0] === '@' ? 't-kw' : 't-sel', t: m[0] });
      } else if (!emValor) {
        m = /^[^:;{}\/\s"']+/.exec(r) || /^./.exec(r);
        out.push({ c: 't-prop', t: m[0] });
      } else if ((m = /^#[\da-f]{3,8}\b/i.exec(r)) || (m = /^-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?/i.exec(r))) out.push({ c: 't-num', t: m[0] });
      else if ((m = /^!important/i.exec(r))) out.push({ c: 't-kw', t: m[0] });
      else if ((m = /^[\w-]+(?=\()/.exec(r))) out.push({ c: 't-fn', t: m[0] });
      else if ((m = /^[\w-]+/.exec(r))) out.push({ c: 't-val', t: m[0] });
      else out.push({ c: 't-pon', t: r[0] });
      i += out[out.length - 1].t.length;
    }
    return out;
  }

  // ---------------------------------------------------------------- HTML
  function tokHTML(src) {
    var out = [], i = 0, n = src.length, m;
    while (i < n) {
      var r = src.slice(i);
      if ((m = /^<!--[\s\S]*?(-->|$)/.exec(r))) { out.push({ c: 't-com', t: m[0] }); i += m[0].length; continue; }
      if ((m = /^<!doctype[^>]*>?/i.exec(r))) { out.push({ c: 't-dt', t: m[0] }); i += m[0].length; continue; }
      if ((m = /^<\/?[a-zA-Z][\w-]*/.exec(r))) {
        var nome = m[0].replace(/^<\/?/, '').toLowerCase();
        var fecha = m[0][1] === '/';
        out.push({ c: 't-pon', t: fecha ? '</' : '<' });
        out.push({ c: 't-tag', t: m[0].slice(fecha ? 2 : 1) });
        i += m[0].length;
        // atributos até o '>'
        while (i < n && src[i] !== '>' && !(src[i] === '<')) {
          r = src.slice(i);
          if ((m = /^\s+/.exec(r))) out.push({ c: '', t: m[0] });
          else if ((m = /^[^\s=>"'\/<]+/.exec(r))) out.push({ c: 't-attr', t: m[0] });
          else if ((m = /^=/.exec(r))) out.push({ c: 't-pon', t: '=' });
          else if ((m = /^(["'])[^]*?(\1|$)/.exec(r))) {
            var q = m[0], fim = q.indexOf(q[0], 1);
            q = fim === -1 ? q.split('\n')[0] : q.slice(0, fim + 1);
            out.push({ c: 't-str', t: q });
          } else out.push({ c: 't-pon', t: r[0] });
          i += out[out.length - 1].t.length;
        }
        if (src[i] === '>') { out.push({ c: 't-pon', t: '>' }); i++; }
        // conteúdo de <style> e <script>
        if (!fecha && (nome === 'style' || nome === 'script')) {
          var fimTag = src.slice(i).search(new RegExp('</' + nome + '\\s*>', 'i'));
          var corpo = fimTag === -1 ? src.slice(i) : src.slice(i, i + fimTag);
          out = out.concat(nome === 'style' ? tokCSS(corpo) : tokJS(corpo));
          i += corpo.length;
        }
        continue;
      }
      if ((m = /^&[#\w]+;/.exec(r))) { out.push({ c: 't-ent', t: m[0] }); i += m[0].length; continue; }
      m = /^[^<&]+/.exec(r) || /^./.exec(r);
      out.push({ c: 't-txt', t: m[0] });
      i += m[0].length;
    }
    return out;
  }

  /** quebra tokens em linhas → array de strings HTML (uma por linha) */
  function linhas(tokens) {
    var res = [''];
    tokens.forEach(function (tk) {
      var partes = tk.t.split('\n');
      partes.forEach(function (p, k) {
        if (k > 0) res.push('');
        if (p) res[res.length - 1] += tk.c ? '<span class="' + tk.c + '">' + esc(p) + '</span>' : esc(p);
      });
    });
    return res;
  }

  var TOK = { html: tokHTML, css: tokCSS, js: tokJS };

  window.Lab = window.Lab || {};
  window.Lab.realce = {
    /** → array com o HTML de cada linha */
    linhas: function (texto, linguagem) {
      var f = TOK[linguagem] || function (t) { return [{ c: '', t: t }]; };
      return linhas(f(texto));
    }
  };
})();
