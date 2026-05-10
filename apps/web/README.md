# Moedin.IA Web

Aplicação frontend do Moedin.IA, construída com Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase SSR, Recharts e lucide-react.

Leia também o README da raiz do repositório para configuração completa de Supabase, migrations, Docker, n8n e LGPD.

## Rodar localmente

Crie `apps/web/.env.local` com:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sua-chave-publica
```

Instale e inicie:

```bash
npm install
npm run dev
```

Acesse:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Estrutura principal

```text
src/app/page.tsx                  # landing page
src/app/(auth)                    # login, cadastro, recuperar senha, atualizar senha
src/app/(app)                     # área autenticada
src/app/api/categories/ensure     # garante categorias padrão por usuário
src/components                    # componentes compartilhados
src/lib                           # helpers e clientes Supabase
src/proxy.ts                      # proxy/middleware do Next 16
```

## Rotas

Públicas:

```text
/
/login
/cadastro
/recuperar-senha
/atualizar-senha
```

Autenticadas:

```text
/dashboard
/historico
/lancamentos
/planejamento-mensal
/gastos-fixos
/parcelamentos
/metas
/perfil
/planos
```

## Validação

Antes de commit/deploy:

```bash
npm run lint
npm run build
```

O build deve mostrar `ƒ Proxy (Middleware)`, confirmando que `src/proxy.ts` está ativo.

## Observações de segurança

- O frontend deve usar apenas chaves públicas do Supabase.
- Não use `SUPABASE_SERVICE_ROLE_KEY` nesta aplicação.
- `.env.local`, `.next`, `node_modules`, logs e `*.tsbuildinfo` não devem ser versionados.
- O aceite de Termos/Privacidade usa `localStorage` para UX e `user_settings` no Supabase para usuário logado.
