---
name: Flora.ds — Grupo Boticário Design System
description: >
  Design system interno do Grupo Boticário (Flora.ds), construído para servir
  o ecossistema de marcas do grupo (O Boticário, Eudora, Quem Disse Berenice?,
  Vult, BeautyBox, Beleza na Web). Organizado em 3 camadas: Core Components
  (primitivos mantidos pelo time Flora), Team Components (contribuições livres
  de squads) e Shared Components (consolidações de alta maturidade). Suporta
  e-commerce, venda direta, produtos financeiros, operação de franquias,
  marketplace e sistemas internos.
colors:
  brand:
    primaryMain: "#006B3F"
    primaryLight: "#1A8A5C"
    primaryLightest: "#E6F5EF"
    primaryDark: "#004D2D"
    primaryDarkest: "#003520"
    secondaryMain: "#C5A34D"
    secondaryLight: "#D4B86E"
    secondaryLightest: "#F5EDDA"
    secondaryDark: "#A6873D"
    secondaryDarkest: "#7A632D"
  gradient:
    primary: "linear-gradient(135deg, #006B3F, #004D2D)"
    accent: "linear-gradient(135deg, #C5A34D, #A6873D)"
  semantic:
    surface: "#FFFFFF"
    surfaceDark: "#1A1A1A"
    background: "#FAFAF8"
    onBackground: "#1A1A1A"
    highlight: "#006B3F"
    highEmphasis: "#2D2D2D"
    mediumEmphasis: "#6B6B6B"
    lowEmphasis: "#999999"
  feedback:
    info: "#1565C0"
    infoLight: "#BBDEFB"
    success: "#2E7D32"
    successLight: "#C8E6C9"
    warning: "#F9A825"
    warningLight: "#FFF9C4"
    alert: "#C62828"
    alertLight: "#FFCDD2"
    link: "#1565C0"
  neutral:
    neutral0: "#FFFFFF"
    neutral50: "#FAFAF8"
    neutral100: "#F5F5F3"
    neutral200: "#EEEEEC"
    neutral300: "#E0E0DE"
    neutral400: "#BDBDBB"
    neutral500: "#9E9E9C"
    neutral600: "#6B6B6B"
    neutral700: "#4A4A4A"
    neutral800: "#2D2D2D"
    neutral900: "#1A1A1A"
typography:
  families:
    - Nunito Sans
    - system-ui
  weights:
    regular: 400
    semibold: 600
    bold: 700
    extrabold: 800
  sizes:
    caption: 12
    body2: 14
    body1: 16
    subtitle2: 18
    subtitle1: 20
    heading6: 22
    heading5: 24
    heading4: 28
    heading3: 32
    heading2: 36
    heading1: 40
    display2: 48
    display1: 56
  lineHeights:
    tight: 1.2
    normal: 1.5
    relaxed: 1.75
rounded:
  none: 0
  small: 4
  medium: 8
  large: 12
  xLarge: 16
  pill: 999
  circle: "50%"
spacing:
  none: 0
  micro: 4
  tiny: 8
  small: 12
  standard: 16
  medium: 24
  large: 32
  xLarge: 48
  xxLarge: 64
  huge: 80
---

## Overview

**Flora.ds** é o design system interno do **Grupo Boticário**, um dos maiores ecossistemas de beleza do mundo com mais de 4.000 lojas em 1.600 cidades brasileiras e presença em 40+ países. O nome Flora é uma analogia direta com o reino vegetal — assim como na natureza cada elemento de uma flora está conectado, é dependente e desempenha funções distintas para a manutenção do todo, os componentes do design system funcionam como um ecossistema interligado.

O Flora serve múltiplas marcas do grupo:

| Marca                 | Segmento                        |
| --------------------- | ------------------------------- |
| O Boticário           | Perfumaria e cosméticos premium |
| Eudora                | Beleza e bem-estar              |
| Quem Disse, Berenice? | Maquiagem acessível             |
| Vult                  | Maquiagem popular               |
| Beleza na Web         | E-commerce multimarca           |
| BeautyBox             | Assinatura de beleza            |

### Arquitetura de Governança

O Flora organiza componentes em 3 bibliotecas com governança diferenciada:

| Biblioteca            | Governança                | Escopo                                                            |
| --------------------- | ------------------------- | ----------------------------------------------------------------- |
| **Core Components**   | Time Flora (dedicado)     | Primitivos altamente replicáveis: botões, inputs, tabs, acordeons |
| **Team Components**   | Squads de produto (livre) | Componentes complexos criados por times usando Core como base     |
| **Shared Components** | Time Flora (consolidação) | Componentes de alta maturidade, testados e versáteis              |

### Princípios

1. **Flora como ecossistema** — Cada componente tem função específica mas é dependente do todo, assim como na natureza
2. **Governança aberta** — Qualquer Product Designer ou Dev pode contribuir via Team Components
3. **Qualidade premium** — Refletir visualmente a qualidade que o Grupo Boticário preza em todas as suas marcas
4. **Multi-contexto** — Desde bots de WhatsApp até painéis de franquias, o DS atende níveis de digitalização distintos
5. **Acessibilidade nativa** — Requisitos de acessibilidade, carregamento e usabilidade em cada componente

---

## Colors

A paleta do Flora é derivada da identidade visual do Grupo Boticário, com o verde como cor primária representando natureza, sustentabilidade e a herança botânica da marca. O dourado funciona como cor secundária de prestígio e premium.

### Brand Colors

| Token                      | Hex       | Uso                                                      |
| -------------------------- | --------- | -------------------------------------------------------- |
| `brand.primary.main`       | `#006B3F` | Verde Boticário — cor primária da marca, CTAs, destaques |
| `brand.primary.light`      | `#1A8A5C` | Verde claro para hovers e estados interativos            |
| `brand.primary.lightest`   | `#E6F5EF` | Verde muito claro para backgrounds sutis                 |
| `brand.primary.dark`       | `#004D2D` | Verde escuro para textos sobre fundos claros             |
| `brand.primary.darkest`    | `#003520` | Verde profundo para headers e footers                    |
| `brand.secondary.main`     | `#C5A34D` | Dourado Boticário — premium, destaques, selos            |
| `brand.secondary.light`    | `#D4B86E` | Dourado claro para ícones e ornamentos                   |
| `brand.secondary.lightest` | `#F5EDDA` | Dourado sutil para backgrounds de destaque               |
| `brand.secondary.dark`     | `#A6873D` | Dourado escuro para textos e badges                      |
| `brand.secondary.darkest`  | `#7A632D` | Dourado profundo para elementos menores                  |

### Semantic Colors

| Token          | Hex       | Uso                                           |
| -------------- | --------- | --------------------------------------------- |
| `primary`      | `#006B3F` | CTAs primários, links ativos, navegação ativa |
| `onPrimary`    | `#FFFFFF` | Texto/ícones sobre superfícies primárias      |
| `secondary`    | `#C5A34D` | Ações secundárias, selos premium, destaques   |
| `onSecondary`  | `#FFFFFF` | Texto/ícones sobre superfícies secundárias    |
| `surface`      | `#FFFFFF` | Backgrounds de cards, modais, painéis         |
| `onSurface`    | `#2D2D2D` | Texto principal sobre surfaces                |
| `background`   | `#FAFAF8` | Background geral da aplicação (tom quente)    |
| `onBackground` | `#1A1A1A` | Texto de máximo contraste sobre background    |

### Feedback Colors

| Token           | Hex       | Uso                                                    |
| --------------- | --------- | ------------------------------------------------------ |
| `success`       | `#2E7D32` | Confirmações, pedidos concluídos, estoque disponível   |
| `warning`       | `#F9A825` | Alertas de atenção, estoque baixo, promoções expirando |
| `alert`         | `#C62828` | Erros, itens indisponíveis, validação de formulários   |
| `info` / `link` | `#1565C0` | Links, informações contextuais, breadcrumbs            |

### Neutrals

| Token        | Hex       | Uso                                      |
| ------------ | --------- | ---------------------------------------- |
| `neutral0`   | `#FFFFFF` | Branco puro                              |
| `neutral50`  | `#FAFAF8` | Background base (tom quente)             |
| `neutral100` | `#F5F5F3` | Background alternativo (listras, seções) |
| `neutral200` | `#EEEEEC` | Backgrounds de hover                     |
| `neutral300` | `#E0E0DE` | Bordas, dividers                         |
| `neutral400` | `#BDBDBB` | Bordas inativas, placeholders de imagem  |
| `neutral500` | `#9E9E9C` | Texto de placeholder                     |
| `neutral600` | `#6B6B6B` | Texto terciário, captions                |
| `neutral700` | `#4A4A4A` | Texto secundário                         |
| `neutral800` | `#2D2D2D` | Texto principal                          |
| `neutral900` | `#1A1A1A` | Texto de máximo contraste                |

---

## Typography

### Font Families

- **Nunito Sans** — Família primária para UI, corpo de texto e headings. Sans-serif humanista com terminais arredondados que transmitem acolhimento e acessibilidade, alinhada ao posicionamento premium-mas-acessível do Grupo Boticário.
- **system-ui** — Fallback nativo do sistema para performance em dispositivos móveis.

### Roles Tipográficos

| Role            | Font Family |     Weight      | Uso                                    |
| --------------- | ----------- | :-------------: | -------------------------------------- |
| `display`       | Nunito Sans | 800 (ExtraBold) | Títulos hero, promoções destaque       |
| `heading`       | Nunito Sans |   700 (Bold)    | Headings de seção, nomes de produto    |
| `subtitle`      | Nunito Sans | 600 (SemiBold)  | Subtítulos, preços, labels de destaque |
| `body.regular`  | Nunito Sans |  400 (Regular)  | Corpo de texto, descrições             |
| `body.emphasis` | Nunito Sans | 600 (SemiBold)  | Ênfase no corpo, valores               |
| `caption`       | Nunito Sans |  400 (Regular)  | Textos auxiliares, disclaimers         |
| `fallback`      | system-ui   |       400       | Substituição nativa                    |

### Escala Tipográfica

| Token       | Tamanho (px) | Uso sugerido                                |
| ----------- | :----------: | ------------------------------------------- |
| `caption`   |      12      | Disclaimers, timestamps, metadados          |
| `body2`     |      14      | Labels de formulário, breadcrumbs, captions |
| `body1`     |      16      | Corpo padrão, descrições de produto         |
| `subtitle2` |      18      | Subtítulos menores, preços                  |
| `subtitle1` |      20      | Subtítulos de seção                         |
| `heading6`  |      22      | Heading de card, nomes de produto em grid   |
| `heading5`  |      24      | Heading de seção menor                      |
| `heading4`  |      28      | Heading de página interior                  |
| `heading3`  |      32      | Heading de categoria                        |
| `heading2`  |      36      | Heading de landing page                     |
| `heading1`  |      40      | Heading principal de página                 |
| `display2`  |      48      | Hero secundário, promoções                  |
| `display1`  |      56      | Hero principal, destaques sazonais          |

### Line Heights

| Token     | Multiplicador | Uso                                           |
| --------- | :-----------: | --------------------------------------------- |
| `tight`   |     1.2×      | Headings, display, títulos curtos             |
| `normal`  |     1.5×      | Corpo padrão, parágrafos, descrições          |
| `relaxed` |     1.75×     | Texto com espaçamento generoso, listas longas |

---

## Layout

### Spacing Scale

O Flora utiliza uma escala de espaçamento baseada em incrementos de 4px com progressão para seções maiores:

| Token      | Valor | Uso                                         |
| ---------- | :---: | ------------------------------------------- |
| `none`     |  0px  | Reset                                       |
| `micro`    |  4px  | Espaçamento mínimo, gap entre ícone e badge |
| `tiny`     |  8px  | Padding mínimo, gap entre ícone e texto     |
| `small`    | 12px  | Padding interno de chips e tags             |
| `standard` | 16px  | Padding padrão de componentes, gap de grid  |
| `medium`   | 24px  | Espaçamento entre blocos, padding de card   |
| `large`    | 32px  | Separação entre seções menores              |
| `xLarge`   | 48px  | Espaçamento entre seções                    |
| `xxLarge`  | 64px  | Espaçamento de seção (desktop)              |
| `huge`     | 80px  | Separação máxima entre áreas (hero, footer) |

### Grid System

| Breakpoint            | Colunas | Gutter | Margin | Uso                                  |
| --------------------- | :-----: | :----: | :----: | ------------------------------------ |
| Mobile (<768px)       |    4    |  16px  |  16px  | Smartphones                          |
| Tablet (768–1023px)   |    8    |  24px  |  32px  | Tablets, retrato                     |
| Desktop (1024–1439px) |   12    |  24px  |  48px  | Desktop padrão                       |
| Wide (≥1440px)        |   12    |  32px  |  auto  | Desktop amplo, conteúdo centralizado |

### Container

| Token          | Valor  | Uso                               |
| -------------- | :----: | --------------------------------- |
| `maxWidth`     | 1280px | Largura máxima de conteúdo        |
| `maxWidthWide` | 1440px | Largura máxima para landing pages |

---

## Elevation & Depth

O Flora implementa uma escala de elevação progressiva com sombras suaves, mantendo a estética clean e premium:

| Token  | Box-shadow                       | Uso                                  |
| ------ | -------------------------------- | ------------------------------------ |
| `none` | Nenhuma                          | Elementos flat, inline               |
| `xs`   | `0 1px 2px 0 rgba(0,0,0,0.06)`   | Hover sutil em cards                 |
| `sm`   | `0 2px 4px 0 rgba(0,0,0,0.08)`   | Cards em repouso, badges             |
| `md`   | `0 4px 8px 0 rgba(0,0,0,0.10)`   | Cards elevados, dropdowns            |
| `lg`   | `0 8px 16px 0 rgba(0,0,0,0.12)`  | Modais, bottom sheets, mega menus    |
| `xl`   | `0 12px 24px 0 rgba(0,0,0,0.14)` | Dialogs, drawers                     |
| `xxl`  | `0 20px 40px 0 rgba(0,0,0,0.16)` | Overlays full-screen, image lightbox |

### Opacity Scale

| Token         | Valor | Uso                              |
| ------------- | :---: | -------------------------------- |
| `transparent` |  0.0  | Totalmente invisível             |
| `hover`       | 0.04  | Background sutil de hover        |
| `disabled`    | 0.38  | Elementos desabilitados          |
| `medium`      | 0.54  | Textos secundários desabilitados |
| `high`        | 0.72  | Scrim de modais                  |
| `overlay`     | 0.87  | Overlays de galeria              |
| `opaque`      |  1.0  | Totalmente opaco                 |

---

## Shapes

### Border Radius

| Token    | Valor | Uso                                         |
| -------- | :---: | ------------------------------------------- |
| `none`   |  0px  | Imagens full-bleed, dividers                |
| `small`  |  4px  | Inputs, selects, tags compactas             |
| `medium` |  8px  | Botões, cards padrão, modais                |
| `large`  | 12px  | Cards de produto, containers destacados     |
| `xLarge` | 16px  | Cards hero, bottom sheets, image containers |
| `pill`   | 999px | Botões pill, chips, badges arredondados     |
| `circle` |  50%  | Avatares, FABs, thumbnails circulares       |

O Flora favorece `medium` (8px) como padrão, transmitindo uma estética premium com cantos suavemente arredondados — não tão sharp quanto tech puro, nem tão arredondado quanto apps infantis.

---

## Components

O Flora oferece componentes organizados pela governança de 3 camadas. Abaixo os principais componentes documentados:

### Core Components (Time Flora)

**Navegação e Estrutura**

- **AppBar** — Barra de topo com logo, busca, carrinho e menu de categorias
- **MegaMenu** — Menu expansível com categorias, subcategorias e imagens de produto
- **Breadcrumb** — Navegação hierárquica com links e separadores
- **Tab** — Abas de navegação horizontal (categorias, filtros)
- **Pagination** — Navegação entre páginas de resultados
- **Footer** — Rodapé com seções de links, redes sociais e selos

**Formulários e Inputs**

- **TextField** — Campo de texto com label, helper text, erro e estados
- **Select** — Seletor dropdown com busca opcional
- **Checkbox** — Caixa de seleção com label
- **RadioButton** — Grupo de seleção exclusiva
- **SearchBar** — Campo de busca com autocompletar e sugestões
- **QuantitySelector** — Input numérico de quantidade para carrinho

**Ações**

- **Button** — Variantes: contained (primary/secondary), outlined, ghost, text
- **IconButton** — Botões circulares (favoritar, compartilhar, fechar)
- **Link** — Links textuais com underline e estados
- **AddToCart** — Botão especializado de adicionar ao carrinho

**Feedback e Informação**

- **Badge** — Indicadores de quantidade (carrinho) e status (novo, promoção)
- **Tag** — Labels categóricos: promoção, novo, esgotado, frete grátis
- **Toast** — Notificações temporárias (produto adicionado, erro)
- **Alert** — Mensagens persistentes de informação ou erro
- **ProgressBar** — Barra de progresso (frete grátis, checkout steps)
- **Skeleton** — Placeholder de carregamento

**Mídia e Display**

- **ProductCard** — Card de produto com imagem, nome, preço e ações
- **Avatar** — Foto de perfil ou iniciais
- **Carousel** — Carrossel de imagens e banners
- **Rating** — Avaliação por estrelas (display e input)
- **PriceDisplay** — Formatação de preço com desconto, parcelamento

### Shared Components (Alta Maturidade)

- **ProductGrid** — Grid responsivo de produtos com filtros laterais
- **MiniCart** — Drawer de carrinho lateral
- **CheckoutSteps** — Wizard de etapas do checkout
- **AddressFinder** — Formulário de endereço com CEP autocomplete
- **DatePicker** — Seletor de data para agendamentos
- **ImageGallery** — Galeria de imagens de produto com zoom e thumbs

---

## Do's and Don'ts

### ✅ Do's

- **Use a paleta verde+dourado com propósito** — Verde para ações primárias e navegação; dourado para elementos premium, selos e destaques especiais
- **Mantenha backgrounds com tom quente** — Usar `neutral50` (#FAFAF8) em vez de branco/cinza frio puro para refletir a personalidade acolhedora da marca
- **Respeite a hierarquia tipográfica** — Display (800) → Heading (700) → Subtitle (600) → Body (400) com progressão clara
- **Aplique border-radius medium (8px) como padrão** — A estética Flora é premium com cantos suaves, não sharp nem excessivamente round
- **Priorize acessibilidade** — Contraste mínimo WCAG AA (4.5:1 para texto, 3:1 para elementos grandes)
- **Use o modelo de contribuição** — Se não encontrou o componente em Core, crie em Team Components usando tokens do Flora
- **Mantenha sombras suaves** — A marca é clean e luminosa; evite sombras pesadas
- **Use espaçamento generoso** — Produtos premium precisam de breathing room; não compacte demais

### ❌ Don'ts

- **Não use verde em texto sobre fundo branco para corpo** — Reserve verde para links, CTAs e destaques; corpo de texto sempre em neutrals
- **Não misture dourado com cores de feedback** — Dourado é exclusivo para premium/destaque; nunca para warning (use amarelo dedicado)
- **Não use sombras acima de `lg` em cards de produto** — Elevação excessiva descaracteriza a estética clean da marca
- **Não hardcode cores** — Use tokens semânticos; o Flora pode servir múltiplas marcas com temas distintos
- **Não use fontes não-autorizadas** — Nunca substitua Nunito Sans por fonts genéricas sem aprovação
- **Não ignore o contexto mobile** — 70%+ do tráfego é mobile; teste touch targets (mínimo 44px) e carregamento
- **Não crie componentes isolados** — Antes de criar do zero, consulte Team Components e Core; o ecossistema já pode ter o que você precisa
- **Não use gradientes chamativos** — Os gradientes do Flora são sutis (verde-para-verde-escuro); nunca gradientes multicoloridos

---

## Attribution

| Campo         | Valor                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source        | [boticario.com.br](https://www.boticario.com.br), [grupoboticario.com.br](https://www.grupoboticario.com.br)                                                 |
| Design System | Flora.ds — sistema interno (closed-source)                                                                                                                   |
| Listing       | [designsystemsbrasileiros.com/florads](https://designsystemsbrasileiros.com/florads/) — tag: closed                                                          |
| Reference     | [medium.com/gbtech — Cultivando Design Systems no Grupo Boticário](https://medium.com/gbtech/cultivando-design-systems-no-grupo-botic%C3%A1rio-6a6c57dfe137) |
| GitHub Org    | [github.com/grupoboticario](https://github.com/grupoboticario)                                                                                               |
| Method        | Public site CSS extraction + official blog documentation                                                                                                     |
| Date          | 2026-07-05                                                                                                                                                   |

<!-- Source: https://designmd.app/brands/grupo-boticario · designmd.app -->
