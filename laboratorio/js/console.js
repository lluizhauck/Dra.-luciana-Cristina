/* =====================================================================
   console.js — Console embutido.
   Na tela de atividade ele fica escondido: quando há erro, uma FAIXA
   discreta mostra UMA mensagem em linguagem simples, com "Ver detalhes"
   (a gaveta com tudo o que o navegador disse). A mensagem original
   continua visível nos detalhes: é ela que o aluno verá no DevTools.
   ===================================================================== */
(function () {
  'use strict';
  var Lab = window.Lab;
  var U = Lab.util, el = U.el;

  var TRADUCOES = [
    [/Cannot read propert(?:y|ies) of (null|undefined)(?: \(reading '([^']+)'\))?/i, function (m) {
      return 'O código tentou usar ' + (m[2] ? '"' + m[2] + '" de ' : '') + 'algo que vale ' + m[1] + ': uma coisa que não existe naquele momento.';
    }],
    [/Cannot set propert(?:y|ies) of (null|undefined)(?: \(setting '([^']+)'\))?/i, function (m) {
      return 'O código tentou mudar ' + (m[2] ? '"' + m[2] + '" de ' : '') + 'algo que vale ' + m[1] + ': uma coisa que não existe naquele momento.';
    }],
    [/(\S+) is not defined/i, function (m) { return 'O nome "' + m[1] + '" não existe neste ponto do código (não foi criado, foi escrito diferente ou está fora do alcance).'; }],
    [/(\S+) is not a function/i, function (m) { return '"' + m[1] + '" foi usado como função (com parênteses), mas não é uma função.'; }],
    [/Unexpected end of input/i, function () { return 'O arquivo terminou antes da hora: provavelmente falta fechar uma chave }, um parêntese ) ou aspas.'; }],
    [/missing \) after argument list/i, function () { return 'Faltou fechar um parêntese ) na chamada de uma função.'; }],
    [/Unexpected token '?([^'\s]+)'?/i, function (m) { return 'O navegador encontrou "' + m[1] + '" onde não esperava. O erro costuma estar nessa linha ou logo antes.'; }],
    [/Unexpected identifier(?: '([^']+)')?/i, function (m) { return 'Apareceu um nome' + (m[1] ? ' ("' + m[1] + '")' : '') + ' onde o navegador esperava outra coisa. Falta vírgula, ponto e vírgula ou operador?'; }],
    [/Invalid or unexpected token/i, function () { return 'Tem um caractere estranho ou aspas que abriram e não fecharam.'; }],
    [/Unexpected string/i, function () { return 'Apareceu um texto entre aspas num lugar inesperado. Falta um + ou uma vírgula?'; }],
    [/Assignment to constant variable/i, function () { return 'Você tentou mudar o valor de uma const. Uma const não pode receber outro valor.'; }],
    [/has already been declared/i, function () { return 'Esse nome foi declarado duas vezes.'; }],
    [/is not valid JSON|JSON\.parse|Unexpected token .* in JSON/i, function () { return 'JSON.parse recebeu um texto que não está no formato JSON.'; }],
    [/Maximum call stack size exceeded/i, function () { return 'Uma função chamou a si mesma sem parar.'; }]
  ];
  function traduzir(msg) {
    for (var i = 0; i < TRADUCOES.length; i++) {
      var m = TRADUCOES[i][0].exec(msg);
      if (m) return TRADUCOES[i][1](m);
    }
    return null;
  }

  var itens = [];          // tudo o que chegou nesta execução
  var faixaFechada = false;
  var atualizarFaixa = null;

  function lugar(arquivo, linha) {
    if (!arquivo || !linha) return null;
    return el('button', {
      class: 'console-lugar', type: 'button', title: 'Mostrar no editor',
      onclick: function () {
        if (!Lab.editor.destacar(arquivo, linha, 'erro')) Lab.ui.aviso('Esse arquivo não está aberto neste passo.');
        else if (Lab.motor && Lab.motor.registrarConsultaConsole) Lab.motor.registrarConsultaConsole();
      }
    }, arquivo + ':' + linha);
  }

  function renderItem(it) {
    var simbolo = { error: 'alerta', warn: 'alerta', lab: 'seta', info: 'seta', log: 'seta' }[it.nivel] || 'seta';
    return el('div', { class: 'console-item nivel-' + it.nivel }, [
      Lab.iconeEl(simbolo, 'console-ico'),
      el('div', { class: 'console-msg' }, [
        el('div', { class: 'console-texto' }, it.texto),
        it.simples ? el('div', { class: 'console-simples' }, it.simples) : null
      ]),
      lugar(it.arquivo, it.linha)
    ]);
  }

  var painel = {
    traduzir: traduzir,

    limpar: function () {
      itens = [];
      faixaFechada = false;
      var cont = document.getElementById('painel-console');
      if (cont) U.limpar(cont).appendChild(el('p', { class: 'vazio' }, 'Nada por aqui. As mensagens do navegador aparecem quando você executa o código.'));
      painel.mostrarFaixa();
    },

    /** nivel: log | info | warn | error | lab ; extra: {arquivo, linha, simples} */
    adicionar: function (nivel, texto, extra) {
      extra = extra || {};
      var it = { nivel: nivel, texto: texto, arquivo: extra.arquivo, linha: extra.linha, simples: extra.simples, em: Date.now() };
      itens.push(it);
      var cont = document.getElementById('painel-console');
      if (cont) {
        var vazio = U.$('.vazio', cont);
        if (vazio) vazio.remove();
        cont.appendChild(renderItem(it));
        if (cont.children.length > 300) cont.removeChild(cont.firstChild);
        cont.scrollTop = cont.scrollHeight;
      }
      clearTimeout(atualizarFaixa);
      atualizarFaixa = setTimeout(painel.mostrarFaixa, 60);
    },

    erro: function (info) {
      var simples = traduzir(info.mensagem);
      var texto = info.nome && info.mensagem.indexOf(info.nome) !== 0 ? info.nome + ': ' + info.mensagem : info.mensagem;
      painel.adicionar('error', texto, { arquivo: info.arquivo, linha: info.linha, simples: simples });
    },

    /** primeira mensagem importante (erro > aviso) */
    principal: function () {
      return itens.filter(function (i) { return i.nivel === 'error'; })[0] || itens.filter(function (i) { return i.nivel === 'warn'; })[0] || null;
    },

    erros: function () { return itens.filter(function (i) { return i.nivel === 'error'; }); },

    mostrarFaixa: function () {
      var f = document.getElementById('faixa-console');
      if (!f) return;
      var p = painel.principal();
      var n = itens.filter(function (i) { return i.nivel === 'error' || i.nivel === 'warn'; }).length;
      if (!p || faixaFechada) { f.hidden = true; return; }
      f.className = 'faixa-console ' + (p.nivel === 'error' ? 'erro' : 'aviso');
      U.$('.faixa-texto', f).textContent = p.simples ? p.simples.replace(/^Em português:\s*/, '') : p.texto;
      U.$('.faixa-lugar', f).textContent = p.arquivo && p.linha ? p.arquivo + ' · linha ' + p.linha : '';
      U.$('.faixa-mais', f).textContent = n > 1 ? '+' + (n - 1) : '';
      f.hidden = false;
    },
    fecharFaixa: function () {
      faixaFechada = true;
      var f = document.getElementById('faixa-console');
      if (f) f.hidden = true;
    },

    temErros: function () { return itens.some(function (i) { return i.nivel === 'error'; }); }
  };

  Lab.consolePainel = painel;
})();
