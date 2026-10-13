# Explicação do código — Moedin-IA

Guia para quem vai ler o repositório pela primeira vez. Diz onde cada coisa mora e por que foi feita assim. A visão geral e os comandos estão no [`README.md`](../README.md); este documento desce um nível.

Atualizado na revisão final de outubro de 2026.

## 1. As três partes

| Parte | Pasta | Onde roda | Papel |
|---|---|---|---|
| Painel e landing | `apps/web` | Vercel | Tela do usuário. Lê e grava no Supabase direto do navegador. |
| Bot do WhatsApp | `n8n/` | Servidor doméstico | Recebe a mensagem, entende e chama funções do banco. |
| Banco | `supabase/migrations` | Supabase | Dados, autenticação, isolamento por usuário e a lógica das ferramentas do bot. |

O painel e o bot **não conversam entre si**. Os dois escrevem no mesmo banco, e o painel percebe as mudanças pelo Realtime do Supabase.

## 2. Painel: como uma página protegida carrega

1. **`src/proxy.ts`** roda antes de qualquer rota do painel. No Next.js 16 o arquivo de *middleware* passou a se chamar *proxy*. Ele chama `src/lib/supabase/middleware.ts`, que confere a sessão e manda para `/login` quem não tem. A lista de rotas protegidas e o `matcher` precisam andar juntos; o teste `src/proxy-routes.test.ts` quebra se divergirem.
2. **`src/app/(app)/layout.tsx`** envolve todas as telas logadas com o `AppDataProvider` e o `AppShell`.
3. **`src/components/app-data-provider.tsx`** é o estado global do painel:
   - guarda usuário, perfil e categorias;
   - mantém um cache curto dos dados financeiros, invalidado por um contador (`financialVersion`);
   - assina o Realtime de sete tabelas (`transactions`, `goals`, `fixed_expenses`, `fixed_incomes`, `installments`, `budgets`, `monthly_controls`): qualquer mudança incrementa o contador e as telas recarregam;
   - uma vez por dia, por usuário, roda a geração de recorrências vencidas.
4. **`src/components/app-shell.tsx`** desenha o menu lateral (recolhido, abre ao passar o mouse) e o cabeçalho do celular.
5. A página em si (`src/app/(app)/<rota>/page.tsx`) é um componente cliente que consulta o Supabase com o cliente de `src/lib/supabase/client.ts`.

Como as consultas saem do navegador com a chave pública, **quem protege os dados é o RLS do banco**, não o código da página.

## 3. Painel: telas

| Arquivo | O que tem de particular |
|---|---|
| `(app)/dashboard/page.tsx` | Carrega uma janela de seis meses de lançamentos, paginada. Calcula totais, gráfico por categoria, comparação com o mês anterior e a previsão de fim de mês (saldo menos fixos e parcelas que ainda vão vencer). |
| `(app)/historico/page.tsx` | Lista paginada com filtros. Só lançamentos manuais podem ser editados; os gerados por fixo ou parcela não, para não desalinhar a recorrência. Excluir é lógico e tem "Desfazer". |
| `(app)/fixos/page.tsx` | Gastos fixos e receitas fixas na mesma tela, com alternador. Ao salvar, chama a geração de recorrências. |
| `(app)/parcelamentos/page.tsx` | Cadastro, barra de progresso e quitação antecipada, que lança de uma vez as parcelas que faltam. |
| `(app)/limite/page.tsx` | Limite geral e por categoria. Grava o mesmo valor para o mês atual e os doze seguintes na tabela `budgets`. |
| `(app)/categorias/page.tsx` | Usa `components/category-manager.tsx`. Categorias padrão podem mudar de cor e ícone, mas não de nome. |
| `(app)/metas/page.tsx` | Metas com valor alvo, prazo e progresso. |
| `(app)/whatsapp/page.tsx`, `(app)/onboarding/page.tsx` | Mostram o código de ativação, o botão que abre a conversa e o QR. O onboarding fica consultando até o vínculo aparecer. |
| `(app)/perfil/page.tsx` | Dados pessoais, exportar dados e excluir conta. |
| `(auth)/*` | Login, cadastro, recuperar e atualizar senha. Validação em `lib/auth-validation.ts`; mensagens de erro traduzidas em `lib/auth-errors.ts`. |
| `app/page.tsx` | Landing. É renderizada no servidor e revalidada a cada hora; o contador de lançamentos vem de `lib/landing-stats.ts`. Animações em `components/landing-motion.tsx` e `components/landing/`. |

`components/financial-entry-modal.tsx` é o "Novo lançamento" usado em várias telas: gasto normal, parcelado, fixo e receita. `components/notification-bell.tsx` monta os avisos (vencimentos e limite a partir de 80%).

## 4. Painel: dinheiro, datas e recorrência

Esta é a parte mais sensível do sistema. Fica toda em `src/lib` e tem testes.

- **`formatters.ts` — `parseMoneyInput`.** Converte o que a pessoa digita. Entende `1.234,56` e também `23.50`.
- **`money.ts` — `splitInstallments`.** Divide em centavos inteiros. R$ 100,00 em 3 vezes vira 33,33 + 33,33 + 33,34: a última parcela fecha o total.
- **`dates.ts`.** Toda data de negócio sai no fuso `America/Sao_Paulo`, porque o servidor roda em UTC e à noite a data UTC já é a do dia seguinte. `addMonthsClamped` soma meses ajustando o dia: 31 de agosto mais um mês é 30 de setembro.
- **`recurrence.ts`.** Funções puras que listam as ocorrências de um fixo ou de um parcelamento até hoje. Nunca geram datas futuras.
- **`recurrence-catchup.ts`.** Compara o que deveria existir com o que existe e insere o que falta. É idempotente por três camadas: consulta o que já existe (inclusive excluídos, para não ressuscitar), insere, e o banco tem índices únicos por origem e competência que recusam duplicata mesmo com duas abas abertas.

A mesma função de recorrência é chamada pelo navegador e pelo cron (`src/app/api/cron/recurrences/route.ts`, todo dia às 06:00 UTC), que cobre quem só usa o WhatsApp e nunca abre o painel.

## 5. Painel: rotas de API

Ficam em `src/app/api`. Todas conferem a sessão com `getUser()`.

- `account/export`: lê todas as tabelas do usuário, paginando, e devolve um JSON. Se alguma tabela falhar, responde 207 em vez de entregar um arquivo incompleto como se estivesse inteiro.
- `account/delete`: apaga primeiro os `message_logs` e depois o usuário. A ordem importa: a chave estrangeira dos logs é `ON DELETE SET NULL`, então apagar o usuário antes deixaria os logs órfãos e impossíveis de achar.
- `categories/ensure`: garante as categorias padrão.
- `whatsapp/qr`: gera o QR no servidor.
- `cron/recurrences`: protegido por segredo, comparado em tempo constante.
- `insight`: repassa para o `apps/ai-service`, se configurado.

`lib/rate-limit.ts` limita as chamadas por usuário usando Upstash Redis. Se o Redis estiver fora, a requisição passa: o limite é rede de segurança, não porta de entrada.

A chave de serviço do Supabase aparece em três lugares, todos no servidor: o cron, a exclusão de conta e o contador da landing.

## 6. Bot: o workflow do agente

Arquivo: `n8n/workflow/moedin-agente-v2.json`. É melhor abrir no n8n, onde os nós estão agrupados em setores com notas. Em texto:

| Setor | O que acontece |
|---|---|
| 1. Recepção | Webhook, conferência do token, normalização do formato da Evolution, descarte de grupos e de mensagens do próprio bot. |
| 2. Identificação | `resolve_user_by_wa` procura o número em `whatsapp_links`. Sem vínculo, o texto é tratado como tentativa de código de ativação. |
| 3. Mídia | Imagem e PDF vão para a OpenAI; áudio é transcrito. O resultado vira texto delimitado por uma marca sorteada a cada execução. |
| 4. Agrupamento | Cada mensagem vira uma chave no Redis com validade curta; depois de uma espera, só a última da sequência segue, levando o texto de todas. |
| 5. Rota e agente | Um nó de código responde sem IA o que é trivial. O resto vai para o *AI Agent*, com memória curta no Redis e 26 ferramentas. |
| 6. Resposta | Guarda de saída (remove links externos e marcas internas) e envio pela Evolution. |
| 7. Erros | Qualquer falha cai num aviso amigável e aciona o workflow de erros. |

**Ferramentas.** Cada uma é um nó HTTP que chama uma função `whatsapp_*` do banco. O modelo preenche só o conteúdo (valor, descrição, categoria, data). O identificador do usuário, o da mensagem e a origem (texto, áudio ou arquivo) são injetados pelo workflow por expressão. Isso garante três coisas: o modelo não escolhe de quem são os dados; a mesma mensagem não gera dois lançamentos; e um pedido que veio de dentro de um PDF ou de um áudio não consegue excluir nada.

**Formatação.** As funções do banco devolvem a mensagem já pronta em português. Formatar no SQL economiza tokens e mantém o texto igual em toda resposta.

**Prompt.** `n8n/SYSTEM-PROMPT-AGENTE-V2.md`. As regras fixas vêm no começo e os dados que mudam (nome, data, hora) no fim, para aproveitar o cache de prefixo da OpenAI.

O histórico de cada versão, com os testes e as decisões, está em [`n8n/AGENTE-V2.md`](../n8n/AGENTE-V2.md).

## 7. Banco

- **Isolamento.** Toda tabela tem RLS com a regra "a linha é do usuário logado". `fx_rates` (cotações) tem RLS sem nenhuma política de propósito: só a chave de serviço lê e escreve.
- **Funções do bot.** São `security definer` com `search_path` fixo, e a permissão de execução foi revogada de `anon` e `authenticated`. Só o n8n, com a chave de serviço, chama.
- **Vínculo do WhatsApp.** A identidade é o registro em `whatsapp_links`, criado quando a pessoa envia ao bot o código de ativação que só ela vê no painel. O telefone do cadastro não serve de identidade, porque não é verificado.
- **Idempotência.** Índices únicos por `(usuário, id da mensagem)`, por ocorrência de fixo e de parcela, e por orçamento de mês e categoria.
- **Retenção.** `purge_old_message_logs(180)` roda todo dia pelo `pg_cron` e apaga conversas com mais de 180 dias.
- **Realtime.** As sete tabelas financeiras estão na publicação `supabase_realtime` com `replica identity full`.

As migrations são aplicadas à mão no SQL Editor. Por isso existe a `034`: ela traz para o repositório ajustes que tinham sido feitos direto no banco.

## 8. Infraestrutura do bot

`infra/bot/` tem o compose do servidor, os scripts de publicar workflow, de empacotar e restaurar, e o backup diário criptografado. O ambiente de teste local (`docker-compose.teste-local.yml` com `evolution-stub.py`) permite rodar o agente inteiro no computador sem enviar nada pelo WhatsApp. Tudo descrito em [`infra/bot/README.md`](../infra/bot/README.md).

## 9. O que não é usado hoje

- `apps/ai-service`: serviço Python da primeira versão do bot. O agente atual faz tudo dentro do n8n. Só a rota `/api/insight` do painel ainda aponta para ele, e sem o serviço no ar o dashboard usa regras locais.
- `apps/web/src/components/hominhos.tsx`, `hominho-tip.tsx` e `src/lib/tips.ts`: os mascotes saíram das telas, mas o código foi mantido de propósito.
- `monthly_controls`: tabela da antiga tela de planejamento mensal. O painel não escreve mais nela.
- `historico/`: versões antigas guardadas para consulta.

## 10. Ao alterar o projeto

1. Rodar `npm run lint`, `npm test` e `npx next build --webpack` em `apps/web`.
2. Mexeu em dinheiro, data ou recorrência: escrever o teste do caso de borda antes.
3. Consulta ao Supabase: sempre conferir `error`. Um `data ?? []` sem isso transforma falha em lista vazia e esconde o problema.
4. Tabela nova que deva atualizar o painel sozinha: incluir na publicação de Realtime e na lista do `app-data-provider.tsx`.
5. Mudança no bot: editar, publicar no n8n e rodar a bateria de `infra/bot/testes-seguranca.py`.
6. Mudança no banco: criar uma migration numerada. Não ajustar direto no painel do Supabase sem trazer para o repositório.
