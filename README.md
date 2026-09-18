# Saggiorato & Benites — site

Site estático (HTML/CSS, sem framework). Referência visual: `source/Saggiorato_Benites_Hero_Preview.jpg`.

```bash
npm install
npm run build            # gera assets/img, ícones e injeta o hero no index.html
npm run build -- --force # regera também as imagens que já existem
npm run trace            # revetoriza o lettering da 2ª dobra (só se o PNG mudar)
npm run register         # realinha as mãos da 4ª dobra (só se as imagens mudarem)
npm run dev              # http://localhost:3004
npm run deploy           # build + publica no GitHub Pages
```

## Publicação

No ar em **https://joaopauloalvesofc-lab.github.io/saggiorato/**.

- `main` guarda o projeto inteiro, inclusive as fontes originais em 8K (518 MB; o fundo vetorial de 99 MB passa com aviso do GitHub, que recomenda até 50 MB).
- `gh-pages` leva só o que o site serve (72 MB: `index.html` e `assets/`), e é dela que o Pages publica. `npm run deploy` reconstrói e atualiza essa branch.
- O repositório precisou virar público: GitHub Pages não funciona em repositório privado na conta gratuita.
- Conferido no ar: carrega em 1,0 s, hero com erro de 1,00/255 contra a referência, as seis dobras revelam, o vídeo toca, as quatro fontes carregam, nenhuma imagem quebrada, nenhum erro de JavaScript e nenhuma rolagem lateral no celular. Os tipos de arquivo saem certos (AVIF, WebP, WOFF2, MP4, SVG).

O markup entre os marcadores `<!-- preload -->`, `<!-- hero -->`, `<!-- atelier -->`, `<!-- luxury-bg -->`, `<!-- luxury-gallery -->`, `<!-- handmade-* -->` e `<!-- duffle-* -->` é gerado pelo build (`scripts/build.mjs`, `atelier.mjs`, `luxury.mjs`, `handmade.mjs` e `duffle.mjs`): não edite à mão. O texto e o mockup do iPhone da terceira dobra ficam escritos direto no `index.html` e podem ser editados.

## Decisões — hero

- **Fundo sai do PNG 8K, não do SVG vetorial.** Comparados 1:1, o `Background_Paisagem_Vetorial.svg` (104 MB, 372 mil caminhos) posteriza o couro, cria manchas e serrilha bordas; o PNG é fiel à foto. O SVG também travaria o navegador.
- **Sharpen proporcional à ampliação.** O fundo foi gerado em 1672 px e ampliado; cada tamanho acima disso recebe `sigma = 0,4 × largura / 1672`.
- **AVIF q88, 10 bits, 4:4:4** (WebP q92 de reserva). Com q72–80 os pretos viram manchas quando se aumenta o brilho, o que aparece em telas OLED.
- **Marca em SVG inline**, com os caminhos de `hero_overlay_vector.svg` (idênticos às peças avulsas), posicionada pelas coordenadas de `layout.json`. Foto e marca ficam no mesmo palco 16:9, que cobre a tela, então a marca nunca se desloca em relação aos estojos.
- **Telas estreitas:** o bloco da marca é limitado à largura da tela menos a margem, e segue centrado sobre os estojos.
- **Verificação:** screenshot no Chrome em 1920×1080 comparado com a prévia: erro médio de 1,04/255 e deslocamento 0 px.

## Decisões — segunda dobra (The Handmade Design)

Referência: `source/atelier/referencia-3840.jpg` (reduzida do export do Canva de 18750 × 7813).

- **Geometria medida, não estimada.** Os cards foram segmentados na referência e um círculo foi ajustado aos centros: centro (960, 985) e raio 781 num palco 1920 × 800; cada card gira junto com o arco, com a proporção da própria foto (3:4 ou 4:5, sem corte) e cantos de 14,5.
- **Roda de 10 posições a 36°.** Com 5 fotos, só múltiplos de 5 repetem sem quebra; a 24° (15 posições) até 7 cards ficam visíveis e a mesma foto apareceria duas vezes na tela. A 36° nunca há repetição visível, e a foto gêmea entra pela esquerda quando a outra sai pela direita. A referência usa ~29°.
- **Animação só no compositor.** Cada card anima apenas `rotate` em volta do centro da roda (auditado: 0 recálculos de estilo e 0 layouts em 3 s). Para fora da tela e sob o cursor; estática com `prefers-reduced-motion`.
- **Sombra com luz fixa.** Duas rodas de sombra (próxima e difusa) deslocadas para baixo giram em sincronia com os cards, então a sombra cai sempre para baixo, qualquer que seja o ângulo.
- **Lettering vetorizado.** O PNG do ChatGPT (1536 px) tinha ~200 mil pixels de névoa (alfa 1–10), limpos antes do potrace, feito com ampliação 4× (IoU 0,956 com o original). O SB do PNG era um redesenho do oficial (IoU 0,88) e foi trocado pelo SB oficial em vetor. As três linhas em caixa-alta foram centralizadas no eixo do SB (variavam até 14 px).
- **Fundo vinho em AVIF q92 10 bits.** Abaixo disso o grão da textura some. No celular o `sizes` limita a 2560 px.

## Decisões — terceira dobra (The Luxury Box)

- **Tipografia.** O título usa **Rouge Script**, escolhida entre 20 caligrafias renderizadas no Chrome ao lado do "The Handmade Design" original: é a mais próxima no "H" com laço, no "T" e nas laçadas altas. O texto usa **Cormorant Garamond** variável (300 e itálico). As fontes são auto-hospedadas em WOFF2 (subconjunto latin, com os acentos do português).
- **iPhone 17 em CSS, com medidas reais em mm** (71,5 × 149,6; tela com cantos de 10,3; ilha dinâmica 20,7 × 6,15; botões de ação, volume, lateral e Camera Control), convertidas por unidades de container. Moldura de alumínio preto com reflexos em `conic-gradient`.
- **Vídeo sem recodificar.** O fluxo H.264 do Instagram (720 × 1280) é copiado bit a bit, sem áudio e com `faststart` (moov no byte 36). O pôster é o primeiro quadro exato. O vídeo não baixa enquanto a seção está longe, toca só com ela na tela e pausa ao sair. Clicar ou teclar Enter pausa e retoma (rótulo acessível). Com `prefers-reduced-motion` fica parado com ícone de play.
- **Alinhamento medido.** O topo visível das letras do título e a base da galeria coincidem com o topo e a base do iPhone (≤ 1,8 px em 7 tamanhos, de 1280×720 a 2560×1440); a seção ocupa exatamente a altura da tela e o conjunto fica centralizado com margens iguais.
- **Madeira escurecida em CSS** (mais densa atrás do texto). No celular a imagem ocupa 200% da largura: os veios são verticais, então esticar na altura mantém o desenho.
- **Texto.** Descreve só o que as fotos e o vídeo mostram (madeira em alto brilho, dobradiças embutidas, pied-de-poule, couro com costura, bandeja removível com compartimento de acessórios), mais "feita à mão e sob medida, configurada de acordo com o seu gosto", a pedido.

## Decisões — quarta dobra (The Handmade Design, mão tatuada)

- **As mãos foram registradas.** As cinco imagens (cognac, borgonha, amarelo, verde-oliva e azul-marinho) foram geradas separadamente: a mão aparecia deslocada até ~30 px, com até 1,7% de escala e 0,6° de rotação de diferença. `scripts/register-hands.mjs` estima escala, rotação e posição por correlação no dorso tatuado (NCC de 0,55–0,93 para 0,82–0,96) e reamostra todas no mesmo quadro com Lanczos3 e alfa pré-multiplicado. Na sobreposição a 50%, a rosa, a adaga e os anéis ficam nítidos, sem imagem dupla. O resíduo é a variação do desenho das tatuagens entre as imagens geradas.
- **A "8K" não tem detalhe a mais:** é uma ampliação exata da versão de 1254 px (reduzir e ampliar de volta dá erro 0). Todas são tratadas em 1254 e reamostradas em 2× (2470 × 2499).
- **Quadro ancorado no canto superior direito:** a manga sai pelo topo e pela direita, como numa fotografia. O quadro ocupa 93% da altura e no máximo 58vw. Em retrato ou até 900 px, a mão vem primeiro e título e quadrados ficam embaixo.
- **Quadrados = amostras de couro da marca** (`source/hands/amostras`, 3000 × 3000, sem borda), reduzidas com Lanczos3 para 96–320 px. As cores foram conferidas contra o original (médias idênticas; erro de 2–2,8/255). Os nomes seguem os arquivos: Cognac, Borgonha, Amarelo, Verde-oliva e Azul-marinho. Funcionam como grupo de rádio acessível (clique, setas, Home e End).
- **Troca sem "buraco":** a nova mão entra por cima enquanto a anterior continua opaca, e só depois a anterior some. Medido: cobertura da mão de 98–100% durante toda a troca, contra ~75% num cross-fade simples. A imagem só troca depois de decodificada.
- **Bug corrigido no build:** depois de `removeAlpha()` o sharp marcava os pixels como pré-multiplicados e as amostras saíam com cores estouradas. O `encode` agora passa só as dimensões.

## Decisões — dobra "Herança automobilística" (entre a mão tatuada e a Duffle Bag)

Dobra em **faixa**, não em tela cheia: 360–560 px no desktop (a primeira versão, de tela inteira e com tudo centralizado, ficou simples demais perto das outras).

- **Composição horizontal:** título e assinatura à esquerda, os quatro elementos à direita, na mesma linha de base.
- **Painel de couro costurado:** sulco contínuo na borda e, por dentro, o pesponto — pontos inclinados em linha creme, cada um com a sombra do furo logo abaixo (gradientes repetidos, um par por lado). Cada corrida recua 20 px das pontas para os cantos não se cruzarem. Mais uma luz quente atrás dos produtos e vinheta discreta.
- **Tinta escura sobre o amarelo Senna** (média RGB 250,195,7): em creme o texto sumiria. A assinatura é a mesma arte da 2ª dobra, recolorida pelo build em `heranca-assinatura.svg`.
- **Título** em Montserrat Light caixa-alta, 0,17em de espaçamento, em duas linhas, com fio curto antes do "By". A assinatura sai maior e com o traço engrossado (contorno de 5,5 unidades no vetor): o desenho original é de pena fina e sumia no amarelo.
- **Quatro elementos equilibrados por área visual:** proporções de 1,15 a 1,75; o build recorta cada PNG pelo contorno e calcula a fração da fileira (`√proporção / Σ√proporção`). Medido: variação de área de 0% e linha de base idêntica. Até 1023 px vira 2 × 2, com a mesma conta normalizada pelo par mais largo.
- **Sem moldura e sem fundo:** só uma sombra de contato discreta.
- **Verificação:** 11 tamanhos, de 320 px ao ultrawide, sem estouro e sem rolagem lateral. A dobra pesa 1,3 MB e só carrega quando aparece.

## Decisões — quinta dobra (The Duffle Bag)

Três versões anteriores foram descartadas a pedido: Porsche sobre couro marrom; três molduras iguais (latão com passe-partout, depois ébano); e a versão editorial com foto à esquerda e texto à direita. As fontes de todas seguem em `source/duffle/`, fora do build.

- **Camurça verde-militar em toda a dobra** e, por cima, a arte sem fundo dos dois braços disputando a bolsa. Sem texto visível; o `h2` "The Duffle Bag" fica só para leitores de tela, para a seção continuar identificada.
- **Encaixe lateral:** o alfa da arte encosta nas duas bordas do PNG (x = 0 e x = 1671 de 1672), então ela ocupa 100% da largura — cada braço termina exatamente no fim da tela, sem folga nem corte. Medido em 10 tamanhos comparando a dobra com e sem a arte: há pixels de braço na primeira e na última coluna em todos.
- **Bolsa a 2 mm da base:** o PNG tem uma faixa transparente de 73 px (7,758% da altura, medida no alfa visível) abaixo da bolsa. Uma margem negativa de `calc(2mm - 4.3665vw)` corta essa faixa e deixa a folga pedida. Medido: 1,85–2,12 mm em sete tamanhos (o resto é arredondamento de pixel).
- **Altura da dobra:** `max(100svh, 100vw × 869/1672 + 32px)` — em telas mais largas que 16:9 a dobra cresce junto com a arte, para os braços nunca serem cortados.
- **Qualidade:** a arte nasce em 1672 × 941; acima disso as versões são ampliadas com Lanczos3 e sharpen proporcional (receita do hero). A dobra pesa 1,2 MB e só carrega quando aparece.

## Decisões — rodapé

- **Couro preto premium** (1942 × 809 na origem; acima disso ampliado com Lanczos3 + sharpen, como no hero), com vinheta, um brilho discreto no alto e uma **costura creme** na emenda com a dobra de cima.
- **Três colunas:** marca (monograma SB + assinatura + "São Paulo • Veneto", todos vetores já usados na 2ª dobra); **índice de coleções** (número, nome e um fio por linha, com o nome deslizando no hover, como uma ficha de ateliê); e o **bloco do ateliê em ficha** (rótulo em caixa-alta + informação: Peças, Sob medida, Feitura) fechando com "Purpose © Time © Exclusivity". Fio vertical entre as colunas. Empilha centralizado até 1023 px, com alvo de toque de 43 px nos links.
- **Fundo no celular:** a foto do couro é 2,4:1; num rodapé alto e estreito ela precisaria de ~7000 px de largura para cobrir — dava zoom de 18× e só 17% da imagem visível, tudo borrado. Até 1023 px entra um **ladrilho sem emenda** (recorte de 600 px espelhado nos quatro sentidos, 1200 × 1200), repetido na escala natural do couro: 1,3 pixel de textura por pixel de tela no celular (antes era 0,18) e 277 KB no lugar de 1,3 MB.
- **Contraste medido** (cor composta contra a média real do couro atrás de cada texto, com o conteúdo escondido para fotografar o fundo): 4,75:1 a 9,30:1, todos acima do mínimo de 4,5:1. O número do índice passou de 4,18 para 5,29 depois do ajuste.
- **Navegação:** cada link leva à dobra correspondente (ids `topo`, `atelier`, `luxury`, `handmade`, `heranca`, `duffle`).
- **Bug corrigido na rolagem:** com as imagens acima ainda não carregadas, a rolagem suave nativa errava o destino e parava no fim da página. Os links agora usam uma rolagem própria que recalcula o alvo a cada quadro e, por 0,9 s depois de chegar, corrige o desvio causado por imagens que terminam de carregar; qualquer rolagem ou toque do usuário cancela na hora. Testado nos seis links, com e sem imagens carregadas.
- **Sem contato nem redes sociais:** não invento dados. Quando vierem o Instagram, o WhatsApp e o e-mail, entram como uma quarta coluna.
