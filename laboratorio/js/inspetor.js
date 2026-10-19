/* =====================================================================
   inspetor.js — ferramenta "Inspecionar": o aluno clica num elemento do
   preview e vê de onde ele vem (linha do HTML, regras de CSS, linhas de JS).
   O mesmo desenho de ficha é usado no Raio-X.
   ===================================================================== */
(function () {
  'use strict';
  var Lab = window.Lab;
  var U = Lab.util, el = U.el;

  function irPara(arquivo, linha) {
    return function () {
      if (Lab.editor.temArquivo(arquivo)) Lab.editor.destacar(arquivo, linha, 'inspecao');
    };
  }

  function nomeElemento(info) {
    return '<' + info.tag + (info.id ? ' id="' + info.id + '"' : '') + (info.classes.length ? ' class="' + info.classes.join(' ') + '"' : '') + '>';
  }

  /** desenha a ficha de um elemento. opcoes.navegar: botões que levam ao editor */
  function renderInfo(cont, info, opcoes) {
    opcoes = opcoes || {};
    U.limpar(cont);
    var principal = Lab.motor && Lab.motor.arquivoPrincipal ? Lab.motor.arquivoPrincipal() : 'index.html';
    var arquivos = opcoes.arquivos || Lab.editor.obterArquivos();
    function trecho(arquivo, linha) {
      var t = arquivos[arquivo];
      return t ? (t.split('\n')[linha - 1] || '').trim() : '';
    }
    function botaoLinha(arquivo, linha) {
      var rot = arquivo + ':' + linha;
      if (!opcoes.navegar) return el('span', { class: 'insp-lugar' }, rot);
      return el('button', { type: 'button', class: 'insp-lugar', onclick: irPara(arquivo, linha), title: 'Mostrar no editor' }, rot);
    }

    cont.appendChild(el('div', { class: 'insp-elemento' }, [
      el('code', null, nomeElemento(info)),
      info.texto ? el('p', { class: 'insp-texto' }, '“' + info.texto + (info.texto.length >= 70 ? '…' : '') + '”') : null
    ]));

    // HTML
    var secHtml = el('section', { class: 'insp-sec' }, [el('h4', null, [el('span', { class: 'tag-ling html' }, 'HTML'), ' quem cria o elemento'])]);
    if (info.linha) {
      secHtml.appendChild(el('div', { class: 'insp-linha' }, [botaoLinha(principal, info.linha), el('code', null, trecho(principal, info.linha))]));
    } else {
      secHtml.appendChild(el('p', { class: 'insp-vazio' }, 'Elemento criado pelo navegador ou pelo JavaScript (não está escrito no HTML).'));
    }
    cont.appendChild(secHtml);

    // CSS
    var secCss = el('section', { class: 'insp-sec' }, [el('h4', null, [el('span', { class: 'tag-ling css' }, 'CSS'), ' regras que valem para ele'])]);
    if (!info.css.length) {
      secCss.appendChild(el('p', { class: 'insp-vazio' }, 'Nenhuma regra de CSS do site seleciona este elemento. Ele usa só o estilo padrão do navegador (ou herda do elemento pai).'));
    }
    info.css.slice().reverse().forEach(function (r) {
      var bloco = el('div', { class: 'insp-regra' + (r.ativa === false ? ' inativa' : '') }, [
        el('div', { class: 'insp-regra-cab' }, [
          el('code', { class: 'insp-seletor' }, r.seletor + (r.media ? '  (' + r.media + (r.ativa === false ? ' – não vale nesta largura' : '') + ')' : '')),
          r.linha ? botaoLinha(r.arquivo, r.linha) : null
        ])
      ]);
      if (r.decls && r.decls.length) {
        bloco.appendChild(el('ul', { class: 'insp-decls' }, r.decls.map(function (d) {
          return el('li', { class: d.valida ? '' : 'invalida', title: d.valida ? '' : 'O navegador não reconheceu esta declaração e a ignorou.' }, [
            el('code', null, d.prop + ': ' + d.valor + ';'),
            d.valida ? null : el('span', { class: 'insp-alerta' }, ' ignorada pelo navegador')
          ]);
        })));
      }
      secCss.appendChild(bloco);
    });
    var est = info.estilos || {};
    secCss.appendChild(el('details', { class: 'insp-calc' }, [
      el('summary', null, 'Valores calculados (como o navegador desenhou)'),
      el('dl', null, Object.keys(est).reduce(function (acc, k) { return acc.concat([el('dt', null, k), el('dd', null, est[k])]); }, []))
    ]));
    cont.appendChild(secCss);

    // JS
    var secJs = el('section', { class: 'insp-sec' }, [el('h4', null, [el('span', { class: 'tag-ling js' }, 'JS'), ' linhas que mexem nele'])]);
    if (!info.js.length) secJs.appendChild(el('p', { class: 'insp-vazio' }, 'Nenhuma linha de JavaScript encontrou ou alterou este elemento.'));
    info.js.forEach(function (j) {
      secJs.appendChild(el('div', { class: 'insp-linha' }, [botaoLinha(j.arquivo, j.linha), el('code', null, j.acao)]));
    });
    cont.appendChild(secJs);
  }

  var inspetor = {
    ativo: false,
    renderInfo: renderInfo,

    alternar: function (forcar) {
      inspetor.ativo = typeof forcar === 'boolean' ? forcar : !inspetor.ativo;
      var bt = document.getElementById('bt-inspecionar');
      if (bt) bt.setAttribute('aria-pressed', inspetor.ativo ? 'true' : 'false');
      document.getElementById('moldura-navegador').classList.toggle('inspecionando', inspetor.ativo);
      if (Lab.motor.molduraPreview) Lab.motor.molduraPreview.enviar('inspecionar', inspetor.ativo);
      if (!inspetor.ativo) inspetor.fechar();
    },

    /** chamado quando o aluno clica num elemento do preview */
    mostrar: function (info) {
      var pop = document.getElementById('inspetor-ficha');
      renderInfo(U.$('.insp-corpo', pop), info, { navegar: true });
      pop.hidden = false;
      if (info.linha) Lab.editor.destacar(Lab.motor.arquivoPrincipal(), info.linha, 'inspecao');
      Lab.motor.registrarInspecao(info);
    },

    fechar: function () {
      var pop = document.getElementById('inspetor-ficha');
      if (pop) pop.hidden = true;
    }
  };

  Lab.inspetor = inspetor;
})();
