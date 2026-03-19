## MoedinIA

Este é o repostório oficial do TCC de Sistemas de Informação da FHO | Uniararas, dos alunos:

- Gustavo Henrique Rodrigues
- Márcio Roberto Pereira Soares Junior
- João Lucas Lime
- Gustavo Henrique Timachi
- Alefe Thiago Cirino da Silva


LINK TRELLO: https://trello.com/invite/b/69aa1b2f4631c3a80f48ed0f/ATTI42d4bed0d709943526254bf57711429a93CFB389/tcc

Moedin.IA

Sistema web de controle financeiro pessoal com dashboard, lançamentos, metas e relatórios.

Tecnologias
	•	Frontend: Next.js
	•	Backend: FastAPI
	•	Banco de dados: PostgreSQL
	•	Containers: Docker + Docker Compose

⸻

O que o projeto já tem
	•	Cadastro de usuário
	•	Login com email e senha
	•	Dashboard financeiro
	•	Lançamentos de receitas e despesas
	•	Metas financeiras
	•	Relatórios com gráficos
	•	Ajuda com IA (tela provisória)

⸻

Requisitos para rodar no computador

Antes de começar, a pessoa precisa instalar OBRIGATORIAMENTE:

1. Docker Desktop (OBRIGATÓRIO)

Responsável por rodar todo o sistema (frontend, backend e banco).

Download:
https://www.docker.com/products/docker-desktop/

⚠️ Importante:
	•	Habilitar WSL2 no Windows
	•	Reiniciar o computador após instalar
	•	Deixar o Docker aberto antes de rodar o projeto

⸻

2. Git (OBRIGATÓRIO)

Para baixar o projeto.

Download:
https://git-scm.com/downloads

⸻

3. Node.js (RECOMENDADO)

Mesmo usando Docker, é importante ter Node para desenvolvimento e possíveis ajustes.

Download:
https://nodejs.org/

Versão recomendada:
	•	Node.js 20+

⸻

4. Python (RECOMENDADO)

Usado no backend. Mesmo rodando via Docker, é bom ter instalado para testes locais.

Download:
https://www.python.org/downloads/

Versão recomendada:
	•	Python 3.11

⸻

5. Visual Studio Code (RECOMENDADO)

Para editar o projeto.

Download:
https://code.visualstudio.com/

⸻

Estrutura do projeto

moedin-ia/
├── backend/
├── frontend/
├── docker-compose.yml
└── README.md


⸻

Como baixar o projeto

Opção 1: baixar zip
	•	Baixar o projeto em ZIP
	•	Extrair para uma pasta, por exemplo:

C:\Projetos\moedin-ia

Opção 2: clonar com Git

git clone <URL_DO_REPOSITORIO>
cd moedin-ia


⸻

Como rodar o projeto

1. Abrir terminal na pasta do projeto

Exemplo no Windows PowerShell:

cd C:\Projetos\moedin-ia

2. Subir os containers

docker compose up --build

Esse comando vai:
	•	criar a imagem do backend
	•	criar a imagem do frontend
	•	subir o PostgreSQL
	•	iniciar o sistema completo

⸻

Endereços do sistema

Depois que tudo subir:

Frontend

http://localhost:3000

Backend Swagger

http://localhost:8000/docs

API raiz

http://localhost:8000


⸻

Como parar o projeto

No terminal onde o Docker está rodando:

CTRL + C

Depois:

docker compose down


⸻

Como reiniciar o projeto

docker compose down
docker compose up --build


⸻

Como testar se está tudo certo

Teste 1: frontend

Abrir:

http://localhost:3000

Deve aparecer a tela de login.

Teste 2: backend

Abrir:

http://localhost:8000/docs

Deve aparecer o Swagger da API.

Teste 3: banco

Se backend e frontend subiram sem erro, o banco está funcionando.

⸻

Fluxo básico de uso

1. Criar conta
	•	nome
	•	celular
	•	email
	•	senha

2. Fazer login
	•	email
	•	senha

3. Usar o sistema
	•	cadastrar lançamentos
	•	criar metas
	•	visualizar dashboard
	•	ver relatórios

⸻

Funcionalidades principais

Dashboard

Mostra:
	•	receitas
	•	despesas
	•	saldo
	•	gastos por categoria
	•	metas em destaque
	•	dicas da IA

Lançamentos

Permite:
	•	criar receita
	•	criar despesa
	•	vincular transação a meta
	•	excluir lançamento
	•	filtrar por categoria e tipo

Metas

Permite:
	•	criar meta
	•	editar meta
	•	excluir meta
	•	acompanhar progresso
	•	ver data limite

Relatórios

Mostra:
	•	receitas x despesas
	•	gastos por categoria
	•	resumo financeiro

⸻

O que fazer se der erro

1. Erro no frontend

Tentar:

docker compose down
docker compose up --build

2. Erro no backend

Verificar no terminal se apareceu traceback Python.

3. Porta em uso

Se a porta 3000 ou 8000 já estiver ocupada, fechar o programa que está usando a porta.

4. Docker não inicia

Verificar se o Docker Desktop está aberto e rodando.

5. Alterou arquivos e não refletiu

Rodar novamente:

docker compose up --build


⸻

Banco de dados

O sistema usa PostgreSQL em container.

O banco sobe automaticamente com Docker Compose.

Não precisa instalar PostgreSQL manualmente no computador.

⸻

Usuário de teste

Se quiser, pode cadastrar um usuário novo pela própria tela de registro.

⸻

Comandos úteis

Subir projeto

docker compose up --build

Parar projeto

docker compose down

Ver containers rodando

docker ps

Entrar no banco

docker compose exec db psql -U moedin -d moedin_db


⸻

Melhorias futuras
	•	recuperação de senha real por email
	•	integração real com IA
	•	edição de lançamentos
	•	perfil do usuário
	•	notificações
	•	deploy online

⸻

Observações importantes
	•	O projeto foi preparado para rodar localmente com Docker.
	•	O sistema depende do Docker Desktop estar ativo.
	•	O primeiro build pode demorar alguns minutos.
	•	Depois do primeiro build, os próximos normalmente ficam mais rápidos.

⸻

Resumo rápido para quem vai rodar

Instalar:
	•	Git
	•	Docker Desktop
	•	VS Code
	•	Node.js

Depois:

cd C:\Projetos\moedin-ia
docker compose up --build

Acessar:
	•	Frontend: http://localhost:3000
	•	Backend: http://localhost:8000/docs
