# Laboratório de Código: Missões

Sistema de prática para o **Capítulo 4 de "Projeto de Aplicações Web" (SEDUC-MA)**, para o 3º ano do Técnico em Informática para Internet.
O aluno é um dev júnior contratado pela **Açaí & Cia** e conserta o site do cliente editando código de verdade.
HTML, CSS e JavaScript puros: sem framework, sem CDN, funciona **offline**.

> **Etapa 1 entregue:** turmas, perfis com PIN, senha do professor, sessões (salvar/retomar), motor completo e as **Missões 1 (HTML) e 2 (CSS)** de ponta a ponta. As Missões 3 a 8 aparecem no mapa como "em preparação".

## Como abrir

1. Copie a pasta `laboratorio/` para o computador (ou pendrive).
2. Dê dois cliques em `index.html` (Chrome, Edge ou Firefox atuais).
   - Também funciona servido por um servidor simples: `python3 -m http.server` dentro da pasta e acesse `http://localhost:8000`.
3. **Senha de teste do professor: `acai2026`**. Troque antes de usar com a turma (veja abaixo).

## Roteiro de teste (≈ 15 min)

| # | O que fazer | O que deve acontecer |
|---|---|---|
| 1 | Abrir `index.html` e escolher **Turma 300** | Pede confirmação; o computador fica travado na 300. |
| 2 | Criar perfil (nome + PIN de 4 números) | Boas-vindas e o mapa com 8 missões (só a 1 disponível). |
| 3 | **Começar** a Missão 1 e clicar em **Executar** sem mudar nada | O preview mostra o texto grudado e gigante, a aba diz `index.html`, o Console mostra o 404 da imagem. Nenhuma mensagem de "errado". |
| 4 | Clicar **Executar** de novo sem mudar nada | Aviso: "o código está igual". |
| 5 | Mudar algo e executar | Abre a **hipótese obrigatória** ("acho que está em… porque…"). |
| 6 | Mudar mais de 5 linhas de uma vez e executar | Aparece o **diff** com a pergunta "como você vai saber qual mudança resolveu?". |
| 7 | Ligar **Inspecionar** e clicar no texto gigante | O editor destaca a linha do `<h2>` sem fechamento; a ficha mostra HTML/CSS/JS. |
| 8 | **Preciso de ajuda** | Degrau 1 (evidência) → 2 (pista). O 3 (solução comentada) só abre após 3 execuções com hipótese e exige a explicação do aluno. |
| 9 | Concluir a etapa 1 (doctype, head com `meta charset` e `title`, body) | Ponto de salvamento + resposta do cliente. A etapa 2 começa pedindo uma **previsão**, depois mostra "previsão × realidade". |
| 10 | Ao terminar as 4 etapas | **Raio-X**: clicar em 3 elementos libera a pergunta de insight. Depois, a Missão 2 abre. |
| 11 | **Encerrar sessão** | Resumo da aula, o que vem na próxima e o lembrete do código de progresso. |
| 12 | Entrar de novo com o mesmo nome/PIN | Tela **Retomar**: onde parou, última hipótese/insight e 1 pergunta de aquecimento antes do editor. |
| 13 | **Gerar relatório** | Página imprimível com sessões, hipóteses, ajudas, insights e campos de reflexão; exporta JSON. |
| 14 | Tela de perfis → **Trocar de turma** → Turma 301 | Pede a senha do professor. Senha errada: bloqueio de 30 s, 1 min, 5 min. |
| 15 | **Modo professor** | Bloquear/liberar missões por turma, redefinir PIN, resetar (backup + confirmação dupla digitando o nome), restaurar backups, exportar a turma em JSON, ver o resumo. |

Dica para testar a Missão 2 sem fazer a 1: no console do navegador (F12), com um aluno logado:
```js
Lab.estado.trilha().missoes['cap4-m1'] = { status: 'concluida', etapasConcluidas: [], etapas: {}, tentativas: [], hipoteses: [], ajudas: [], previsoes: [], snapshots: [] };
Lab.estado.salvar(); Lab.app.mostrarMapa();
```

## Trocar a senha do professor

1. Abra `gerar-hash.html`, digite a nova senha duas vezes e clique em **Gerar hash**.
2. Cole o bloco gerado no lugar de `senhaProfessor` em `config.js`.
3. Copie o `config.js` para todos os computadores.

A senha nunca fica escrita no código: só o hash PBKDF2-SHA256 (sal aleatório, 120 000 iterações). O cálculo usa `crypto.subtle` e, se ele não existir (ex.: servidor `http://` na rede), um SHA-256 em JavaScript puro.

## Segurança: limites de um sistema sem servidor

Seja honesto com a turma: isto **organiza a aula**, mas não protege segredos.

- Tudo fica no `localStorage` do navegador. Quem abrir o DevTools (F12) pode ler e alterar os dados, inclusive o progresso dos colegas naquele computador.
- O PIN de 4 dígitos tem só 10 000 combinações. Quem copiar o hash consegue descobrir o PIN em segundos. Ele impede curiosidade casual, não um ataque.
- O hash da senha do professor está no `config.js`. Uma senha fraca pode ser quebrada por força bruta offline. Use uma senha longa (frase com 12+ caracteres).
- O desbloqueio do professor fica **só na memória** e expira em 10 min (`minutosDesbloqueio`), ao recarregar a página ou ao trocar de turma. O bloqueio por senha errada fica salvo, mas quem tem acesso ao DevTools consegue apagá-lo.
- O código do aluno roda num `iframe` com `sandbox="allow-scripts"` (sem `allow-same-origin`): ele não enxerga o laboratório nem o `localStorage` real. Um laço infinito (`while(true)`) ainda pode travar a aba (é preciso recarregar). O progresso já está salvo.
- O "código de progresso" contém o hash do PIN. Trate-o como pessoal.

## Onde os dados ficam (e por que nada se perde)

Chaves no `localStorage`, todas com prefixo versionado:

```
lab:v1:meta                                  turma travada neste computador, versão do esquema
lab:v1:bloqueio-senha                        bloqueio progressivo
lab:v1:turma300:perfis                       nomes, hash do PIN
lab:v1:turma300:aluno:<id>                   progresso, sessões, diário, reflexão
lab:v1:turma300:aluno:<id>:sandbox:cap4:...  localStorage do "site de treino"
lab:v1:turma300:controle                     missões bloqueadas pelo professor
lab:v1:turma300:backup:<id>:<data>           cópias automáticas
```

- As turmas ficam em chaves separadas. Trocar de turma **nunca** apaga a outra.
- O progresso é guardado por **trilha** (`cap4`, depois `cap5`…), por **id de missão** e por **id de etapa**. Atualizar ou trocar missões não apaga nada. Se uma etapa sumir, o motor continua da primeira não concluída.
- O esquema tem versão (`esquema` em `js/util.js`). Uma migração faz cópia completa (`backup-esquema`) antes e só acrescenta campos.
- Os dados são **por computador**. Para levar o progresso a outra máquina, use **Código de progresso → Importar**. Para juntar a turma, o professor exporta o JSON de cada computador.

## Como o motor funciona (para criar novas missões)

```
index.html, config.js, gerar-hash.html
css/lab.css
js/  util, cripto, turmas (turmas/senha/perfis), sessoes, diario (diário, pontos, relatório),
     ui, editor, css-parser, preview (iframe + agente), console, inspetor,
     validadores, motor (missões), raiox, professor, app (telas)
missoes/cap4/  assets.js, trilha.js, m01-estrutura.js, m02-estilo.js
```

- **Preview isolado:** `preview.js` junta os arquivos virtuais num `srcdoc` e resolve `<link>`, `<script src>` e `<img src>`. Caminho errado vira 404 no Console, como num servidor. Um "agente" injetado captura console e erros (com o `arquivo:linha` real do aluno), cria um **localStorage falso via postMessage** (o iframe isolado não tem acesso ao real), intercepta links e formulários (envio sem `preventDefault` = página recarrega), faz Inspecionar e Raio-X.
- **Validação por comportamento:** cada critério é uma função `verificar(api)` que roda num segundo iframe escondido. A `api` oferece `$`, `estilo` (getComputedStyle), `clicar`, `digitar`, `imagemOk`, `css()` (regras com linha e validade), `fonte()`, `armazenamento()`… Critérios com `aposRecarregar: true` rodam depois de um "F5" que mantém o localStorage (pronto para a Missão 5).
- **Erros previstos:** `detectar(api)` devolve dados (`{linha, caminho…}`) que preenchem a evidência e a pista da escada de ajuda, e o `tipo` vai para o diário.

Esqueleto de uma missão:

```js
Lab.registrarMissao({
  id: 'cap5-m1', numero: 1, titulo: '...', cliente: { nome, negocio, iniciais },
  principal: 'index.html', assets: [], abertura: ['mensagem do cliente'],
  arquivos: [{ nome: 'index.html', linguagem: 'html', modelo: `...\n[[editavel:regiao]]\n...\n[[/editavel]]` }],
  etapas: [{
    id: 'e1', titulo, minutos, teaser, mensagens: [], tarefa: '<p>html</p>', conceitos: [],
    previsao: { pergunta, observar: function (api) { return 'texto'; } },          // opcional
    criterios: [{ id, texto, verificar: function (api) { return true; }, aposRecarregar: false }],
    errosPrevistos: [{ id, tipo, detectar: function (api) { return { linha: 3 } || false; }, evidencia: '... {linha}', pista: '...' }],
    ajuda: { evidencia, pista }, solucao: { explicacao: '<p>…</p>', codigo: '...' }, aoConcluir: '...'
  }],
  raiox: { intro, pergunta }, encerramento: '...', aquecimento: ['pergunta 1', '...']
});
```

As funções de critério precisam ser **autocontidas**: elas são enviadas como texto para dentro do iframe e só enxergam `api`, `document` e `window`.

**Trocar de capítulo (5 ou 6):** crie `missoes/cap5/` com `trilha.js` (`Lab.registrarTrilha({ id: 'cap5', ... })`) e as missões, e em `config.js` mude `trilha: 'cap5'` e `arquivosMissoes`. O motor não muda, e o progresso do `cap4` continua salvo.

## Pontuação de processo

Os pontos vão para Investigação (Inspecionar, seguir o Console, explorar o Raio-X), Hipóteses (qualidade: cita linha/tag/seletor, tem "porque"), Método (mudanças pequenas, voltar após o aviso de diff) e Reflexão (previsões, explicação após a solução, insight, aquecimento). Há limites por etapa para não "farmar". **Tempo e número de cliques não contam.**

## Limitações conhecidas

- O laço infinito no código do aluno trava a aba. Os validadores têm tempo-limite, mas o preview visível roda no mesmo processo.
- Em `srcdoc` o navegador nunca entra em quirks mode, por isso o `<!DOCTYPE>` é verificado no código-fonte.
- O controle de missões do professor vale por computador (não há servidor para sincronizar).
