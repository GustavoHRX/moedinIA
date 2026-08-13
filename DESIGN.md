# Design

Fonte de verdade visual: Brand Book Moedin.IA v1.3 (tokens na pág. 12) +
`apps/web/src/app/globals.css`.

## Theme

Dark-first esverdeado (nunca preto puro). Tema claro derivado existe via
`[data-theme="light"]`.

## Colors

- bg `#0C1210` · surface `#141C18` · surface-2 `#182420` · border `#24322B`
- primary `#10B981` (Verde Moedin) · hover `#34D399` · soft `#0F2E22`
- accent teal `#14B8A6` · mint `#6EE7B7`
- text `#F2F6F4` · muted `#B7C4BE` · soft `#5A6B63`
- semânticas: income `#34D399` · expense `#F87171` · warning `#FBBF24` · info `#60A5FA`
- texto sobre verde: `#06130D` (nunca branco)
- Gradiente da marca `135deg #10B981→#14B8A6`: SÓ hero/CTA principal/gráficos de destaque.
- Paleta de categorias (16 cores): `apps/web/src/lib/category-palette.ts`.

## Typography

- Poppins 600/700 — títulos e logo (via next/font, `--font-heading`).
- Inter 400/500/600 — corpo e UI (`--font-body`).
- JetBrains Mono 600 — valores R$, tabelas (`--font-mono`, classe `.money`).
- Escala: H1 48–64 Bold lh 1.1 · H2 32–40 · H3 20–24 SemiBold · corpo 16–18 lh 1.6 · label 13–14 Medium.
- Pesos acima de 700 são proibidos (o book só usa até Bold).

## Shape & Elevation

- Raios: botões/inputs 12px · cards 16–20px · modais/hero 24px · chips/avatares 100%.
- Glow verde `0 0 40px rgba(16,185,129,.25)` só em 1–2 pontos por tela (elementos de IA).
- Ícones Lucide traço 1.5–2px; cor padrão `#B7C4BE`, ativo `#34D399`. Nunca sólidos.

## Motion

Tokens: `--dur-fast` 150ms · `--dur-base` 250ms · `--dur-slow` 450ms ·
`--ease-out` cubic-bezier(.16,1,.3,1) · `--ease-spring` cubic-bezier(.34,1.56,.64,1).
As 8 animações da marca (book pág. 08): coin-flip, count-up, chart-grow,
typing-dots, glow-pulse (só CTA hero), pop-in, slide-fade, celebrate.
Regras: máx. 1 loop por tela · nada acima de 600ms · `prefers-reduced-motion` obrigatório.

## Components

- UI kit: `apps/web/src/components/ui-kit.tsx` (Surface, PageHeader, StatCard…).
- Mascotes: `apps/web/src/components/hominhos.tsx` + `hominho-tip.tsx`
  (line-art menta 2.2, badge com 5 frisos; arte canônica em
  `docs/design/hominhos/`).
- Gráficos Recharts: barras topo 6px raio, largura máx 32px; donut 12–16px de
  espessura; grid `#1C2823`; tooltip fundo `#182420` raio 12 valores em mono.
- Chips/badges: fundo `#0F2E22`, texto menta, 100% redondos; ✦ marca ações da IA.
