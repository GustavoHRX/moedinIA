# Moedin.IA

Moedin.IA é uma plataforma de controle financeiro pessoal com dashboard web, organização de lançamentos, metas, orçamentos mensais, gastos fixos, parcelamentos e uma base preparada para integrações com IA, WhatsApp e automações via n8n.

O projeto está organizado como um monorepo simples, com:

- Aplicação web em Next.js.
- API auxiliar em Node.js/Fastify.
- Serviço de IA em Python/FastAPI.
- Banco de dados e autenticação no Supabase.
- Ambiente local opcional com Docker Compose.

## Sumário

- [Recursos principais](#recursos-principais)
- [Arquitetura](#arquitetura)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Tecnologias](#tecnologias)
- [Pré-requisitos](#pré-requisitos)
- [Instalação rápida](#instalação-rápida)
- [Configuração do Supabase](#configuração-do-supabase)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Rodando com Docker](#rodando-com-docker)
- [Rodando sem Docker](#rodando-sem-docker)
- [Scripts úteis](#scripts-úteis)
- [Rotas da aplicação](#rotas-da-aplicação)
- [Fluxos financeiros](#fluxos-financeiros)
- [Deploy](#deploy)
- [Solução de problemas](#solução-de-problemas)

## Recursos principais

### Dashboard financeiro

O dashboard apresenta uma visão consolidada do mês atual:

- Saldo mensal.
- Total de receitas.
- Total de despesas.
- Últimos lançamentos.
- Top categoria de gasto.
- Orçamento geral do mês.
- Gráfico de gastos por categoria.
- Comparativo entre receitas e despesas.
- Resumo de metas, gastos fixos e parcelamentos.

### Lançamentos

O usuário pode registrar:

- Receita normal.
- Despesa normal.
- Despesa fixa.
- Despesa parcelada.
- Receita fixa, atualmente salva como lançamento normal.

Para manter o histórico limpo, parcelas e recorrências futuras não são exibidas como transações realizadas. O sistema trabalha apenas com transações vencidas ou ocorridas até a data atual.

### Histórico

A tela de histórico permite:

- Buscar movimentações por texto.
- Filtrar por tipo: receita ou despesa.
- Filtrar por categoria.
- Filtrar por período.
- Editar lançamentos manuais.
- Excluir lançamentos por exclusão lógica.
- Identificar a origem do registro: manual, fixo ou parcelado.

### Planejamento mensal

Permite registrar por mês:

- Salário.
- Renda extra.
- Saldo inicial.
- Dia de pagamento.
- Vale-alimentação.
- Vale-refeição.
- Observações.
- Orçamento geral.
- Orçamentos por categoria.

### Gastos fixos

Permite cadastrar despesas recorrentes com:

- Nome.
- Descrição.
- Valor.
- Dia de vencimento.
- Categoria.
- Status ativo ou inativo.
- Opção de criação automática de transações vencidas.

### Parcelamentos

Permite cadastrar compras parceladas com:

- Valor total.
- Quantidade de parcelas.
- Valor calculado por parcela.
- Data da primeira parcela.
- Categoria.
- Progresso das parcelas já geradas.
- Valor pago e valor restante.

### Metas

Permite:

- Criar objetivos financeiros.
- Definir valor-alvo.
- Definir prazo.
- Atualizar progresso.
- Marcar como concluída automaticamente quando o valor acumulado atinge o alvo.
- Cancelar metas.

## Arquitetura

```text
Navegador
  |
  | Next.js App Router
  v
apps/web
  |
  | Supabase Auth + Supabase Database
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
  | Automações e webhooks
  v
http://localhost:5678
```

## Estrutura de pastas

```text
.
├── apps
│   ├── web
│   │   ├── src/app
│   │   │   ├── (auth)              # Login, cadastro e recuperação de senha
│   │   │   └── (app)               # Área autenticada
│   │   ├── src/components          # Componentes reutilizáveis
│   │   ├── src/lib                 # Helpers, datas e clientes Supabase
│   │   └── public                  # Imagens e assets
│   ├── api
│   │   └── src/server.ts           # API Fastify
│   └── ai-service
│       └── main.py                 # Serviço FastAPI
├── supabase
│   ├── migrations                  # Estrutura do banco
│   └── seeds                       # Dados iniciais
├── docker-compose.yml              # Ambiente local completo
├── package.json
└── README.md
```

## Tecnologias

### Web

- Next.js 16.
- React 19.
- TypeScript.
- Tailwind CSS 4.
- Supabase SSR.
- Supabase JS.
- Recharts.
- Lucide React.

### API

- Node.js.
- Fastify.
- TypeScript.
- TSX.

### IA

- Python 3.11.
- FastAPI.
- Uvicorn.

### Banco e autenticação

- Supabase Auth.
- PostgreSQL.
- Row Level Security.
- Migrations SQL.

### Automação

- n8n.

## Pré-requisitos

Para rodar o projeto, você precisa de uma das duas opções abaixo.

### Opção com Docker

- Docker.
- Docker Compose.

### Opção sem Docker

- Node.js 20 ou superior.
- npm.
- Python 3.11 ou superior.
- Um projeto criado no Supabase.

## Instalação rápida

Clone a branch `newVersion`:

```bash
git clone -b newVersion https://github.com/GustavoHRX/moedinIA.git
cd moedinIA
```

Depois, escolha uma forma de execução:

- Use [Rodando com Docker](#rodando-com-docker) para subir web, API, IA e n8n juntos.
- Use [Rodando sem Docker](#rodando-sem-docker) para iniciar cada serviço manualmente.

Antes de acessar o app, configure:

1. O banco no Supabase.
2. As variáveis de ambiente do web app.
3. As URLs de integração, caso vá usar API, IA ou n8n.

## Configuração do Supabase

As migrations ficam em:

```text
supabase/migrations
```

Ordem atual:

```text
001_init.sql
002_app_alignment.sql
003_auth_profile_bootstrap.sql
```

### Como aplicar as migrations pelo painel do Supabase

1. Acesse o painel do Supabase.
2. Entre no seu projeto.
3. Abra **SQL Editor**.
4. Crie uma nova query.
5. Copie e execute o conteúdo de `001_init.sql`.
6. Copie e execute o conteúdo de `002_app_alignment.sql`.
7. Copie e execute o conteúdo de `003_auth_profile_bootstrap.sql`.

### O que cada migration faz

`001_init.sql` cria a base principal:

- `profiles`.
- `categories`.
- `transactions`.
- `goals`.
- `budgets`.
- `ai_insights`.
- `message_logs`.
- `user_settings`.
- Triggers de `updated_at`.
- Índices.
- Políticas de RLS.

`002_app_alignment.sql` alinha o banco com as telas atuais:

- Ajusta `budgets.amount`.
- Adiciona `goals.description`.
- Cria `monthly_controls`.
- Cria `fixed_expenses`.
- Cria `installments`.
- Adiciona campos de origem em `transactions`.
- Cria RLS para as novas tabelas.

`003_auth_profile_bootstrap.sql` cria:

- A função `public.handle_new_user()`.
- O trigger `on_auth_user_created`.

Esse trigger cria automaticamente uma linha em `public.profiles` quando um usuário novo é criado no Supabase Auth.

### Usuários antigos sem perfil

O trigger resolve usuários novos. Se você já tinha usuários em `auth.users` antes de aplicar a migration `003`, rode este SQL para criar os perfis que faltam:

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

## Variáveis de ambiente

> Nunca suba arquivos `.env` para o GitHub. Eles já estão no `.gitignore`.

O Next.js carrega variáveis a partir da pasta do app web. Portanto, para rodar o frontend localmente sem Docker, crie:

```text
apps/web/.env.local
```

Exemplo:

```env
NEXT_PUBLIC_APP_NAME=Moedin.IA
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sua-chave-publica
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-opcional

NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_AI_URL=http://localhost:8000
NEXT_PUBLIC_N8N_URL=http://localhost:5678
```

Variáveis sensíveis, como `SUPABASE_SERVICE_ROLE_KEY`, não devem ser usadas no frontend. Elas só devem existir em ambiente de servidor.

Exemplo para serviços de backend, quando necessário:

```env
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
AI_SERVICE_URL=http://localhost:8000
N8N_WEBHOOK_BASE_URL=http://localhost:5678
WHATSAPP_PROVIDER=evolution
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
JWT_SECRET=troque-este-valor-em-producao
DEFAULT_TIMEZONE=America/Sao_Paulo
DEFAULT_CURRENCY=BRL
```

## Rodando com Docker

O arquivo `docker-compose.yml` sobe:

- Web app.
- API.
- Serviço de IA.
- n8n.

Na raiz do projeto:

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

### Observação importante sobre Supabase no Docker

O serviço `web` precisa receber as variáveis públicas do Supabase. Você pode configurar isso diretamente no `docker-compose.yml` ou usar um arquivo de ambiente.

Exemplo com `env_file`:

```yaml
services:
  web:
    env_file:
      - ./apps/web/.env.local
```

## Rodando sem Docker

### 1. Rodar o web app

Entre na pasta do web app:

```bash
cd apps/web
```

Instale as dependências:

```bash
npm install
```

Crie o arquivo:

```text
.env.local
```

Com pelo menos:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sua-chave-publica
```

Inicie o servidor:

```bash
npm run dev
```

Acesse:

```text
http://localhost:3000
```

### 2. Rodar a API

Em outro terminal:

```bash
cd apps/api
npm install
npm run dev
```

Acesse:

```text
http://localhost:3001
```

Health check:

```text
http://localhost:3001/health
```

### 3. Rodar o serviço de IA

Em outro terminal:

```bash
cd apps/ai-service
python -m venv venv
```

Ative o ambiente virtual no Windows:

```bash
venv\Scripts\activate
```

Instale as dependências:

```bash
pip install -r requirements.txt
```

Inicie o serviço:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Acesse:

```text
http://localhost:8000
```

Health check:

```text
http://localhost:8000/health
```

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

## Rotas da aplicação

### Rotas públicas

```text
/                  # Início
/login             # Login
/cadastro          # Criação de conta
/recuperar-senha   # Recuperação de senha
/atualizar-senha   # Atualização de senha
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
```

O middleware protege as rotas autenticadas e redireciona usuários sem sessão para `/login`.

## Fluxos financeiros

### Competência mensal

O app usa datas no formato:

```text
YYYY-MM-DD
```

A competência mensal é salva como:

```text
YYYY-MM-01
```

O fuso padrão do app é:

```text
America/Sao_Paulo
```

Isso evita problemas comuns causados por `toISOString()`, que pode mudar o dia quando o horário local está atrás do UTC.

### Gastos fixos

Ao criar um gasto fixo pelo modal:

- O registro é salvo em `fixed_expenses`.
- Se a opção de criação automática estiver ativa, o app cria somente transações vencidas até hoje.
- Transações futuras não são criadas automaticamente para não poluir o dashboard e o histórico.

### Parcelamentos

Ao criar um parcelamento:

- O registro é salvo em `installments`.
- O valor da parcela é calculado por `total_amount / total_installments`.
- O app cria em `transactions` apenas parcelas vencidas até hoje.
- O progresso da tela de parcelamentos usa as transações geradas.

### Histórico

O histórico busca apenas:

```text
status = active
transaction_date <= hoje
```

A exclusão é lógica:

```text
status = deleted
deleted_at = now()
```

## Deploy

### Deploy do web app na Vercel

1. Conecte o repositório na Vercel.
2. Configure o diretório raiz do projeto como:

```text
apps/web
```

3. Configure as variáveis:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
NEXT_PUBLIC_APP_URL=
```

4. Use o comando de build:

```bash
npm run build
```

5. Faça o deploy.

### Deploy da API

A API Fastify pode ser publicada em qualquer ambiente Node.js.

Comandos básicos:

```bash
npm install
npm run dev
```

Para produção, recomenda-se adicionar scripts próprios de `build` e `start`.

### Deploy do serviço de IA

O serviço FastAPI pode ser publicado em qualquer plataforma com suporte a Python.

Comando básico:

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Deploy do n8n

O `docker-compose.yml` contém um n8n local. Para produção, configure:

- URL pública.
- Autenticação.
- Persistência de dados.
- Backups.
- Variáveis de segurança.

## Boas práticas

- Nunca versionar `.env`.
- Nunca usar `SUPABASE_SERVICE_ROLE_KEY` no navegador.
- Rodar `npm run lint` antes de subir alterações no web app.
- Rodar `npm run build` antes de fazer deploy.
- Aplicar migrations em ordem.
- Manter RLS ativo nas tabelas do Supabase.
- Validar políticas de RLS antes de liberar novas tabelas.
- Usar `status = deleted` para exclusão lógica de transações.
- Evitar gerar transações futuras no histórico principal.

## Solução de problemas

### Erro ao salvar lançamento por chave estrangeira em `profiles`

Provável causa:

- O usuário existe em `auth.users`, mas não existe em `public.profiles`.

Solução:

- Rode `003_auth_profile_bootstrap.sql`.
- Faça o backfill para usuários antigos, se necessário.

### Usuário cadastra, mas o perfil não carrega

Verifique:

- Se a migration `003_auth_profile_bootstrap.sql` foi aplicada.
- Se existe uma linha em `public.profiles` com `id = auth.uid()`.
- Se a política de RLS permite `select` do próprio perfil.

### Dashboard vazio mesmo com lançamentos cadastrados

Verifique:

- Se `transactions.status = 'active'`.
- Se `transaction_date <= hoje`.
- Se o usuário do lançamento é o mesmo usuário autenticado.
- Se as migrations foram aplicadas corretamente.

### Build do Next falha por variáveis do Supabase

Verifique se o arquivo `apps/web/.env.local` existe e contém:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
```

### Docker web sobe, mas o app não conecta no Supabase

Verifique se as variáveis públicas do Supabase foram passadas para o serviço `web` no `docker-compose.yml`.

### n8n não abre

Verifique os logs:

```bash
docker compose logs n8n
```

E confirme se a porta `5678` está livre.

## Validação

Validações recomendadas para o web app:

```bash
cd apps/web
npm run lint
npm run build
```

## Licença

Este repositório ainda não possui uma licença definida. Defina uma licença antes de distribuir publicamente ou aceitar contribuições externas.
