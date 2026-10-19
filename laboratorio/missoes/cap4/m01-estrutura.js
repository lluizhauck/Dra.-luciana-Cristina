/* =====================================================================
   Missão 1 — Estrutura (HTML)
   Tudo aqui é DADO: o motor lê e monta a missão.
   - criterios[].verificar(api): roda dentro do site (iframe) e devolve
     true/false. Deve ser autocontida (só usa "api", "document", "window").
   - errosPrevistos[].detectar(api): devolve false ou um objeto com dados
     ({linha, ...}) que preenchem {chaves} na evidência e na pista.
   ===================================================================== */
window.Lab.registrarMissao({
  id: 'cap4-m1',
  numero: 1,
  versao: 1,
  titulo: 'Estrutura (HTML)',
  cliente: { nome: 'Seu Raimundo', negocio: 'Açaí & Cia · cliente', iniciais: 'SR' },
  principal: 'index.html',
  assets: ['img/tigela-acai.svg', 'img/logo.svg'],

  abertura: [
    'Opa, bom dia! Aqui é o Raimundo, da Açaí & Cia. O pessoal da escola disse que tu mexe com site.',
    'Meu primo Júnior começou o site da loja mas largou no meio, foi trabalhar de motoboy kkkk',
    'Quero vender pelo site até o fim do mês. Dá uma olhada aí. Tá tudo esquisito.'
  ],

  arquivos: [{
    nome: 'index.html',
    linguagem: 'html',
    modelo: `<!-- Rascunho do site da Açaí & Cia. Feito pelo Júnior, primo do Seu Raimundo. -->
[[editavel:pagina]]
Açaí & Cia
O melhor açaí do bairro, batido na hora.

<h2>Cardápio

Açaí tradicional: batido com guaraná, do jeito paraense.
Açaí com banana
Açaí com morango e leite condensado
Açaí da casa: granola, banana e mel

Tamanhos
300 ml - R$ 12,00
500 ml - R$ 18,00
700 ml - R$ 24,00

<img src="imagens/acai.png">

Sobre nós
A Açaí & Cia nasceu em 2019 na garagem da Dona Graça. Hoje a gente atende o bairro todo, sempre com fruta fresca.

Contato
Rua das Palmeiras, 120 - Cohama
São Luís - MA
Peça pelo <a href="wa.me/5598988887777">WhatsApp: (98) 98888-7777
Aberto de terça a domingo, das 14h às 22h.
Siga a gente no Instagram: @acaiecia
[[/editavel]]`
  }],

  etapas: [
    // ------------------------------------------------------------ E1
    {
      id: 'e1',
      titulo: 'A aba sem nome',
      minutos: '15–25',
      teaser: 'Você vai montar o esqueleto da página (head e body).',
      mensagens: [
        'Primeira coisa: abri no celular e lá em cima, na abinha do navegador, tá escrito index.html. Quero o NOME DA LOJA ali.',
        'O Júnior falou que faltava a "cabeça" e o "corpo" do site. Sei lá o que é isso, tu que entende.'
      ],
      tarefa: '<p>Toda página HTML tem um <strong>esqueleto</strong>: a declaração <code>&lt;!DOCTYPE html&gt;</code>, o elemento <code>&lt;html&gt;</code> e, dentro dele, duas partes: <code>&lt;head&gt;</code> (informações <em>sobre</em> a página, que não aparecem no conteúdo) e <code>&lt;body&gt;</code> (o que aparece na tela).</p>' +
        '<p>Monte esse esqueleto em volta do rascunho. No head, coloque o título da aba e a codificação de caracteres.</p>' +
        '<p>Primeiro clique em <strong>Executar</strong> sem mudar nada, para ver como o site está. O texto grudado e gigante fica para a próxima etapa.</p>',
      conceitos: ['<!DOCTYPE html>', '<html>', '<head>', '<body>', '<title>', '<meta charset>'],
      criterios: [
        { id: 'doctype', texto: 'A primeira coisa do arquivo (depois do comentário) é a declaração <!DOCTYPE html>', verificar: function (api) {
          return /^\s*(<!--[\s\S]*?-->\s*)*<!doctype\s+html\s*>/i.test(api.fonte());
        } },
        { id: 'titulo', texto: 'A aba do navegador mostra o nome da loja (Açaí & Cia)', verificar: function (api) {
          var t = api.$('head > title');
          return !!t && /a[çc]a[íi]/i.test(t.textContent) && /cia/i.test(t.textContent);
        } },
        { id: 'charset', texto: 'O head declara a codificação UTF-8 (para acentos e ç)', verificar: function (api) {
          var f = api.fonte().replace(/<!--[\s\S]*?-->/g, '');
          var h = /<head[\s>][\s\S]*?<\/head>/i.exec(f);
          return !!h && /<meta\s+charset\s*=\s*["']?utf-8["']?\s*\/?>/i.test(h[0]);
        } },
        { id: 'partes', texto: 'O código tem <html>, <head> e <body>, cada um aberto e fechado, na ordem certa', verificar: function (api) {
          var f = api.fonte().replace(/<!--[\s\S]*?-->/g, '');
          var a = f.search(/<html[\s>]/i), i = f.search(/<head[\s>]/i), j = f.search(/<\/head\s*>/i), k = f.search(/<body[\s>]/i), l = f.search(/<\/body\s*>/i), z = f.search(/<\/html\s*>/i);
          return a !== -1 && i > a && j > i && k > j && l > k && z > l;
        } },
        { id: 'conteudo', texto: 'Todo o texto que aparece no site está dentro do <body>', verificar: function (api) {
          var f = api.fonte().replace(/<!--[\s\S]*?-->/g, '');
          var k = f.search(/<body[\s>]/i), l = f.search(/<\/body\s*>/i);
          if (k === -1 || l === -1) return false;
          var antes = f.slice(0, k).replace(/<title[\s\S]*?<\/title\s*>/i, '').replace(/<[^>]*>/g, '').trim();
          var depois = f.slice(l).replace(/<[^>]*>/g, '').trim();
          return antes === '' && depois === '' && /O melhor açaí/.test(f.slice(k, l));
        } }
      ],
      errosPrevistos: [
        { id: 'sem-doctype', tipo: 'estrutura',
          detectar: function (api) { return !/^\s*(<!--[\s\S]*?-->\s*)*<!doctype\s+html\s*>/i.test(api.fonte()); },
          evidencia: 'Olhe com atenção o começo do arquivo e compare com o esqueleto da tarefa. Sem a declaração certa no topo, um navegador de verdade desenha a página em "modo de compatibilidade", imitando navegadores dos anos 2000.',
          pista: 'Uma página HTML moderna começa com uma declaração que diz ao navegador qual versão de HTML ela usa. Sem ela, o navegador imita navegadores antigos.' },
        { id: 'sem-title', tipo: 'estrutura',
          detectar: function (api) { return !api.$('title'); },
          evidencia: 'Olhe a aba do navegador, em cima do preview: ela mostra o nome do arquivo. É isso que todo navegador faz quando a página não tem título.',
          pista: 'O texto da aba vem de uma tag própria, que fica no head (as informações SOBRE a página).' },
        { id: 'title-fora', tipo: 'estrutura',
          detectar: function (api) {
            var t = api.$('title');
            return t && !api.$('head > title') ? { linha: api.linhaDoElemento(t) } : false;
          },
          evidencia: 'O <title> está na linha {linha}. Siga as tags de cima para baixo até chegar nele: nesse ponto, qual bloco está aberto, o <head> ou o <body>?',
          pista: 'O head guarda informações sobre a página (título da aba, codificação, links para CSS). O body guarda o que aparece na tela. Cada coisa no seu lugar.' },
        { id: 'texto-fora-body', tipo: 'estrutura',
          detectar: function (api) {
            var f = api.fonte();
            var linhas = f.split('\n');
            var limpo = f.replace(/<!--[\s\S]*?-->/g, function (m) { return m.replace(/[^\n]/g, ' '); });
            var k = limpo.search(/<body[\s>]/i);
            if (k === -1) return false;
            var antes = limpo.slice(0, k).replace(/<title[\s\S]*?<\/title\s*>/i, function (m) { return m.replace(/[^\n]/g, ' '); }).replace(/<[^>]*>/g, function (m) { return m.replace(/[^\n]/g, ' '); });
            var ls = antes.split('\n');
            for (var i = 0; i < ls.length; i++) if (ls[i].trim()) return { linha: i + 1, texto: linhas[i].trim().slice(0, 30) };
            return false;
          },
          evidencia: 'Tem texto do site ANTES do <body>, na linha {linha} ("{texto}…"). O navegador até mostra, mas a estrutura fica errada.',
          pista: 'Tudo que o visitante vê na tela precisa estar entre <body> e </body>.' }
      ],
      ajuda: {
        evidencia: 'Compare o seu código com o esqueleto descrito na tarefa, de cima para baixo. Olhe também a aba do navegador no topo do preview.',
        pista: 'Pense numa carta: o envelope tem informações sobre a carta (destinatário, remetente) e dentro vai o conteúdo. O head é o envelope, o body é a carta.'
      },
      solucao: {
        explicacao: '<p>Faltava o esqueleto da página. Sem o <code>&lt;!DOCTYPE html&gt;</code>, o navegador entra em modo de compatibilidade. Sem <code>&lt;title&gt;</code> dentro do <code>&lt;head&gt;</code>, a aba mostra o nome do arquivo. E todo o conteúdo visível precisa ficar no <code>&lt;body&gt;</code>.</p>',
        codigo: '<!DOCTYPE html>               <!-- 1ª linha: "esta página é HTML5" -->\n' +
          '<html lang="pt-BR">           <!-- abre o documento (em português) -->\n' +
          '<head>                        <!-- informações SOBRE a página -->\n' +
          '  <meta charset="UTF-8">      <!-- acentos e ç aparecem certos -->\n' +
          '  <title>Açaí & Cia</title>   <!-- texto da aba do navegador -->\n' +
          '</head>\n' +
          '<body>                        <!-- tudo o que aparece na tela -->\n' +
          '  ...o texto do rascunho fica aqui dentro...\n' +
          '</body>\n' +
          '</html>'
      },
      aoConcluir: 'Agora sim! Apareceu "Açaí & Cia" na abinha. Minha esposa até printou.'
    },

    // ------------------------------------------------------------ E2
    {
      id: 'e2',
      titulo: 'Tudo virou outdoor',
      minutos: '20–30',
      teaser: 'Títulos e parágrafos: o texto gigante e grudado.',
      mensagens: [
        'Agora o principal: depois da palavra Cardápio fica TUDO GIGANTE, parece outdoor de político.',
        'E o resto tá tudo grudado numa linha só, ninguém consegue ler. Quero o nome da loja bem grandão em cima e cada parte separadinha.',
        'O endereço também: rua numa linha, cidade na outra, que nem em envelope.'
      ],
      tarefa: '<p>No HTML, quebrar linha no código <strong>não</strong> quebra linha na tela: o navegador junta tudo. Quem organiza o texto são as tags.</p>' +
        '<ul><li>Títulos: <code>&lt;h1&gt;</code> (o principal, só um) até <code>&lt;h6&gt;</code>. Use <code>&lt;h2&gt;</code> para as seções Cardápio, Sobre nós e Contato.</li>' +
        '<li>Parágrafos: <code>&lt;p&gt;</code>. Quebra de linha dentro de um parágrafo: <code>&lt;br&gt;</code>.</li></ul>' +
        '<p>Algo no rascunho está deixando tudo gigante. Investigue com <strong>Inspecionar</strong> antes de sair mudando.</p>',
      conceitos: ['<h1>…<h6>', '<p>', '<br>', 'abrir e fechar tags'],
      previsao: {
        pergunta: 'Olhe no seu código o texto "Açaí com banana". Quando você executar, de que tamanho ele vai aparecer na tela, e dentro de qual tag ele vai estar?',
        observar: function (api) {
          var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          var n;
          while ((n = w.nextNode())) { if (/com banana/.test(n.nodeValue)) break; }
          if (!n) return 'O texto "Açaí com banana" não apareceu na página.';
          var p = n.parentElement, cadeia = [], e = p;
          while (e && e !== document.body) { cadeia.unshift('<' + e.tagName.toLowerCase() + '>'); e = e.parentElement; }
          var cs = getComputedStyle(p);
          return 'O texto "Açaí com banana" apareceu com letra de ' + cs.fontSize + (parseInt(cs.fontWeight, 10) >= 600 ? ', em negrito' : '') +
            ', dentro de: <body>' + (cadeia.length ? ' › ' + cadeia.join(' › ') : ' (direto)') + '.';
        }
      },
      criterios: [
        { id: 'h1', texto: 'O nome da loja é o título principal da página (um único <h1>)', verificar: function (api) {
          var h = api.$$('h1');
          return h.length === 1 && /a[çc]a[íi]\s*&\s*cia/i.test(h[0].textContent) && h[0].textContent.trim().length < 40;
        } },
        { id: 'h2', texto: 'Cardápio, Sobre nós e Contato são subtítulos (<h2>) curtinhos', verificar: function (api) {
          var h2 = api.$$('h2').map(function (h) { return h.textContent.replace(/\s+/g, ' ').trim().toLowerCase(); });
          return ['card', 'sobre', 'contato'].every(function (p) { return h2.some(function (t) { return t.indexOf(p) !== -1 && t.length <= 25; }); });
        } },
        { id: 'p', texto: 'O slogan e o texto do "Sobre nós" estão em parágrafos (<p>)', verificar: function (api) {
          var ps = api.$$('p').map(function (p) { return p.textContent; });
          return ps.some(function (t) { return /melhor açaí/i.test(t); }) && ps.some(function (t) { return /garagem/i.test(t); });
        } },
        { id: 'br', texto: 'O endereço aparece em linhas separadas (rua numa linha, cidade na outra)', verificar: function (api) {
          var alvo = api.$$('body *').filter(function (e) { return /Palmeiras/.test(e.textContent) && /S[ãa]o Lu[íi]s/.test(e.textContent); });
          var menor = alvo.filter(function (e) { return !alvo.some(function (o) { return o !== e && e.contains(o); }); })[0];
          return !!menor && !!menor.querySelector('br');
        } },
        { id: 'sem-gigante', texto: 'Nenhum texto comum ficou com cara de título (nada gigante por engano)', verificar: function (api) {
          return api.$$('h1, h2, h3, h4, h5, h6').every(function (h) { return h.textContent.replace(/\s+/g, ' ').trim().length <= 40; });
        } }
      ],
      errosPrevistos: [
        { id: 'titulo-aberto', tipo: 'estrutura (tag sem fechamento)',
          detectar: function (api) {
            var h = api.$$('h1, h2, h3, h4, h5, h6').filter(function (x) { return x.textContent.replace(/\s+/g, ' ').trim().length > 40; })[0];
            return h ? { linha: api.linhaDoElemento(h), tag: h.tagName.toLowerCase() } : false;
          },
          evidencia: 'Ligue o Inspecionar e clique no texto "Açaí com banana" no preview. O editor marca a linha onde começa o elemento que contém esse texto: linha {linha}. Que tag é essa?',
          pista: 'Toda tag de título abre e fecha. O navegador considera que TUDO o que vem depois de <{tag}> faz parte do título, até encontrar o </{tag}>.' },
        { id: 'fecha-trocado', tipo: 'sintaxe (fechamento trocado)',
          detectar: function (api) {
            var f = api.fonte().replace(/<!--[\s\S]*?-->/g, '');
            for (var n = 1; n <= 6; n++) {
              var abre = (f.match(new RegExp('<h' + n + '[\\s>]', 'gi')) || []).length;
              var fecha = (f.match(new RegExp('</h' + n + '\\s*>', 'gi')) || []).length;
              if (abre !== fecha) return { tag: 'h' + n, abre: abre, fecha: fecha };
            }
            return false;
          },
          evidencia: 'Conte no seu código: há {abre} <{tag}> abrindo e {fecha} </{tag}> fechando.',
          pista: 'O fechamento precisa ter o MESMO nome da abertura: <h2> fecha com </h2>, e não com </h3>.' },
        { id: 'h1-repetido', tipo: 'estrutura',
          detectar: function (api) { var n = api.$$('h1').length; return n > 1 ? { n: n } : false; },
          evidencia: 'Há {n} elementos <h1> na página. Inspecione cada título grande.',
          pista: 'O h1 é o título principal — como o título de um livro, só existe um. Para as seções use h2; para partes dentro delas, h3.' },
        { id: 'sem-br', tipo: 'estrutura',
          detectar: function (api) { return api.$$('br').length === 0 ? { linha: api.linhaDe('index.html', 'Palmeiras') } : false; },
          evidencia: 'Veja como o endereço (linha {linha} do código) aparece no preview: o Enter que você deu no código virou espaço na tela.',
          pista: 'Existe uma tag vazia, que não precisa de fechamento, feita só para quebrar a linha dentro de um parágrafo.' }
      ],
      ajuda: {
        evidencia: 'Use Inspecionar no texto que está gigante e veja qual linha o editor marca.',
        pista: 'O navegador não "adivinha" onde um título termina: ele espera a tag de fechamento.'
      },
      solucao: {
        explicacao: '<p>O <code>&lt;h2&gt;</code> do Cardápio nunca era fechado, então o navegador colocou todo o resto da página dentro do título. Além disso, sem <code>&lt;p&gt;</code> e <code>&lt;br&gt;</code>, as quebras de linha do código viram espaços.</p>',
        codigo: '<h1>Açaí & Cia</h1>                                  <!-- título principal: só um -->\n' +
          '<p>O melhor açaí do bairro, batido na hora.</p>     <!-- parágrafo -->\n\n' +
          '<h2>Cardápio</h2>                                   <!-- abriu, fechou! -->\n' +
          '...\n' +
          '<h2>Contato</h2>\n' +
          '<p>\n' +
          '  Rua das Palmeiras, 120 - Cohama<br>              <!-- <br> quebra a linha -->\n' +
          '  São Luís - MA\n' +
          '</p>'
      },
      aoConcluir: 'Rapaz, agora dá pra ler! Ficou organizado que nem cardápio de verdade.'
    },

    // ------------------------------------------------------------ E3
    {
      id: 'e3',
      titulo: 'Cardápio de verdade',
      minutos: '20–30',
      teaser: 'Listas e a foto quebrada da tigela.',
      mensagens: [
        'Os sabores tão tudo emendado. Quero um embaixo do outro, com aquelas bolinhas na frente. Os tamanhos também.',
        'E a foto da tigela não aparece, fica só um quadradinho quebrado. Minha filha que tirou, ficou bonita!',
        'Ah: minha tia usa aquele programa que lê a tela pra ela. Ela disse que a foto "não tem nome".'
      ],
      tarefa: '<p>Listas organizam itens: <code>&lt;ul&gt;</code> (lista com marcadores) ou <code>&lt;ol&gt;</code> (lista numerada). Cada item fica num <code>&lt;li&gt;</code>, sempre <em>dentro</em> da lista.</p>' +
        '<p>Imagens usam <code>&lt;img&gt;</code> com dois atributos importantes: <code>src</code> (o caminho do arquivo) e <code>alt</code> (a descrição em texto). Confira o caminho no botão <strong>Arquivos do projeto</strong>, acima do editor.</p>',
      conceitos: ['<ul>', '<ol>', '<li>', '<img>', 'src', 'alt', 'caminho relativo'],
      criterios: [
        { id: 'ul-sabores', texto: 'Os 4 sabores aparecem em lista com marcadores (<ul> e <li>)', verificar: function (api) {
          return api.$$('ul').some(function (ul) {
            var itens = Array.prototype.filter.call(ul.children, function (c) { return c.tagName === 'LI'; });
            return itens.length >= 4 && /banana/i.test(ul.textContent) && /morango/i.test(ul.textContent);
          });
        } },
        { id: 'lista-tamanhos', texto: 'Os 3 tamanhos aparecem numa lista (<ul> ou <ol>)', verificar: function (api) {
          return api.$$('ul, ol').some(function (l) {
            return Array.prototype.filter.call(l.children, function (c) { return c.tagName === 'LI' && /ml/i.test(c.textContent); }).length >= 3;
          });
        } },
        { id: 'img-ok', texto: 'A foto da tigela aparece (sem ícone quebrado)', verificar: function (api) {
          var imgs = api.$$('img');
          if (!imgs.length) return false;
          return Promise.all(imgs.map(function (i) { return api.imagemOk(i); })).then(function (r) { return r.every(Boolean); });
        } },
        { id: 'img-alt', texto: 'A imagem tem uma descrição (alt) para quem usa leitor de tela', verificar: function (api) {
          var imgs = api.$$('img');
          return imgs.length > 0 && imgs.every(function (i) { return (i.getAttribute('alt') || '').trim().length >= 5; });
        } },
        { id: 'li-dentro', texto: 'Nenhum item de lista está solto (todo <li> dentro de <ul> ou <ol>)', verificar: function (api) {
          return api.$$('li').every(function (li) { return /^(UL|OL)$/.test(li.parentElement.tagName); });
        } }
      ],
      errosPrevistos: [
        { id: 'caminho-img', tipo: 'caminho de arquivo',
          detectar: function (api) {
            var imgs = api.$$('img');
            return Promise.all(imgs.map(function (i) { return api.imagemOk(i); })).then(function (r) {
              var i = r.indexOf(false);
              return i === -1 ? false : { linha: api.linhaDoElemento(imgs[i]), caminho: imgs[i].getAttribute('src') };
            });
          },
          evidencia: 'O Console mostra um erro 404 para "{caminho}" (linha {linha}). Abra "Arquivos do projeto", acima do editor, e compare letra por letra.',
          pista: 'O src é um caminho: pasta/nome-do-arquivo.extensão, lido a partir da pasta do index.html. Pasta, nome, extensão e até maiúsculas e minúsculas precisam bater.' },
        { id: 'li-solto', tipo: 'estrutura',
          detectar: function (api) {
            var li = api.$$('li').filter(function (x) { return !/^(UL|OL)$/.test(x.parentElement.tagName); })[0];
            return li ? { linha: api.linhaDoElemento(li) } : false;
          },
          evidencia: 'Inspecione o item da linha {linha}: dentro de qual elemento ele está?',
          pista: '<li> é um ITEM. Ele precisa de uma lista em volta: <ul> (marcadores) ou <ol> (números).' },
        { id: 'lista-aberta', tipo: 'estrutura (tag sem fechamento)',
          detectar: function (api) {
            var f = api.fonte().replace(/<!--[\s\S]*?-->/g, '');
            var t = ['ul', 'ol'];
            for (var i = 0; i < t.length; i++) {
              var a = (f.match(new RegExp('<' + t[i] + '[\\s>]', 'gi')) || []).length;
              var b = (f.match(new RegExp('</' + t[i] + '\\s*>', 'gi')) || []).length;
              if (a !== b) return { tag: t[i], abre: a, fecha: b };
            }
            return false;
          },
          evidencia: 'Conte no seu código: {abre} <{tag}> abrindo e {fecha} </{tag}> fechando. Veja no preview até onde vai o recuo da lista.',
          pista: 'Tudo o que vem depois de uma lista aberta fica "dentro" dela — por isso aparece com recuo.' },
        { id: 'sem-alt', tipo: 'acessibilidade',
          detectar: function (api) {
            var i = api.$$('img').filter(function (x) { return (x.getAttribute('alt') || '').trim().length < 5; })[0];
            return i ? { linha: api.linhaDoElemento(i) } : false;
          },
          evidencia: 'Veja os atributos da imagem na linha {linha}. O que um leitor de tela teria para ler em voz alta?',
          pista: 'O atributo alt descreve a imagem em texto: é lido por leitores de tela e aparece no lugar da imagem se ela falhar.' }
      ],
      ajuda: {
        evidencia: 'Olhe o Console depois de executar e abra "Arquivos do projeto".',
        pista: 'Lista = uma tag de lista em volta + uma tag de item para cada linha.'
      },
      solucao: {
        explicacao: '<p>O <code>src</code> apontava para <code>imagens/acai.png</code>, um arquivo que não existe: o certo é <code>img/tigela-acai.svg</code>. Sem <code>alt</code>, o leitor de tela não tem o que dizer. E itens viram lista quando ficam em <code>&lt;li&gt;</code> dentro de <code>&lt;ul&gt;</code>/<code>&lt;ol&gt;</code>.</p>',
        codigo: '<ul>                                   <!-- lista com marcadores -->\n' +
          '  <li>Açaí tradicional: ...</li>         <!-- um item por sabor -->\n' +
          '  <li>Açaí com banana</li>\n' +
          '  ...\n' +
          '</ul>\n\n' +
          '<img src="img/tigela-acai.svg"         <!-- pasta/arquivo.extensão -->\n' +
          '     alt="Tigela de açaí com banana e granola">  <!-- descrição -->'
      },
      aoConcluir: 'A foto apareceu!! E minha tia disse que o celular dela falou "tigela de açaí". Ela ficou emocionada.'
    },

    // ------------------------------------------------------------ E4
    {
      id: 'e4',
      titulo: 'Chama no Zap',
      minutos: '15–25',
      teaser: 'Links: o WhatsApp que não abre e o atalho para o cardápio.',
      mensagens: [
        'Do "Peça pelo WhatsApp" pra baixo ficou tudo azul e sublinhado kkkk parece link de golpe.',
        'E quando o cliente clica no WhatsApp não abre a conversa, abre uma página de erro.',
        'Coloca também um link lá no começo que leva direto pro cardápio. O povo tem preguiça de rolar.'
      ],
      tarefa: '<p>Links usam <code>&lt;a href="destino"&gt;texto clicável&lt;/a&gt;</code>. O <code>href</code> pode ser:</p>' +
        '<ul><li>um endereço completo de outro site, começando com o protocolo (<code>https://</code>);</li>' +
        '<li>um ponto da própria página: <code>#nome</code>, que leva ao elemento com <code>id="nome"</code>.</li></ul>' +
        '<p>O WhatsApp da loja é <code>https://wa.me/5598988887777</code>. Clique nos links do preview e leia o Console: ele conta para onde o link levaria.</p>',
      conceitos: ['<a>', 'href', 'https://', 'id', 'âncora #'],
      criterios: [
        { id: 'wa', texto: 'O link do WhatsApp leva para o endereço completo da conversa (https://wa.me/…)', verificar: function (api) {
          return api.$$('a').some(function (a) { return /^https:\/\/wa\.me\/\d{10,}$/.test((a.getAttribute('href') || '').trim()); });
        } },
        { id: 'texto-link', texto: 'Só o texto certo é clicável (nada de parágrafo inteiro azul)', verificar: function (api) {
          var as = api.$$('a');
          return as.length > 0 && as.every(function (a) { var t = a.textContent.replace(/\s+/g, ' ').trim(); return t.length <= 40 && !/Aberto de/i.test(t); });
        } },
        { id: 'ancora-link', texto: 'Logo no começo da página há um link para o cardápio (href="#cardapio")', verificar: function (api) {
          var a = api.$('a[href="#cardapio"]');
          var h2 = api.$$('h2').filter(function (h) { return /card/i.test(h.textContent); })[0];
          return !!a && !!h2 && !!(a.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING);
        } },
        { id: 'ancora-alvo', texto: 'O título do Cardápio tem a identificação que o link procura (id="cardapio")', verificar: function (api) {
          var alvo = document.getElementById('cardapio');
          return !!alvo && /card/i.test(alvo.textContent);
        } }
      ],
      errosPrevistos: [
        { id: 'a-aberto', tipo: 'estrutura (tag sem fechamento)',
          detectar: function (api) {
            var a = api.$$('a').filter(function (x) { var t = x.textContent.replace(/\s+/g, ' ').trim(); return t.length > 40 || /Aberto de/i.test(t); })[0];
            return a ? { linha: api.linhaDoElemento(a) } : false;
          },
          evidencia: 'Inspecione o texto "Aberto de terça a domingo" no preview. O editor marca onde começa o elemento clicável que engoliu esse texto: linha {linha}.',
          pista: 'O <a> transforma em link TUDO o que estiver entre <a ...> e </a>.' },
        { id: 'href-sem-protocolo', tipo: 'caminho (endereço relativo)',
          detectar: function (api) {
            var a = api.$$('a').filter(function (x) { return /^(www\.)?wa\.me/i.test((x.getAttribute('href') || '').trim()); })[0];
            return a ? { linha: api.linhaDoElemento(a) } : false;
          },
          evidencia: 'Clique no link do WhatsApp no preview e leia no Console para onde ele levaria o visitante (linha {linha}).',
          pista: 'Sem o protocolo no começo, o navegador acha que o endereço é um arquivo DENTRO do próprio site.' },
        { id: 'id-faltando', tipo: 'seletor (id inexistente)',
          detectar: function (api) {
            var a = api.$$('a[href^="#"]').filter(function (x) { var id = x.getAttribute('href').slice(1); return id && !document.getElementById(id); })[0];
            return a ? { linha: api.linhaDoElemento(a), alvo: a.getAttribute('href').slice(1) } : false;
          },
          evidencia: 'Clique no link da linha {linha} no preview e veja o aviso no Console: ele procura id="{alvo}".',
          pista: 'O # no href aponta para o id de um elemento da mesma página: href="#abc" procura id="abc". Os dois nomes precisam ser idênticos (sem acento, maiúsculas iguais).' },
        { id: 'href-sem-hash', tipo: 'lógica',
          detectar: function (api) {
            var a = api.$$('a').filter(function (x) { return /^cardapio$/i.test((x.getAttribute('href') || '').trim()); })[0];
            return a ? { linha: api.linhaDoElemento(a) } : false;
          },
          evidencia: 'Clique no link da linha {linha} e leia no Console para onde ele levaria.',
          pista: 'Sem o #, "cardapio" vira o nome de uma OUTRA página do site. Com #, é um ponto desta página.' }
      ],
      ajuda: {
        evidencia: 'Clique em cada link do preview e leia o Console. Depois use Inspecionar no texto azul que não devia ser link.',
        pista: 'Todo <a> precisa de um </a>. E o href decide para onde o link leva.'
      },
      solucao: {
        explicacao: '<p>O <code>&lt;a&gt;</code> do WhatsApp não era fechado (tudo depois dele virou link) e o <code>href</code> não tinha <code>https://</code>, então o navegador procurava um arquivo "wa.me/..." dentro do próprio site. O link interno usa <code>#cardapio</code> e o destino precisa de <code>id="cardapio"</code>.</p>',
        codigo: '<a href="#cardapio">Ver o cardápio</a>          <!-- no topo da página -->\n\n' +
          '<h2 id="cardapio">Cardápio</h2>                  <!-- o destino tem o id -->\n\n' +
          '<p>Peça pelo <a href="https://wa.me/5598988887777">WhatsApp: (98) 98888-7777</a></p>\n' +
          '<!--          protocolo completo ^^^^^^^^        e o </a> fecha o link ^^^^ -->'
      },
      aoConcluir: 'Testei aqui: cliquei no WhatsApp e ia abrir minha conversa. E o link do cardápio desce direitinho!'
    }
  ],

  raiox: {
    intro: 'Seu site por dentro. Passe o mouse e clique nos elementos: cada um mostra a linha de HTML que o cria. Repare como cada parte da tela nasce de uma tag.',
    pergunta: 'Quando uma tag ficava sem fechamento, o navegador não mostrou nenhuma mensagem de erro: ele desenhou a página do jeito que entendeu. O que ele fez com o resto da página? Por que você acha que os navegadores agem assim, em vez de parar e mostrar um erro?'
  },

  encerramento: 'Valeu demais! O site tá com cara de site. Só tá meio sem cor, né? O Júnior disse que mandou um arquivo de "estilo" que deixa bonito. Amanhã te passo.',

  aquecimento: [
    'Explique para alguém que nunca viu HTML: qual é a diferença entre o <head> e o <body>?',
    'O que aconteceu na tela quando o <h2> do Cardápio ficou sem fechamento? Por que isso aconteceu?',
    'Para que serve o atributo alt de uma imagem? Quem precisa dele?',
    'Qual a diferença entre href="#cardapio" e href="https://wa.me/..."?'
  ]
});
