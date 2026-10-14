# Moedin-IA Web

Painel e landing do Moedin-IA: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Supabase SSR, Recharts, GSAP e lucide-react.

A visão geral do sistema, as rotas, as variáveis e o deploy estão no [README da raiz](../../README.md). O guia de leitura do código está em [`docs/EXPLICACAO_DO_CODIGO.md`](../../docs/EXPLICACAO_DO_CODIGO.md).

## Rodar

```bash
npm install
npm run dev        # http://localhost:3000 (next dev --webpack)
```

`.env.local` mínimo:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sua-chave-publica
```

Para exportar dados, excluir conta, o cron e o QR do WhatsApp funcionarem, veja a tabela de variáveis no README da raiz.

## Scripts

```bash
npm run lint       # tsc + eslint
npm test           # vitest
npx next build --webpack
```

O build precisa listar `ƒ Proxy (Middleware)`: é o `src/proxy.ts` protegendo o painel.

## Estrutura

```text
src/app/page.tsx        landing
src/app/(auth)          login, cadastro, recuperar e atualizar senha
src/app/(app)           painel (dashboard, historico, fixos, parcelamentos,
                        categorias, metas, limite, whatsapp, onboarding, perfil)
src/app/api             account, categories, cron, whatsapp
src/components          componentes compartilhados e o estado global do painel
src/lib                 dinheiro, datas, recorrência, clientes do Supabase
src/proxy.ts            proteção de rotas (o "middleware" do Next 16)
```

## Segurança

- No navegador, só chaves públicas do Supabase. A proteção dos dados é o RLS.
- `SUPABASE_SERVICE_ROLE_KEY` é lida apenas em código de servidor (cron, exclusão de conta e contador da landing) e nunca leva o prefixo `NEXT_PUBLIC_`.
- `.env.local`, `.next`, `node_modules` e logs não são versionados.
