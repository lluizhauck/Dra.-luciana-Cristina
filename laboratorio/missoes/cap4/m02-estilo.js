/* =====================================================================
   Missão 2 — Estilo (CSS)
   O primo mandou uma folha de estilo "quase pronta". Ela tem erros
   plantados que têm CONSEQUÊNCIA visível (ou invisível!) no site.
   ===================================================================== */
window.Lab.registrarMissao({
  id: 'cap4-m2',
  numero: 2,
  versao: 1,
  titulo: 'Estilo (CSS)',
  cliente: { nome: 'Seu Raimundo', negocio: 'Açaí & Cia · cliente', iniciais: 'SR' },
  principal: 'index.html',
  abaInicial: 'index.html',
  assets: ['img/tigela-acai.svg', 'img/logo.svg'],

  abertura: [
    'Bom dia, chefe! Organizei a versão que tu fez com o Júnior. Ele mandou também o tal arquivo de estilo.',
    'Ele disse: "é só ligar o CSS que fica bonito". Mas eu abro e continua tudo branco e sem graça.'
  ],

  arquivos: [
    {
      nome: 'index.html',
      linguagem: 'html',
      modelo: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Açaí & Cia — o melhor açaí do bairro</title>
[[editavel:link]]
  <link rel="stylesheet" href="estilos.css">
[[/editavel]]
</head>
<body>
[[editavel:conteudo]]
  <header class="topo">
    <img src="img/logo.svg" alt="Açaí & Cia" class="logo">
    <nav>
      <a href="#cardapio">Cardápio</a>
      <a href="#sobre">Sobre</a>
      <a href="#contato">Contato</a>
    </nav>
  </header>

  <section class="destaque-topo">
    <h1>Açaí & Cia</h1>
    <p class="slogan">O melhor açaí do bairro, batido na hora.</p>
    <img src="img/tigela-acai.svg" alt="Tigela de açaí com banana e granola" class="foto-principal">
  </section>

  <section id="cardapio">
    <h2>Cardápio</h2>
    <div class="sabores">
      <article class="sabor">
        <h3>Açaí tradicional</h3>
        <p class="descricao">Batido com guaraná, do jeito paraense.</p>
        <p class="preco">R$ 12,00</p>
      </article>
      <article class="sabor destaque">
        <span class="selo">Mais vendido</span>
        <h3>Açaí da casa</h3>
        <p class="descricao">Granola crocante, banana e mel.</p>
        <p class="preco">R$ 16,00</p>
      </article>
      <article class="sabor">
        <h3>Açaí com morango</h3>
        <p class="descricao">Morango fresco e leite condensado.</p>
        <p class="preco">R$ 15,00</p>
      </article>
      <article class="sabor">
        <h3>Açaí com banana</h3>
        <p class="descricao">Banana prata e um fio de mel.</p>
        <p class="preco">R$ 13,00</p>
      </article>
    </div>
  </section>

  <section id="sobre">
    <h2>Sobre nós</h2>
    <p>A Açaí & Cia nasceu em 2019 na garagem da Dona Graça. Hoje a gente atende o bairro todo, sempre com fruta fresca.</p>
  </section>

  <footer id="contato" class="rodape">
    <p>Rua das Palmeiras, 120 - Cohama<br>São Luís - MA</p>
    <p>Peça pelo <a href="https://wa.me/5598988887777">WhatsApp: (98) 98888-7777</a></p>
    <p>Aberto de terça a domingo, das 14h às 22h.</p>
  </footer>
[[/editavel]]
</body>
</html>`
    },
    {
      nome: 'css/estilo.css',
      linguagem: 'css',
      modelo: `/* =============================================
   Açaí & Cia — estilo do site
   Feito pelo Júnior. "Tá quase pronto."
   ============================================= */
[[editavel:estilos]]
body {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
  background-color: #fbf6ee;
  color: #2b1a26;
}

.topo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background-color: #3d1533;
}

.topo nav a {
  color: #f6e7c8;
  text-decoration: none;
  margin-left: 20px;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 15px;
}

.logo {
  width: 180px;
}

.destaque-topo {
  text-align: center;
  padding: 40px 16px 24px;
}

h1 {
  font-size: 46px;
  colr: #5e2a50;
  margin: 0 0 8px;
}

.slogan {
  font-size: 20px;
  color: #6b4a5e;
  font-style: italic;
}

.foto-principal {
  width: 300px;
  max-width: 100%;
}

section h2 {
  text-align: center;
  font-size: 30px;
  color: #3d1533;
}

.sabores {
  max-width: 640px;
  margin: 0 auto;
  padding: 0 16px;
}

.destaque {
  background-color: #fff4d6;
  border-color: #e9b949;
}

.sabor {
  background-color: #ffffff;
  border: 2px solid #eadcc8;
  border-radius: 14px;
  padding: 20 px;
  margin-bottom: 16px;
}

.sabor h3 {
  margin: 0 0 4px;
  font-size: 22px;
}

.descricao {
  margin: 4px 0;
  font-size: 14;
}

#preco {
  color: #2e6a3e;
  font-weight: bold;
  font-size: 22px;
}

.Selo {
  display: inline-block;
  background-color: #3d1533;
  color: #ffffff;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 3px 10px;
  border-radius: 99px;
}

#sobre {
  max-width: 640px;
  margin: 32px auto;
  padding: 0 16px;
  font-size: 18px;
  line-height: 1.6;
}

.rodape {
  background-color: #3d1533;
  color: #f6e7c8;
  text-align: center;
  padding: 28px 16px;
  margin-top: 40px;
}

.rodape a {
  color: #e9b949;
}
[[/editavel]]`
    }
  ],

  etapas: [
    // ------------------------------------------------------------ E1
    {
      id: 'e1',
      titulo: 'O CSS não pega',
      resumo: "Ligue a folha de estilo ao HTML.",
      arquivo: 'index.html',
      minutos: '10–20',
      teaser: 'Ligar a folha de estilo ao HTML.',
      mensagens: [
        'Olha aí: o arquivo do Júnior tá na pasta do site, mas a página continua igualzinha. Branca, letra de documento.',
        'Será que ele esqueceu de "ligar" alguma coisa?'
      ],
      tarefa: '<p>O HTML chama o arquivo de CSS com a tag <code>&lt;link rel="stylesheet" href="caminho"&gt;</code>, que fica no <code>&lt;head&gt;</code>. Se o caminho estiver errado, o navegador não encontra o arquivo e simplesmente segue sem estilo.</p>' +
        '<p>Execute, leia o Console e confira os nomes em <strong>Arquivos do projeto</strong>. Repare: o CSS está numa aba separada do editor, como um arquivo de verdade.</p>',
      conceitos: ['<link>', 'rel="stylesheet"', 'href', 'caminho relativo', '404'],
      previsao: {
        pergunta: 'Quando o navegador finalmente encontrar o arquivo de estilo, o que você acha que vai mudar no site? Dê pelo menos dois exemplos.',
        observar: function (api) {
          if (!document.querySelector('style[data-arquivo="css/estilo.css"]')) return 'O navegador continuou sem encontrar o arquivo de estilo: o site ficou igual (fundo branco, letra padrão).';
          return 'O CSS foi carregado: o fundo da página mudou para ' + api.estilo('body', 'background-color') + ', a letra passou a ser ' + api.estilo('body', 'font-family').split(',')[0] + ', o topo ganhou fundo ' + api.estilo('.topo', 'background-color') + ' e os sabores viraram cartões com borda.';
        }
      },
      criterios: [
        { id: 'carregou', texto: 'O navegador encontra e aplica a folha de estilo do Júnior (css/estilo.css)', verificar: function (api) {
          return !!document.querySelector('style[data-arquivo="css/estilo.css"]') && !api.transparente(api.estilo('body', 'background-color'));
        } },
        { id: 'sem-404', texto: 'O Console não mostra mais nenhum arquivo não encontrado (404)', verificar: function (api) { return api.naoEncontrados.length === 0; } }
      ],
      errosPrevistos: [
        { id: 'caminho-css', tipo: 'caminho de arquivo',
          detectar: function (api) {
            var c = api.naoEncontrados.filter(function (n) { return /\.css$/i.test(n); })[0];
            return c ? { caminho: c, linha: api.linhaDe('index.html', c) } : false;
          },
          evidencia: 'O Console mostra 404 para "{caminho}" (linha {linha}). Abra "Arquivos do projeto": em que PASTA está o arquivo de estilo, e qual é o nome EXATO dele?',
          pista: 'O href é um caminho a partir da pasta do index.html. Se o arquivo está dentro de uma pasta, o nome da pasta vem antes, separado por uma barra: pasta/arquivo.css.' },
        { id: 'sem-rel', tipo: 'sintaxe (atributo)',
          detectar: function (api) {
            var f = api.fonte('index.html');
            var m = /<link\b[^>]*>/i.exec(f);
            return m && !/rel\s*=\s*["']?stylesheet/i.test(m[0]) ? { linha: api.linhaDe('index.html', /<link/i) } : false;
          },
          evidencia: 'Releia a tag <link> da linha {linha}, atributo por atributo.',
          pista: 'O <link> serve para várias coisas (ícone, fontes, estilo). O atributo rel diz QUAL é a relação: para CSS, rel="stylesheet".' }
      ],
      ajuda: {
        evidencia: 'Execute e leia a primeira mensagem vermelha do Console. Ela diz exatamente qual arquivo o navegador procurou.',
        pista: 'O navegador procura o arquivo exatamente no caminho escrito no href. Não existe "chegou perto".'
      },
      solucao: {
        explicacao: '<p>O href dizia <code>estilos.css</code>, mas o arquivo se chama <code>estilo.css</code> e está dentro da pasta <code>css</code>. O navegador procurou um arquivo que não existe (erro 404) e seguiu sem estilo, sem reclamar na tela.</p>',
        codigo: '<link rel="stylesheet" href="css/estilo.css">\n' +
          '<!--  ^ relação: folha de estilo   ^ pasta/arquivo, exatamente como está no projeto -->'
      },
      aoConcluir: 'EITA! Agora sim mudou tudo. Tem cor, tem cartãozinho... Ficou com cara de loja.'
    },

    // ------------------------------------------------------------ E2
    {
      id: 'e2',
      titulo: 'O preço sumiu na multidão',
      resumo: "Faça os preços e o título usarem as cores da marca.",
      arquivo: 'css/estilo.css',
      checklist: [{"texto": "Preços em destaque e maiores que a descrição", "criterios": ["preco-cor", "preco-tamanho"]}, {"texto": "Nome da loja na cor da marca", "criterios": ["h1-cor"]}, {"texto": "Nenhum id repetido", "criterios": ["ids-unicos"]}],
      minutos: '20–30',
      teaser: 'Seletores: tag, id e classe.',
      mensagens: [
        'Ficou bonito, mas o preço tinha que ser VERDE e grandão pra chamar atenção. O Júnior jura que colocou isso no arquivo.',
        'E o nome da loja lá em cima era pra ser roxo açaí, não preto.'
      ],
      tarefa: '<p>Um seletor diz <em>em quem</em> a regra vale:</p>' +
        '<ul><li><code>h1</code> — seletor de <strong>tag</strong> (todos os h1);</li>' +
        '<li><code>.nome</code> — seletor de <strong>classe</strong> (elementos com <code>class="nome"</code>, podem ser vários);</li>' +
        '<li><code>#nome</code> — seletor de <strong>id</strong> (o elemento com <code>id="nome"</code>, que é único).</li></ul>' +
        '<p>Use <strong>Inspecionar</strong> num preço e no título: a ficha mostra quais regras valem para cada elemento e marca declarações que o navegador ignorou.</p>',
      conceitos: ['seletor de tag', '.classe', '#id', 'propriedade: valor;', 'cor'],
      criterios: [
        { id: 'preco-cor', texto: 'Os preços aparecem em destaque, numa cor diferente do texto normal', verificar: function (api) {
          var corpo = api.cor('body', 'color');
          var ps = api.$$('.preco');
          return ps.length >= 4 && ps.every(function (p) { return api.cor(p, 'color') !== corpo; });
        } },
        { id: 'preco-tamanho', texto: 'Os preços estão maiores que o texto da descrição', verificar: function (api) {
          var d = api.$('.descricao');
          var ps = api.$$('.preco');
          return !!d && ps.length >= 4 && ps.every(function (p) { return api.px(p, 'font-size') > api.px(d, 'font-size'); });
        } },
        { id: 'h1-cor', texto: 'O nome da loja aparece na cor da marca (roxo açaí), não na cor do texto comum', verificar: function (api) {
          var h = api.$('h1');
          return !!h && api.cor(h, 'color') !== api.cor('body', 'color');
        } },
        { id: 'ids-unicos', texto: 'Nenhum id se repete na página', verificar: function (api) {
          var vistos = {};
          return api.$$('[id]').every(function (e) { if (vistos[e.id]) return false; vistos[e.id] = true; return true; });
        } }
      ],
      errosPrevistos: [
        { id: 'id-vs-classe', arquivo: 'css/estilo.css', tipo: 'seletor (id × classe)',
          detectar: function (api) {
            var css = api.css('css/estilo.css');
            var r = css.regras.filter(function (x) { return x.seletor.trim() === '#preco'; })[0];
            if (!r || !api.$('.preco') || document.getElementById('preco')) return false;
            return { linha: r.linha };
          },
          evidencia: 'Inspecione um preço no preview. A ficha lista as regras de CSS que valem para ele. A regra da linha {linha} do estilo.css aparece na lista? Compare o seletor dela com os atributos do elemento.',
          pista: '# seleciona pelo id (um elemento único: id="..."). O ponto seleciona pela classe (class="..."), que pode se repetir em vários elementos. O seletor precisa combinar com o que está escrito no HTML.' },
        { id: 'prop-errada-h1', arquivo: 'css/estilo.css', tipo: 'digitação (propriedade)',
          detectar: function (api) {
            var css = api.css('css/estilo.css');
            for (var i = 0; i < css.regras.length; i++) {
              var r = css.regras[i];
              if (!/(^|[\s,>])h1\b/.test(r.seletor)) continue;
              var d = r.decls.filter(function (x) { return !x.valida; })[0];
              if (d) return { linha: d.linha, prop: d.prop };
            }
            return false;
          },
          evidencia: 'Inspecione o título "Açaí & Cia". Na ficha, uma declaração da regra h1 aparece riscada: "{prop}" (linha {linha} do estilo.css).',
          pista: 'Quando o navegador não reconhece uma propriedade, ele ignora só aquela linha, sem avisar ninguém. Uma letra a menos basta.' },
        { id: 'id-repetido', tipo: 'estrutura (id duplicado)',
          detectar: function (api) {
            var cont = {};
            api.$$('[id]').forEach(function (e) { cont[e.id] = (cont[e.id] || 0) + 1; });
            var id = Object.keys(cont).filter(function (k) { return cont[k] > 1; })[0];
            return id ? { id: id, n: cont[id], linha: api.linhaDe('index.html', 'id="' + id + '"') } : false;
          },
          evidencia: 'O id "{id}" aparece {n} vezes no HTML (a primeira na linha {linha}).',
          pista: 'Um id é como um CPF: único na página. Para marcar vários elementos iguais, o certo é class. O navegador até pinta, mas o JavaScript (getElementById) só vai achar o primeiro.' }
      ],
      ajuda: {
        evidencia: 'Inspecione um preço e o título. Para cada um, veja quais regras do estilo.css aparecem na ficha e se alguma declaração está riscada.',
        pista: 'Se uma regra "não pega", ou o seletor não encontra o elemento, ou a declaração tem algo que o navegador não entende.'
      },
      solucao: {
        explicacao: '<p>No HTML os preços usam <code>class="preco"</code>, mas o CSS usava <code>#preco</code> (seletor de id): a regra não encontrava ninguém. E no h1 estava escrito <code>colr</code> em vez de <code>color</code>, então o navegador ignorou a linha.</p>',
        codigo: '.preco {                 /* ponto = classe (vale para os 4 preços) */\n' +
          '  color: #2e6a3e;\n' +
          '  font-weight: bold;\n' +
          '  font-size: 22px;\n' +
          '}\n\n' +
          'h1 {\n' +
          '  font-size: 46px;\n' +
          '  color: #5e2a50;          /* color, com "o" */\n' +
          '  margin: 0 0 8px;\n' +
          '}'
      },
      aoConcluir: 'AGORA SIM! Preço verdinho e o nome roxo. Minha esposa disse que parece site de shopping.'
    },

    // ------------------------------------------------------------ E3
    {
      id: 'e3',
      titulo: 'Tudo espremido',
      resumo: "Dê respiro aos cartões e aumente a letra.",
      arquivo: 'css/estilo.css',
      checklist: [{"texto": "Cartões com espaço interno", "criterios": ["padding"]}, {"texto": "Descrições com letra de 17px ou mais e boa entrelinha", "criterios": ["fonte", "entrelinha"]}, {"texto": "Pelo menos 2 comentários explicando o CSS", "criterios": ["comentarios"]}],
      minutos: '20–30',
      teaser: 'Espaçamentos, unidades de medida e comentários no CSS.',
      mensagens: [
        'Os quadradinhos dos sabores tão com o texto colado na borda. Parece apertado, sufocado.',
        'E a letra da descrição tá miudinha. Minha vista não ajuda mais, e a dos meus clientes também não kkk'
      ],
      tarefa: '<p>Todo elemento é uma caixa (box model): <code>padding</code> é o espaço <em>dentro</em> da borda; <code>margin</code> é o espaço <em>fora</em> dela. Tamanhos precisam de unidade: <code>px</code>, <code>em</code>, <code>rem</code>…</p>' +
        '<p>Deixe os cartões com respiro, aumente a letra das descrições e o espaço entre as linhas (<code>line-height</code>).</p>' +
        '<p>O Júnior não comentou nada no CSS. Deixe <strong>comentários</strong> (<code>/* ... */</code>) explicando pelo menos dois blocos, para o próximo dev que pegar o projeto.</p>',
      conceitos: ['box model', 'padding', 'margin', 'px', 'font-size', 'line-height', '/* comentários */'],
      criterios: [
        { id: 'padding', texto: 'Os cartões dos sabores têm respiro interno (o texto não encosta na borda)', verificar: function (api) {
          var s = api.$$('.sabor');
          return s.length >= 4 && s.every(function (e) { return api.px(e, 'padding-left') >= 12 && api.px(e, 'padding-top') >= 12; });
        } },
        { id: 'fonte', texto: 'O texto das descrições está maior, fácil de ler (17px ou mais)', verificar: function (api) {
          var d = api.$$('.descricao');
          return d.length >= 4 && d.every(function (e) { return api.px(e, 'font-size') >= 17; });
        } },
        { id: 'entrelinha', texto: 'As linhas da descrição não ficam espremidas (espaço entre linhas de pelo menos 1.4 vez a letra)', verificar: function (api) {
          var d = api.$('.descricao');
          if (!d) return false;
          var lh = api.estilo(d, 'line-height');
          if (lh === 'normal') return false;
          return parseFloat(lh) / api.px(d, 'font-size') >= 1.39;
        } },
        { id: 'comentarios', texto: 'O CSS tem comentários explicando pelo menos 2 blocos (além do cabeçalho do Júnior)', verificar: function (api) {
          return api.css('css/estilo.css').comentarios >= 3;
        } }
      ],
      errosPrevistos: [
        { id: 'unidade-com-espaco', arquivo: 'css/estilo.css', tipo: 'sintaxe (valor inválido)',
          detectar: function (api) {
            var css = api.css('css/estilo.css');
            for (var i = 0; i < css.regras.length; i++) {
              var d = css.regras[i].decls.filter(function (x) { return !x.valida && /\d\s+(px|em|rem|%)/.test(x.valor); })[0];
              if (d) return { linha: d.linha, prop: d.prop, valor: d.valor };
            }
            return false;
          },
          evidencia: 'Inspecione um cartão de sabor: na ficha, a declaração "{prop}: {valor}" aparece riscada (linha {linha} do estilo.css).',
          pista: 'Número e unidade andam grudados, sem espaço no meio. Com espaço, o navegador não reconhece o valor e ignora a linha inteira.' },
        { id: 'sem-unidade', arquivo: 'css/estilo.css', tipo: 'sintaxe (valor sem unidade)',
          detectar: function (api) {
            var css = api.css('css/estilo.css');
            for (var i = 0; i < css.regras.length; i++) {
              var d = css.regras[i].decls.filter(function (x) { return !x.valida && /^\d+(\.\d+)?$/.test(x.valor.trim()); })[0];
              if (d) return { linha: d.linha, prop: d.prop, valor: d.valor };
            }
            return false;
          },
          evidencia: 'Inspecione uma descrição de sabor: a declaração "{prop}: {valor}" (linha {linha}) aparece riscada.',
          pista: 'Para o CSS, um número sozinho não diz nada: {valor} o quê? Pixels (px)? em? Sem unidade, o valor é ignorado (só o zero e alguns casos como line-height aceitam número puro).' },
        { id: 'margin-no-lugar', tipo: 'lógica (box model)',
          detectar: function (api) {
            var s = api.$('.sabor');
            return s && api.px(s, 'padding-left') < 12 && api.px(s, 'margin-left') >= 12 ? { sim: true } : false;
          },
          evidencia: 'Inspecione um cartão e abra "Valores calculados": compare margin e padding.',
          pista: 'margin afasta a caixa das VIZINHAS (espaço por fora da borda). Para afastar o texto da borda, o espaço precisa ser por DENTRO.' }
      ],
      ajuda: {
        evidencia: 'Inspecione um cartão de sabor e uma descrição. Procure declarações riscadas e abra "Valores calculados".',
        pista: 'Valores de medida em CSS são escritos como 20px: número + unidade, juntos.'
      },
      solucao: {
        explicacao: '<p><code>padding: 20 px</code> tinha um espaço entre o número e a unidade, e <code>font-size: 14</code> não tinha unidade: o navegador ignorou as duas linhas. O <code>line-height</code> dá espaço entre as linhas.</p>',
        codigo: '/* Cartão de cada sabor: fundo branco, borda e respiro interno */\n' +
          '.sabor {\n' +
          '  ...\n' +
          '  padding: 20px;          /* número + unidade, grudados */\n' +
          '}\n\n' +
          '/* Texto que descreve cada sabor */\n' +
          '.descricao {\n' +
          '  margin: 4px 0;\n' +
          '  font-size: 18px;        /* com unidade */\n' +
          '  line-height: 1.5;       /* 1,5 vez o tamanho da letra */\n' +
          '}'
      },
      aoConcluir: 'Agora respira! E eu consigo ler sem óculos. Quase.'
    },

    // ------------------------------------------------------------ E4
    {
      id: 'e4',
      titulo: 'O mais vendido não aparece',
      resumo: "Destaque o sabor mais vendido.",
      arquivo: 'css/estilo.css',
      minutos: '15–25',
      teaser: 'Cascata: quando duas regras brigam.',
      mensagens: [
        'Última coisa: o Açaí da casa é o que mais vende. Era pra ter um fundo amarelinho e aquele selo "Mais vendido" bem chamativo.',
        'Tá igualzinho aos outros. O selo é só um texto pequeno perdido ali.'
      ],
      tarefa: '<p>Um elemento pode ter várias classes: <code>class="sabor destaque"</code>. Quando duas regras com a mesma força mudam a mesma propriedade, o navegador precisa decidir quem vence — isso é a <strong>cascata</strong>.</p>' +
        '<p>Inspecione o cartão do Açaí da casa e o selo. A ficha mostra as regras na ordem em que valem.</p>',
      conceitos: ['várias classes', 'cascata', 'ordem das regras', 'especificidade', 'maiúsculas contam'],
      criterios: [
        { id: 'destaque', texto: 'O cartão do Açaí da casa tem fundo diferente dos outros cartões', verificar: function (api) {
          var d = api.$('.sabor.destaque'), n = api.$('.sabor:not(.destaque)');
          return !!d && !!n && api.cor(d, 'background-color') !== api.cor(n, 'background-color');
        } },
        { id: 'selo', texto: 'O selo "Mais vendido" aparece como uma etiqueta, com fundo colorido', verificar: function (api) {
          var s = api.$('.selo');
          return !!s && !api.transparente(api.estilo(s, 'background-color')) && api.px(s, 'padding-left') > 0;
        } },
        { id: 'selo-legivel', texto: 'O texto do selo tem contraste com o fundo dele', verificar: function (api) {
          var s = api.$('.selo');
          return !!s && api.cor(s, 'color') !== api.cor(s, 'background-color');
        } }
      ],
      errosPrevistos: [
        { id: 'ordem-cascata', arquivo: 'css/estilo.css', tipo: 'cascata (ordem das regras)',
          detectar: function (api) {
            var css = api.css('css/estilo.css');
            var d = css.regras.filter(function (r) { return r.seletor.trim() === '.destaque'; })[0];
            var s = css.regras.filter(function (r) { return r.seletor.trim() === '.sabor'; })[0];
            if (!d || !s || d.linha > s.linha) return false;
            var el = api.$('.sabor.destaque'), n = api.$('.sabor:not(.destaque)');
            if (!el || !n || api.cor(el, 'background-color') !== api.cor(n, 'background-color')) return false;
            return { linhaDestaque: d.linha, linhaSabor: s.linha };
          },
          evidencia: 'Inspecione o cartão do Açaí da casa: as regras .destaque (linha {linhaDestaque}) e .sabor (linha {linhaSabor}) aparecem na ficha e as duas mudam o fundo. Qual delas vem por último no arquivo?',
          pista: 'Quando duas regras têm a mesma força (aqui, uma classe cada) e mudam a mesma propriedade, vence a que aparece DEPOIS no CSS. É a "cascata": a água que vem depois passa por cima.' },
        { id: 'maiuscula', arquivo: 'css/estilo.css', tipo: 'seletor (maiúsculas)',
          detectar: function (api) {
            var css = api.css('css/estilo.css');
            var r = css.regras.filter(function (x) { return /\.selo\b/i.test(x.seletor) && !/\.selo\b/.test(x.seletor); })[0];
            return r && !api.$$('.selo').some(function (e) { return getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)'; }) ? { linha: r.linha, seletor: r.seletor } : false;
          },
          evidencia: 'Inspecione o selo "Mais vendido": nenhuma regra com fundo aparece para ele. Compare, letra por letra, o seletor "{seletor}" (linha {linha}) com o class escrito no HTML.',
          pista: 'Nomes de classe diferenciam maiúsculas de minúsculas: .Selo e .selo são classes DIFERENTES para o navegador.' }
      ],
      ajuda: {
        evidencia: 'Inspecione o cartão destacado e o selo. Para cada um, confira quais regras aparecem e em que ordem.',
        pista: 'Duas perguntas: a regra encontra o elemento? Se encontra, existe outra regra que vem depois e muda a mesma coisa?'
      },
      solucao: {
        explicacao: '<p>A regra <code>.destaque</code> vinha <em>antes</em> da <code>.sabor</code>; as duas têm a mesma força, então o fundo branco da <code>.sabor</code> vencia. Basta mover <code>.destaque</code> para depois (ou usar um seletor mais forte, como <code>.sabor.destaque</code>). E o CSS dizia <code>.Selo</code>, com S maiúsculo, mas o HTML usa <code>selo</code>.</p>',
        codigo: '.sabor { background-color: #ffffff; ... }\n\n' +
          '/* Depois da .sabor: na cascata, quem vem por último vence */\n' +
          '.destaque {\n' +
          '  background-color: #fff4d6;\n' +
          '  border-color: #e9b949;\n' +
          '}\n\n' +
          '.selo {                   /* minúsculo, igual ao HTML */\n' +
          '  ...\n' +
          '}'
      },
      aoConcluir: 'É ISSO! O Açaí da casa brilhando com o selinho. Vou vender o dobro.'
    }
  ],

  raiox: {
    intro: 'Agora cada elemento mostra também as regras de CSS que o enfeitam, com a linha do estilo.css. Repare em quantas regras um único elemento pode receber.',
    pergunta: 'No começo, a regra #preco existia e não tinha nenhum erro de digitação, mas os preços não mudavam. Explique com suas palavras por que isso acontecia e como o navegador decide quais regras valem para cada elemento.'
  },

  encerramento: 'Ficou LINDO. Mandei pro grupo da família e todo mundo perguntou quem fez. Agora o próximo passo: quero que o povo consiga montar o pedido pelo site. Tem um botão de "Adicionar", mas ele não faz nada…',

  aquecimento: [
    'Qual é a diferença entre um seletor que começa com # e um que começa com . (ponto)? Dê um exemplo de quando usar cada um.',
    'Por que "padding: 20 px" não funcionou? O que o navegador fez com essa linha?',
    'Duas regras mudam a cor de fundo do mesmo elemento. Como o navegador decide qual vale?',
    'O que acontece quando o href do <link> aponta para um arquivo que não existe?'
  ]
});
