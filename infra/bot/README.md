# Bot do Moedin.IA fora do Mac: home lab

**Estado atual (20/09/2026): o bot roda no servidor de casa, não no Mac.** Este diretório documenta o
que está no ar, como publicar mudanças e como recriar tudo num servidor novo se um dia for preciso.

O painel continua na Vercel e o banco no Supabase. Em casa rodam **quatro containers**: n8n, Evolution API,
Redis e o Postgres da Evolution.

## O servidor

| | |
|---|---|
| Máquina | Notebook Acer, Intel i5-7200U (2 núcleos), 8 GB, Ubuntu Server 26.04 LTS, x86_64 |
| Endereço | `192.168.3.204` na rede de casa; Tailscale para acesso de fora |
| Acesso | `ssh docker@192.168.3.204` (chave em `~/.ssh/moedin-homelab`) |
| Stack | `~/stack/docker-compose.yml` + `.env` (chmod 600). Serviços: `redis`, `postgres`, `n8n`, `evolution-api` |
| Painéis | n8n em `:5678`, manager da Evolution em `:8080/manager` |

Nenhuma senha ou chave fica neste repositório. Os segredos vivem no `.env` do servidor.

O stack do servidor é **compartilhado** (o bot do Jura também vai morar lá), então o bot do Moedin foi
**acrescentado** ao `~/stack` existente em vez de trazer um compose próprio.

## O que foi acrescentado ao stack do servidor

**No `.env`:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_WEBHOOK_TOKEN`, `OPENAI_MODEL`,
`EVOLUTION_INSTANCE`, `N8N_ALERT_WA_ID`, `MOEDIN_APP_URL`.

**No serviço `n8n`:** essas variáveis, mais `EVOLUTION_API_URL=http://evolution-api:8080`, `TZ` e
`GENERIC_TIMEZONE` de São Paulo, `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` (os workflows leem `$env`),
limpeza automática do histórico de execuções (2 semanas) e a **imagem fixada em `2.39.8`**. Fixar evita que o
`docker compose pull` mensal atualize o n8n sozinho e quebre o bot sem aviso.

**No serviço `evolution-api`:** as variáveis de persistência do Mac. As duas que mais importam:

- `DATABASE_SAVE_DATA_NEW_MESSAGE=true`: sem ela **o bot não baixa foto, áudio nem PDF**, porque a mídia é
  buscada no banco da Evolution.
- `DATABASE_CONNECTION_CLIENT_NAME=evolution`: a Evolution só carrega do banco as instâncias do **seu** nome
  de cliente. O servidor usava `evolution_exchange` por padrão e a instância vinda do Mac era `evolution`.

## Publicar uma mudança no bot

No Mac, na raiz do projeto:

```bash
bash infra/bot/publicar-workflow.sh n8n/workflow/moedin-agente-v2.json
bash infra/bot/publicar-workflow.sh n8n/workflow/*.json     # os três, com uma parada só
```

Copia o JSON por SSH, **para o n8n (uns 20 segundos fora do ar)**, importa, publica e liga de novo, e só
termina bem se achar a linha de ativação no log. Não passa por login. Faça fora do horário de uso.

**O repositório é a fonte do que está no ar.** Se alguém editar direto na tela do n8n do servidor, exporte de
volta antes de publicar por aqui, senão a próxima publicação sobrescreve a alteração.

## Como a migração foi feita (e o que custou tempo)

1. Variáveis no `.env`, compose ajustado, n8n reiniciado.
2. Workflows e as credenciais do OpenAI e do Redis foram exportados do n8n do Mac (`export:credentials
   --decrypted`) e importados no servidor, que **recifra com a chave dele**. Os arquivos com segredo foram
   apagados dos dois lados.
3. **A sessão do WhatsApp foi transferida, sem parear de novo**: `pg_dump --data-only` das tabelas
   `Instance`, `Session`, `Webhook` e `Setting` do Postgres da Evolution do Mac, restauradas no do servidor.

Armadilhas:

- **Apagar uma instância da Evolution (`DELETE /instance/delete`) desloga o WhatsApp.** Antes de apagar
  qualquer instância, confira o `connectionState` de novo: um pareamento recém-feito some.
- **O código de pareamento gira** a cada renovação do QR (30 a 40 s), então é inviável passar por chat.
- `fetchInstances` vazio não é erro: pode ser instância no banco que a Evolution não carregou (ver `clientName`).
- **Nunca suba o stack do Mac com o servidor no ar.** As duas Evolutions disputam a mesma sessão e o bot
  responde em dobro. Os containers do Mac ficam parados.

## Rotina

```bash
ssh docker@192.168.3.204
cd ~/stack && docker compose ps                     # semanal: tudo Up?
docker compose logs n8n --tail=50                   # se algo parecer estranho
docker compose pull evolution-api && docker compose up -d evolution-api   # mensal; o n8n está fixado de propósito
```

Depois de uma queda de energia, confira se o notebook religou sozinho. Isso depende da opção "AC Recovery"
da BIOS, que ainda precisa ser ligada.

## Backup (configurado em 20/09/2026)

**Como funciona:** o servidor gera um backup toda madrugada (cron às 03:30) e o **Mac busca uma cópia todo dia às 20h**
(launchd), pedindo antes um backup novo, para a cópia das 20h ser do próprio dia. Cada backup é um arquivo de ~2 MB
com o banco da Evolution (inclui a sessão do WhatsApp), o n8n (workflows, credenciais e o SQLite) e o `.env` com a
`N8N_ENCRYPTION_KEY`. O servidor guarda os últimos 7; o Mac guarda os últimos 14 em `~/Backups/moedin-homelab`.

**Criptografia com chave pública.** O servidor só tem a chave pública, então consegue **criar** backups mas nunca
**abri-los** (conferido: zero chaves secretas lá). Se o servidor for invadido, os backups antigos continuam fechados.
A chave privada `moedin-backup` fica só no Mac.

**Instalar (uma vez, no Mac):** `bash infra/bot/backup/instalar-backup.sh`. É idempotente.

**Testar que o backup serve (o passo que importa):** `bash ~/.moedin-backup/restaurar-teste.sh`. Descriptografa o
mais novo, restaura o banco da Evolution num Postgres descartável, roda o `integrity_check` do SQLite do n8n e confere
workflows, credenciais e os nomes das variáveis do `.env`. Não toca no servidor nem no bot. Rode de vez em quando:
backup que nunca foi restaurado é uma aposta.

**O que precisa de você:**
1. **Guardar uma cópia da chave privada FORA deste Mac** (gerenciador de senhas ou pendrive). Sem ela, se o Mac morrer
   junto com o notebook, os backups não abrem:
   `gpg --export-secret-keys --armor moedin-backup > moedin-backup-CHAVE-PRIVADA.asc`
2. Guardar também uma cópia da `N8N_ENCRYPTION_KEY` do servidor. Ela já vai dentro do backup, mas se o backup não
   abrir, ela é a única coisa que salva as credenciais.

**Limites honestos**
- O job das 20h só roda com o Mac **ligado ou dormindo**. Desligado, ele não roda; é por isso que o servidor também faz
  o seu backup às 03:30 (mas essa cópia só chega ao Mac na próxima vez que ele puxar).
- A chave privada não tem senha, para o restore de teste rodar sozinho. Quem depende de proteção é o disco do Mac
  (FileVault).
- Não é cópia em outro lugar da casa: Mac e notebook do home lab podem ter o mesmo problema (incêndio, roubo). Uma
  terceira cópia (pendrive ou nuvem, já criptografada) cobre isso.
- O n8n é pausado por ~2 s durante o backup para o SQLite ficar consistente. Mensagem que chegar nesse instante só
  demora um pouco mais.
- **Restaurar de verdade** num servidor novo: descriptografe com `gpg -d`, suba o `.env` e o compose de `stack/`, restaure
  o `evolution.sql.gz` no Postgres e o `n8n/database.sqlite` (+ `-wal`/`-shm`/`config`) no volume do n8n com ele parado.

## Testar no Mac sem mexer no que está no ar (22/09/2026)

```bash
docker compose -f docker-compose.yml -f infra/bot/docker-compose.teste-local.yml \
  up -d --no-deps redis evolution-stub n8n
bash infra/bot/testar-local.sh "gastei 30 no mercado"
docker compose -f docker-compose.yml -f infra/bot/docker-compose.teste-local.yml down
```

Sobe **n8n + Redis + uma Evolution falsa** (`infra/bot/evolution-stub.py`): o n8n chama
`http://evolution-stub:8080` e o texto que seria enviado cai em `n8n/files/respostas.log`, que é o que o
`testar-local.sh` mostra. **Nada sai pelo WhatsApp**, então dá para testar com o servidor de casa no ar.

- **O `--no-deps` não é opcional.** Sem ele o compose sobe o serviço `evolution` de verdade, e duas Evolutions
  com a mesma sessão fazem o bot responder em dobro (ou deslogar). Não dá para "desligar" a porta 8080 do
  serviço original pela sobreposição: o compose **soma** as listas de `ports` e de `depends_on` em vez de
  substituir — por isso o stub é um serviço com outro nome, e não uma troca de imagem do `evolution`.
- Antes de testar, importe os workflows **com o n8n parado** (`docker compose run --rm --no-deps -T n8n
  import:workflow --input=/workflows/moedin-agente-v2.json`) e publique com `publish:workflow`. Nunca mexa no
  SQLite pelo host.
- Só o workflow do agente fica ativo aqui (`update:workflow --all --active=false` e depois `--id=MoedinAgenteV2aa
  --active=true`), para os agendamentos de alerta não dispararem do Mac.
- **O banco é o de produção.** Consulta é de graça, mas lançamento de teste entra na conta de verdade: apague
  depois. O n8n local é o 2.36.8; o do servidor é o 2.39.8.

## Plano B: servidor novo do zero

Se o notebook morrer, `docker-compose.yml`, `empacotar.sh` e `restaurar.sh` deste diretório montam um stack
completo e dedicado ao bot: `empacotar.sh` roda no computador que tem o bot (para o n8n, copia o SQLite,
exporta a base da Evolution com `pg_dump` e monta um `.env` só com o necessário) e `restaurar.sh` sobe tudo
no servidor novo. Foram escritos para o caso Oracle e testados só até o empacotamento; ao usar, releia as
armadilhas acima, principalmente o `clientName` e o `DATABASE_SAVE_DATA_NEW_MESSAGE`.

Nenhuma porta precisa ficar aberta para a internet: a Evolution conecta para fora até o WhatsApp e o n8n
conecta para fora até o Supabase e a OpenAI. O acesso ao editor do n8n é pela rede de casa ou pelo Tailscale.
