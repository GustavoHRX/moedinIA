# Relatório de refinamento do frontend Moedin.IA

## Resumo

Foi refinado o visual interno do Moedin.IA com foco em aparência premium, consistência de tema claro/escuro, sidebar mais forte e criação da tela de planos.

As alterações preservaram autenticação, banco, categorias, lançamentos, filtros e regras de negócio existentes.

## Arquivos criados

- `apps/web/src/app/(app)/planos/page.tsx`

## Arquivos alterados

- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/components/ui-kit.tsx`
- `apps/web/src/lib/supabase/middleware.ts`

## AppShell e sidebar

Alterações realizadas:

- Sidebar desktop com altura total.
- Logo completo do Moedin.IA maior no topo.
- Badge `Finance + IA` no bloco de marca.
- Menu lateral com ícones `lucide-react`.
- Item ativo com contraste legível em tema claro e escuro.
- Botão de sair mantido no rodapé.
- Botão de alternar tema mantido no rodapé.
- Fundo geral usando tokens de tema.
- Drawer lateral para mobile.
- Navegação inferior compacta mantida no mobile.

## Tela de Planos

Foi criada a rota:

`/planos`

A tela contém:

- Título `Escolha seu plano`.
- Subtítulo `Controle suas finanças com mais clareza, automação e inteligência.`
- Cards dos planos Mensal, Semestral e Anual.
- Card Semestral destacado como `Recomendado`.
- Badge `Melhor valor` no plano Anual.
- Botões visuais com alerta temporário: `Integração de pagamento em desenvolvimento.`

## Menu

Foi adicionado o item `Planos` na sidebar apontando para:

`/planos`

A rota também foi incluída no middleware como rota protegida.

## Design system interno

Foram refinados componentes visuais reutilizáveis:

- `PageFrame`
- `PageHeader`
- `Surface`
- `SectionHeader`
- `StatCard`

Esses ajustes melhoram visualmente dashboard, histórico, planejamento mensal, gastos fixos e parcelamentos sem alterar lógica das páginas.

## Regras preservadas

Não foram alterados:

- Banco de dados.
- Supabase Auth.
- Categorias.
- Lançamentos.
- Filtros do histórico.
- Regras de parcelamentos.
- Regra de não exibir lançamentos futuros no dashboard/histórico.

## Validação

Comandos executados em `apps/web`:

```bash
npm run lint
npm run build
```

Resultado:

- `npm run lint`: passou.
- `npm run build`: passou.

Build gerou a nova rota:

`/planos`
