/* =====================================================================
   preview.js — executa o código do aluno num iframe ISOLADO
   (sandbox="allow-scripts", sem allow-same-origin: o código do aluno não
   enxerga o laboratório nem o localStorage real).

   Como funciona:
   1. montarDocumento() junta index.html + CSS + JS num único srcdoc,
      resolvendo <link>, <script src> e <img src> pelos arquivos virtuais.
      Caminho errado = arquivo não encontrado (404), como num servidor real.
   2. Um "agente" é injetado no topo do documento. Ele captura console e
      erros, cria um localStorage falso (shim) que conversa com o
      laboratório via postMessage, intercepta links/formulários, faz a
      inspeção de elementos, o Raio-X e roda os validadores.
   3. Um mapa de linhas traduz "linha do srcdoc" → "arquivo:linha" do aluno.
   ===================================================================== */
(function () {
  'use strict';
  var Lab = window.Lab;
  var BASE_FALSA = 'about:blank'; // caminho relativo não resolvido falha na hora, sem tocar a rede

  // ---------------------------------------------------------- caminhos
  function ehExterno(c) { return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(c); }
  function resolver(baseArquivo, caminho) {
    caminho = String(caminho || '').trim().replace(/[?#].*$/, '');
    if (!caminho || ehExterno(caminho)) return null;
    var partes = caminho.charAt(0) === '/' ? [] : baseArquivo.split('/').slice(0, -1);
    caminho.replace(/^\/+/, '').split('/').forEach(function (p) {
      if (p === '' || p === '.') return;
      if (p === '..') partes.pop();
      else partes.push(p);
    });
    return partes.join('/');
  }

  function attr(tag, nome) {
    var re = new RegExp('\\s' + nome + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i');
    var m = re.exec(tag);
    return m ? (m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]) : null;
  }
  function temAttr(tag, nome) { return new RegExp('\\s' + nome + '(?=[\\s=>/])', 'i').test(tag); }

  function inicioLinhas(txt) {
    var r = [0];
    for (var i = 0; i < txt.length; i++) if (txt.charCodeAt(i) === 10) r.push(i + 1);
    return r;
  }
  function linhaEm(ini, pos) {
    var lo = 0, hi = ini.length - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (ini[mid] <= pos) lo = mid; else hi = mid - 1; }
    return lo + 1;
  }

  /** marca cada tag de abertura com data-lab-l="linha" (para Inspecionar e Raio-X) */
  function anotar(html) {
    var ini = inicioLinhas(html);
    var re = /<!--[\s\S]*?-->|<(script|style|textarea|title)\b[^>]*>[\s\S]*?<\/\1\s*>|<([a-zA-Z][a-zA-Z0-9-]*)(?=[\s>\/])/gi;
    return html.replace(re, function (m, cru, tag, off) {
      if (m.slice(0, 4) === '<!--') return m;
      var nome = cru || tag;
      return '<' + nome + ' data-lab-l="' + linhaEm(ini, off) + '"' + m.slice(1 + nome.length);
    });
  }

  function reescreverUrlsCss(css, arquivoCss, assets, naoEncontrados) {
    var ini = inicioLinhas(css);
    return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, function (m, q, url, off) {
      var r = resolver(arquivoCss, url);
      if (r === null) return m;
      if (assets[r]) return 'url("' + assets[r] + '")';
      naoEncontrados.push({ caminho: url, resolvido: r, tipo: 'imagem (CSS)', arquivo: arquivoCss, linha: linhaEm(ini, off) });
      return m;
    });
  }

  /**
   * arquivos: {nome: texto}; opcoes: {principal, assets, modo, token, armazenamento, sessao}
   * → {srcdoc, mapa, naoEncontrados}
   */
  function montarDocumento(arquivos, opcoes) {
    var principal = opcoes.principal || 'index.html';
    var assets = opcoes.assets || {};
    var naoEncontrados = [];
    var html = anotar(arquivos[principal] || '');
    var ini = inicioLinhas(html);
    var trocas = []; // {ini, fim, pecas:[{texto, arquivo, linha}]}
    var adiados = [];

    // <img src>
    html.replace(/<img\b[^>]*>/gi, function (tag, off) {
      var src = attr(tag, 'src');
      if (src === null) return tag;
      var r = resolver(principal, src);
      if (r === null) return tag;
      var linha = linhaEm(ini, off);
      if (assets[r]) {
        var novo = tag.replace(/(\ssrc\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '$1"' + assets[r] + '"');
        trocas.push({ ini: off, fim: off + tag.length, pecas: [{ texto: novo, arquivo: principal, linha: linha }] });
      } else {
        naoEncontrados.push({ caminho: src, resolvido: r, tipo: 'imagem', arquivo: principal, linha: linha });
      }
      return tag;
    });

    // <link rel="stylesheet" href>
    html.replace(/<link\b[^>]*>/gi, function (tag, off) {
      var rel = (attr(tag, 'rel') || '').toLowerCase();
      var href = attr(tag, 'href');
      if (rel.split(/\s+/).indexOf('stylesheet') === -1 || href === null) return tag;
      var linha = linhaEm(ini, off);
      var r = resolver(principal, href);
      if (r !== null && typeof arquivos[r] === 'string') {
        var css = reescreverUrlsCss(arquivos[r], r, assets, naoEncontrados);
        trocas.push({ ini: off, fim: off + tag.length, pecas: [
          { texto: '<style data-arquivo="' + r + '" data-lab-l="' + linha + '">\n', arquivo: null },
          { texto: css, arquivo: r, linha: 1 },
          { texto: '\n</style>', arquivo: null }
        ] });
      } else if (r !== null) {
        naoEncontrados.push({ caminho: href, resolvido: r, tipo: 'CSS', arquivo: principal, linha: linha });
      }
      return tag;
    });

    // <script src> (defer/async vão para o fim do body, como o navegador faria)
    html.replace(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi, function (bloco, attrs, off) {
      var tagAbre = '<script' + attrs + '>';
      var src = attr(tagAbre, 'src');
      if (src === null) return bloco;
      var linha = linhaEm(ini, off);
      var r = resolver(principal, src);
      if (r !== null && typeof arquivos[r] === 'string') {
        var outros = attrs.replace(/\s(src|defer|async)(\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '');
        var pecas = [
          { texto: '<script data-arquivo="' + r + '" data-lab-l="' + linha + '"' + outros + '>\n', arquivo: null },
          { texto: arquivos[r], arquivo: r, linha: 1 },
          { texto: '\n</script>', arquivo: null }
        ];
        if (temAttr(tagAbre, 'defer') || temAttr(tagAbre, 'async')) {
          trocas.push({ ini: off, fim: off + bloco.length, pecas: [] });
          adiados = adiados.concat([{ texto: '\n', arquivo: null }], pecas);
        } else {
          trocas.push({ ini: off, fim: off + bloco.length, pecas: pecas });
        }
      } else if (r !== null) {
        naoEncontrados.push({ caminho: src, resolvido: r, tipo: 'JavaScript', arquivo: principal, linha: linha });
      }
      return bloco;
    });

    if (adiados.length) {
      var posBody = html.search(/<\/body\s*>(?![\s\S]*<\/body\s*>)/i);
      if (posBody === -1) posBody = html.length;
      trocas.push({ ini: posBody, fim: posBody, pecas: adiados });
    }

    // agente logo depois do <!DOCTYPE> (antes dele quebraria o modo padrão)
    var dt = /^(\s*(?:<!--[\s\S]*?-->\s*)*<!doctype[^>]*>)/i.exec(html);
    var posAgente = dt ? dt[1].length : 0;
    var scriptAgente = '<base href="' + BASE_FALSA + '"><script>\n' + Lab.preview._codigoAgente + '\n(' + 'labAgente' + ')("__LAB_CFG__");\n</script>';
    trocas.push({ ini: posAgente, fim: posAgente, pecas: [{ texto: scriptAgente, arquivo: null }], primeiro: true });

    trocas.sort(function (a, b) { return a.ini - b.ini || (a.primeiro ? -1 : b.primeiro ? 1 : 0); });

    // monta as peças finais intercalando trechos do HTML
    var pecas = [], cursor = 0;
    trocas.forEach(function (t) {
      if (t.ini < cursor) return; // sobreposição (não deveria acontecer)
      if (t.ini > cursor) pecas.push({ texto: html.slice(cursor, t.ini), arquivo: principal, linha: linhaEm(ini, cursor) });
      pecas = pecas.concat(t.pecas);
      cursor = t.fim;
    });
    if (cursor < html.length) pecas.push({ texto: html.slice(cursor), arquivo: principal, linha: linhaEm(ini, cursor) });

    // junta tudo calculando a origem de cada linha do srcdoc
    var saida = [], mapa = [], linhaOut = 0, atual = '';
    pecas.forEach(function (p) {
      var partes = p.texto.split('\n');
      partes.forEach(function (parte, i) {
        if (i > 0) { saida.push(atual); atual = ''; linhaOut++; }
        if (mapa[linhaOut] === undefined && parte.length) mapa[linhaOut] = p.arquivo ? { a: p.arquivo, l: p.linha + i } : null;
        atual += parte;
      });
    });
    saida.push(atual);
    for (var i = 0; i < saida.length; i++) if (mapa[i] === undefined) mapa[i] = null;

    var cfg = {
      token: opcoes.token, modo: opcoes.modo || 'preview', principal: principal, mapa: mapa,
      fontes: arquivos, naoEncontrados: naoEncontrados.map(function (n) { return n.caminho; }),
      armazenamento: opcoes.armazenamento || {}, sessao: opcoes.sessao || {}
    };
    var json = JSON.stringify(cfg).replace(/</g, '\\u003c');
    var srcdoc = saida.join('\n').replace('"__LAB_CFG__"', function () { return json; });
    return { srcdoc: srcdoc, mapa: mapa, naoEncontrados: naoEncontrados };
  }

  // ===================================================================
  //  AGENTE — roda DENTRO do iframe. Precisa ser autocontido.
  // ===================================================================
  /* eslint-disable no-var */
  function labAgente(CFG) {
    'use strict';
    var pai = window.parent;
    var MODO = CFG.modo;
    var ORIG = { log: console.log, info: console.info, warn: console.warn, error: console.error };
    var logs = [], erros = [], envios = 0;
    var jsReg = typeof WeakMap === 'function' ? new WeakMap() : null;

    function enviar(tipo, dados) {
      try { pai.postMessage({ lab: 1, token: CFG.token, tipo: tipo, dados: dados }, '*'); } catch (e) { /* nada */ }
    }
    function origem(n) { return CFG.mapa[n - 1] || null; }
    function daPilha(stack) {
      var re = /about:srcdoc:(\d+):(\d+)/g, m;
      while ((m = re.exec(String(stack || '')))) {
        var o = origem(+m[1]);
        if (o) return { arquivo: o.a, linha: o.l };
      }
      return null;
    }

    // ---------------------------------------------------- console
    function fmt(v, prof) {
      prof = prof || 0;
      if (v === null) return 'null';
      if (v === undefined) return 'undefined';
      var t = typeof v;
      if (t === 'string') return prof ? JSON.stringify(v) : v;
      if (t === 'number' || t === 'boolean' || t === 'bigint') return String(v);
      if (t === 'function') return 'ƒ ' + (v.name || 'anônima') + '()';
      if (t === 'symbol') return String(v);
      try {
        if (v instanceof Element) {
          var cls = typeof v.className === 'string' && v.className.trim() ? '.' + v.className.trim().split(/\s+/).join('.') : '';
          return '<' + v.tagName.toLowerCase() + (v.id ? '#' + v.id : '') + cls + '>';
        }
        if (v instanceof Error) return v.name + ': ' + v.message;
        if (prof > 2) return Array.isArray(v) ? '[…]' : '{…}';
        if (Array.isArray(v)) return '[' + v.slice(0, 20).map(function (x) { return fmt(x, prof + 1); }).join(', ') + (v.length > 20 ? ', …' : '') + ']';
        if (typeof NodeList !== 'undefined' && (v instanceof NodeList || v instanceof HTMLCollection)) {
          return 'NodeList(' + v.length + ') [' + Array.prototype.slice.call(v, 0, 10).map(function (x) { return fmt(x, prof + 1); }).join(', ') + ']';
        }
        var ks = Object.keys(v);
        return '{' + ks.slice(0, 20).map(function (k) { return k + ': ' + fmt(v[k], prof + 1); }).join(', ') + (ks.length > 20 ? ', …' : '') + '}';
      } catch (e) { return String(v); }
    }
    ['log', 'info', 'warn', 'error'].forEach(function (nivel) {
      console[nivel] = function () {
        var args = Array.prototype.slice.call(arguments);
        var item = { nivel: nivel, texto: args.map(function (a) { return fmt(a); }).join(' '), onde: daPilha(new Error().stack) };
        logs.push(item);
        if (MODO === 'preview') enviar('console', item);
        try { ORIG[nivel].apply(console, args); } catch (e) { /* nada */ }
      };
    });

    // ---------------------------------------------------- erros
    window.addEventListener('error', function (ev) {
      var alvo = ev.target;
      if (alvo && alvo !== window && alvo.tagName) {
        var url = alvo.getAttribute('src') || alvo.getAttribute('href') || '';
        if (CFG.naoEncontrados.indexOf(url) !== -1) return; // o laboratório já avisou (404)
        if (MODO === 'preview') enviar('recurso', { tag: alvo.tagName.toLowerCase(), url: url, linha: +alvo.getAttribute('data-lab-l') || 0 });
        return;
      }
      var o = origem(ev.lineno);
      var info = {
        mensagem: String(ev.message || 'Erro').replace(/^Uncaught\s+/, ''),
        nome: (ev.error && ev.error.name) || (/^(\w*Error)/.exec(String(ev.message).replace(/^Uncaught\s+/, '')) || [])[1] || 'Error',
        arquivo: o ? o.a : null, linha: o ? o.l : 0
      };
      if (!o && ev.error && ev.error.stack) {
        var p = daPilha(ev.error.stack);
        if (p) { info.arquivo = p.arquivo; info.linha = p.linha; }
      }
      erros.push(info);
      if (MODO === 'preview') enviar('erro', info);
    }, true);
    window.addEventListener('unhandledrejection', function (ev) {
      var r = ev.reason;
      var info = { mensagem: 'Promise rejeitada: ' + (r && r.message ? r.message : String(r)), nome: (r && r.name) || 'Error', arquivo: null, linha: 0 };
      var p = r && r.stack ? daPilha(r.stack) : null;
      if (p) { info.arquivo = p.arquivo; info.linha = p.linha; }
      erros.push(info);
      if (MODO === 'preview') enviar('erro', info);
    });

    // ---------------------------------------------- localStorage falso
    function criarStorage(dados, aoMudar) {
      var store = Object.create(null);
      Object.keys(dados || {}).forEach(function (k) { store[k] = String(dados[k]); });
      var api = {
        getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { k = String(k); store[k] = String(v); if (aoMudar) aoMudar('set', k, store[k]); },
        removeItem: function (k) { k = String(k); delete store[k]; if (aoMudar) aoMudar('remove', k); },
        clear: function () { Object.keys(store).forEach(function (k) { delete store[k]; }); if (aoMudar) aoMudar('clear'); },
        key: function (i) { var ks = Object.keys(store); return i < ks.length ? ks[i] : null; }
      };
      Object.defineProperty(api, 'length', { get: function () { return Object.keys(store).length; } });
      var proxy = typeof Proxy === 'function' ? new Proxy(api, {
        get: function (t, p) { if (p in t) return t[p]; if (typeof p === 'string' && Object.prototype.hasOwnProperty.call(store, p)) return store[p]; return undefined; },
        set: function (t, p, v) { if (p in t) return false; api.setItem(p, v); return true; },
        deleteProperty: function (t, p) { api.removeItem(p); return true; },
        has: function (t, p) { return p in t || Object.prototype.hasOwnProperty.call(store, p); },
        ownKeys: function () { return Object.keys(store); },
        getOwnPropertyDescriptor: function (t, p) {
          if (Object.prototype.hasOwnProperty.call(store, p)) return { value: store[p], enumerable: true, configurable: true, writable: true };
          return Object.getOwnPropertyDescriptor(t, p);
        }
      }) : api;
      return { obj: proxy, dados: function () { var c = {}; Object.keys(store).forEach(function (k) { c[k] = store[k]; }); return c; } };
    }
    var local = criarStorage(CFG.armazenamento, MODO === 'preview' ? function (op, k, v) { enviar('armazenamento', { op: op, k: k, v: v }); } : null);
    var sessao = criarStorage(CFG.sessao, MODO === 'preview' ? function (op, k, v) { enviar('sessao', { op: op, k: k, v: v }); } : null);
    try { Object.defineProperty(window, 'localStorage', { configurable: true, get: function () { return local.obj; } }); } catch (e) { /* sem shim */ }
    try { Object.defineProperty(window, 'sessionStorage', { configurable: true, get: function () { return sessao.obj; } }); } catch (e) { /* sem shim */ }

    // no validador e no raio-X, janelas de alerta não podem travar nada
    if (MODO !== 'preview') {
      window.alert = function (m) { logs.push({ nivel: 'alert', texto: String(m) }); };
      window.confirm = function () { return true; };
      window.prompt = function () { return ''; };
    }

    // --------------------------------------- rastreio do JS (Raio-X)
    function registrar(el, acao) {
      if (!jsReg || !el || el.nodeType !== 1) return;
      var o = daPilha(new Error().stack);
      if (!o) return;
      var lista = jsReg.get(el) || [];
      var chave = acao + '@' + o.arquivo + ':' + o.linha;
      if (!lista.some(function (x) { return x.chave === chave; })) lista.push({ chave: chave, acao: acao, arquivo: o.arquivo, linha: o.linha });
      jsReg.set(el, lista);
    }
    function embrulharMetodo(proto, nome, rotulo) {
      var orig = proto && proto[nome];
      if (typeof orig !== 'function') return;
      proto[nome] = function () {
        var r = orig.apply(this, arguments);
        try {
          var arg = arguments[0];
          var desc = rotulo(arg);
          if (r && r.nodeType === 1) registrar(r, desc);
          else if (r && typeof r.length === 'number' && nome === 'querySelectorAll') {
            for (var i = 0; i < r.length && i < 50; i++) registrar(r[i], desc);
          }
        } catch (e) { /* nada */ }
        return r;
      };
    }
    function embrulharSetter(proto, prop, rotulo) {
      var d = proto && Object.getOwnPropertyDescriptor(proto, prop);
      if (!d || !d.set) return;
      Object.defineProperty(proto, prop, {
        configurable: true, enumerable: d.enumerable,
        get: d.get,
        set: function (v) { try { registrar(this, rotulo); } catch (e) { /* nada */ } return d.set.call(this, v); }
      });
    }
    if (MODO !== 'validador') {
      embrulharMetodo(Document.prototype, 'getElementById', function (a) { return 'getElementById("' + a + '")'; });
      embrulharMetodo(Document.prototype, 'querySelector', function (a) { return 'querySelector("' + a + '")'; });
      embrulharMetodo(Document.prototype, 'querySelectorAll', function (a) { return 'querySelectorAll("' + a + '")'; });
      embrulharMetodo(Element.prototype, 'querySelector', function (a) { return 'querySelector("' + a + '")'; });
      var addOrig = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (tipo) {
        try { if (this && this.nodeType === 1) registrar(this, 'addEventListener("' + tipo + '")'); } catch (e) { /* nada */ }
        return addOrig.apply(this, arguments);
      };
      embrulharSetter(Node.prototype, 'textContent', 'textContent =');
      embrulharSetter(Element.prototype, 'innerHTML', 'innerHTML =');
      embrulharSetter(HTMLElement.prototype, 'innerText', 'innerText =');
      embrulharSetter(HTMLElement.prototype, 'onclick', 'onclick =');
      var dStyle = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'style');
      if (dStyle && dStyle.get) {
        Object.defineProperty(HTMLElement.prototype, 'style', {
          configurable: true, enumerable: dStyle.enumerable,
          get: function () { try { registrar(this, '.style'); } catch (e) { /* nada */ } return dStyle.get.call(this); },
          set: dStyle.set
        });
      }
    }

    // ------------------------------------------ links e formulários
    window.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!a || ev.defaultPrevented) return;
      var href = a.getAttribute('href');
      ev.preventDefault();
      var linha = +a.getAttribute('data-lab-l') || 0;
      if (href.charAt(0) === '#') {
        var id = decodeURIComponent(href.slice(1));
        var alvo = id ? document.getElementById(id) : null;
        if (alvo) { alvo.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        if (!id) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        if (MODO === 'preview') enviar('ancora', { id: id, linha: linha });
        return;
      }
      if (MODO === 'preview') enviar('link', { href: href, linha: linha });
    }, false);
    window.addEventListener('submit', function (ev) {
      if (ev.defaultPrevented) return;
      ev.preventDefault();
      envios++;
      if (MODO === 'preview') enviar('submit', { linha: +(ev.target.getAttribute && ev.target.getAttribute('data-lab-l')) || 0 });
    });

    // -------------------------------------------- inspeção de elementos
    var cacheCss = {};
    function cssDe(arquivo, texto, base) {
      var k = arquivo + '@' + (base || 1);
      if (!cacheCss[k]) cacheCss[k] = labParseCSS(texto, base || 1);
      return cacheCss[k];
    }
    function regrasDe(el) {
      var out = [];
      var folhas = document.styleSheets;
      for (var i = 0; i < folhas.length; i++) {
        var f = folhas[i], dono = f.ownerNode, regras;
        if (!dono || dono.hasAttribute('data-lab-ui')) continue;
        try { regras = f.cssRules; } catch (e) { continue; }
        var arq = dono.getAttribute('data-arquivo');
        var parse = arq ? cssDe(arq, CFG.fontes[arq] || '', 1) : cssDe(CFG.principal, dono.textContent, +dono.getAttribute('data-lab-l') || 1);
        (function andar(lista, media, ativa) {
          for (var j = 0; j < lista.length; j++) {
            var r = lista[j];
            if (r.type === 1) {
              var bate = false;
              try { bate = el.matches(r.selectorText); } catch (e) { bate = false; }
              if (!bate) continue;
              var alvo = labNormSeletor(r.selectorText);
              var fonte = parse.regras.filter(function (x) { return labNormSeletor(x.seletor) === alvo && (x.media || '') === (media || ''); })[0] ||
                parse.regras.filter(function (x) { return labNormSeletor(x.seletor) === alvo; })[0];
              out.push({
                seletor: r.selectorText, arquivo: arq || CFG.principal, media: media || '', ativa: ativa,
                linha: fonte ? fonte.linha : 0,
                decls: fonte ? fonte.decls.map(function (d) { return { prop: d.prop, valor: d.valor, linha: d.linha, valida: !d.semDoisPontos && labDeclValida(d.prop, d.valor) }; }) : []
              });
            } else if (r.type === 4) {
              var cond = r.conditionText || (r.media && r.media.mediaText) || '';
              var at = false;
              try { at = window.matchMedia(cond).matches; } catch (e) { at = false; }
              andar(r.cssRules, '@media ' + cond, at);
            }
          }
        })(regras, '', true);
      }
      var inl = el.getAttribute('style');
      if (inl) out.push({ seletor: 'style="…" (no próprio elemento)', arquivo: CFG.principal, linha: +el.getAttribute('data-lab-l') || 0, ativa: true, decls: [] });
      return out;
    }
    function infoElemento(el) {
      var cs = getComputedStyle(el);
      var props = ['color', 'background-color', 'font-size', 'font-family', 'font-weight', 'margin', 'padding', 'display', 'width'];
      var est = {};
      props.forEach(function (p) { est[p] = cs.getPropertyValue(p); });
      return {
        tag: el.tagName.toLowerCase(), id: el.id || '',
        classes: typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean) : [],
        linha: +el.getAttribute('data-lab-l') || 0,
        texto: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70),
        css: regrasDe(el), js: jsReg ? (jsReg.get(el) || []).map(function (x) { return { acao: x.acao, arquivo: x.arquivo, linha: x.linha }; }) : [],
        estilos: est,
        uid: el.__labUid || (el.__labUid = Math.random().toString(36).slice(2))
      };
    }
    function alvoDe(t) {
      while (t && t.nodeType === 1 && !t.hasAttribute('data-lab-l')) t = t.parentElement;
      return t && t.nodeType === 1 ? t : null;
    }
    var inspecionando = false, caixa = null, etiqueta = null;
    function garantirCaixa() {
      if (caixa) return;
      caixa = document.createElement('div');
      etiqueta = document.createElement('div');
      caixa.setAttribute('data-lab-ui', '1');
      etiqueta.setAttribute('data-lab-ui', '1');
      caixa.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483646;outline:2px solid #e9b949;background:rgba(233,185,73,.18);display:none;';
      etiqueta.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483647;background:#1d1a1c;color:#f3efe6;font:12px/1.4 Consolas,monospace;padding:2px 6px;border-radius:3px;display:none;white-space:nowrap;';
      document.documentElement.appendChild(caixa);
      document.documentElement.appendChild(etiqueta);
    }
    function posicionar(el) {
      garantirCaixa();
      var r = el.getBoundingClientRect();
      caixa.style.display = etiqueta.style.display = 'block';
      caixa.style.left = (r.left + window.scrollX) + 'px';
      caixa.style.top = (r.top + window.scrollY) + 'px';
      caixa.style.width = r.width + 'px';
      caixa.style.height = r.height + 'px';
      var cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '';
      etiqueta.textContent = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls + '  ·  linha ' + el.getAttribute('data-lab-l');
      etiqueta.style.left = (r.left + window.scrollX) + 'px';
      etiqueta.style.top = Math.max(0, r.top + window.scrollY - 20) + 'px';
    }
    function esconderCaixa() { if (caixa) caixa.style.display = etiqueta.style.display = 'none'; }

    document.addEventListener('mousemove', function (ev) {
      if (!inspecionando && MODO !== 'raiox') return;
      var t = alvoDe(ev.target);
      if (t) posicionar(t);
    }, true);
    document.addEventListener('click', function (ev) {
      if (!inspecionando && MODO !== 'raiox') return;
      ev.preventDefault();
      ev.stopPropagation();
      var t = alvoDe(ev.target);
      if (t) enviar(MODO === 'raiox' ? 'raiox' : 'inspecionado', infoElemento(t));
    }, true);
    document.addEventListener('mouseleave', esconderCaixa, true);

    function ligarRaioX() {
      var st = document.createElement('style');
      st.setAttribute('data-lab-ui', '1');
      st.textContent = 'body [data-lab-l]{outline:1px dashed rgba(94,42,80,.55)!important;outline-offset:-1px;}' +
        'body [data-lab-l]:hover{outline:2px solid #e9b949!important;}' +
        'html{cursor:crosshair;}';
      document.head.appendChild(st);
    }

    // ------------------------------------------------ API de validação
    function el$(x) { return typeof x === 'string' ? document.querySelector(x) : x; }
    var api = {
      $: function (s) { return document.querySelector(s); },
      $$: function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); },
      texto: function (x) { var e = el$(x); return e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : ''; },
      estilo: function (x, prop) { var e = el$(x); return e ? getComputedStyle(e).getPropertyValue(prop).trim() : ''; },
      px: function (x, prop) { return parseFloat(api.estilo(x, prop)) || 0; },
      cor: function (x, prop) { return api.estilo(x, prop || 'color').replace(/\s+/g, ''); },
      transparente: function (c) { c = String(c).replace(/\s+/g, ''); return c === 'transparent' || /^rgba\(\d+,\d+,\d+,0\)$/.test(c); },
      visivel: function (x) { var e = el$(x); if (!e) return false; var r = e.getBoundingClientRect(); var cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; },
      clicar: function (x) { var e = el$(x); if (!e) return false; e.click(); return true; },
      digitar: function (x, v) {
        var e = el$(x); if (!e) return false;
        e.value = v;
        e.dispatchEvent(new Event('input', { bubbles: true }));
        e.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      },
      esperar: function (ms) { return new Promise(function (ok) { setTimeout(ok, ms || 0); }); },
      imagemOk: function (x) {
        var e = el$(x);
        if (!e) return Promise.resolve(false);
        if (e.complete) return Promise.resolve(e.naturalWidth > 0);
        return new Promise(function (ok) {
          e.addEventListener('load', function () { ok(e.naturalWidth > 0); });
          e.addEventListener('error', function () { ok(false); });
          setTimeout(function () { ok(e.naturalWidth > 0); }, 1200);
        });
      },
      linhaDoElemento: function (x) { var e = el$(x); return e ? +e.getAttribute('data-lab-l') || 0 : 0; },
      fonte: function (nome) { return CFG.fontes[nome || CFG.principal] || ''; },
      fontes: CFG.fontes,
      linhaDe: function (nome, padrao, aPartirDe) {
        var linhas = api.fonte(nome).split('\n');
        for (var i = (aPartirDe || 1) - 1; i < linhas.length; i++) {
          if (padrao instanceof RegExp ? padrao.test(linhas[i]) : linhas[i].indexOf(padrao) !== -1) return i + 1;
        }
        return 0;
      },
      css: function (nome) {
        var p = labParseCSS(api.fonte(nome), 1);
        p.regras.forEach(function (r) { r.decls.forEach(function (d) { d.valida = !d.semDoisPontos && labDeclValida(d.prop, d.valor); }); });
        return p;
      },
      naoEncontrados: CFG.naoEncontrados,
      erros: erros, logs: logs,
      envios: function () { return envios; },
      armazenamento: function () { return local.dados(); },
      titulo: function () { return document.title; },
      modo: function () { return document.compatMode; }
    };

    function criarFn(src) {
      src = String(src).trim();
      var cabeca = src.split('{')[0];
      if (!/^(async\s+)?function\b/.test(src) && cabeca.indexOf('=>') === -1 && /^(async\s+)?[A-Za-z_$][\w$]*\s*\(/.test(src)) {
        src = src.replace(/^(async\s+)?/, function (m) { return (m || '') + 'function '; });
      }
      return new Function('return (' + src + ');')();
    }
    function rodar(src) {
      return new Promise(function (ok) {
        var fim = false;
        var t = setTimeout(function () { if (!fim) { fim = true; ok({ ok: false, detalhe: 'validador demorou demais', falhaValidador: true }); } }, 2500);
        try {
          Promise.resolve(criarFn(src)(api)).then(function (r) {
            if (fim) return; fim = true; clearTimeout(t); ok(r);
          }, function (e) {
            if (fim) return; fim = true; clearTimeout(t); ok({ ok: false, detalhe: 'erro no validador: ' + e.message, falhaValidador: true });
          });
        } catch (e) {
          fim = true; clearTimeout(t); ok({ ok: false, detalhe: 'erro no validador: ' + e.message, falhaValidador: true });
        }
      });
    }
    function validar(pedido) {
      var res = { checks: {}, detectores: {}, observacao: null };
      var fila = Promise.resolve();
      (pedido.checks || []).forEach(function (c) {
        fila = fila.then(function () { return rodar(c.fn); }).then(function (r) {
          res.checks[c.id] = (r && typeof r === 'object') ? { ok: !!r.ok, detalhe: r.detalhe || '', falhaValidador: !!r.falhaValidador } : { ok: !!r };
        });
      });
      (pedido.detectores || []).forEach(function (d) {
        fila = fila.then(function () { return rodar(d.fn); }).then(function (r) {
          if (r && r.falhaValidador) r = null;
          res.detectores[d.id] = r ? (typeof r === 'object' ? r : { sim: true }) : null;
        });
      });
      if (pedido.observar) {
        fila = fila.then(function () { return rodar(pedido.observar); }).then(function (r) {
          res.observacao = typeof r === 'string' ? r : (r && r.detalhe) || null;
        });
      }
      return fila.then(function () {
        res.armazenamento = local.dados();
        res.erros = erros;
        res.logs = logs.slice(-50);
        res.envios = envios;
        return res;
      });
    }

    // --------------------------------------------- mensagens do laboratório
    window.addEventListener('message', function (ev) {
      if (ev.source !== pai) return;
      var m = ev.data;
      if (!m || m.lab !== 1 || m.token !== CFG.token) return;
      if (m.tipo === 'inspecionar') { inspecionando = !!m.dados; if (!inspecionando) esconderCaixa(); document.documentElement.style.cursor = inspecionando ? 'crosshair' : ''; }
      else if (m.tipo === 'validar') validar(m.dados).then(function (r) { enviar('resultado', r); });
      else if (m.tipo === 'rolar') window.scrollTo(0, m.dados || 0);
    });

    // ------------------------------------------------- pronto
    var tituloAnterior = null;
    function avisarTitulo() {
      if (document.title !== tituloAnterior) { tituloAnterior = document.title; enviar('titulo', { titulo: document.title }); }
    }
    document.addEventListener('DOMContentLoaded', avisarTitulo);
    window.addEventListener('load', function () {
      if (MODO === 'raiox') ligarRaioX();
      avisarTitulo();
      setTimeout(function () {
        enviar('pronto', { titulo: document.title, compat: document.compatMode });
      }, 40);
      if (typeof MutationObserver === 'function' && document.head) {
        new MutationObserver(avisarTitulo).observe(document.head, { childList: true, subtree: true, characterData: true });
      }
    });
  }
  /* eslint-enable no-var */

  // ===================================================================
  //  MOLDURA — controla um iframe (preview, validador ou raio-x)
  // ===================================================================
  var molduras = [];
  window.addEventListener('message', function (ev) {
    var m = ev.data;
    if (!m || m.lab !== 1) return;
    for (var i = 0; i < molduras.length; i++) {
      var mo = molduras[i];
      if (mo.iframe.contentWindow === ev.source && m.token === mo.token) { mo._receber(m.tipo, m.dados); return; }
    }
  });

  function Moldura(iframe, modo) {
    this.iframe = iframe;
    this.modo = modo;
    this.token = null;
    this.aoMensagem = null;
    this._espera = {};
    this.ultimo = null;
    molduras.push(this);
  }
  Moldura.prototype._receber = function (tipo, dados) {
    var w = this._espera[tipo];
    if (w) { delete this._espera[tipo]; w(dados); }
    if (this.aoMensagem) this.aoMensagem(tipo, dados);
  };
  Moldura.prototype._aguardar = function (tipo, ms) {
    var self = this;
    return new Promise(function (ok) {
      var t = setTimeout(function () { if (self._espera[tipo]) { delete self._espera[tipo]; ok(null); } }, ms);
      self._espera[tipo] = function (d) { clearTimeout(t); ok(d); };
    });
  };
  /** desenha o documento. Resolve com {doc, pronto (dados) | null se travou} */
  Moldura.prototype.render = function (arquivos, opcoes) {
    opcoes = opcoes || {};
    this.token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    var doc = montarDocumento(arquivos, {
      principal: opcoes.principal, assets: opcoes.assets, modo: this.modo, token: this.token,
      armazenamento: opcoes.armazenamento, sessao: opcoes.sessao
    });
    this.ultimo = { arquivos: arquivos, opcoes: opcoes, doc: doc };
    var espera = this._aguardar('pronto', opcoes.timeout || 5000);
    this.iframe.srcdoc = doc.srcdoc;
    return espera.then(function (pronto) { return { doc: doc, pronto: pronto }; });
  };
  Moldura.prototype.enviar = function (tipo, dados) {
    try { this.iframe.contentWindow.postMessage({ lab: 1, token: this.token, tipo: tipo, dados: dados }, '*'); } catch (e) { /* nada */ }
  };
  Moldura.prototype.pedir = function (tipo, dados, resposta, ms) {
    var p = this._aguardar(resposta, ms || 8000);
    this.enviar(tipo, dados);
    return p;
  };
  Moldura.prototype.limpar = function () {
    this.token = null;
    this.iframe.srcdoc = '<!DOCTYPE html><title>.</title>';
  };

  Lab.preview = {
    montarDocumento: montarDocumento,
    resolver: resolver,
    Moldura: Moldura,
    BASE_FALSA: BASE_FALSA,
    _codigoAgente: [labParseCSS.toString(), labNormSeletor.toString(), labDeclValida.toString(), labAgente.toString()].join('\n')
  };
})();
