/* =====================================================================
   console.js — Console embutido, com tradução dos erros para linguagem
   simples. A mensagem original do navegador continua visível (é ela que
   o aluno vai encontrar no DevTools de verdade).
   ===================================================================== */
(function () {
  'use strict';
  var Lab = window.Lab;
  var U = Lab.util, el = U.el;

  // [padrão da mensagem, explicação simples]
  var TRADUCOES = [
    [/Cannot read propert(?:y|ies) of (null|undefined)(?: \(reading '([^']+)'\))?/i, function (m) {
      return 'O código tentou usar ' + (m[2] ? '"' + m[2] + '" de ' : '') + 'algo que vale ' + m[1] + ' — ou seja, uma coisa que não existe naquele momento.';
    }],
    [/Cannot set propert(?:y|ies) of (null|undefined)(?: \(setting '([^']+)'\))?/i, function (m) {
      return 'O código tentou mudar ' + (m[2] ? '"' + m[2] + '" de ' : '') + 'algo que vale ' + m[1] + ' — uma coisa que não existe naquele momento.';
    }],
    [/(\S+) is not defined/i, function (m) { return 'O nome "' + m[1] + '" não existe neste ponto do código (não foi criado, foi escrito diferente ou está fora do alcance).'; }],
    [/(\S+) is not a function/i, function (m) { return '"' + m[1] + '" foi usado como função (com parênteses), mas não é uma função.'; }],
    [/Unexpected end of input/i, function () { return 'O arquivo terminou antes da hora: provavelmente falta fechar algo — uma chave }, um parêntese ) ou aspas.'; }],
    [/missing \) after argument list/i, function () { return 'Faltou fechar um parêntese ) na chamada de uma função.'; }],
    [/Unexpected token '?([^'\s]+)'?/i, function (m) { return 'O navegador encontrou "' + m[1] + '" num lugar onde não esperava. O erro costuma estar nessa linha ou logo antes.'; }],
    [/Unexpected identifier(?: '([^']+)')?/i, function (m) { return 'Apareceu um nome' + (m[1] ? ' ("' + m[1] + '")' : '') + ' onde o navegador esperava outra coisa. Falta vírgula, ponto e vírgula ou operador?'; }],
    [/Invalid or unexpected token/i, function () { return 'Tem um caractere estranho ou aspas que abriram e não fecharam.'; }],
    [/Unexpected string/i, function () { return 'Apareceu um texto entre aspas num lugar inesperado. Falta um + ou uma vírgula?'; }],
    [/Assignment to constant variable/i, function () { return 'Você tentou mudar o valor de uma const. Uma const não pode receber outro valor.'; }],
    [/has already been declared/i, function () { return 'Esse nome foi declarado duas vezes (let/const/function com o mesmo nome).'; }],
    [/is not valid JSON|JSON\.parse|Unexpected token .* in JSON/i, function () { return 'JSON.parse recebeu um texto que não está no formato JSON.'; }],
    [/Maximum call stack size exceeded/i, function () { return 'Uma função chamou a si mesma sem parar (recursão infinita).'; }]
  ];

  function traduzir(msg) {
    for (var i = 0; i < TRADUCOES.length; i++) {
      var m = TRADUCOES[i][0].exec(msg);
      if (m) return TRADUCOES[i][1](m);
    }
    return null;
  }

  var contadores = { erro: 0, aviso: 0 };

  function lugar(arquivo, linha) {
    if (!arquivo || !linha) return null;
    return el('button', {
      class: 'console-lugar', type: 'button', title: 'Mostrar no editor',
      onclick: function () {
        Lab.editor.destacar(arquivo, linha, 'erro');
        if (Lab.motor && Lab.motor.registrarConsultaConsole) Lab.motor.registrarConsultaConsole();
      }
    }, arquivo + ':' + linha);
  }

  var painel = {
    traduzir: traduzir,

    limpar: function () {
      U.limpar(document.getElementById('painel-console'));
      contadores = { erro: 0, aviso: 0 };
      painel._badge();
    },

    /** nivel: log | info | warn | error | lab ; extra: {arquivo, linha, original} */
    adicionar: function (nivel, texto, extra) {
      extra = extra || {};
      var cont = document.getElementById('painel-console');
      if (!cont) return;
      var vazio = U.$('.vazio', cont);
      if (vazio) vazio.remove();
      if (nivel === 'error') contadores.erro++;
      if (nivel === 'warn') contadores.aviso++;
      var simbolo = { error: '×', warn: '!', lab: '›', info: 'i', log: '' }[nivel] || '';
      var linha = el('div', { class: 'console-item nivel-' + nivel }, [
        el('span', { class: 'console-simbolo', 'aria-hidden': 'true' }, simbolo),
        el('div', { class: 'console-msg' }, [
          el('div', { class: 'console-texto' }, texto),
          extra.simples ? el('div', { class: 'console-simples' }, extra.simples) : null
        ]),
        lugar(extra.arquivo, extra.linha)
      ]);
      cont.appendChild(linha);
      if (cont.children.length > 300) cont.removeChild(cont.firstChild);
      cont.scrollTop = cont.scrollHeight;
      painel._badge();
    },

    erro: function (info) {
      var simples = traduzir(info.mensagem);
      painel.adicionar('error', info.nome && info.mensagem.indexOf(info.nome) !== 0 ? info.nome + ': ' + info.mensagem : info.mensagem, {
        arquivo: info.arquivo, linha: info.linha,
        simples: simples ? 'Em português: ' + simples : null
      });
    },

    _badge: function () {
      var b = document.getElementById('badge-console');
      if (!b) return;
      var t = contadores.erro ? contadores.erro + ' erro' + (contadores.erro > 1 ? 's' : '') : contadores.aviso ? contadores.aviso + ' aviso' + (contadores.aviso > 1 ? 's' : '') : '';
      b.textContent = t;
      b.className = 'badge' + (contadores.erro ? ' erro' : contadores.aviso ? ' aviso' : '');
      b.hidden = !t;
    },

    temErros: function () { return contadores.erro > 0; }
  };

  Lab.consolePainel = painel;
})();
