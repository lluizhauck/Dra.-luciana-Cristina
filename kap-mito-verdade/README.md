# KAP Edificações — 3 mitos sobre financiar sua casa

Vídeo publicitário vertical (Reels/Stories) no formato **mito x verdade**.

| | |
|---|---|
| Arquivo final | `render/kap-mito-verdade.mp4` |
| Formato | 1080 × 1920 (9:16), 60 fps, H.264 + AAC |
| Duração | 47,2 s (definida pela narração, não por tempo fixo) |
| Ferramentas | HyperFrames 0.8.154, HTML, CSS, SVG, GSAP 3.13 |
| Áudio | só narração + efeitos discretos (sem trilha) |

## Roteiro e tempos

| Tempo | Cena | Voz |
|---|---|---|
| 0,0 – 3,6 s | Logo KAP + "3 mitos sobre financiar sua casa" | masculina: título |
| 3,6 – 16,3 s | Mito 1 · Entrada → página vira → Verdade 1 (FGTS + compor renda) | masculina / feminina |
| 16,3 – 26,5 s | Mito 2 · Burocracia → Verdade 2 (planta, capacete, esquadro) | masculina / feminina |
| 26,5 – 37,3 s | Mito 3 · Parcelas → Verdade 3 (aluguel ≈ prestação, sem valores) | masculina / feminina |
| 37,3 – 47,2 s | "Menos boatos. Mais contas no papel." + logo + "Comente SIMULAR" + direct | feminina |

Cada mito: a folha desliza para a mesa, a pergunta é "impressa" palavra por
palavra no ritmo da voz, um marcador laranja risca o texto e o carimbo **MITO**
bate (com tremida leve da câmera). A página vira em 3D, o carimbo **VERDADE**
aparece e a resposta é impressa com destaques de marca-texto sincronizados com
as palavras faladas. Zoom in/out suaves acompanham a leitura.

As falas nunca se sobrepõem. Depois de cada verdade há 1,3 s de respiro para
leitura e o CTA final fica 2,2 s parado.

## Como reproduzir

```bash
# 1. dependências
npm install                              # HyperFrames (fixado em 0.8.154), GSAP, fontes
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

# 2. mídia (opcional: os arquivos gerados já estão no repositório)
python scripts/narration.py              # vozes + tempos de cada palavra
python scripts/sfx.py                    # efeitos sonoros
python scripts/textures.py               # texturas de papel/mesa/carimbo
python scripts/build_timeline.py         # cronograma + faixas de áudio no index.html

# 3. vídeo
npx hyperframes check                    # validação (0 erros)
npx hyperframes preview                  # editar/visualizar no Studio
npm run render                           # -> render/kap-mito-verdade.mp4
```

`narration.py` baixa os modelos na primeira execução (do GitHub): Kokoro v1.0
(≈ 340 MB) e Parakeet TDT 0.6B v3 (≈ 490 MB, só para medir os tempos das
palavras). Eles ficam em `.cache/`, fora do git.

Para mudar o ritmo, ajuste as pausas no topo de `scripts/build_timeline.py` e
rode o script de novo. O `index.html` lê tudo de `assets/data/timeline.js`.

## Estrutura

```
index.html                  composição HyperFrames (cenas, SVGs, timeline GSAP)
assets/data/narration.json  falas, duração, fonemas e tempo de cada palavra
assets/data/timeline.js     cronograma gerado (não editar à mão)
assets/audio/vo/            narrações (48 kHz, -16 LUFS)
assets/audio/sfx/           efeitos (papel, carimbo, marcador, tique)
assets/img/                 logo KAP (original, sem alteração) + texturas
assets/fonts/               fontes locais + licenças OFL
scripts/                    geração de narração, efeitos, texturas e cronograma
reference/                  imagens originais enviadas (logo e referência)
```

## Decisões e limitações reais do ambiente

- **Vozes.** Os serviços de voz em nuvem (HeyGen, ElevenLabs, Microsoft, Google)
  estão bloqueados na rede deste ambiente. Usei o TTS local do próprio
  HyperFrames, o Kokoro-82M (Apache-2.0, uso comercial permitido), com as vozes
  brasileiras `pm_alex` (masculina) e `pf_dora` (feminina), em velocidade
  natural (1,0, sem aceleração). Uma transcrição automática (Whisper) confirmou
  todas as falas palavra por palavra. É uma voz sintética local: soa um pouco
  menos expressiva que uma locução profissional ou um TTS de nuvem premium.
- **Entonação de pergunta.** Em pt-BR o Kokoro lê "?" como afirmação. Por isso,
  nas três perguntas dos mitos, a última palavra recebe o contorno de pergunta
  do português brasileiro: sobe na sílaba tônica e cai na postônica (en-**TRA**-da?,
  so-**ZI**-nho?, alu-**GAR**?). Só a altura muda (WORLD), e o restante da frase
  fica intocado.
- **Pronúncia.** "KAP" é falado como "Kápi", e "direct" como "dairécti". Se a
  marca for pronunciada de outro jeito (por exemplo, soletrada "cá-á-pê"),
  basta alterar a coluna de texto falado em `scripts/narration.py`.
- **Abertura e encerramento narrados.** O briefing definia narração só para os
  mitos e as verdades. Para o vídeo não ficar mudo sem trilha, a voz masculina
  lê o título e a feminina lê o encerramento e o CTA, usando exatamente os
  textos da tela. Para remover, apague as linhas `abertura`, `fim1` e `fim2`
  em `narration.py` (as cenas continuam com as pausas).
- **Fontes.** Satoshi (Fontshare) e Amertha não estão acessíveis aqui: todos
  os sites de fontes estão bloqueados e não existem pacotes delas no npm. Usei
  substitutos abertos (OFL): **Manrope** no lugar do Satoshi e **Kaushan
  Script** no lugar da Amertha. Anton é a original. Para trocar, coloque os
  arquivos `.woff2` em `assets/fonts/` e mude só o `src` dos `@font-face`
  "KAP Sans" e "KAP Script" no topo do `index.html`.
- **Logo.** O PNG enviado tem fundo branco opaco. Para não alterar o arquivo, o
  logo aparece sobre etiquetas brancas (coladas com fita), na abertura e no
  encerramento.
- **Cores.** Creme `#F0EEE6`, preto `#1F1E1D` e laranja `#D97757`, mais uma
  variação clara do laranja nas moedas. O azul do logo aparece só no logo. O
  laranja sobre o creme tem contraste de cerca de 2,6:1, e por isso só é usado
  em textos grandes (66 px ou mais).
- **Efeitos sonoros.** Sintetizados por código (`scripts/sfx.py`): virada de
  página, carimbo, papel deslizando, marcador e um tique. Não há bancos de som de
  terceiros, e todos ficam de 11 a 17 LU abaixo da voz.
- **Valores.** O vídeo não mostra taxas, valores nem garantias. O gráfico do
  mito 3 é marcado como "comparação ilustrativa, sem valores".

## Licenças de terceiros

- HyperFrames (Apache-2.0), GSAP 3.13 (licença padrão GSAP, uso gratuito).
- Kokoro-82M e vozes (Apache-2.0), espeak-ng (GPL, só para fonemização).
- Anton, Manrope, Kaushan Script: SIL Open Font License (`assets/fonts/licencas/`).
