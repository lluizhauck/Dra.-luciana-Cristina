/* =====================================================================
   editor.js — editor com abas, números de linha e regiões editáveis
   O modelo de cada arquivo marca as regiões editáveis com linhas:
       [[editavel:nome]]
       ...código que o aluno pode mudar...
       [[/editavel]]
   Todo o resto aparece travado (somente leitura), mas faz parte do arquivo.
   ===================================================================== */
(function () {
  'use strict';
  var Lab = window.Lab;
  var U = Lab.util, el = U.el;
  var ALTURA_LINHA = 20; // precisa bater com --ed-linha no CSS
  var PAD = 8;           // padding vertical de cada bloco (CSS)

  function parseModelo(texto) {
    var linhas = String(texto).replace(/\r\n/g, '\n').split('\n');
    var blocos = [], atual = null, buffer = [];
    function fecharFixo() {
      if (buffer.length) blocos.push({ tipo: 'fixo', texto: buffer.join('\n') });
      buffer = [];
    }
    linhas.forEach(function (l) {
      var abre = /^\s*\[\[editavel:([\w-]+)\]\]\s*$/.exec(l);
      var fecha = /^\s*\[\[\/editavel\]\]\s*$/.test(l);
      if (abre && !atual) { fecharFixo(); atual = { tipo: 'editavel', id: abre[1], linhas: [] }; }
      else if (fecha && atual) { blocos.push({ tipo: 'editavel', id: atual.id, texto: atual.linhas.join('\n') }); atual = null; }
      else if (atual) atual.linhas.push(l);
      else buffer.push(l);
    });
    if (atual) blocos.push({ tipo: 'editavel', id: atual.id, texto: atual.linhas.join('\n') });
    fecharFixo();
    return blocos;
  }

  var estado = {
    arquivos: [],      // [{nome, linguagem, blocos:[{tipo,id,texto, no, gutter, campo}]}]
    ativo: null,
    aoMudar: null,
    escapeTab: false,
    somenteLeitura: false
  };

  function contarLinhas(t) { return t.split('\n').length; }

  function renumerar(arq) {
    var n = 1;
    arq.blocos.forEach(function (b) {
      var texto = b.tipo === 'editavel' ? b.campo.value : b.texto;
      var qtd = contarLinhas(texto);
      b.inicio = n;
      b.qtd = qtd;
      var nums = [];
      for (var i = 0; i < qtd; i++) nums.push(n + i);
      b.gutter.textContent = nums.join('\n');
      if (b.tipo === 'editavel') {
        b.campo.style.height = (qtd * ALTURA_LINHA + PAD * 2) + 'px';
        var maior = texto.split('\n').reduce(function (m, l) { return Math.max(m, l.length); }, 0);
        b.campo.style.width = 'max(100%, ' + (maior + 4) + 'ch)';
      }
      n += qtd;
    });
  }

  function linhaAtual(campo) {
    var antes = campo.value.slice(0, campo.selectionStart);
    var inicio = antes.lastIndexOf('\n') + 1;
    return { inicio: inicio, texto: campo.value.slice(inicio, campo.value.indexOf('\n', inicio) === -1 ? undefined : campo.value.indexOf('\n', inicio)) };
  }

  function inserir(campo, texto) {
    // execCommand mantém o histórico de desfazer (Ctrl+Z) do navegador
    var ok = false;
    try { ok = document.execCommand('insertText', false, texto); } catch (e) { ok = false; }
    if (!ok) {
      var s = campo.selectionStart, f = campo.selectionEnd;
      campo.value = campo.value.slice(0, s) + texto + campo.value.slice(f);
      campo.selectionStart = campo.selectionEnd = s + texto.length;
      campo.dispatchEvent(new Event('input'));
    }
  }

  function teclas(ev, campo) {
    if (ev.key === 'Escape') { estado.escapeTab = true; return; }
    if (ev.key === 'Tab' && !estado.escapeTab && !ev.ctrlKey && !ev.altKey) {
      ev.preventDefault();
      if (!ev.shiftKey) inserir(campo, '  ');
      else {
        var la = linhaAtual(campo);
        if (/^ {1,2}/.test(la.texto)) {
          var tira = /^ {1,2}/.exec(la.texto)[0].length;
          var pos = campo.selectionStart;
          campo.setSelectionRange(la.inicio, la.inicio + tira);
          inserir(campo, '');
          campo.setSelectionRange(Math.max(la.inicio, pos - tira), Math.max(la.inicio, pos - tira));
        }
      }
      return;
    }
    if (ev.key !== 'Tab') estado.escapeTab = false;
    if (ev.key === 'Enter' && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
      // mantém a indentação da linha de cima
      var recuo = /^\s*/.exec(linhaAtual(campo).texto)[0];
      if (recuo) { ev.preventDefault(); inserir(campo, '\n' + recuo); }
    }
  }

  function montarArquivo(def, salvo) {
    var arq = { nome: def.nome, linguagem: def.linguagem || 'html', blocos: parseModelo(def.modelo) };
    var cont = el('div', { class: 'ed-arquivo', 'data-arquivo': def.nome, role: 'tabpanel', 'aria-label': def.nome });
    arq.blocos.forEach(function (b) {
      b.gutter = el('div', { class: 'ed-gutter', 'aria-hidden': 'true' });
      var corpo;
      if (b.tipo === 'fixo') {
        corpo = el('pre', { class: 'ed-codigo' }, b.texto);
        b.no = el('div', { class: 'ed-bloco fixo', title: 'Trecho travado: faz parte do arquivo, mas não é para mexer nesta missão.' }, [b.gutter, corpo]);
      } else {
        var valor = salvo && typeof salvo[b.id] === 'string' ? salvo[b.id] : b.texto;
        b.original = b.texto;
        b.campo = el('textarea', {
          class: 'ed-codigo', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off',
          'aria-label': 'Código editável de ' + def.nome + ' (região ' + b.id + '). Tab insere espaços; Esc e depois Tab sai do editor.'
        });
        b.campo.value = valor;
        b.campo.addEventListener('keydown', function (ev) { teclas(ev, b.campo); });
        b.campo.addEventListener('input', function () {
          renumerar(arq);
          if (estado.aoMudar) estado.aoMudar(arq.nome);
        });
        corpo = b.campo;
        b.no = el('div', { class: 'ed-bloco editavel' }, [b.gutter, corpo, el('span', { class: 'ed-rotulo' }, 'editável')]);
      }
      b.corpo = corpo;
      cont.appendChild(b.no);
    });
    arq.no = cont;
    return arq;
  }

  var editor = {
    parseModelo: parseModelo,

    /** defs: [{nome, linguagem, modelo}], salvo: {nome:{regiao:texto}} */
    carregar: function (defs, salvo, opcoes) {
      opcoes = opcoes || {};
      var abas = U.limpar(document.getElementById('editor-abas'));
      var area = U.limpar(document.getElementById('editor-area'));
      estado.arquivos = defs.map(function (d) { return montarArquivo(d, salvo && salvo[d.nome]); });
      estado.arquivos.forEach(function (arq, i) {
        var bt = el('button', {
          class: 'aba', role: 'tab', type: 'button', id: 'aba-' + i, 'aria-selected': 'false', 'data-arquivo': arq.nome,
          onclick: function () { editor.abrirAba(arq.nome); }
        }, [el('span', { class: 'aba-tipo tipo-' + arq.linguagem }, arq.linguagem.toUpperCase()), ' ' + arq.nome]);
        abas.appendChild(bt);
        area.appendChild(arq.no);
        renumerar(arq);
      });
      editor.abrirAba(opcoes.abaInicial || (estado.arquivos[0] && estado.arquivos[0].nome));
    },

    abrirAba: function (nome) {
      estado.ativo = nome;
      estado.arquivos.forEach(function (a) {
        var ativo = a.nome === nome;
        a.no.hidden = !ativo;
        if (ativo) renumerar(a);
      });
      U.$$('#editor-abas .aba').forEach(function (b) {
        b.setAttribute('aria-selected', b.getAttribute('data-arquivo') === nome ? 'true' : 'false');
      });
    },

    arquivoAtivo: function () { return estado.ativo; },
    temArquivo: function (nome) { return estado.arquivos.some(function (a) { return a.nome === nome; }); },

    obterArquivos: function () {
      var r = {};
      estado.arquivos.forEach(function (a) {
        r[a.nome] = a.blocos.map(function (b) { return b.tipo === 'editavel' ? b.campo.value : b.texto; }).join('\n');
      });
      return r;
    },

    obterRegioes: function () {
      var r = {};
      estado.arquivos.forEach(function (a) {
        a.blocos.forEach(function (b) {
          if (b.tipo !== 'editavel') return;
          r[a.nome] = r[a.nome] || {};
          r[a.nome][b.id] = b.campo.value;
        });
      });
      return r;
    },

    definirRegioes: function (regioes) {
      estado.arquivos.forEach(function (a) {
        a.blocos.forEach(function (b) {
          if (b.tipo === 'editavel' && regioes[a.nome] && typeof regioes[a.nome][b.id] === 'string') {
            b.campo.value = regioes[a.nome][b.id];
          }
        });
        renumerar(a);
      });
    },

    /** regiões do modelo original (código inicial da missão) */
    regioesOriginais: function () {
      var r = {};
      estado.arquivos.forEach(function (a) {
        a.blocos.forEach(function (b) {
          if (b.tipo !== 'editavel') return;
          r[a.nome] = r[a.nome] || {};
          r[a.nome][b.id] = b.original;
        });
      });
      return r;
    },

    setSomenteLeitura: function (sim) {
      estado.somenteLeitura = sim;
      estado.arquivos.forEach(function (a) { a.blocos.forEach(function (b) { if (b.campo) b.campo.readOnly = sim; }); });
    },

    aoMudar: function (fn) { estado.aoMudar = fn; },

    /** muda para a aba e destaca a linha. tipo: 'inspecao' | 'erro' */
    destacar: function (nome, linha, tipo) {
      var arq = estado.arquivos.filter(function (a) { return a.nome === nome; })[0];
      if (!arq || !linha) return false;
      editor.abrirAba(nome);
      U.$$('.ed-marca', arq.no).forEach(function (m) { m.remove(); });
      var bloco = arq.blocos.filter(function (b) { return linha >= b.inicio && linha < b.inicio + b.qtd; })[0];
      if (!bloco) return false;
      var off = linha - bloco.inicio;
      var marca = el('div', { class: 'ed-marca ' + (tipo || 'inspecao'), 'aria-hidden': 'true' });
      marca.style.top = (PAD + off * ALTURA_LINHA) + 'px';
      bloco.no.appendChild(marca);
      var area = document.getElementById('editor-area');
      var alvo = bloco.no.offsetTop + PAD + off * ALTURA_LINHA - area.clientHeight / 3;
      area.scrollTo({ top: Math.max(0, alvo), behavior: 'smooth' });
      if (bloco.campo) {
        // coloca o cursor no começo da linha (sem roubar a rolagem)
        var linhas = bloco.campo.value.split('\n'), pos = 0;
        for (var i = 0; i < off; i++) pos += linhas[i].length + 1;
        try { bloco.campo.focus({ preventScroll: true }); bloco.campo.setSelectionRange(pos, pos); } catch (e) { /* ok */ }
      }
      setTimeout(function () { marca.classList.add('some'); }, 2600);
      setTimeout(function () { marca.remove(); }, 3400);
      return true;
    },

    /** texto de uma linha do arquivo (para mostrar trechos no inspetor e no raio-X) */
    linhaTexto: function (nome, linha) {
      var t = editor.obterArquivos()[nome];
      if (!t) return '';
      return t.split('\n')[linha - 1] || '';
    },

    focar: function () {
      var arq = estado.arquivos.filter(function (a) { return a.nome === estado.ativo; })[0];
      var b = arq && arq.blocos.filter(function (x) { return x.campo; })[0];
      if (b) b.campo.focus();
    }
  };

  Lab.editor = editor;
})();
