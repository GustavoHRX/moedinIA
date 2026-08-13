# Design — Brand book v1.3 + Hominhos + Categorias com cor

Data: 2026-07-05 · Aprovado pelo João em conversa (brainstorming)

## Contexto

O app web (apps/web, Next.js 16) não segue o Brand Book v1.3: verde antigo
`#2e9e4f` (book: `#10B981`), headings Montserrat (book: Poppins), sem
JetBrains Mono em valores, tema padrão claro (book: dark-first `#0C1210`).
As cores de categorias vêm de um mapa fixo fora da paleta da marca
(`src/lib/categories.ts`); a coluna `categories.color` existe no banco mas é
pouco usada.

## Decisões de produto (alinhadas com o usuário)

- **Hominhos** = os 5 avatares line-art da equipe do book (pág. 09):
  Alefe, Gustavo, Marcinho, João, Timachi.
- Comportamento: **card de dica fixo por página**, dispensável, não volta até
  haver dica nova.
- Onde: 5 páginas-chave, 1 padrinho cada — João→Dashboard,
  Gustavo→Histórico, Marcinho→Metas, Alefe→Gastos fixos + Parcelamentos,
  Timachi→Planejamento mensal. Inclui empty states dessas páginas.
- **Categorias**: usuário pode criar as suas e definir cor de qualquer uma
  (novas e existentes). Persistência em `categories.color` (coluna existente).
- Seletor de cor: **grade curada de 16 cores da marca + roda de cor livre**.
- Gestão de categorias: **seção na página /perfil**.
- Tema claro: mantido (derivado da paleta), **dark vira padrão**.

## Arquitetura

### 1. Fundação — tokens do book
- `globals.css`: tokens da pág. 12 (`--bg #0C1210`, `--surface #141C18`,
  `--surface-2 #182420`, `--border #24322B`, `--primary #10B981`,
  `--primary-hover #34D399`, `--primary-soft #0F2E22`, `--accent #14B8A6`,
  `--mint #6EE7B7`, `--text #F2F6F4`, `--text-muted #B7C4BE`,
  `--text-soft #5A6B63`, `--income/--expense/--warning/--info`,
  `--on-primary #06130D`, raios 12/16/24, `--gradient`, `--glow`) +
  tokens de movimento da pág. 08 (`--dur-fast/base/slow`, `--ease-out`,
  `--ease-spring`) + keyframes da marca (pop-in, glow-pulse, coin-flip,
  typing).
- Fontes via `next/font`: Poppins (600/700, títulos), Inter (400/500/600,
  corpo), JetBrains Mono (600, valores R$). Regra de ouro: nunca texto branco
  sobre `#10B981` — usar `#06130D`.
- Tema claro derivado (mesmo verde `#10B981` como âncora), dark default.

### 2. Paleta de categorias
- Novo `src/lib/category-palette.ts`: 16 cores curadas derivadas do book
  (sequência de gráficos da pág. 15 + variações harmônicas legíveis sobre
  `#0C1210`).
- Resolução de cor: `categories.color` (banco) → mapa padrão remapeado à
  paleta → neutro. `categories.ts` vira fallback.
- Consumidores: `CategoryIcon`, chips do histórico, donut/barras do
  dashboard (Recharts, regras da pág. 15), modal de lançamento, filtros.

### 3. Gestão de categorias em /perfil
- Seção "Categorias": listas Receitas/Despesas; criar, renomear, escolher
  ícone (conjunto Lucide curado) e cor (grade 16 + color picker nativo).
- `is_default`: pode mudar cor/ícone, não pode excluir. Custom: arquivável.
- Ao salvar: invalida cache do `AppDataProvider`.

### 4. Hominhos
- 5 componentes SVG line-art seguindo pág. 09: linha única `#6EE7B7`
  (via CSS var), espessura 2.2 (grid 100), olhos-ponto, sobrancelhas e
  orelhas, busto em "U", badge com anel + 5 frisos de moeda, sorriso sempre.
  Identidade: Alefe=cachos+bigode, Gustavo=óculos redondos+capuz,
  Marcinho=puffer com zíper, João=corrente+gola careca,
  Timachi=óculos+barba+lapela.
- Validação: arte estática (canvas-design) aprovada pelo usuário antes de
  integrar.
- `<HominhoTip>`: card raio 16px, avatar 48px, nome, 1 dica, botão fechar.
  Hover: coin-flip no anel (600ms spring). `prefers-reduced-motion`
  respeitado.
- `src/lib/tips.ts`: funções puras por página; recebem os dados que a página
  já carrega e devolvem a dica mais relevante, tom de voz da pág. 10.
  Fallback educativo + texto de empty state por página.
- Dispensa: `localStorage`, chave `hominho:<page>:<tipId>`.

### Fora de escopo
Landing page nova, recorrência de receita, dicas geradas por IA real
(interface pronta para plugar depois), edição de categorias no modal de
lançamento, mudanças de banco.

### Validação
- `npm run lint && npm run build` no apps/web.
- Preview em localhost:3333 (docker) com prints antes/depois.
- Sem commit/push sem pedido explícito.
