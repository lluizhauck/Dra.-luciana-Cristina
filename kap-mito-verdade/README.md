# KAP Edificações — Mito x Verdade (HyperFrames)

Vídeo publicitário vertical de 30 s (1080 × 1920, 60 fps), sem narração, em estética
editorial de papel: folhas que viram com curvatura 3D, carimbos de **MITO** e
**VERDADE**, riscos de marcador e anotações à mão. Trilha instrumental original e
efeitos sonoros sintetizados por código com a Web Audio API.

- Vídeo final: `renders/kap-mito-verdade.mp4`
- Composição HyperFrames: `index.html` (+ `cues.js`)

## Roteiro (mapa de tempo)

| Tempo   | Cena | O que acontece |
| ------- | ---- | -------------- |
| 0–4 s   | Abertura | Folha entra na mesa, etiqueta com a logo oficial é "colada", título **3 mitos sobre financiar sua casa** e sumário (Entrada / Burocracia / Parcelas). "vire a página →" e a folha vira. |
| 4–10 s  | Mito 1 — Entrada | "Preciso ter R$ 100 mil para dar de entrada." → riscos de marcador → carimbo **MITO** (6 s) → página vira → **FGTS + composição de renda** / "Existem alternativas, dependendo das condições do financiamento." |
| 10–16 s | Mito 2 — Burocracia | "Vou resolver toda a burocracia sozinho." com papéis bagunçados → carimbo **MITO** (12 s) → página vira → "A KAP auxilia com a documentação técnica da obra." enquanto plantas, projetos e documentos se organizam e recebem ✓. |
| 16–22 s | Mito 3 — Parcelas | "Financiar é sempre mais caro que alugar." → "sempre" circulado, frase riscada, carimbo **MITO** (18 s) → página vira → **Compare os números.** + balança Aluguel × Prestação com valores em branco (R$ ____) que se equilibra → "Sua casa pode estar mais perto do que você imagina." |
| 22–30 s | Encerramento | Capa escura fecha o caderno. Logo oficial, **Menos boatos. Mais contas no papel.**, "Comente" + carimbo **SIMULAR** em laranja (25 s), "Receba um diagnóstico real e gratuito no direct." Tela final estável de ~26 s a 30 s. |

Nenhuma taxa, valor ou garantia foi inventada: o único valor na tela é o "R$ 100 mil"
do próprio mito (texto do briefing), e a comparação aluguel × prestação usa campos em
branco — a mensagem é "compare", não "é mais barato".

## Identidade visual

- Cores: creme `#F0EEE6`, preto `#1F1E1D`, laranja argila `#D97757` (mais tons
  derivados do creme para mesa, verso da folha e sombras).
- Tipografia (todas OFL, embutidas em `assets/fonts/`): **Fraunces** (títulos
  serifados, eixo óptico variável), **Instrument Sans** (textos sem serifa),
  **Caveat** (anotações à mão) e **JetBrains Mono** (cabeçalhos editoriais).
- Logo: `assets/kap-logo.png` é o arquivo enviado, sem alteração de cor, proporção
  ou desenho. Como o PNG tem fundo branco (sem transparência), ele aparece sobre uma
  etiqueta branca presa com fita — inclusive na tela escura final.

## Como funciona

- **Uma linha do tempo GSAP** pausada, registrada em `window.__timelines["main"]`,
  buscada quadro a quadro pelo HyperFrames. Todos os tempos vêm de `cues.js`, que
  também alimenta a trilha — imagem e som ficam sincronizados por construção.
- **Virada de página**: no início da virada, a folha é substituída por 20 tiras
  aninhadas em 3D (`preserve-3d`) com cópias do conteúdo. Cada tira gira um pouco em
  relação à anterior, o que curva o papel; sombreamento por tira e sombra projetada
  na folha de baixo. As curvas são funções puras usadas como `ease` do GSAP, então
  qualquer quadro é determinístico (sem `onUpdate`, sem relógio).
- **Carimbos**: HTML + filtro SVG (`feTurbulence` com seed fixa) para a textura de
  tinta; batida sincronizada com tremor da folha.
- **Traços à mão** (riscos, círculo, sublinhados): paths SVG desenhados com
  `stroke-dashoffset`, reescalados para o tamanho real em pixels na montagem.
- **Texturas** de papel geradas por `tools/make-textures.py` (seed fixa).

## Áudio (Web Audio API)

`tools/audio/soundtrack.js` sintetiza tudo com `OfflineAudioContext` (48 kHz,
estéreo), sem samples:

- Música original a 120 BPM em Fá maior: piano elétrico FM, marimba em arpejo, baixo,
  pad, percussão leve "de papel" e sinos no encerramento. Os carimbos caem nos tempos
  fortes, com pausas da bateria antes deles.
- Efeitos: papel deslizando, virada de página, impressão/tipos, carimbos, marcador,
  lápis, fita adesiva, ticks dos ✓.

`tools/audio/render-audio.mjs` roda a síntese no Chrome headless, mede a loudness
com o `loudnorm` do ffmpeg e aplica ganho + limitador (o mesmo envelope nos dois
stems). Resultado: `assets/audio/trilha.wav` e `assets/audio/efeitos.wav`, cuja soma
fica em ~-14 LUFS com pico abaixo de -1,5 dBTP.

## Reproduzir a renderização

Requisitos: Node.js ≥ 22, FFmpeg, (opcional) Python 3 + numpy + Pillow.

```bash
cd kap-mito-verdade
npm install                                  # puppeteer-core (só para gerar o áudio)
npx --yes hyperframes@0.8.150 browser ensure # baixa o Chrome headless de render
npm run textures                             # opcional: as texturas já estão versionadas
npm run audio                                # opcional: os WAVs já estão versionados
npm run check                                # lint + runtime + layout + contraste
npm run render                               # -> renders/kap-mito-verdade.mp4 (60 fps)
npm run dev                                  # Studio para revisar/editar no navegador
```

A versão do HyperFrames está fixada em `0.8.150` nos scripts do `package.json`.

## Estrutura

```
index.html                 composição (cenas, CSS, linha do tempo GSAP)
cues.js                    folha de deixas compartilhada (vídeo + áudio)
assets/kap-logo.png        logo oficial (inalterada)
assets/fonts/              fontes OFL embutidas
assets/vendor/gsap.min.js  GSAP 3.13.0 (local, sem CDN)
assets/textures/           grão e manchas do papel
assets/audio/              trilha.wav + efeitos.wav
tools/make-textures.py     gerador das texturas
tools/audio/               síntese da trilha (Web Audio API) e script de render
renders/                   MP4 final
```

## Verificação do arquivo entregue

`renders/kap-mito-verdade.mp4` — H.264 High, 1080 × 1920, 60/1 fps constante,
1800 quadros, 30,000 s; áudio AAC-LC 48 kHz estéreo; −13,8 LUFS integrados, pico
real −1,7 dBTP; 31,7 MB (CRF 18). `npm run check`: 0 erros de lint, runtime e motion.

Avisos conhecidos e aceitos:

- **Estrutura**: o lint sugere dividir as cenas em sub-composições. Mantive uma
  composição única de propósito: as folhas formam uma pilha compartilhada entre as
  cenas (viradas, sombras projetadas e transições dependem de estarem no mesmo
  contexto).
- **Sobreposição de texto (~0,25 s)**: enquanto a verdade 1 é puxada para cima e o
  mito 3 cai por cima da verdade 2, a auditoria vê caixas de texto sobrepostas; na
  imagem, a folha de cima é opaca e cobre a de baixo.
- **Contraste do "3" da abertura**: laranja `#D97757` sobre creme dá 2,48:1 (a
  auditoria pede 3:1 para texto grande). Mantive a cor exata da marca; é um numeral
  de 340 px.

## Limitações do ambiente de produção

- Renderizado sem GPU (Chrome headless com SwiftShader, captura `beginframe`). As
  transformações 3D e os filtros SVG renderizam corretamente, só que mais devagar
  (~3 min para os 1800 quadros).
- A trilha foi validada por métricas (loudness, pico, espectrograma e forma de onda
  alinhada às deixas), não por audição humana: vale ouvir antes de publicar.
- A logo recebida é um PNG com fundo branco; por isso ela aparece sobre uma etiqueta
  branca. Um SVG ou PNG transparente permitiria aplicá-la diretamente no fundo escuro.
- As fontes oficiais da marca não foram informadas; usei Fraunces, Instrument Sans,
  Caveat e JetBrains Mono (licença OFL).
