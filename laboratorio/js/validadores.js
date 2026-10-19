/* =====================================================================
   validadores.js — validação por COMPORTAMENTO
   Roda num segundo iframe escondido (o aluno não vê cliques simulados).
   Os critérios e detectores de erro das missões são funções que recebem
   "api" (ver agente em preview.js): elas leem o DOM, getComputedStyle,
   simulam cliques e podem pedir um teste "depois de recarregar".
   ===================================================================== */
(function () {
  'use strict';
  var Lab = window.Lab;

  var moldura = null;

  function fonte(fn) { return typeof fn === 'function' ? fn.toString() : String(fn); }

  var validadores = {
    iniciar: function (iframe) { moldura = new Lab.preview.Moldura(iframe, 'validador'); },

    /**
     * opcoes: {principal, assets, armazenamento}
     * → Promise<{travou, checks:{id:{ok,detalhe}}, detectores:{id:obj|null}, observacao, erros, naoEncontrados}>
     */
    validar: function (arquivos, etapa, opcoes) {
      opcoes = opcoes || {};
      var criterios = etapa.criterios || [];
      var fase1 = criterios.filter(function (c) { return !c.aposRecarregar; }).map(function (c) { return { id: c.id, fn: fonte(c.verificar) }; });
      var fase2 = criterios.filter(function (c) { return c.aposRecarregar; }).map(function (c) { return { id: c.id, fn: fonte(c.verificar) }; });
      var detectores = (etapa.errosPrevistos || []).filter(function (e) { return e.detectar; }).map(function (e) { return { id: e.id, fn: fonte(e.detectar) }; });
      var observar = etapa.previsao && etapa.previsao.observar ? fonte(etapa.previsao.observar) : null;
      var base = { principal: opcoes.principal, assets: opcoes.assets, armazenamento: Lab.util.clone(opcoes.armazenamento || {}) };
      var resultado = { travou: false, checks: {}, detectores: {}, observacao: null, erros: [], naoEncontrados: [] };

      return moldura.render(arquivos, base).then(function (r) {
        resultado.naoEncontrados = r.doc.naoEncontrados;
        if (!r.pronto) { resultado.travou = true; return resultado; }
        return moldura.pedir('validar', { checks: fase1, detectores: detectores, observar: observar }, 'resultado', 20000).then(function (r1) {
          if (!r1) { resultado.travou = true; return resultado; }
          resultado.checks = r1.checks;
          resultado.detectores = r1.detectores;
          resultado.observacao = r1.observacao;
          resultado.erros = r1.erros || [];
          resultado.envios = r1.envios || 0;
          if (!fase2.length) return resultado;
          // "recarrega a página": mesmo código, com o que ficou salvo no localStorage
          return moldura.render(arquivos, { principal: base.principal, assets: base.assets, armazenamento: r1.armazenamento }).then(function (rr) {
            if (!rr.pronto) { resultado.travou = true; return resultado; }
            return moldura.pedir('validar', { checks: fase2 }, 'resultado', 20000).then(function (r2) {
              if (r2) Object.keys(r2.checks).forEach(function (k) { resultado.checks[k] = r2.checks[k]; });
              return resultado;
            });
          });
        });
      });
    },

    /** tipos de erro desta execução (para o diário e o relatório) */
    classificar: function (res, etapa, errosPreview) {
      var tipos = {};
      (etapa.errosPrevistos || []).forEach(function (e) {
        if (res.detectores && res.detectores[e.id]) tipos[e.tipo || 'lógica'] = true;
      });
      (errosPreview || res.erros || []).forEach(function (e) {
        var n = e.nome || '';
        if (n === 'SyntaxError') tipos['sintaxe'] = true;
        else if (n === 'ReferenceError') tipos['escopo/referência'] = true;
        else if (n === 'TypeError' && /null|undefined/.test(e.mensagem)) tipos['seletor (elemento null)'] = true;
        else if (n === 'TypeError') tipos['tipo de dado'] = true;
        else tipos['erro de execução'] = true;
      });
      if ((res.naoEncontrados || []).length) tipos['caminho de arquivo'] = true;
      if (res.travou) tipos['travamento'] = true;
      return Object.keys(tipos);
    }
  };

  Lab.validadores = validadores;
})();
