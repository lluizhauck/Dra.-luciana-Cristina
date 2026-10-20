/* =====================================================================
   editor.js — editor com realce de sintaxe, números de linha,
   destaque da linha atual, trechos fixos recolhidos e regiões editáveis.

   O modelo de cada arquivo marca as regiões editáveis com linhas:
       [[editavel:nome]]
       ...código que o aluno pode mudar...
       [[/editavel]]
   Todo o resto é FIXO (somente leitura), mas faz parte do arquivo.

   Técnica: o textarea fica transparente por cima de um <pre> com o
   código colorido (mesma fonte e métricas). Cada linha do <pre> é um
   <span class="l">, o que permite sublinhar erros na linha certa.
   ===================================================================== */
(function () {
  'use strict';
  var Lab = window.Lab;
  var U = Lab.util, el = U.el;
  var LH = 20;   // altura da linha: precisa bater com --ed-lh no CSS
  var PAD = 8;   // padding vertical de cada bloco
  var RECOLHER_ACIMA_DE = 3; // trechos fixos com mais linhas que isso começam recolhidos

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
      if (abre && !atual) { fecharFixo(); atual = { id: abre[1], linhas: [] }; }
      else if (fecha && atual) { blocos.push({ tipo: 'editavel', id: atual.id, texto: atual.linhas.join('\n') }); atual = null; }
      else if (atual) atual.linhas.push(l);
      else buffer.push(l);
    });
    if (atual) blocos.push({ tipo: 'editavel', id: atual.id, texto: atual.linhas.join('\n') });
    fecharFixo();
    return blocos;
  }

  var estado = { arquivos: [], ativo: null, visiveis: null, aoMudar: null, escapeTab: false, erros: {} };

  function textoBloco(b) { return b.tipo === 'editavel' ? b.campo.value : b.texto; }

  /** redesenha o realce de um bloco (com erros sublinhados) */
  function pintar(arq, b) {
    var ls = Lab.realce.linhas(textoBloco(b), arq.linguagem);
    var errs = estado.erros[arq.nome] || {};
    b.realce.innerHTML = ls.map(function (h, i) {
      var n = b.inicio + i;
      var e = errs[n];
      return '<span class="l' + (e ? ' l-erro' : '') + '"' + (e ? ' title="' + U.esc(e) + '"' : '') + '>' + (h || ' ') + '</span>';
    }).join('');
  }

  function renumerar(arq) {
    var n = 1;
    arq.blocos.forEach(function (b) {
      var texto = textoBloco(b);
      var qtd = texto.split('\n').length;
      b.inicio = n;
      b.qtd = qtd;
      if (b.tipo === 'fixo' && b.recolhido) {
        b.gutter.textContent = qtd > 1 ? n + '–' + (n + qtd - 1) : String(n);
      } else {
        var nums = [];
        for (var i = 0; i < qtd; i++) nums.push(n + i);
        b.gutter.textContent = nums.join('\n');
      }
      if (b.tipo === 'editavel') {
        var maior = texto.split('\n').reduce(function (m, l) { return Math.max(m, l.length); }, 0);
        b.campo.style.height = (qtd * LH + PAD * 2) + 'px';
        b.caixa.style.minWidth = (maior + 4) + 'ch';
      }
      n += qtd;
    });
    arq.blocos.forEach(function (b) { if (!(b.tipo === 'fixo' && b.recolhido)) pintar(arq, b); });
  }

  function linhaDoCursor(campo) {
    return campo.value.slice(0, campo.selectionStart).split('\n').length - 1;
  }
  function linhaAtual(campo) {
    var antes = campo.value.slice(0, campo.selectionStart);
    var ini = antes.lastIndexOf('\n') + 1;
    var fim = campo.value.indexOf('\n', ini);
    return { inicio: ini, texto: campo.value.slice(ini, fim === -1 ? undefined : fim) };
  }
  function moverLinhaAtual(b) {
    if (!b.marcaAtual) return;
    b.marcaAtual.style.top = (PAD + linhaDoCursor(b.campo) * LH) + 'px';
  }

  function inserir(campo, texto) {
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
      if (!ev.shiftKey) { inserir(campo, '  '); return; }
      var la = linhaAtual(campo);
      var m = /^ {1,2}/.exec(la.texto);
      if (m) {
        var pos = campo.selectionStart;
        campo.setSelectionRange(la.inicio, la.inicio + m[0].length);
        inserir(campo, '');
        var p = Math.max(la.inicio, pos - m[0].length);
        campo.setSelectionRange(p, p);
      }
      return;
    }
    if (ev.key !== 'Tab') estado.escapeTab = false;
    if (ev.key === 'Enter' && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
      var recuo = /^\s*/.exec(linhaAtual(campo).texto)[0];
      if (recuo) { ev.preventDefault(); inserir(campo, '\n' + recuo); }
    }
  }

  function montarArquivo(def, salvo) {
    var arq = { nome: def.nome, linguagem: def.linguagem || 'html', blocos: parseModelo(def.modelo) };
    var cont = el('div', { class: 'ed-arquivo', 'data-arquivo': def.nome, role: 'tabpanel', 'aria-label': 'Arquivo ' + def.nome });
    arq.blocos.forEach(function (b) {
      b.gutter = el('div', { class: 'ed-gutter', 'aria-hidden': 'true' });
      b.realce = el('pre', { class: 'ed-realce', 'aria-hidden': 'true' });
      if (b.tipo === 'fixo') {
        var qtd = b.texto.split('\n').length;
        b.recolhido = qtd > RECOLHER_ACIMA_DE;
        b.botao = el('button', {
          type: 'button', class: 'ed-recolhido',
          onclick: function () { b.recolhido = false; b.no.classList.remove('recolhido'); renumerar(arq); }
        }, [Lab.iconeEl('seta'), el('span', null, qtd + ' linhas fixas — clique para ver')]);
        b.no = el('div', { class: 'ed-bloco fixo' + (b.recolhido ? ' recolhido' : ''), title: 'Trecho fixo: faz parte do arquivo, mas não é para mexer nesta missão.' },
          [b.gutter, el('div', { class: 'ed-caixa' }, [b.realce, b.botao])]);
      } else {
        b.original = b.texto;
        b.campo = el('textarea', {
          class: 'ed-campo', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off',
          'aria-label': 'Código editável de ' + def.nome + '. Tab insere espaços; Esc e depois Tab sai do editor.'
        });
        b.campo.value = salvo && typeof salvo[b.id] === 'string' ? salvo[b.id] : b.texto;
        b.marcaAtual = el('div', { class: 'ed-linha-atual', 'aria-hidden': 'true' });
        b.caixa = el('div', { class: 'ed-caixa' }, [b.marcaAtual, b.realce, b.campo]);
        b.campo.addEventListener('keydown', function (ev) { teclas(ev, b.campo); });
        b.campo.addEventListener('input', function () {
          // editar a linha apaga o sublinhado de erro daquele arquivo (o código mudou)
          if (estado.erros[arq.nome]) delete estado.erros[arq.nome];
          renumerar(arq);
          moverLinhaAtual(b);
          if (estado.aoMudar) estado.aoMudar(arq.nome);
        });
        ['keyup', 'click', 'focus', 'select'].forEach(function (t) { b.campo.addEventListener(t, function () { moverLinhaAtual(b); }); });
        b.no = el('div', { class: 'ed-bloco editavel', title: 'Região editável' }, [b.gutter, b.caixa]);
      }
      cont.appendChild(b.no);
    });
    arq.no = cont;
    return arq;
  }

  var editor = {
    parseModelo: parseModelo,

    /** defs: [{nome, linguagem, modelo}], salvo: {nome:{regiao:texto}}, opcoes.visiveis: [nomes] */
    carregar: function (defs, salvo, opcoes) {
      opcoes = opcoes || {};
      var area = U.limpar(document.getElementById('editor-area'));
      estado.erros = {};
      estado.arquivos = defs.map(function (d) { return montarArquivo(d, salvo && salvo[d.nome]); });
      estado.arquivos.forEach(function (arq) { area.appendChild(arq.no); renumerar(arq); });
      editor.mostrarSo(opcoes.visiveis || [defs[0].nome]);
    },

    /** mostra só os arquivos do passo atual (normalmente um) */
    mostrarSo: function (nomes) {
      estado.visiveis = nomes.filter(editor.temArquivo);
      if (!estado.visiveis.length) estado.visiveis = [estado.arquivos[0].nome];
      var abas = U.limpar(document.getElementById('editor-abas'));
      estado.visiveis.forEach(function (nome) {
        var arq = estado.arquivos.filter(function (a) { return a.nome === nome; })[0];
        abas.appendChild(el('button', {
          class: 'aba', role: 'tab', type: 'button', 'data-arquivo': nome, 'aria-selected': 'false',
          onclick: function () { editor.abrirAba(nome); }
        }, [el('span', { class: 'aba-tipo tipo-' + arq.linguagem }, arq.linguagem.toUpperCase()), nome]));
      });
      editor.abrirAba(estado.visiveis[0]);
    },

    abrirAba: function (nome) {
      estado.ativo = nome;
      estado.arquivos.forEach(function (a) { a.no.hidden = a.nome !== nome; if (a.nome === nome) renumerar(a); });
      U.$$('#editor-abas .aba').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-arquivo') === nome ? 'true' : 'false'); });
    },

    arquivoAtivo: function () { return estado.ativo; },
    temArquivo: function (nome) { return estado.arquivos.some(function (a) { return a.nome === nome; }); },
    visivel: function (nome) { return (estado.visiveis || []).indexOf(nome) !== -1; },

    obterArquivos: function () {
      var r = {};
      estado.arquivos.forEach(function (a) { r[a.nome] = a.blocos.map(textoBloco).join('\n'); });
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
          if (b.tipo === 'editavel' && regioes[a.nome] && typeof regioes[a.nome][b.id] === 'string') b.campo.value = regioes[a.nome][b.id];
        });
        renumerar(a);
      });
    },
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
      estado.arquivos.forEach(function (a) { a.blocos.forEach(function (b) { if (b.campo) b.campo.readOnly = sim; }); });
    },
    aoMudar: function (fn) { estado.aoMudar = fn; },

    /** erros: [{arquivo, linha, mensagem}] → sublinhado ondulado na linha */
    marcarErros: function (erros) {
      estado.erros = {};
      (erros || []).forEach(function (e) {
        if (!e.arquivo || !e.linha) return;
        estado.erros[e.arquivo] = estado.erros[e.arquivo] || {};
        estado.erros[e.arquivo][e.linha] = e.mensagem || 'erro';
      });
      estado.arquivos.forEach(renumerar);
    },

    /** muda para a aba e destaca a linha. tipo: 'inspecao' | 'erro'. Só funciona em arquivo visível. */
    destacar: function (nome, linha, tipo) {
      var arq = estado.arquivos.filter(function (a) { return a.nome === nome; })[0];
      if (!arq || !linha || !editor.visivel(nome)) return false;
      editor.abrirAba(nome);
      var bloco = arq.blocos.filter(function (b) { return linha >= b.inicio && linha < b.inicio + b.qtd; })[0];
      if (!bloco) return false;
      if (bloco.recolhido) { bloco.recolhido = false; bloco.no.classList.remove('recolhido'); renumerar(arq); }
      U.$$('.ed-marca', arq.no).forEach(function (m) { m.remove(); });
      var off = linha - bloco.inicio;
      var marca = el('div', { class: 'ed-marca ' + (tipo || 'inspecao'), 'aria-hidden': 'true' });
      marca.style.top = (PAD + off * LH) + 'px';
      bloco.no.appendChild(marca);
      var area = document.getElementById('editor-area');
      area.scrollTo({ top: Math.max(0, bloco.no.offsetTop + PAD + off * LH - area.clientHeight / 3), behavior: 'smooth' });
      if (bloco.campo) {
        var ls = bloco.campo.value.split('\n'), pos = 0;
        for (var i = 0; i < off; i++) pos += ls[i].length + 1;
        try { bloco.campo.focus({ preventScroll: true }); bloco.campo.setSelectionRange(pos, pos); moverLinhaAtual(bloco); } catch (e) { /* ok */ }
      }
      setTimeout(function () { marca.classList.add('some'); }, 2400);
      setTimeout(function () { marca.remove(); }, 3200);
      return true;
    },

    linhaTexto: function (nome, linha) {
      var t = editor.obterArquivos()[nome];
      return t ? t.split('\n')[linha - 1] || '' : '';
    },

    focar: function () {
      var arq = estado.arquivos.filter(function (a) { return a.nome === estado.ativo; })[0];
      var b = arq && arq.blocos.filter(function (x) { return x.campo; })[0];
      if (b) b.campo.focus();
    }
  };

  Lab.editor = editor;
})();
