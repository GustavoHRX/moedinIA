# Moedin.IA — Agente de WhatsApp v2 (n8n)

Workflow: `n8n/workflow/moedin-agente-v2.json` · id no n8n local: `MoedinAgenteV2aa`
(http://localhost:5678/workflow/MoedinAgenteV2aa) · path do webhook: `POST /webhook/moedin-agente`.
System prompt: `n8n/SYSTEM-PROMPT-AGENTE-V2.md` · Migrations: `022` a `029` em `supabase/migrations/`.

**Versão atual: v2.6** (15/09/2026) — 98 nós, 24 ferramentas. O que mudou depois da v2 original
está nas seções 10 a 13, em ordem cronológica; o começo deste documento descreve o desenho que
continua valendo.

Escrito do zero em 08/09/2026, em torno do nó **AI Agent** (a v1, `moedin-whatsapp-ia.json`,
era um `switch` de 4 intenções + serviço externo de IA). Toda a inteligência roda dentro do n8n;
o `ai-service` não é usado.

## 1. Arquitetura (7 setores, com sticky note numerada no canvas)

```
1 RECEPÇÃO        Webhook → Guard token (Code, fail-closed) → Token válido? (401)
                  → Normalizar payload (Code) → Ignorar próprio/grupo/sistema?
2 IDENTIFICAÇÃO   resolve_user_by_wa (RPC) → vinculado?
                  não → link_whatsapp_by_code (texto cru) → ativado / não cadastrado
3 MÍDIA           Switch tipo: texto | imagem | áudio | pdf | outro
                  imagem → Evolution getBase64 → OpenAI Responses (input_image) → texto
                  áudio  → getBase64 → Convert to File → Whisper (/audio/transcriptions) → texto
                  pdf    → getBase64 → OpenAI Responses (input_file) → texto
                  tudo converge no NoOp "Mensagem normalizada"
4 BUFFER          Redis SET moedin:buf:{wa_id}:{msg_id} (TTL 120s) + SET moedin:last:{wa_id} (TTL 120s)
                  → Wait 4s → GET last → sou a última (por msg_id)? → KEYS moedin:buf:{wa_id}:*
                  → Consolidar (ordena por chegada, junta) → DEL cada chave
5 ROTA + AGENTE   Entrada do agente (Set, executeOnce) → Rota rápida? (Code) → Caminho (Switch)
                  saída "texto"  → resposta pronta, sem IA          (setor 6)
                  saída "pdf"    → relatório em PDF, sem IA         (setor 5b)
                  fallback       → AI Agent 3.1
                  + OpenAI Chat Model 1.3 ($env.OPENAI_MODEL, Responses API ON, reasoning low)
                  + Redis Chat Memory 1.6 (moedin:mem:{user_id}, 6 mensagens, TTL 24h)
                  + 24 HTTP Request Tools → RPCs do Supabase (service_role)
                  (log de entrada em message_logs em paralelo)
5b PDF            whatsapp_report_pdf_data (RPC) → Montar PDF (Code, sem biblioteca)
                  → Evolution sendMedia (document) → message_logs (out) → Respond 200
6 RESPOSTA        Resposta final (Set) ← agente E rota "texto" convergem aqui
                  → Evolution sendText (onError: continue) → message_logs (out) → Respond 200
7 ERROS           saídas de erro do agente / mídia / PDF / RPCs de identificação
                  → aviso amigável no WhatsApp → Respond 500
```

**Fronteira de segurança:** o `user_id` sai do nó `Resolver usuário (RPC)` e é injetado por expressão
(`$('Entrada do agente').first().json.user_id`) em todas as tools, na memória e nos logs. O modelo
só fornece valor, categoria, descrição, datas. Nenhum segredo está no JSON: tudo por `$env` e pelas
credenciais do n8n.

## 2. Variáveis de ambiente e credenciais

Lidas por `$env` dentro do container (já mapeadas no `docker-compose.yml`):

| Variável | Uso |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | RPCs e `message_logs` (PostgREST) |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` | download de mídia e `sendText` |
| `WHATSAPP_WEBHOOK_TOKEN` | guard do webhook (`X-Webhook-Token`) — fail-closed |
| `OPENAI_MODEL` | modelo do agente (`gpt-5.4-mini` desde a v2.2) — **nunca** hardcoded no JSON |
| `MOEDIN_APP_URL` | URL do painel, usada nas boas-vindas (v2.5) |
| `N8N_ALERT_WA_ID` | número que recebe o aviso do workflow de erros |

Credenciais do n8n referenciadas pelo id (já existentes no banco local):

| Tipo | id | Usada em |
|---|---|---|
| `openAiApi` | `duLlZ7pNzyaArobE` | Chat Model, visão, PDF, Whisper |
| `redis` | `kMGVNQZslK2ebEgs` | buffer (4 nós) e memória |

`OPENAI_API_KEY` do `.env` **não** é usada pelo agente: o nó usa a credencial. Se a chave mudar,
atualize a credencial "OpenAi account" na UI.

## 3. Como importar / atualizar

O workflow já está importado e **ativo** no n8n local. Para reimportar uma versão nova:

**Recomendado (UI):** abra http://localhost:5678/workflow/MoedinAgenteV2aa → menu `…` → *Import from file*
→ selecione `n8n/workflow/moedin-agente-v2.json` → Save. Como o JSON traz o `id`, a importação pela UI
em cima do workflow aberto substitui os nós no lugar. Se você importar pelo menu "Create" (`new=true`),
cria uma **cópia** com outro id — não a ative, o path `moedin-agente` conflitaria.

**Pelo CLI, só com o n8n parado** (ver incidente na seção 8):

```bash
docker stop moedin_n8n
docker run --rm -v "$PWD/n8n/data:/home/node/.n8n" -v "$PWD/n8n/workflow:/workflows" \
  n8nio/n8n:latest n8n import:workflow --input=/workflows/moedin-agente-v2.json
docker start moedin_n8n
```

O JSON é gerado por um script Python (fora do repo) a partir de `SYSTEM-PROMPT-AGENTE-V2.md`; para
editar o prompt basta editar o `.md` e reimportar — ou editar o campo *System Message* na UI.

**Rascunho × publicado (n8n 2.36):** salvar (ou importar por cima, ou PATCH na API) altera só o
**rascunho**. O webhook continua executando a versão **publicada** até você clicar em **Publish** no
topo da tela. Toda alteração = salvar + Publish; confira em *Executions* que a mudança já aparece.

## 4. RPCs (migration 022, aplicada via MCP em 08/09/2026)

Todas `security definer`, `set search_path = public`, retorno `jsonb {ok, mensagem, ...}` com a
mensagem já formatada em pt-BR; `revoke` de `public/anon/authenticated`, `grant` só para `service_role`.
Idempotente (`create or replace`).

| RPC | Tool no agente |
|---|---|
| `whatsapp_create_transaction(user, type, amount, desc, date, category, external_id, notes)` — upsert por `external_message_id` | `criar_lancamento` |
| `whatsapp_find_transactions(user, termo, limit)` | `buscar_lancamentos` |
| `whatsapp_delete_transaction` (já existia, 008) | `excluir_lancamento` |
| `whatsapp_create_fixed_expense(user, title, amount, due_day, category, create_now)` | `criar_gasto_fixo` |
| `whatsapp_create_fixed_income(user, title, amount, due_day, kind)` — upsert por `(user, kind)` | `criar_receita_fixa` |
| `whatsapp_create_installment(user, title, total, installment_amount, count, start_date, category)` | `criar_parcelamento` |
| `whatsapp_list_recurrences(user, kind)` | `listar_fixos` |
| `whatsapp_delete_recurrence(user, kind, alvo)` — devolve `ambiguo=true` com candidatos | `excluir_fixo` |
| `whatsapp_monthly_report` (já existia, 008) | `relatorio_mensal` |
| `whatsapp_monthly_limit(user, ref)` | `ver_limite_mensal` |
| `whatsapp_set_monthly_limit(user, amount, months=13)` — convenção do site | `definir_limite_mensal` |
| `whatsapp_month_summary(user, ref)` | `resumo_do_mes` |

Helpers: `whatsapp_today()` (data em America/Sao_Paulo), `whatsapp_category_id()` (lista fechada,
nunca null), `whatsapp_due_date()` (dia limitado ao fim do mês).

Duas RPCs além da lista do briefing, com motivo: `whatsapp_create_transaction` (a criação exige
resolver categoria + inserir com `on conflict` — duas etapas que uma HTTP Tool não faz) e
`whatsapp_find_transactions` (necessária para o critério "exclusão ambígua pergunta antes").

**`get_advisors` (security) depois da migration:** nenhuma função nova exposta. Só os dois avisos
pré-existentes: `ensure_activation_code` executável por `authenticated` (intencional — o site chama
logado) e *leaked password protection* desativada (decisão anterior do projeto).

## 5. Critérios de aceite — resultado (08/09/2026)

Testes feitos com payloads reais da Evolution disparados no webhook (com o token), um LID falso
vinculado à conta "Usuario Teste WhatsApp" e mídia real baixada da Evolution. Os dados de teste foram
limpos no fim (soft-delete/inativação; limite restaurado; vínculo falso removido).

| # | Critério | Resultado |
|---|---|---|
| 1 | "oi" → saudação, nada gravado | ✅ |
| 2 | Número novo → não cadastrado; código dentro de frase → ativa | ✅ |
| 3 | "gastei 35,90 no mercado" → 1 tx, Mercado | ✅ |
| 4 | Mesma mensagem, mesmo msgId → não duplica | ✅ ("já tinha sido registrado — não dupliquei") |
| 5 | "gastei 30 no uber e 50 no mercado" → 2 tx | ✅ (`msgId#1`, `msgId#2`) |
| 6 | Áudio → transcreve e grava | ✅ (m4a real via Evolution; ver limitação em §6) |
| 7 | Foto de comprovante → lê e grava | ✅ (R$ 14,50, Padaria, 02/09) |
| 8 | PDF de fatura → lê e grava | ✅ (R$ 1.234,56, venc. 10/09) |
| 9 | "todo mês pago 1200 de aluguel, vence dia 10" → gasto fixo | ✅ |
| 10 | Salário 3000 dia 5; repetir → atualiza | ✅ ("Receita fixa atualizada") |
| 11 | "comprei um fone em 10x de 89" → parcelamento 10x | ✅ (1ª parcela lançada) |
| 12 | "qual meu limite?" → limite, gasto, restante, % | ✅ |
| 13 | "meu limite é 2000" → grava (13 meses) | ✅ |
| 14 | "quanto gastei esse mês" → relatório por categoria | ✅ |
| 15 | "exclui o último" → soft-delete | ✅ |
| 16 | "exclui o mercado" com vários → pergunta; "o de 35,90" → exclui | ✅ |
| 17 | OpenAI fora do ar → aviso amigável, sem stack trace, sem pendurar | ✅ (7 s, `api.openai.com` bloqueado no container) |
| 18 | 3 mensagens em rajada → 1 processamento | ✅ (2× `agrupado`, 1 resposta com os 3 itens) |
| 19 | Grupo e `fromMe` → ignorados | ✅ (<0,1 s) |
| 20 | Sem `X-Webhook-Token` → rejeitada | ✅ (401) |
| 21 | Injeção de prompt → não obedece, não vaza | ✅ |
| — | Resposta chega no WhatsApp real | ✅ ("Oi, João!" no 5519998804130) |

Latência típica: 8–16 s por mensagem (4 s de debounce + modelo com raciocínio + 1–2 tools).

### Como testar cada capacidade

Pelo celular: mande as frases da tabela para `5519997547717`. Pelo terminal (sem celular), simulando
a Evolution:

```bash
set -a; source .env; set +a
curl -s -X POST http://localhost:5678/webhook/moedin-agente \
  -H "X-Webhook-Token: $WHATSAPP_WEBHOOK_TOKEN" -H 'Content-Type: application/json' \
  -d '{"event":"messages.upsert","data":{"key":{"remoteJid":"5519998804130@s.whatsapp.net","fromMe":false,"id":"TESTE0001"},"pushName":"João","messageType":"conversation","message":{"conversation":"gastei 12 no café"}}}'
```

A resposta do webhook traz `{"ok":true,"resposta":"..."}` e a mesma resposta é enviada ao número.
Para mídia, use o `id` de uma mensagem real (`messageType` `imageMessage`/`audioMessage`/`documentMessage`)
— a Evolution baixa o conteúdo pelo id. Acompanhe em *Executions* no n8n.

## 6. O que ficou de fora / limitações (honesto)

- **Validado do celular pelo João (08/09, 21:04–21:11):** texto, áudio real (ogg/opus → "Gastei R$ 20,00
  no mercado"), foto de comprovante (R$ 110,88, data de ontem), receita, limite, resumo e relatório.
  Só o PDF não foi enviado do celular (testado com PDF real via Evolution).
- Atenção: se a resposta automática do WhatsApp Business estiver ligada, cada mensagem do bot pode
  disparar uma auto-resposta que o agente responde (só fora de finanças, sem gravar nada).
- **v2.1 (publicada 09/09 00:20):** ❌ para gasto, ✅ só para receita, linha "🗑️ Errou? Diga *excluir o
  último*…" após registrar; `whatsapp_delete_transaction` redefinida na 022 (🗑️ e o tipo certo).
- **Sem Error Trigger workflow.** O tratamento é por saídas de erro dentro do próprio workflow (agente,
  mídia, RPCs de identificação). Um erro num nó não coberto (ex.: Redis fora) derruba a execução sem
  aviso ao usuário. Criar um workflow com *Error Trigger* e apontá-lo em *Settings → Error workflow* é
  ajuste de UI que não fiz.
- **PDF escaneado**: em vez de extrair texto e rasterizar, o PDF inteiro vai para a Responses API
  (`input_file`), que lê texto e imagens das páginas. Mais simples e cobre os dois casos; limite da
  OpenAI de 100 páginas / 32 MB.
- **Idempotência em rajada**: a chave usada é o `msg_id` da **última** mensagem do grupo; se a Evolution
  reentregar sozinha uma mensagem anterior da rajada, ela pode ser processada de novo.
- **"exclui o último"** usa a RPC existente: apaga o lançamento ativo mais recente, inclusive
  ocorrência de parcela/fixo (o site regenera? não — o catch-up olha qualquer status, então não volta).
- **Relatório × limite**: o relatório vai de 1º até hoje; o limite conta o mês inteiro (lançamentos
  com data futura entram no limite, não no relatório).
- `whisper-1` e o link de onboarding (`https://moedin-ia.vercel.app`) estão literais no JSON.
- **`ai-service` como fallback**: não implementado (o briefing dizia "opcional").
- **A v1 continua ativa** no n8n no path `moedin-whatsapp` (não conflita); desative quando quiser.
- Modelo usa `reasoningEffort: low` para latência; `temperature` não é enviada.

## 7. Segurança (o que está garantido)

Guard fail-closed por header; `fromMe`/`@g.us`/reações ignorados; `user_id` nunca vem do payload nem
do modelo; RPCs só para `service_role`; soft-delete sempre; `message_logs` guarda entrada e saída com
`external_id`; system prompt trata a mensagem como dado (injeção testada); nenhum segredo no JSON, no
prompt, na migration ou neste arquivo.

## 8. Incidente durante a entrega: banco SQLite do n8n corrompido (e recuperado)

Durante os testes o `n8n/data/database.sqlite` corrompeu (`SQLITE_CORRUPT: database disk image is
malformed`) e o n8n entrou em loop de crash. Causa: **acesso concorrente ao arquivo pelo bind mount do
Docker no macOS** — importações pelo CLI (`docker exec … n8n import:workflow`) com o servidor rodando e
leituras com `sqlite3` no host enquanto o n8n gravava (os `SQLITE_IOERR` no log apareceram exatamente
nesses momentos).

Recuperação feita: container parado; backup dos arquivos em
`n8n/data/backup-corrompido-20260908-204613/`; `sqlite3 .recover` para um arquivo novo
(`integrity_check` = ok); tabela `settings` restaurada a partir do backup de 30/08; arquivo trocado;
n8n subiu normal com o dono logado, as 3 credenciais, os 8 workflows e o v2 ativo. **Perdido:** o
histórico antigo de execuções (ficaram 28 de 689) — nada funcional.

**Regra daqui pra frente:** nunca abrir `database.sqlite` com `sqlite3` no host nem rodar `n8n
import/update` pelo CLI com o container de pé. Importe pela UI, ou pare o container antes.

## 9. Testando mídia sem celular (truque usado)

Enviar a mídia **do bot para um número** (`sendMedia`) devolve um `key.id` que a Evolution consegue
baixar depois com `getBase64FromMediaMessage`; esse id serve para simular a chegada no webhook.
Funciona para imagem, documento e áudio como `mediatype: audio` (m4a) — **não** para áudio via
`sendWhatsAppAudio`.

## 10. v2.2 — rodada de aprimoramento (09/09/2026)

**Modelo:** `OPENAI_MODEL=gpt-5.4-mini` no `.env` (era `gpt-5.6-luna`). Testado nos casos difíceis
(dois itens numa frase, exclusão ambígua + escolha, injeção, foto, fixo sem dia → pergunta → salva,
limite): mesma qualidade, custo de modelo "mini". A troca é só o `.env` + `docker compose up -d n8n`.
Visão/PDF/Whisper usam o mesmo `$env.OPENAI_MODEL` (Whisper fixo em `whisper-1`).

**Novidades (migration `023_whatsapp_statement_import_alerts.sql`, aplicada via MCP):**

| Item | Como funciona |
|---|---|
| **Fatura de cartão / extrato em PDF** | `Ler PDF (OpenAI)` usa Responses API com **JSON schema estrito** (`tipo_documento`, `periodo`, `itens[data, descricao, valor, tipo, parcela_atual, parcela_total, categoria, ignorar]`). `Interpretar PDF` (Code) monta o texto para o agente e guarda os itens em `message_logs.parsed_json.itens`. O agente resume, pergunta "tudo / só parcelados / nada"; na confirmação chama `importar_extrato` → RPC `whatsapp_import_statement(user, modo)`, que lê o último PDF não importado (3 h), cria avulsos (idempotentes por `msgId#impN`) e **vincula parcelados a `installments`** (mesmo nome + nº de parcelas reaproveita; senão cria com `start_date = data − (parcela_atual−1) meses` e lança as parcelas 1..atual já vencidas). Pagamentos/transferências vêm com `ignorar=true`. Testado: fatura com 13 linhas → 7 avulsos + 3 parcelamentos (6 parcelas retroativas) + 1 ignorado; reenvio do mesmo PDF não duplica. Extrato bancário usa o mesmo caminho (entradas viram `income`). **Validado com fatura real do Nubank (09/09, 21:58):** 15 linhas → 13 válidas, 6 parcelados, 2 ignoradas. **Regra final (migration 024, decisão do João):** parcelado importado lança **só a parcela desta fatura**; o parcelamento vinculado nasce com as parcelas *restantes* (ex.: 10/12 → 3x a partir da data da fatura) e a origem fica na descrição com o marcador `[fatura:12x]`, que faz a fatura do mês seguinte (11/12) reconhecer o mesmo parcelamento e lançar só a parcela nova. Nada entra nos meses passados; o site mostra 1/3 pagas. A importação real foi convertida para esse modelo. Os 3 maiores valores do resumo são calculados no Code (`Maiores (já em ordem)`), não pelo modelo. |
| **Relatório compacto** | `relatorio_mensal` → `whatsapp_monthly_report_v2`: totais por categoria com %, 3 maiores gastos, total. "detalhar" → `detalhado=true` (formato antigo item por item). |
| **Aviso de categoria** | Quando cai em "Outras despesas/receitas", o agente acrescenta "Coloquei em Outras despesas — se quiser, me diz a categoria certa." |
| **Ícones / desfazer** | ❌ gasto, ✅ receita, 🗑️ exclusão; linha "🗑️ Errou? Diga *excluir o último*…" após registrar. |
| **Debounce** | 3 s (era 4). |
| **Alertas diários** | Workflow `moedin-alertas-diarios.json` (id local `Kb4P8EblM3RYHOdx`, ativo): todo dia 09:00 chama `whatsapp_daily_alerts()` → gasto fixo **vencendo hoje** e limite **≥ 80% / estourado** (1× por mês). Dedupe por `message_logs` (`external_id` = `alert:due:YYYY-MM-DD` / `alert:limit80:YYYY-MM` / `alert:limit100:YYYY-MM`). Respeita `user_settings.whatsapp_notifications`. Testado manualmente (alerta real da "Internet fibra" enviado). |
| **Error Trigger** | Workflow `moedin-erros.json` (id local `VvStsIFCMWpV7YUu`), apontado em *Settings → Error workflow* do agente e dos alertas. Manda ao `$env.N8N_ALERT_WA_ID` (novo no `.env`/compose) o nome do workflow, nó, erro e link. Testado com os dados de exemplo do Error Trigger. |
| **Timeout** | `executionTimeout` 120 s no agente (300 s nos auxiliares). Com o Redis fora, o nó de buffer fica pendurado; antes o webhook esperava 180 s+, agora a execução é cancelada em 120 s (webhook 500). **Limitação:** execução cancelada por timeout **não** dispara o Error workflow — só erro de nó. |
| **v1 desativada** | `moedin-whatsapp` (id `3N16e6VyPeBpQXiK`) ficou inativa. |

**Como atualizar o agente daqui pra frente (sem tocar no SQLite):** com a UI aberta e logada, um
`fetch` na página para `PATCH /rest/workflows/MoedinAgenteV2aa` com `nodes/connections/settings/versionId`
(header `browser-id` = `localStorage['n8n-browserId']`) atualiza o rascunho; depois **Publish** no topo.
Um servidor HTTP local com CORS (`python3 -m http.server` com header `Access-Control-Allow-Origin`) serve
o JSON do repo para a página buscar. Cuidado com `}}` dentro de expressões (o schema JSON precisa de
`} }`): o n8n encerra a expressão no primeiro `}}` e o nó falha com "invalid syntax".

## 11. v2.4 — segurança/anti-spam e novas funções (10/09/2026)

Migration `025_whatsapp_v3_features.sql` (aplicada via MCP): tabela `whatsapp_category_rules` (RLS,
dona = usuário), coluna `user_settings.whatsapp_muted_until`, e as RPCs abaixo. Workflow v2.4
publicado (84 nós, 19 tools); alertas v2 publicado (8 nós). Tudo testado na conta de teste com
payloads reais e limpo no fim.

| Função | Como funciona | Teste |
|---|---|---|
| **Anti-spam (vinculados)** | Depois de identificar o usuário, dois contadores Redis `INCR` com TTL: `moedin:rl:{wa_id}` (20 msgs / 10 min) e `moedin:day:{wa_id}` (150 / dia). Acima disso a mensagem **não chega ao modelo** (custo zero) e o usuário é avisado uma única vez (na 21ª / 151ª). | 22 mensagens em paralelo: 20 aceitas (debounce juntou tudo numa chamada), 2 bloqueadas, 1 aviso ✅ |
| **Anti-abuso (não vinculados)** | `moedin:onb:{wa_id}` limita a **5 tentativas de código por hora**; acima disso o webhook responde `bloqueado` sem enviar nada (nada de mandar mensagem para número aleatório). | 12 tentativas: 5 respondidas, resto bloqueado ✅ |
| **Limites de entrada** | Texto cortado em 2000 caracteres; mídia acima de **15 MB** não é baixada (aviso "arquivo grande"); `wa_id` fora de 8–20 dígitos ou sem `msg_id` é descartado. | documento de 20 MB → aviso em 2 s, sem download ✅ |
| **Fatura por foto/print** | A imagem passa pela mesma extração estruturada (JSON schema) do PDF; comprovante vira 1 lançamento, fatura/extrato vira lista + confirmação + `importar_extrato`. | print de fatura com 8 linhas → 7 itens, 2 parcelados; "tudo" importou ✅ |
| **Categoria por aprendizado** | `corrigir_categoria` (RPC `whatsapp_set_category`): muda a categoria do lançamento e grava regra `descrição → categoria` em `whatsapp_category_rules`; `whatsapp_create_transaction` e a importação aplicam a regra (🧠 na confirmação). | "isso é Lazer" → próxima "shopee" já veio em Lazer 🧠 ✅ |
| **Metas** | `criar_meta`, `guardar_na_meta` (negativo = retirar; conclui com 🎉), `listar_metas`; `resumo_do_mes` mostra até 3 metas. Usa a tabela `goals` do site. | "meta: juntar 3000 pra viagem até dezembro" / "guardei 200 na viagem" ✅ |
| **Desfazer importação** | A importação grava `import_ids` no log; `desfazer_importacao` (RPC `whatsapp_undo_import`) faz soft-delete dos lançamentos, desativa os parcelamentos e libera o PDF para reimportar (renomeia o `external_message_id` para não bater no índice único). | importar → desfazer → reimportar ✅ |
| **Lembrete de fatura** | A extração devolve `vencimento`/`total`; o workflow guarda em `parsed_json`; `whatsapp_daily_alerts` avisa quando faltam 2 dias (ou 1, ou hoje), uma vez por fatura (`alert:fatura:<log>`). | vencimento 15/09 guardado; alerta gerado no teste de RPC ✅ |
| **Resumo semanal** | Trigger extra no workflow de alertas: **domingo 20h** → `whatsapp_weekly_summaries` (top 5 categorias dos últimos 7 dias, total, comparação com a semana anterior; `alert:week:IYYY-IW`). | RPC testada ✅ (primeiro envio real: próximo domingo) |
| **Silenciar / pausar** | `configurar_alertas` → `whatsapp_mute_alerts`: `silenciar N dias` (`whatsapp_muted_until`), `pausar` (`whatsapp_notifications=false`), `reativar`. Alertas e resumo semanal respeitam os dois. | "não me manda alerta hoje" / "volta a mandar alertas" ✅ |

**Limitações honestas:** o rate limit é por número (um atacante com muitos números ainda consegue
gastar — o limite global fica a cargo da OpenAI); a regra aprendida casa por substring da descrição
(regra "shopee" pega "shopee compra" — bom — mas também pegaria "shopeeasy"); o aviso de limite vai
por `sendText`, então se o número for inválido só o webhook sabe; execuções canceladas por timeout
continuam sem acionar o Error workflow.

## 12. Porta de entrada e identidade (10/09/2026)

Revisão do encontro entre o login do site e a primeira mensagem do bot. Os dois
funcionavam, mas não se conversavam: **o site nunca dizia qual era o número do
assistente** (o perfil mandava "abra a conversa" sem número, link ou QR), não
existia tela de conexão, e a identidade do WhatsApp podia vir de um telefone
nunca verificado.

**Migration `026_whatsapp_identity_hardening.sql`:**

| Mudança | Motivo |
|---|---|
| `resolve_user_by_wa` só resolve por `whatsapp_links` | O celular do cadastro é opcional e **nunca verificado**, mas era aceito como identidade. Quem digitasse o número de outra pessoa passava a receber os lançamentos dela, e o relatório dessa pessoa voltava com os dados de quem digitou. Agora a única prova de posse é o código (estar logado no painel **e** ter o aparelho). Testado: número com vínculo resolve; telefone de perfil sem vínculo não resolve mais. |
| `regenerate_activation_code()` | O código nunca expirava e não dava para trocar. Se vazasse num print, era acesso permanente. Sem parâmetro: opera só em `auth.uid()`. |
| `whatsapp_unlink()` | Perdeu o aparelho ou emprestou o celular: corta o acesso pelo painel. Também só em `auth.uid()`. |
| `whatsapp_links.updated_at` | Mostra "vinculado em DD/MM" no perfil, como sinal de segurança. |
| `link_whatsapp_by_code` devolve `trocou_de_conta` | Revincular um número que era de outra conta é legítimo, mas fica visível. |
| `whatsapp_goal_bar` com `set search_path` | Corrige o aviso do advisor que a migration 025 introduziu. |

**Site (`apps/web`):**

- **`/onboarding`** — tela de conexão: botão que abre a conversa com a mensagem
  já escrita, QR para quem está no computador, código copiável, e detecção
  automática da ativação (consulta a cada 3 s, só com a aba visível). Já
  vinculado, a tela mostra o estado e leva ao painel.
- **Card no dashboard** (`whatsapp-connect-card.tsx`) — a descoberta. Some
  sozinho quando existe vínculo; "agora não" adia por uma semana.
- **Perfil** — status com data do vínculo, abrir conversa, **desvincular**, e o
  bloco "Segurança do código" com **gerar novo código**.
- **`/api/whatsapp/qr`** — QR em SVG gerado no servidor (`qrcode`, dependência
  nova). Fica fora do bundle do cliente e o código nunca vai para um serviço de
  terceiro; a CSP do projeto também não permitiria imagem externa. Responde 401
  sem sessão.
- **`lib/whatsapp.ts`** — número, formatação e o link `wa.me` com o texto de
  ativação pronto.

**Bot:** a mensagem de boas-vindas passou a apontar para `/onboarding` e a de
ativação convida a voltar ao painel. A URL saiu do JSON e virou
`$env.MOEDIN_APP_URL` (com fallback). Workflow v2.5 publicado.

**Variáveis novas:** `NEXT_PUBLIC_WHATSAPP_NUMBER` (número do bot, usado pelo
site) e `MOEDIN_APP_URL` (URL do painel, usada pelo n8n). Ambas no `.env`,
`.env.example`, `docker-compose.yml` e em `apps/web/.env.local`.
**Na Vercel é preciso adicionar `NEXT_PUBLIC_WHATSAPP_NUMBER` à mão**, senão o
botão e o QR não aparecem em produção (a tela avisa em vez de quebrar).

**Testado:** `next build` de produção passa com as rotas novas; `/onboarding`
redireciona quem não está logado; o QR responde 401 sem sessão; as duas RPCs
novas mudam o código e removem o vínculo quando chamadas como usuário logado, e
recusam sem sessão; e o ciclo real no WhatsApp do dono (desvincular → "oi" →
mensagem nova com o link → mandar o código → ativado) funcionou ponta a ponta.

**Não verificado visualmente:** as telas logadas (onboarding, card, perfil). Não
tenho sessão no navegador e não manipulo a senha do dono. O dev server do host
fica em `http://localhost:3010` para essa conferência.
**Atenção:** o container `moedin_web` está travado num `npm install` que não
completa (timeout de rede dentro do container), então `localhost:3333` não sobe.

## 13. v2.6 — sete funções novas e economia de token (15/09/2026)

Migration `029_whatsapp_v4_features.sql` (aplicada via MCP). Workflow com **98 nós e 24
ferramentas**, publicado; alertas com 11 nós. Testado ponta a ponta pelo webhook (8 casos) e os
efeitos nos dados reais foram desfeitos depois.

### As funções

| Função | Como funciona | Teste real |
|---|---|---|
| **Comparar meses** | `comparar_meses` → `whatsapp_compare_months`. Gastos, receitas, saldo e as 6 categorias que mais mudaram, com ▲/▼. Quando **um dos meses é o atual**, compara o mesmo recorte nos dois (dia 1 até hoje) e diz isso na resposta — senão o mês corrente sempre pareceria mais barato. | "setembro x agosto" → -2%, com a quebra por categoria ✅ |
| **Consulta livre** | `consultar_gastos` → `whatsapp_query_transactions`. Categoria **e/ou** termo livre, em qualquer período, com total, média, quebra por mês (quando o período cruza meses) e os maiores. | "quanto gastei com transporte esse ano" → R$ 4.113,69 em 45 lançamentos, 9 meses listados ✅ |
| **Editar gasto/receita fixa** | `editar_fixo` → `whatsapp_update_recurrence`. Valor, dia de vencimento, nome e categoria; manda só o que mudou e a resposta lista campo a campo o "de → para". Ambíguo devolve os candidatos. | "muda o valor da internet pra 130" ✅ |
| **Pausar sem excluir** | `pausar_fixo` → `whatsapp_toggle_recurrence`. Ver a seção "Pausar ≠ excluir" abaixo. `listar_fixos` ganhou a linha "⏸️ Pausados: …". | "pausa a netflix" → pausado; a lista mostrou o rodapé ✅ |
| **Limite por categoria** | `definir_limite_mensal` ganhou `p_category` (0 remove); `ver_limite_mensal` mostra o geral **e** cada categoria com ⚠️ acima de 80% e 🚨 estourada. Grava em `budgets.category_id`, a mesma tabela da tela `/limite` do site. `criar_lancamento` avisa **no ato** quando o lançamento cruza 80% ou 100%, e `whatsapp_daily_alerts` cobre categorias (uma vez por mês, chave `alert:cat80/100:<mês>:<categoria>`). | "limite de 300 pro lazer" ✅ |
| **Moeda estrangeira** | Tabela `fx_rates` + `whatsapp_fx_upsert`, alimentada **todo dia às 7h10** pelo workflow de alertas a partir de `https://open.er-api.com/v6/latest/BRL` (pública, gratuita, sem chave — 166 moedas). `criar_lancamento` recebe `p_currency`: o modelo manda o **valor original** e o código ISO, a conversão é no SQL. A descrição guarda o valor original. `cotacao` converte sem registrar. | "gastei 20 dólares no jantar" → ❌ R$ 103,00 (US$ 20,00 × 5,15) ✅ |
| **Gasto e receita na mesma mensagem** | Regra 4 do prompt passou a dizer explicitamente que os itens de uma mesma mensagem podem ter **tipos diferentes**, e que cada um vai com o seu `tipo` e o seu ícone. | ✅ |
| **Relatório em PDF** | Ver "PDF sem biblioteca" abaixo. | "relatório em pdf" → arquivo de 2 páginas entregue no WhatsApp ✅ |

### Pausar ≠ excluir (a decisão que não é óbvia)

O site já tinha o conceito: a tela `/fixos` mostra "Inativo" com um botão **Ativar**, e o motor de
recorrência (`apps/web/src/lib/recurrence-catchup.ts`) só gera ocorrências de registros ativos.
A v2.6 usa esse mesmo estado em vez de inventar outro, e distingue os dois casos assim:

- **Pausado** = `is_active = false` **sem** `end_date`. Ao **reativar**, o `start_date` é movido para
  o mês atual. Sem isso o catch-up do site, que gera de `start_date` até hoje, preencheria
  justamente os meses que a pessoa pediu para pular.
- **Excluído** = apagado de vez quando **não há transação nenhuma** ligada a ele; quando há
  histórico, vira `is_active = false` **com** `end_date = hoje` (o histórico continua explicável).

É a presença do `end_date` que separa "pausado" de "excluído" nas listagens.

### PDF sem biblioteca

O sandbox do Code node do n8n não traz nenhuma biblioteca de PDF e não permite instalar uma. O nó
**Montar PDF** escreve o arquivo byte a byte: PDF 1.4, fontes base-14 (Helvetica e Helvetica-Bold),
tabela `xref` com os deslocamentos calculados sobre o buffer final. Sai com cartões de receita/
despesa/saldo, barra do limite, barras por categoria (com marca do limite quando existe), metas e a
tabela de lançamentos paginada. Vai pelo `sendMedia` da Evolution como `document`, com legenda.

Três detalhes que custaram tempo:

- **Acento funciona, emoji não.** O texto vai em `WinAnsiEncoding`. A Helvetica não tem glifo de
  emoji, então emoji é removido — por isso o PDF não usa nenhum, mesmo a legenda do WhatsApp usando.
- **WinAnsi não é Latin-1.** Travessão, aspas curvas, bullet, reticências e euro ficam nas posições
  `0x80`–`0x9F`, fora do Latin-1. Sem um mapa explícito, um simples `—` (que a RPC usa para
  "sem categoria") vira lixo. O primeiro teste saiu com `?` no lugar dele.
- **O corpo do `sendMedia` na Evolution v2 é achatado**: `number`, `mediatype`, `mimetype`, `media`
  (base64), `fileName`, `caption` — sem o envelope `mediaMessage` da v1.

### Economia de token

Três mudanças, da mais barata para a mais cara de fazer:

1. **Rota rápida (setor 5).** Um nó de código antes do agente responde sozinho saudação, *ajuda*,
   agradecimento e o **pedido de relatório em PDF** — inclusive descobrindo o mês pedido. Essas
   mensagens passaram a custar **zero token**. "ajuda" responde em ~6 s contra 8–16 s pelo agente.
2. **Prompt reordenado.** O cache de prompt da OpenAI é de **prefixo**: só reaproveita o texto
   idêntico desde o primeiro caractere. O nome do usuário e a data estavam no topo, o que garantia
   0% de cache — cada mensagem pagava o preço cheio das regras fixas. Agora as regras vêm primeiro e
   o bloco "Contexto desta conversa" é o último. **Não mova esse bloco para cima.**
3. **Memória de 10 → 6 mensagens.** O histórico é reenviado inteiro a cada chamada. Medição antes da
   rodada: ~4.400 tokens de entrada por chamada ao modelo, e uma mensagem com ferramenta faz duas ou
   mais chamadas.

**O cuidado que a rota rápida exigiu — e que tem teste:** confirmações como *"tudo"*, *"sim"*,
*"ok"*, *"nada"*, *"só os parcelados"*, *"o 2"* **não podem** ser atalhadas. Elas parecem triviais,
mas quase sempre são resposta a uma pergunta que o próprio agente fez (a confirmação de importação
de fatura, por exemplo). Atalhar essas quebraria o fluxo no meio. Outras duas guardas: mensagem que
contém marcador de mídia já interpretada (`[PDF —`, `[Foto —`, `[Áudio`) e texto acima de 120
caracteres vão sempre para o agente. A bateria de 38 casos que cobre isso está em
`testa_rota.js` (fora do repo, no scratchpad da sessão); vale refazê-la se a rota mudar.

### Identidade visual

O emoji do assistente é a **moedinha 🪙**. O porquinho 🐷 saiu de tudo (rota rápida, adesivos do
canvas do v2 e do v1) — a marca é "Moedin", de moeda.

### Conferência de segurança depois da migration

`get_advisors(security)` não apontou nada novo. Os três avisos que aparecem já existiam e são
intencionais (`ensure_activation_code`, `regenerate_activation_code` e `whatsapp_unlink` são
chamáveis por usuário logado de propósito — operam só sobre `auth.uid()`), mais a proteção de senha
vazada, desativada por decisão anterior do projeto.

Aparece também um **INFO novo: "`fx_rates` tem RLS ligado e nenhuma policy"**. Isso é o desenho
pretendido, não um esquecimento: sem policy nenhuma, `anon` e `authenticated` não enxergam a tabela,
e a `service_role` (que ignora RLS) é a única que lê e escreve. Confirmado na prática — a mesma
consulta responde `401 / permission denied for table fx_rates` com a chave pública.

As 16 funções da migration foram conferidas no banco: todas com `search_path = public` fixo e
`EXECUTE` só para `postgres` e `service_role`. As duas que mudaram de assinatura
(`whatsapp_create_transaction` e `whatsapp_set_monthly_limit`) foram dropadas antes de recriadas, e
não ficou nenhuma sobrecarga duplicada — o PostgREST não saberia qual chamar.

### Limitações honestas desta rodada

- A cotação é de fechamento diário, não intradiária, e a API é de terceiro sem SLA. Se ela falhar às
  7h10, o dia inteiro usa a cotação anterior (o nó segue com `onError: continueRegularOutput` e a RPC
  recusa `rates` nulo em vez de gravar lixo). Para um controle financeiro pessoal isso basta.
- O PDF não tem gráfico de pizza nem fonte personalizada: é Helvetica e barras retangulares. Trocar a
  fonte exigiria embutir o arquivo da fonte no PDF.
- As larguras de texto usadas para cortar strings são uma aproximação da métrica da Helvetica, não a
  tabela real. Descrição muito longa pode cortar um ou dois caracteres antes do ideal.
- O mês pedido no PDF é descoberto por regex em português ("agosto", "mês passado"). Escrita muito
  fora do comum cai no mês atual em vez de errar.
- `whatsapp_query_transactions` casa categoria e termo por `like '%…%'`, então "uber" também pegaria
  "uberaba" numa descrição. Mesmo compromisso já aceito nas regras de categoria aprendida.
