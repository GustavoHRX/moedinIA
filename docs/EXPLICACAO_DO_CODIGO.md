# Explicacao do Codigo - Moedin.IA

Este documento explica, de forma pratica, como o codigo do projeto Moedin.IA esta organizado e como as principais partes se conectam.

## 1. Visao geral do projeto

O Moedin.IA e uma aplicacao de controle financeiro pessoal com:

- frontend web em Next.js;
- autenticacao e banco pelo Supabase;
- API auxiliar em Node.js/Fastify;
- servico auxiliar de IA em Python/FastAPI;
- automacoes planejadas com n8n;
- estrutura Docker para subir os servicos localmente.

O objetivo principal do sistema e permitir que o usuario controle receitas, despesas, metas, gastos fixos, parcelamentos e planejamento mensal.

## 2. Estrutura principal de pastas

```text
.
├── apps
│   ├── web
│   │   └── Frontend principal em Next.js
│   ├── api
│   │   └── API auxiliar em Node.js com Fastify
│   └── ai-service
│       └── Servico Python com FastAPI
├── docs
│   └── Documentacoes tecnicas
├── infra
│   └── Arquivos de infraestrutura
├── n8n
│   └── Workflow e documentacao de automacao
├── supabase
│   ├── migrations
│   │   └── Scripts SQL do banco
│   └── seeds
│       └── Dados iniciais
├── docker-compose.yml
└── README.md
```

## 3. Frontend - apps/web

O frontend e a parte principal do projeto. Ele usa:

- Next.js;
- React;
- TypeScript;
- Supabase;
- Tailwind CSS;
- Recharts;
- lucide-react para icones.

### Arquivos importantes

```text
apps/web/src/app/layout.tsx
```

E o layout raiz da aplicacao. Ele define:

- idioma da pagina como `pt-BR`;
- fontes principais;
- metadados do site;
- `ThemeProvider`;
- popup de aceite de termos.

```tsx
<ThemeProvider>
  {children}
  <TermsConsentPopup />
</ThemeProvider>
```

Isso significa que todas as paginas do sistema passam pelo provedor de tema e podem exibir o popup de consentimento.

```text
apps/web/src/app/page.tsx
```

E a landing page publica. Ela mostra a apresentacao do Moedin.IA, beneficios, chamada para login e cadastro.

```text
apps/web/src/app/(auth)
```

Contem as paginas publicas de autenticacao:

- `login`;
- `cadastro`;
- `recuperar-senha`;
- `atualizar-senha`.

```text
apps/web/src/app/(app)
```

Contem as telas internas, que exigem usuario logado:

- `dashboard`;
- `historico`;
- `lancamentos`;
- `planejamento-mensal`;
- `gastos-fixos`;
- `parcelamentos`;
- `metas`;
- `perfil`;
- `planos`.

## 4. Layout interno do sistema

```text
apps/web/src/app/(app)/layout.tsx
```

Esse arquivo envolve todas as paginas internas com:

```tsx
<AppDataProvider>
  <AppShell>{children}</AppShell>
</AppDataProvider>
```

Na pratica:

- `AppDataProvider` carrega dados globais do usuario;
- `AppShell` monta a estrutura visual interna, com menu lateral, menu mobile e botoes de navegacao.

```text
apps/web/src/components/app-shell.tsx
```

Esse componente monta o painel interno do sistema. Ele contem:

- logo;
- menu lateral no desktop;
- menu superior no mobile;
- navegacao entre telas;
- botao de tema;
- botao de logout;
- exibicao do nome do usuario.

As rotas do menu ficam no array `navItems`:

```tsx
const navItems = [
  { href: "/dashboard", label: "Visao geral", icon: LayoutDashboard },
  { href: "/historico", label: "Historico", icon: History },
  { href: "/planejamento-mensal", label: "Planejamento", icon: CalendarDays },
  { href: "/gastos-fixos", label: "Gastos fixos", icon: Repeat2 },
  { href: "/parcelamentos", label: "Parcelamentos", icon: CreditCard },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/planos", label: "Planos", icon: Crown },
  { href: "/perfil", label: "Conta", icon: UserRound },
];
```

## 5. Autenticacao e protecao de rotas

O projeto usa Supabase Auth.

```text
apps/web/src/proxy.ts
```

Esse arquivo chama o middleware de autenticacao:

```tsx
export async function proxy(request: NextRequest) {
  return await supabaseMiddleware(request);
}
```

Ele tambem define quais rotas passam pela verificacao.

```text
apps/web/src/lib/supabase/middleware.ts
```

Esse arquivo verifica se existe usuario logado.

Regras principais:

- usuario logado tentando acessar `/login`, `/cadastro` ou `/recuperar-senha` vai para `/dashboard`;
- usuario deslogado tentando acessar rota interna vai para `/login`;
- cookies de sessao sao sincronizados com o Supabase SSR.

Exemplo de rotas protegidas:

```tsx
const protectedRoutes = [
  "/dashboard",
  "/perfil",
  "/lancamentos",
  "/historico",
  "/metas",
  "/gastos-fixos",
  "/parcelamentos",
  "/planejamento-mensal",
  "/planos",
];
```

## 6. Clientes do Supabase

O projeto separa o uso do Supabase no navegador e no servidor.

```text
apps/web/src/lib/supabase/client.ts
```

Cria o cliente usado em componentes client-side.

Ele usa variaveis publicas:

```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
```

ou:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

```text
apps/web/src/lib/supabase/server.ts
```

Cria o cliente usado em rotas do servidor e server components.

Ele tambem trabalha com cookies do Next.js para manter a sessao do usuario.

## 7. Dados globais do app

```text
apps/web/src/components/app-data-provider.tsx
```

Esse e um dos arquivos mais importantes do frontend.

Ele cria um contexto global com:

- usuario logado;
- perfil do usuario;
- categorias;
- estados de carregamento;
- cache simples de dados financeiros;
- funcoes para atualizar dados.

Principais funcoes:

```tsx
refreshUser()
```

Busca o usuario autenticado.

```tsx
refreshProfile()
```

Busca os dados da tabela `profiles`.

```tsx
refreshCategories()
```

Busca categorias do usuario.

```tsx
invalidateFinancialData()
```

Limpa cache financeiro e avisa as telas que os dados precisam ser recarregados.

Tambem existe a funcao:

```tsx
ensureDefaultCategories()
```

Ela chama a rota `/api/categories/ensure` para garantir que o usuario tenha categorias iniciais de receita e despesa.

## 8. Rota para criar categorias padrao

```text
apps/web/src/app/api/categories/ensure/route.ts
```

Essa rota cria categorias padrao para o usuario logado, caso ainda nao existam.

Categorias de receita:

- Salario;
- Freelance;
- Reembolso;
- Investimentos;
- Outras receitas.

Categorias de despesa:

- Alimentacao;
- Mercado;
- Transporte;
- Moradia;
- Contas;
- Saude;
- Educacao;
- Lazer;
- Outras despesas.

Ela primeiro verifica se o usuario esta autenticado:

```tsx
const {
  data: { user },
  error: userError,
} = await supabase.auth.getUser();
```

Se nao houver usuario, retorna erro `401`.

## 9. Modal de novo lancamento

```text
apps/web/src/components/financial-entry-modal.tsx
```

Esse componente centraliza o cadastro rapido de movimentacoes financeiras.

Ele permite criar:

- gasto normal;
- gasto parcelado;
- gasto fixo;
- receita normal;
- receita fixa temporaria.

### Gasto ou receita normal

Salva direto na tabela:

```text
transactions
```

Campos principais:

```tsx
{
  user_id,
  type,
  amount,
  description,
  notes,
  transaction_date,
  competence_month,
  category_id,
  source: "web",
  status: "active",
  origin_type: "manual",
}
```

### Gasto fixo

Salva primeiro na tabela:

```text
fixed_expenses
```

Depois, se a opcao estiver ativa, cria transacoes vencidas ate a data atual.

Importante: o codigo evita criar transacoes futuras automaticamente.

### Gasto parcelado

Salva primeiro na tabela:

```text
installments
```

Depois calcula o valor da parcela e cria apenas as parcelas que ja venceram ate hoje.

### Receita fixa

No momento, a receita fixa ainda nao tem uma tabela de recorrencia propria.

Por isso, a regra temporaria e:

```text
receita fixa = salva como receita normal
```

## 10. Telas financeiras principais

### Dashboard

```text
apps/web/src/app/(app)/dashboard/page.tsx
```

Mostra a visao geral do usuario.

Normalmente agrega dados como:

- saldo do mes;
- receitas;
- despesas;
- ultimos lancamentos;
- graficos;
- resumo de metas;
- gastos fixos;
- parcelamentos.

### Historico

```text
apps/web/src/app/(app)/historico/page.tsx
```

Mostra movimentacoes financeiras.

Permite:

- filtrar;
- buscar;
- editar lancamentos;
- excluir lancamentos.

A exclusao de transacao usa exclusao logica, marcando status como `deleted`, em vez de remover diretamente do banco.

### Lancamentos

```text
apps/web/src/app/(app)/lancamentos/page.tsx
```

Tela para cadastrar lancamentos manuais.

### Planejamento mensal

```text
apps/web/src/app/(app)/planejamento-mensal/page.tsx
```

Gerencia:

- salario;
- renda extra;
- saldo inicial;
- dia de pagamento;
- beneficios;
- observacoes;
- orcamentos por categoria.

Usa principalmente as tabelas:

```text
monthly_controls
budgets
```

### Gastos fixos

```text
apps/web/src/app/(app)/gastos-fixos/page.tsx
```

Gerencia despesas recorrentes.

Usa a tabela:

```text
fixed_expenses
```

### Parcelamentos

```text
apps/web/src/app/(app)/parcelamentos/page.tsx
```

Gerencia compras parceladas.

Usa a tabela:

```text
installments
transactions
```

### Metas

```text
apps/web/src/app/(app)/metas/page.tsx
```

Gerencia metas financeiras.

Usa a tabela:

```text
goals
```

### Perfil

```text
apps/web/src/app/(app)/perfil/page.tsx
```

Permite editar informacoes do usuario.

Usa a tabela:

```text
profiles
```

## 11. Helpers do frontend

```text
apps/web/src/lib/dates.ts
```

Centraliza regras de datas.

Funcoes importantes:

```tsx
todayDateInput()
```

Retorna a data atual no formato `YYYY-MM-DD`, considerando o fuso `America/Sao_Paulo`.

```tsx
toCompetenceMonth(dateString)
```

Transforma uma data em competencia mensal.

Exemplo:

```text
2026-05-21 -> 2026-05-01
```

```tsx
addMonthsClamped(dateString, monthsToAdd)
```

Soma meses sem quebrar datas em meses menores.

Exemplo: se a data for dia 31 e o mes de destino tiver 30 dias, ajusta para o ultimo dia valido.

```text
apps/web/src/lib/formatters.ts
```

Centraliza formatacao de moeda e data.

```tsx
formatCurrency(100)
```

Retorna:

```text
R$ 100,00
```

```text
apps/web/src/lib/categories.ts
```

Ajuda a extrair nome de categoria quando o retorno do Supabase vem como objeto ou array.

## 12. Banco de dados e Supabase

As migrations ficam em:

```text
supabase/migrations
```

Arquivos principais:

```text
001_init.sql
002_app_alignment.sql
003_auth_bootstrap_policies.sql
003_auth_profile_bootstrap.sql
004_user_settings_consent.sql
```

Tabelas principais do projeto:

```text
profiles
categories
transactions
goals
budgets
monthly_controls
fixed_expenses
installments
user_settings
ai_insights
message_logs
```

O banco usa RLS, ou seja, Row Level Security.

Na pratica, isso ajuda a garantir que cada usuario veja e altere apenas seus proprios dados.

## 13. API auxiliar - apps/api

```text
apps/api/src/server.ts
```

E uma API simples em Fastify.

Ela possui:

```text
GET /
GET /health
```

O endpoint `/health` retorna:

```json
{
  "status": "ok",
  "service": "moedin-api"
}
```

Hoje essa API funciona como base para futuras integracoes.

## 14. Servico de IA - apps/ai-service

```text
apps/ai-service/main.py
```

E um servico simples em FastAPI.

Possui:

```text
GET /
GET /health
```

O endpoint principal retorna:

```json
{
  "ok": true,
  "service": "moedin-ai",
  "message": "AI do Moedin funcionando"
}
```

Hoje ele tambem esta como base para futuras funcionalidades de IA.

## 15. n8n e automacoes

```text
n8n/
```

Essa pasta guarda documentacao e workflow de exemplo para automacoes.

Arquivo importante:

```text
n8n/workflow/moedin-tcc-lancamento-financeiro.json
```

A ideia e permitir futuramente fluxos como:

- receber mensagem do WhatsApp;
- interpretar texto com IA;
- transformar em lancamento financeiro;
- salvar no Supabase.

## 16. Docker

```text
docker-compose.yml
```

Sobe os seguintes servicos:

- `web` em `http://localhost:3333`;
- `api` em `http://localhost:3001`;
- `ai` em `http://localhost:8000`;
- `n8n` em `http://localhost:5678`.

Comando para rodar:

```bash
docker compose up --build
```

Comando para parar:

```bash
docker compose down
```

## 17. Fluxo resumido do sistema

```text
Usuario acessa o site
        |
        v
Next.js carrega a pagina
        |
        v
Proxy verifica autenticacao com Supabase
        |
        v
Se estiver logado, entra no painel
        |
        v
AppDataProvider busca usuario, perfil e categorias
        |
        v
Telas consultam e salvam dados no Supabase
        |
        v
Banco protege dados com RLS por usuario
```

## 18. Cuidados importantes ao alterar o projeto

Ao mexer no codigo, tenha cuidado com:

- nao expor `.env`, chaves ou tokens;
- nao usar `SUPABASE_SERVICE_ROLE_KEY` no frontend;
- manter o `user_id` correto em todos os inserts;
- respeitar as policies de RLS;
- nao quebrar o fluxo de autenticacao;
- nao criar transacoes futuras sem regra clara;
- rodar lint/build antes de subir alteracoes;
- aplicar migrations em ordem.

## 19. Como rodar o projeto

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

Acesse:

```text
http://localhost:3000
```

### API auxiliar

```bash
cd apps/api
npm install
npm run dev
```

Acesse:

```text
http://localhost:3001/health
```

### Servico de IA

```bash
cd apps/ai-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Acesse:

```text
http://localhost:8000/health
```

## 20. Como testar depois de alterar codigo

No frontend:

```bash
cd apps/web
npm run lint
npm run build
```

Teste manual recomendado:

1. Abrir a landing page.
2. Fazer login.
3. Entrar no dashboard.
4. Criar um lancamento normal.
5. Conferir se aparece no historico.
6. Criar uma meta.
7. Criar um gasto fixo.
8. Criar um parcelamento.
9. Conferir se os dados ficam vinculados ao usuario logado.
10. Fazer logout e confirmar que rotas internas voltam para `/login`.

## 21. Resumo final

O projeto esta organizado como uma aplicacao financeira moderna:

- Next.js cuida da interface;
- Supabase cuida de login, banco e seguranca dos dados;
- componentes React organizam telas e formularios;
- `AppDataProvider` centraliza dados globais do usuario;
- migrations SQL definem a estrutura do banco;
- API Node e servico Python estao prontos para evolucoes futuras;
- n8n serve como base para automacoes com WhatsApp e IA.

