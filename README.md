# Moedin.IA

Moedin.IA é uma plataforma de gestão financeira pessoal com dashboard web, histórico de lançamentos, planejamento mensal, gastos fixos, parcelamentos, metas, perfil, planos e integração com IA, WhatsApp, n8n, Evolution API e Supabase.

Esta versão está publicada na branch:

```bash
git checkout versionjune26
```

## Sumário

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Tecnologias](#tecnologias)
- [Pré-requisitos](#pré-requisitos)
- [Configuração rápida](#configuração-rápida)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Supabase e banco de dados](#supabase-e-banco-de-dados)
- [Autenticação e rotas protegidas](#autenticação-e-rotas-protegidas)
- [LGPD e consentimento](#lgpd-e-consentimento)
- [Fluxos financeiros](#fluxos-financeiros)
- [Rodando sem Docker](#rodando-sem-docker)
- [Rodando com Docker](#rodando-com-docker)
- [n8n e WhatsApp](#n8n-e-whatsapp)
- [Scripts úteis](#scripts-úteis)
- [Validação antes de commit/deploy](#validação-antes-de-commitdeploy)
- [Deploy](#deploy)
- [Solução de problemas](#solução-de-problemas)
- [Segurança e boas práticas](#segurança-e-boas-práticas)

## Visão geral

O Moedin.IA usa Supabase Auth para autenticação, Supabase/PostgreSQL com RLS para isolamento dos dados por usuário e Next.js App Router para o frontend. A aplicação trabalha com dados financeiros pessoais e, por isso, prioriza:

- sessão autenticada;
- rotas privadas protegidas por proxy/middleware;
- queries filtradas por usuário;
- RLS nas tabelas principais;
- consentimento de Termos de Uso e Política de Privacidade;
- separação entre chaves públicas do frontend e secrets de backend/automação.

## Funcionalidades

### Landing page

Página pública de apresentação com chamadas para cadastro e login.

### Autenticação

Fluxos atuais:

- login;
- cadastro;
- recuperação de senha;
- atualização de senha via fluxo do Supabase;
- logout;
- redirecionamento de usuários autenticados para o dashboard.

### Dashboard

O dashboard apresenta uma visão consolidada do mês:

- saldo mensal;
- total de receitas;
- total de despesas;
- últimos lançamentos;
- top categoria de gasto;
- orçamento geral;
- gráfico de gastos por categoria;
- comparativo receitas x despesas;
- resumo de metas, gastos fixos e parcelamentos;
- acesso ao modal de novo lançamento.

### Modal de novo lançamento

O modal centraliza os principais lançamentos:

- gasto normal;
- receita normal;
- gasto fixo;
- gasto parcelado;
- receita fixa temporária, salva como receita normal até existir recorrência própria de receitas.

Para manter dashboard e histórico limpos, o app só gera transações vencidas/ocorridas até a data atual em fluxos de gasto fixo e parcelamento.

### Histórico

Permite:

- buscar movimentações;
- filtrar por tipo, categoria e período;
- editar lançamentos manuais;
- excluir transações por exclusão lógica;
- identificar origem manual, gasto fixo ou parcelamento.

### Planejamento mensal

Permite controlar por mês:

- salário;
- renda extra;
- saldo inicial;
- dia de pagamento;
- vale-alimentação;
- vale-refeição;
- observações;
- orçamento geral;
- orçamento por categoria.

### Gastos fixos

Permite cadastrar despesas recorrentes com:

- título;
- descrição;
- valor;
- dia de vencimento;
- categoria;
- período;
- status ativo/inativo;
- geração opcional de transações vencidas.

### Parcelamentos

Permite cadastrar compras parceladas com:

- valor total;
- número de parcelas;
- valor calculado por parcela;
- data da primeira parcela;
- categoria;
- progresso das parcelas já geradas;
- valor pago e restante.

### Metas

Permite:

- criar metas financeiras;
- definir valor-alvo;
- definir prazo;
- atualizar progresso;
- concluir automaticamente quando o valor atual atinge o alvo;
- cancelar metas.

### Perfil e planos

O perfil permite editar dados pessoais básicos e preferências. A tela de planos existe como base para evolução comercial do produto.

## Arquitetura

```text
Navegador
  |
  | Next.js 16 App Router
  v
apps/web
  |
  | Supabase Auth + Supabase Database + RLS
  v
Supabase

apps/api
  |
  | API Fastify auxiliar
  v
http://localhost:3001

apps/ai-service
  |
  | Serviço FastAPI
  v
http://localhost:8000

n8n
  |
  | Webhooks e automações locais
  v
http://localhost:5678
```

## Estrutura do projeto

```text
.
├── apps
│   ├── web
│   │   ├── public
│   │   ├── src/app
│   │   │   ├── (auth)
│   │   │   ├── (app)
│   │   │   └── api/categories/ensure
│   │   ├── src/components
│   │   ├── src/lib
│   │   └── src/proxy.ts
│   ├── api
│   │   └── src/server.ts
│   └── ai-service
│       └── main.py
├── docs
│   └── privacy-lgpd-audit.md
├── n8n
│   ├── README.md
│   └── workflow
├── supabase
│   ├── migrations
│   └── seeds
├── .env.example
├── docker-compose.yml
└── README.md
```

## Tecnologias

### Web

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase SSR
- Supabase JS
- Recharts
- lucide-react

### Backend auxiliar

- Node.js
- Fastify
- TypeScript
- tsx

### Serviço de IA

- Python 3.11+
- FastAPI
- Uvicorn

### Banco e autenticação

- Supabase Auth
- PostgreSQL
- Row Level Security
- Migrations SQL

### Automação

- n8n
- Evolution API
- Redis

### Inteligência artificial

- Groq para interpretação de texto
- OpenAI para imagem, áudio e fallback de texto
- Parser local por regex quando nenhuma chave de IA estiver configurada

## Pré-requisitos

Para rodar sem Docker:

- Node.js 20 ou superior;
- npm;
- Python 3.11 ou superior;
- projeto Supabase criado;
- variáveis do Supabase configuradas no app web.

Para rodar com Docker:

- Docker;
- Docker Compose;
- projeto Supabase criado;
- variáveis públicas do Supabase passadas ao container web.

## Configuração rápida

Clone a branch `versionjune26`:

```bash
git clone -b versionjune26 https://github.com/GustavoHRX/moedinIA.git
cd moedinIA
```

Crie os arquivos de ambiente:

```bash
copy .env.example .env
copy .env.example apps\web\.env.local
```

No Windows PowerShell, também pode usar:

```powershell
Copy-Item .env.example .env
Copy-Item .env.example apps\web\.env.local
```

Edite `apps/web/.env.local` com pelo menos:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sua-chave-publica
```

Depois aplique as migrations no Supabase, instale dependências e rode o web app.

## Variáveis de ambiente

O arquivo versionado `.env.example` contém apenas placeholders. Não coloque chaves reais nele.

### Variáveis públicas do web app

```env
NEXT_PUBLIC_APP_NAME=Moedin.IA
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_AI_URL=http://localhost:8000
NEXT_PUBLIC_N8N_URL=http://localhost:5678
```

### Variáveis privadas para backend/automação

```env
SUPABASE_SERVICE_ROLE_KEY=
AI_SERVICE_URL=http://localhost:8000

GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

N8N_WEBHOOK_BASE_URL=http://localhost:5678
N8N_ENCRYPTION_KEY=change-me-in-production
WHATSAPP_PROVIDER=evolution
EVOLUTION_API_URL=http://evolution:8080
EVOLUTION_API_KEY=troque-por-uma-chave-forte
EVOLUTION_INSTANCE=moedin
JWT_SECRET=change-me-in-production
DEFAULT_TIMEZONE=America/Sao_Paulo
DEFAULT_CURRENCY=BRL
```

Importante:

- `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser usada no frontend.
- Variáveis `NEXT_PUBLIC_*` ficam visíveis no navegador.
- `.env`, `.env.local`, `.env.*`, `.next`, `node_modules` e logs são ignorados pelo Git.

## Supabase e banco de dados

As migrations ficam em:

```text
supabase/migrations
```

Ordem atual:

```text
001_init.sql
002_app_alignment.sql
003_auth_bootstrap_policies.sql
003_auth_profile_bootstrap.sql
004_user_settings_consent.sql
005_whatsapp_rpcs.sql
006_normalize_phone.sql
007_resolve_category_create.sql
008_whatsapp_consulta.sql
009_whatsapp_onboarding.sql
010_realtime_transactions.sql
```

### Como aplicar pelo SQL Editor

No painel do Supabase:

1. Abra o projeto.
2. Vá em SQL Editor.
3. Execute as migrations em ordem.
4. Confirme que as tabelas e policies foram criadas.

### Como aplicar com Supabase CLI

Se o projeto já estiver linkado:

```bash
supabase db push
```

### O que cada migration faz

`001_init.sql`

- Cria a base principal:
  - `profiles`
  - `categories`
  - `transactions`
  - `goals`
  - `budgets`
  - `ai_insights`
  - `message_logs`
  - `user_settings`
- Cria triggers de `updated_at`.
- Cria índices.
- Habilita RLS.
- Cria policies por usuário.

`002_app_alignment.sql`

- Alinha `budgets.amount`.
- Adiciona `goals.description`.
- Cria:
  - `monthly_controls`
  - `fixed_expenses`
  - `installments`
- Adiciona campos de origem em `transactions`.
- Cria índices e RLS para novas tabelas.

`003_auth_bootstrap_policies.sql`

- Cria/ajusta policy para inserir o próprio perfil.
- Recria policy de categorias por usuário.
- Ajuda no bootstrap de novos usuários com RLS ativo.

`003_auth_profile_bootstrap.sql`

- Cria a função `public.handle_new_user()`.
- Cria o trigger `on_auth_user_created`.
- Insere automaticamente um registro em `public.profiles` quando um usuário novo é criado no Supabase Auth.

`004_user_settings_consent.sql`

- Adiciona em `user_settings`:
  - `terms_accepted_at`
  - `privacy_accepted_at`
  - `terms_version`
  - `privacy_version`
- Cria índice auxiliar para consulta por versão.

`005_whatsapp_rpcs.sql` até `010_realtime_transactions.sql`

- Criam funções RPC usadas pelo WhatsApp/n8n.
- Normalizam telefone e vínculo do WhatsApp com o usuário.
- Resolvem categorias por usuário.
- Permitem consulta mensal e exclusão pelo fluxo do WhatsApp.
- Ativam atualização em tempo real da tabela `transactions`.

### Verificar consentimento no banco

Depois de aceitar os termos logado, confira:

```sql
select
  user_id,
  terms_accepted_at,
  privacy_accepted_at,
  terms_version,
  privacy_version
from public.user_settings
order by updated_at desc;
```

### Backfill de perfis antigos

Se já existiam usuários em `auth.users` antes da migration de bootstrap:

```sql
insert into public.profiles (id, full_name, email, phone)
select
  id,
  coalesce(nullif(raw_user_meta_data->>'full_name', ''), split_part(email, '@', 1), 'Usuário'),
  coalesce(email, ''),
  nullif(raw_user_meta_data->>'phone', '')
from auth.users
where id not in (select id from public.profiles);
```

## Autenticação e rotas protegidas

O projeto usa `apps/web/src/proxy.ts`, que é o formato esperado pelo Next.js 16 para proxy/middleware.

O proxy encaminha para:

```text
apps/web/src/lib/supabase/middleware.ts
```

### Rotas públicas

```text
/                  # landing page
/login             # login
/cadastro          # cadastro
/recuperar-senha   # recuperação de senha
/atualizar-senha   # atualização de senha pelo fluxo Supabase
```

### Rotas autenticadas

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

Comportamento esperado:

- usuário deslogado em rota interna vai para `/login`;
- usuário logado em `/login`, `/cadastro` ou `/recuperar-senha` vai para `/dashboard`;
- cookies de sessão são gerenciados pelo Supabase SSR;
- o frontend usa apenas chave pública/publishable do Supabase.

## LGPD e consentimento

Há uma auditoria técnica em:

```text
docs/privacy-lgpd-audit.md
```

O aceite de Termos de Uso e Política de Privacidade funciona assim:

- usuário deslogado pode aceitar e salvar em `localStorage`;
- usuário logado salva em `localStorage` e em `public.user_settings`;
- se já aceitou no banco na versão atual, o popup não aparece;
- se aceitou apenas localmente e depois logou, o app tenta sincronizar com o banco;
- em páginas públicas, o usuário pode escolher "Ver depois / Fechar";
- em rotas internas, o popup bloqueia o uso até o aceite.

Versões atuais:

```text
terms_version = 1.0
privacy_version = 1.0
```

Campos adicionados em `user_settings`:

```text
terms_accepted_at
privacy_accepted_at
terms_version
privacy_version
```

## Fluxos financeiros

### Datas e competência mensal

O app usa datas no formato:

```text
YYYY-MM-DD
```

A competência mensal é salva como:

```text
YYYY-MM-01
```

O helper central fica em:

```text
apps/web/src/lib/dates.ts
```

Funções de formatação ficam em:

```text
apps/web/src/lib/formatters.ts
```

### Transações manuais

Receitas e despesas normais são salvas em `transactions` com:

```text
origin_type = manual
source = web
status = active
```

### Gastos fixos

Ao criar um gasto fixo:

- o registro é salvo em `fixed_expenses`;
- se `auto_create_transaction` estiver ativo, o app cria transações vencidas até hoje;
- transações futuras não são criadas automaticamente.

### Parcelamentos

Ao criar um parcelamento:

- o registro é salvo em `installments`;
- o valor da parcela é calculado por `total_amount / total_installments`;
- o app cria em `transactions` apenas parcelas vencidas até hoje;
- o progresso da tela de parcelamentos usa as transações geradas.

### Receita fixa temporária

Receita fixa existe no modal como opção temporária, mas atualmente é salva como receita normal. A recorrência de receita deve ser modelada em etapa futura.

### Histórico

O histórico busca:

```text
status = active
transaction_date <= hoje
```

Exclusão de transações é lógica:

```text
status = deleted
deleted_at = now()
```

## Rodando sem Docker

### Web

```bash
cd apps/web
npm install
npm run dev
```

Acesse:

```text
http://localhost:3000
```

### API Fastify

```bash
cd apps/api
npm install
npm run dev
```

Health check:

```text
http://localhost:3001/health
```

### Serviço de IA

```bash
cd apps/ai-service
python -m venv venv
```

No Windows:

```bash
venv\Scripts\activate
```

Instale dependências:

```bash
pip install -r requirements.txt
```

Inicie:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Health check:

```text
http://localhost:8000/health
```

## Rodando com Docker

O `docker-compose.yml` sobe:

- web;
- API;
- IA;
- n8n.

Na raiz:

```bash
docker compose up --build
```

Serviços:

```text
Web: http://localhost:3333
API: http://localhost:3001
IA:  http://localhost:8000
n8n: http://localhost:5678
```

Para parar:

```bash
docker compose down
```

Para parar e remover volumes:

```bash
docker compose down -v
```

### Supabase no Docker

O serviço `web` precisa receber as variáveis públicas do Supabase. Você pode usar `env_file`:

```yaml
services:
  web:
    env_file:
      - ./apps/web/.env.local
```

## n8n e WhatsApp

A pasta `n8n/` contém documentação e workflow local de exemplo.

Arquivos importantes:

```text
n8n/README.md
n8n/TESTE-WHATSAPP-IA.md
n8n/workflow/moedin-whatsapp-ia.json
n8n/workflow/moedin-whatsapp-lite.json
```

Endpoint local documentado:

```text
POST http://localhost:5678/webhook/moedin-whatsapp
```

Fluxo principal:

- WhatsApp envia mensagem pela Evolution API.
- n8n recebe o webhook.
- O workflow identifica o remetente e resolve o usuário no Supabase.
- O serviço de IA interpreta texto, imagem ou áudio.
- A transação é gravada em `transactions`.
- O site atualiza os dados pelo Supabase.

O workflow completo usa IA, Redis, Supabase e Evolution API. O workflow `lite` é uma versão mais simples para texto e banco.

Atenção:

- `SUPABASE_SERVICE_ROLE_KEY` no n8n bypassa RLS.
- Não exponha webhook público sem autenticação.
- Não confie em `user_id` livre vindo do payload.
- Para produção, use assinatura HMAC, token por integração ou mapeamento seguro do remetente.
- Configure `N8N_ENCRYPTION_KEY` forte e secreto.

## Scripts úteis

### Web

```bash
cd apps/web
npm run dev
npm run lint
npm run build
npm run start
```

### API

```bash
cd apps/api
npm run dev
```

### IA

```bash
cd apps/ai-service
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Git

```bash
git status
git checkout versionjune26
git pull origin versionjune26
```

## Validação antes de commit/deploy

Antes de subir alterações no frontend:

```bash
cd apps/web
npm run lint
npm run build
```

O build deve listar as rotas e confirmar:

```text
ƒ Proxy (Middleware)
```

Isso indica que `src/proxy.ts` está sendo considerado pelo Next.js.

Também confira se arquivos sensíveis não estão rastreados:

```bash
git status --ignored
```

Arquivos que não devem ir para o GitHub:

```text
.env
.env.local
node_modules
.next
*.log
*.tsbuildinfo
n8n/data
n8n/files
n8n/qrcode*.png
apps/ai-service/venv
apps/ai-service/__pycache__
.claude
*.sqlite
*.sqlite-*
```

## Deploy

### Vercel

Configuração recomendada:

```text
Root Directory: apps/web
Build Command: npm run build
Output: .next
```

Variáveis mínimas:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
NEXT_PUBLIC_APP_URL=
```

Antes do deploy:

1. Aplique todas as migrations no Supabase.
2. Confirme RLS ativo.
3. Confirme que `004_user_settings_consent.sql` foi aplicada.
4. Rode `npm run lint`.
5. Rode `npm run build`.

### API

A API Fastify pode ser publicada em qualquer ambiente Node.js. Para produção, recomenda-se adicionar scripts próprios de `build` e `start`.

### IA

O serviço FastAPI pode ser publicado em plataforma com suporte a Python.

### n8n

Para produção, configure:

- URL pública;
- autenticação;
- persistência;
- backups;
- `N8N_ENCRYPTION_KEY` forte;
- secrets fora do repositório;
- proteção de webhook.

## Solução de problemas

### Build falha por variáveis do Supabase

Confirme `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
```

### Usuário cadastra, mas perfil não carrega

Verifique:

- `003_auth_profile_bootstrap.sql` aplicada;
- trigger `on_auth_user_created` criado;
- linha em `public.profiles`;
- RLS permitindo select do próprio perfil.

### Erro ao salvar lançamento por FK em `profiles`

Provável causa: usuário existe em `auth.users`, mas não existe em `public.profiles`.

Solução:

- aplicar `003_auth_profile_bootstrap.sql`;
- executar backfill de usuários antigos.

### Categorias não aparecem

Verifique:

- usuário autenticado;
- rota `POST /api/categories/ensure`;
- tabela `categories`;
- RLS de categorias;
- se há pelo menos uma categoria `income` e uma `expense`.

### Dashboard vazio mesmo com lançamentos

Verifique:

- `transactions.status = 'active'`;
- `transaction_date <= hoje`;
- `user_id` do lançamento;
- migrations aplicadas;
- RLS ativo.

### Popup de termos não salva no banco

Verifique:

- migration `004_user_settings_consent.sql` aplicada;
- tabela `user_settings`;
- usuário logado;
- RLS de `user_settings`;
- console/network para erro de upsert.

### n8n não abre

Veja logs:

```bash
docker compose logs n8n
```

Confirme se a porta está livre:

```text
5678
```

## Segurança e boas práticas

- Nunca versionar `.env` ou `.env.local`.
- Nunca usar `SUPABASE_SERVICE_ROLE_KEY` no navegador.
- Aplicar migrations em ordem.
- Manter RLS ativo.
- Validar policies antes de liberar tabelas novas.
- Não gerar transações futuras no histórico principal.
- Tratar campos livres como potencialmente sensíveis.
- Proteger webhooks externos.
- Rodar lint/build antes de commit e deploy.
- Consultar `docs/privacy-lgpd-audit.md` antes de features envolvendo IA, WhatsApp ou dados pessoais.

## Licença

Este repositório ainda não possui licença definida. Defina uma licença antes de distribuir publicamente ou aceitar contribuições externas.
