# Revisão final do Moedin-IA — Etapa 1 (auditoria)

Data: 12/10/2026 · Branch `versionjuly26` @ `e0b0404` (igual a `origin/FINALVERSION` e `vercel-repo/main`) · Revisor: Claude Fable 5.1 · Nada foi alterado no repositório, no banco (além de criar/apagar as contas de teste) nem no n8n do servidor.

Legenda: **V** = verificado (teste real, consulta ou leitura do caminho inteiro) · **D** = deduzido (plausível, depende de algo não confirmado) · Esforço **P** até 1 h · **M** meia jornada · **G** mais de um dia.

---

## Etapa 2 — o que foi corrigido (13/10/2026)

Estado: **18 commits locais em `versionjuly26` (`e1f9b88..69ac29a`), sem push.** Cada um passou por lint, testes (32/32) e build. A migration 034 está escrita e testada, **ainda não aplicada**.

### Correção deste relatório: o "crítico" C1 era falso

O reset de senha **funciona em produção**. A lista de Redirect URLs já tinha `https://www.moedin-ia.com.br/**`. Errei de duas formas na Etapa 1: o teste real saiu de `localhost:3010`, que não estava na lista, e a sonda pela Admin API mandou `redirect_to` dentro de `options`, onde o Supabase ignora. Refeito em 13/10 com conta descartável pela tela de produção: o e-mail chegou com `redirect_to=…/atualizar-senha` e o link abriu o formulário de nova senha. A linha C1 abaixo fica riscada como registro.

### Painel (feito no Supabase e conferido)

| Item | Feito | Prova |
|---|---|---|
| Redirect URLs | acrescentado `http://localhost:3010/**` (as de produção já existiam) | lista com 10 URLs |
| Templates de e-mail | confirmação e reset com "Moedin-IA"; assuntos "Confirme seu e-mail no Moedin-IA" e "Redefinir sua senha no Moedin-IA" | corpo com o mesmo hash dos arquivos de `docs/email-templates/`; relido após salvar |
| Senha mínima | 6 → 8 | cadastro com 7 caracteres devolve `weak_password` |
| Retenção de logs | `pg_cron` ativado; job `purge-message-logs-daily` às 03:17 | `cron.job` com 1 linha ativa |
| Senha vazada | **não ligado**: a opção só existe no plano Pro | tela do provedor Email |
| Vercel | 9 variáveis presentes; Build Command `next build --webpack`; 0 erros nos logs (o plano guarda 30 min) | painel |

### Código

| Commit | Achado | O que mudou |
|---|---|---|
| `e1f9b88` | A1 | `npm audit fix`: Next 16.4.0, sharp 0.35.5. Sobram só avisos de ferramenta de desenvolvimento (vitest, eslint-config-next). |
| `c66e871` | A2 | Rate limit com prefixo por rota. Conferido: exportação devolveu 200 depois de várias aberturas do painel. |
| `6b97c6d` | A5 | Cabeçalho do celular sem rolagem lateral. Conferido em 375 px: `scrollWidth` 375, botão de sair inteiro. |
| `6fcfbcb` | A6 | Perfil preenche o formulário uma vez por usuário. |
| `7e53618` | M13 | Contraste do "online agora". |
| `8bfbe4b` | M3, M6 | Início de fixo no fuso de Brasília, com teste de regressão; erro de receitas fixas aparece. |
| `e114a06` | M4 | Previsão do mês conta parcelas de qualquer época. |
| `abe9dd0` | M5, B1, B7 | Limite e WhatsApp não engolem erro; meses sem `toISOString`. Conferido: salvar limite grava 13 linhas. |
| `57a5da1` | M7 | Exportação inclui `whatsapp_category_rules`. Conferido no JSON. |
| `31fb52a` | M2 | "Receita fixa" do modal abre a tela Fixos na aba de receitas. Conferido. |
| `1ea3e7b` | **novo** | Formulários de auth com `method="post"`. Achado ao testar: clicar em Entrar antes de o JavaScript carregar fazia envio nativo por GET e a senha ia para a URL. |
| `a11bb19` | M1, M9 | Migration 034. Teste em produção com rollback: "cafe" achava 0 lançamentos, passa a achar 1; editar e excluir sem acento funcionam. |
| `b2cbe82` | limpeza | Sai `apps/api`. |
| `81c7db2` | limpeza, M11 | Versões antigas em `historico/`; sai `backup 1.json` (mesmo id do agente). |
| `fc67e62`, `68ce9c4` | limpeza | Exports, import, classes e aliases CSS sem uso. |
| `7a16c2b` | B12 | `.env.example` enxuto; modelo padrão do agente igual nos dois composes. |
| `69ac29a` | M12 | README, `n8n/README` e `EXPLICACAO_DO_CODIGO` reescritos; ajustes nos demais. |

### Segunda rodada (13/10, depois do primeiro push)

O primeiro push (`a9f2336`) foi publicado e a migration 034 aplicada e conferida. Em seguida, com decisão do João:

| Commit | O que mudou | Prova |
|---|---|---|
| `99c894d` | `apps/ai-service` vai para `historico/`; saem a rota `/api/insight`, o bloco do dashboard que a chamava e o serviço `ai` do compose. | lint, testes e build |
| `49ebb34` | `moedin-ia.vercel.app` redireciona (308) para o domínio oficial, menos `/api` e `/auth`. | build de produção local com o cabeçalho `Host` trocado: `/login` e `/termos?x=1` redirecionam com caminho e querystring; `/api/cron/recurrences` continua 401 |
| `7c21548` | Botão de envio dos formulários de auth só habilita depois que a página carrega. | HTML servido traz `disabled`; no navegador o botão fica ativo após carregar |
| `c389d50` | Migration 035: as 12 categorias sem dono. **Já aplicada.** | ensaio com rollback e conferência depois: 0 globais, 0 lançamentos/limites/fixos apontando para categoria de outro usuário |

Branches apagadas: locais `landing-plano-unico`, `newVersion`, `master`; em `origin`: `newVersion` (`0578d24`), `backupNewVersion` (`ef25ea6`), `feature-dev` (`be7f7df`), `old-template` (`56fcf48`), `versionjune26` (`af8fa3f`). O `.git` local caiu de 22 MB para 10 MB.

### Ficou de fora, de propósito

- **Guarda de saída do bot (M10)**: o furo é dedução, a correção por regex de domínio solto daria falso positivo e exige republicar o bot.
- **Baixos B2, B3, B5, B6, B8–B11**.

### Para fechar

1. `git push origin versionjuly26:FINALVERSION` e `git push vercel-repo versionjuly26:main` (leva a segunda rodada para o ar).
2. Conferir o deploy: `moedin-ia.vercel.app` deve redirecionar e o login deve funcionar.

---

## Resumo em dez linhas

> As dez linhas abaixo são o retrato da Etapa 1 (12/10). A linha 2 estava errada; ver a seção acima.

1. **Ainda não está pronto para fechar.** Há 1 achado crítico e 6 altos; todos pequenos de corrigir (nenhum passa de meia jornada), mas dois deles são em painel (Supabase), não em código.
2. **~~Crítico~~ (falso, corrigido em 13/10):** a redefinição de senha em produção **não funciona**. O link do e-mail cai na landing (`/?code=…`) em vez de `/atualizar-senha`, porque a allowlist de Redirect URLs do Supabase não tem `https://www.moedin-ia.com.br/**`. Testado de ponta a ponta com conta descartável. Correção: 2 minutos no painel do Supabase.
3. **Altos:** Next 16.3.3 com 7 advisories (3 críticos, inclui SSRF na otimização de imagem que o site usa); rate limit com contador **compartilhado** entre insight/export/exclusão de conta (a exportação LGPD deu 429 na primeira chamada; excluir conta pode ficar bloqueado); e-mails do Supabase ainda com "MOEDIN.IA", assunto em inglês e remetente "Supabase Auth"; retenção de 180 dias dos `message_logs` **nunca rodou** (sem `pg_cron`); cabeçalho do painel estoura 14 px no celular (botão "Sair" cortado); formulário do Perfil é sobrescrito a cada renovação de token.
4. **O núcleo financeiro está correto e foi testado de verdade:** parsing (1.234,56), parcelas (33,33/33,33/34 fechando 100,00), clamp de dia 31 (31/08 → 30/09), gasto fixo com catch-up (3 meses), quitação antecipada, edição/exclusão lógica, totais do dashboard batendo com o histórico e com o relatório do bot (R$ 321,64).
5. **Segurança do banco está boa:** RLS nas 15 tabelas, 12 tentativas reais de uma conta ler/alterar/apagar/inserir dados de outra falharam, RPCs do bot negadas para anon/authenticated, `search_path` fixo em todas as SECURITY DEFINER, nenhum segredo real no histórico do git (62 revisões varridas).
6. **Bot (n8n):** 102 nós íntegros, prompt do JSON idêntico ao `.md`, `p_user_id` nunca vem do modelo, 10/12 casos adversariais passaram (os 2 "sem resposta" foram o anti-spam de 20 msg/10 min funcionando). Um bug real: editar/excluir por descrição ignora acento ("muda o cafe" não acha "Café").
7. **Interface:** Lighthouse mobile em produção 91/97/100/100; sem erro de console em nenhuma tela; GSAP limpa `transform/opacity` ao fim; `prefers-reduced-motion` tratado; foco visível. Um contraste 4,09:1 no mockup do hero.
8. **Limpeza:** `apps/api`, `backup 1.json`, `package-lock.json` da raiz, `RELATORIO_FRONTEND_MOEDIN.md`, `PROMPT-FABLE-AGENTE-V2.txt`, 5 classes CSS, 5 keyframes, 8 aliases, 6 exports, 11 env vars mortas; `apps/ai-service` precisa de decisão (apagar junto com `/api/insight` ou publicar). README e `docs/EXPLICACAO_DO_CODIGO.md` descrevem a versão de junho.
9. **Não consegui testar:** logs de runtime da Vercel (MCP 403, CLI não instalada), o que está publicado no servidor de casa, mídia no bot (stub não serve `getBase64`), login com Google, iPhone real.
10. **Ordem sugerida para a Etapa 2:** painel do Supabase (C1 + A3 + senha vazada) → `npm audit fix` (A1) → rate limit (A2) → header mobile (A5) → Perfil (A6) → retenção de logs (A4) → bugs médios → limpeza em commits separados → docs.

---

## Skills e ferramentas que rodaram de fato, por frente

| Frente | Skills carregadas (Skill tool) | Ferramentas |
|---|---|---|
| 1 Build | `engineering:code-review`, `engineering:tech-debt`, `teste-e-qualidade-software` | `npm run lint`, `npm test`, `npx next build --webpack`, `npm audit`, `npm outdated` |
| 2 Código (subagente) | `engineering:code-review`, `security-review` (critérios aplicados sem sub-tarefas), `engineering:tech-debt`, `anthropic-skills:governanca-lgpd-projeto` | leitura de `apps/web/src` + migrations |
| 3 Interface | `design:design-critique`, `design:accessibility-review`, `anthropic-skills:emil-design-eng`, `anthropic-skills:animate`, `anthropic-skills:web-performance-optimization`, `anthropic-skills:seo-audit` (só a parte de robots/sitemap/headers; não rodei o crawler de 500 páginas) | navegador embutido (375/768/desktop, claro/escuro), `npx lighthouse@latest` (13.5.0) contra produção |
| 4 E2E | `teste-e-qualidade-software` | navegador embutido em `localhost:3010` (dev server já rodando), `curl` na Admin API e REST do Supabase, mail.tm (e-mail descartável), `execute_sql` |
| 5 Banco (subagente) | `security-review`, `anthropic-skills:governanca-lgpd-projeto` | `list_tables`, `execute_sql` (só SELECT), `get_advisors`, `query_logs`, `list_extensions`, `list_migrations` |
| 6 Bot | `anthropic-skills:n8n-validation-expert`, `n8n-workflow-patterns`, `n8n-error-handling`, `n8n-expression-syntax`, `security-review` (subagente); teste vivo por mim | Docker (`up -d --no-deps redis evolution-stub n8n`), `import:workflow` com n8n parado, `testar-local.sh`, cópia de `testes-seguranca.py` com número de teste |
| 7 Limpeza (subagente) | `engineering:tech-debt`, `engineering:documentation` | `npx knip@latest` (config no scratchpad), `git grep` em todas as revisões, `git branch -vv` |
| 8 Cofre (subagente) | — | leitura do cofre + código do Titans e do Jura.ai |
| Fechamento | `engineering:deploy-checklist`, `engineering:documentation` | — |

Falhas de ferramenta: Vercel MCP devolveu 403 em `get_runtime_errors`/`get_project` para `prj_lKixvfMhCsAcccJQTvH0n9o8Xqqw` (a conta ligada ao conector não vê o time `joao-jura`); `vercel` CLI não está instalada. Docker Desktop travou uma vez (`docker ps` sem resposta) e foi reiniciado.

---

## Frente 1 — Saúde do build

| Comando | Resultado |
|---|---|
| `npm run lint` (tsc + eslint) | **0 erros, 33 avisos** em 18 arquivos: 25× `react-hooks/set-state-in-effect`, 4× "Cannot access variable before it is declared" (`limite`, `perfil`, `whatsapp`, `notification-bell`), 3× `exhaustive-deps`, 1× `no-unused-vars` (`addMonthsClamped` em `historico/page.tsx:9`), 1× impure function in render (`dashboard/page.tsx:824`) |
| `npm test` (vitest 3.2.7) | **25/25** em 3 arquivos (`money`, `recurrence`, `proxy-routes`) |
| `npx next build --webpack` | **OK**, 32 rotas, Proxy (Middleware) detectado, TypeScript limpo |
| `npm audit` | **12 vulnerabilidades: 3 críticas, 8 altas, 1 moderada**. Produção: `next 16.3.3` (7 advisories: RCE em `next/og`, cache poisoning SSG/ISR, SSRF em Image Optimization, vazamento em metadata image routes…), `sharp <0.35.5`, `source-map-js`, `brace-expansion`. Dev: `vitest`/`tinypool` (RCE via prototype pollution), `braces`. `npm audit fix` resolve next/sharp/source-map-js/brace-expansion sem breaking; vitest 5 e `eslint-config-next` são `--force` |
| `npm outdated` | `next` 16.3.3 → 16.4.0 (wanted), `@supabase/ssr` 0.5.2 → 0.12.7 (major), `@supabase/supabase-js` 2.101 → 2.117, `lucide-react` 1.11 → 1.55, `recharts` 3.8 → 3.10 |

Log completo: scratchpad `frente1-build.log`.

---

## Achados (ordenados por gravidade)

### Crítico

| # | Onde | O que acontece para o usuário | Evidência | Correção | Esf. | V/D |
|---|---|---|---|---|---|---|
| ~~C1~~ **FALSO** (ver "Etapa 2") | Painel do Supabase → Authentication → URL Configuration (Redirect URLs); `app/(auth)/recuperar-senha/page.tsx:33` | **Quem esquece a senha não consegue trocar.** O site pede `redirectTo=${origin}/atualizar-senha`, o Supabase rejeita (não está na allowlist) e reescreve para a Site URL. O link do e-mail leva a `https://www.moedin-ia.com.br/?code=…` (landing). A página inicial não troca o code nem redireciona; `/atualizar-senha` nunca abre. O mesmo vale para o e-mail de confirmação de cadastro (cai na raiz) e para o fluxo local (`localhost` também fora da lista). | `generate_link` com `redirect_to` para `…/atualizar-senha`, `…/auth/callback`, `localhost:3010` e até `moedin-ia.vercel.app` → todos devolvem `redirect_to=https://www.moedin-ia.com.br`. Teste real: pedi reset pela tela, o e-mail chegou (`type=recovery`), abri o link no navegador → `https://www.moedin-ia.com.br/?code=<code>`, título da landing, `document.cookie` sem `sb-*`. | No painel: Redirect URLs = `https://www.moedin-ia.com.br/**`, `https://moedin-ia.vercel.app/**`, `http://localhost:3010/**`, `http://localhost:3000/**`. Opcional em código: `cadastro/page.tsx` passar `emailRedirectTo: ${origin}/auth/callback` e `auth/callback` já trata `?code`. | P (painel) | **V** |

### Alto

| # | Onde | O que acontece | Evidência | Correção | Esf. | V/D |
|---|---|---|---|---|---|---|
| A1 | `apps/web/package.json` → `next ^16.3.3` | Site em produção com Next vulnerável (CVE de SSRF em `/_next/image`, que o site usa em logos; cache poisoning de páginas estáticas; RCE em `next/og` — não usado). | `npm audit`: "next 16.0.0 – 16.3.7 · Severity: critical · 7 advisories". | `npm audit fix` (sobe para 16.4.0, `sharp` 0.35.5, `source-map-js`, `brace-expansion`); rodar lint/test/build; commit só disso. | P | **V** |
| A2 | `src/lib/rate-limit.ts:36-50` | Os limiters `insight` (20/h), `export` (6/h) e `delete` (4/h) usam o **mesmo prefixo e a mesma janela de 1 h**, e o `@upstash/ratelimit` monta a chave como `prefix:identifier:janela` → **compartilham o contador**. Cada abertura do dashboard chama `/api/insight`; depois de 6 chamadas a **exportação LGPD devolve 429** e depois de 4 a **exclusão de conta** também. | Teste real: conta nova, dashboard aberto ~5 vezes, primeira chamada a `/api/account/export` → `429`, `x-ratelimit-limit: 6`, `x-ratelimit-remaining: 0`, `retry-after: 3040`. Código: `node_modules/@upstash/ratelimit/dist/index.js:1285-1286` (`currentKey = [identifier, currentWindow]`). | Prefixo por limiter: `prefix: \`moedin/rl/${name}\`` (ou identifier `${name}:${user.id}`). | P | **V** |
| A3 | Painel do Supabase → Authentication → Email Templates / SMTP | E-mail de confirmação e de reset chegam com **assunto em inglês** ("Confirm Your Signup", "Reset Your Password"), **remetente "Supabase Auth" `noreply@mail.app.supabase.io`** e corpo com **"MOEDIN.IA"** (marca antiga). Os templates novos de `docs/email-templates/` não foram colados. | E-mails reais recebidos no mail.tm (12/10 18:04 e 18:16). | Colar os 2 templates + assuntos em português; configurar SMTP próprio (Resend/Brevo) se quiser remetente do domínio. | P (painel) | **V** |
| A4 | Banco: `message_logs` / migration `016` | A retenção de 180 dias prometida nos Termos **nunca rodou**: `pg_cron` não está instalado, `cron.job` não existe, nenhum workflow chama `purge_old_message_logs`. 623 logs com texto integral das conversas; hoje nenhum passa de 180 d, mas a partir de dez/2026 o site fica em desacordo com a própria política. | `list_extensions`: `pg_cron installed_version = null`; `select * from cron.job` → `42P01`. | Painel → Database → Extensions → `pg_cron`; `select cron.schedule('purge-message-logs-daily','17 3 * * *', $$select public.purge_old_message_logs(180)$$)`. Ou um Schedule no n8n chamando a RPC. | P | **V** |
| A5 | `src/components/app-shell.tsx:165-181` (header `md:hidden`) | No celular (375 px) o painel tem **rolagem horizontal** (`scrollWidth` 389) e o botão **"Sair" fica cortado** ("Sai"). Logo + 4 botões (`h-10` com `px-3` + `gap-2`) não cabem em 375 − 32 px. Acontece em todas as telas logadas. | `document.documentElement.scrollWidth = 389` vs `clientWidth = 375` em `/dashboard` e `/onboarding`; screenshot do cabeçalho com "Sai" cortado; elementos estourando: `DIV.flex items-center gap-2`, `BUTTON.inline-flex h-10 …`. | Tirar o rótulo "Sair" no header mobile (ícone só, `aria-label`) ou esconder o sino/tema no header (já estão no drawer) ; ou `shrink-0`+`min-w-0` no logo. | P | **V** |
| A6 | `src/app/(app)/perfil/page.tsx:53-55` + `src/components/app-data-provider.tsx:290-311` | Qualquer evento de auth (`TOKEN_REFRESHED` ~1×/h, `SIGNED_IN` ao voltar para a aba) recarrega `profile` no provider → o `useEffect` do Perfil depende de `cachedProfile` → `fillForm()` **sobrescreve nome/telefone que estavam sendo digitados** e pisca o skeleton. | `useEffect(() => { loadProfile(); }, [loadingUser, cachedUser, profileLoaded, cachedProfile]);` → `fillForm(cachedProfile)`. Não reproduzi ao vivo (exigiria esperar a renovação do token); caminho lido inteiro. | Preencher uma vez (`useRef` de "já preenchi") ou só quando não há edição em curso; tirar `cachedProfile` das deps. | P | V (código) |

### Médio

| # | Onde | O que acontece | Evidência | Correção | Esf. | V/D |
|---|---|---|---|---|---|---|
| M1 | RPCs `whatsapp_update_transaction`, `whatsapp_find_transactions`, `whatsapp_delete_transaction`, `whatsapp_set_category` (migrations 022/030/031) | Bot grava "Café" e depois **não acha** "muda o cafe pra 15" ("Não encontrei um lançamento com 'cafe'"). A busca é `lower(description) like '%termo%'` sem tirar acento; o modelo normaliza a descrição com acento. Afeta editar, excluir e "isso é X" por nome. | Teste vivo no bot local (18:22:32). `pg_proc.prosrc`: `lower(coalesce(description,'')) like '%' \|\| v_alvo \|\| '%'`. `whatsapp_norm` (031) já existe e não é usada aqui. | Nas 4 RPCs comparar `whatsapp_norm(description) like '%' \|\| whatsapp_norm(p_alvo) \|\| '%'` (ou `unaccent`). Migration 034. | P/M | **V** |
| M2 | `src/components/financial-entry-modal.tsx:463-471` | A opção **"Receita fixa"** do modal grava **receita avulsa** (`origin manual`, sem `fixed_incomes`); o formulário nem tem dia/duração. No mês seguinte o salário não entra. A tela Fixos faz certo. | Teste vivo: salvei "Receita fixa 2.500" → `fixed_incomes` = 0, transação `manual`. | Reusar o fluxo de Fixos (`kind: "custom"`, `due_day`, `start_date` + `catchUpRecurrences`) ou tirar a opção e mandar para `/fixos`. | M | **V** |
| M3 | `src/app/(app)/fixos/page.tsx:161` → `src/lib/recurrence-catchup.ts:165,235` | "A partir de" vazio grava `start_date null`; o catch-up usa `created_at.slice(0,10)` que é **UTC**. Entre 21h e 24h (Brasília) a data vira o dia seguinte → fixo "vence dia 30" cadastrado dia 30 à noite **pula o mês atual**. | Código lido; `created_at` é `timestamptz`. | Fixos: `start_date: startDate \|\| todayDateInput()`; catch-up: converter `created_at` para `America/Sao_Paulo` antes do `slice`. | P | V (código) |
| M4 | `src/app/(app)/dashboard/page.tsx:173, 276-291` | "Previsão fim do mês" conta parcelas pagas só na janela de 6 meses carregada → parcelamento com mais de 6 parcelas antigas tem a parcela deste mês ignorada (previsão otimista). O sino usa `fetchAllRows` e acerta. | Código lido. | Contar por `installment_id` em consulta própria (como `notification-bell.tsx:133-145`) ou usar o maior `installment_number`. | P | V (código) |
| M5 | `src/app/(app)/limite/page.tsx:134-160, 177-208` | (a) erros das 2 consultas em `budgets` são ignorados → qualquer 400 vira "Sem limite definido" (o padrão que escondeu o `alert_percent`); (b) salvar = `delete` sem checar erro + `insert` de 13 linhas, não atômico. | Código lido; `{ data: budgetRow }` sem `error`; `categoryRows ?? []`. | Checar `error`, mostrar `Alert`; trocar por `upsert(..., { onConflict })` apoiado nos índices da 021. | P | V (código) |
| M6 | `src/app/(app)/fixos/page.tsx:121` | `setIncomes(incRes.error ? [] : …)` → erro na consulta de receitas fixas vira aba vazia sem aviso. | Código lido (linha confirmada). | Tratar como `expRes.error` (mensagem, não zerar). | P | **V** |
| M7 | `src/app/api/account/export/route.ts:14-28` | Exportação LGPD **omite `whatsapp_category_rules`** (padrões que o usuário ensinou ao bot) e diz "Exportação completa". | Lista `TABLES` lida (13 tabelas). | Acrescentar a tabela. | P | **V** |
| M8 | Auth: `src/lib/auth-validation.ts:32-37` + painel | Senha **"12345678" é aceita** (só comprimento); "Leaked Password Protection" desligada (advisor); **12 tentativas seguidas de senha errada não geram 429** (o Supabase não bloqueia por conta; captcha foi descartado). | Cadastro real com "12345678" criou a conta; 12× `POST /auth/v1/token` → `400 400 … 400`; advisor `auth_leaked_password_protection` WARN. | Ligar Leaked Password Protection e "senha mínima 8" no painel; opcional: exigir letra+número no `validatePassword`. Rate limit de login só com captcha ou proxy. | P | **V** |
| M9 | Banco × migrations (ver `relatorio-banco.md`) | (a) `budgets.category_id` é `ON DELETE CASCADE` em prod e `SET NULL` na 001 (prod está certo); (b) **12 categorias com `user_id null`** (03/04/2026) invisíveis pela RLS ainda referenciadas por 17 transações (2 usuários), 2 budgets, 1 fixo → aparecem "sem categoria"; (c) `009` no repo ainda tem `ensure_activation_code` frouxo, endurecido à mão em 19/08 (sem arquivo); (d) `APLICAR_MIGRATIONS.sql` só cobre 012b–021; (e) policy `Users can update own categories` sem `(select auth.uid())`; (f) 2 índices da 002 nunca criados, 11 índices + `budgets.updated_at` só em prod. | Consultas em `pg_constraint`, `pg_policies`, `pg_indexes`, `information_schema`; advisors. | Migration `034_reconcile_prod.sql` com tudo isso (no-op em prod, corrige banco novo) + remapear/apagar as categorias globais + renomear/regenerar `APLICAR_MIGRATIONS.sql`. | M | **V** |
| M10 | n8n: nó `Guarda de saída` (regex de link) | `wa.me` está na allowlist (link para número de terceiro passa) e a regex só pega `http(s)://`/`www.` — **domínio nu** (`banco-falso.com/pagar`) passa. O caso 9 da bateria passa porque o modelo recusa, não a guarda. | Leitura do Code node pelo subagente; não testei os 2 casos extras. | Tirar `wa.me` da allowlist (ou só o número do bot) e cobrir `\b[a-z0-9-]+\.(com|com\.br|net|org|io|app)\b`. | P | D |
| M11 | `infra/bot/publicar-workflow.sh` + `n8n/workflow/backup 1.json` | `publicar-workflow.sh n8n/workflow/*.json` ("os três", como o README manda) **aborta**: `whatsapp-ia`/`lite` não têm `id`; e `backup 1.json` (v2.4, 🐷, "Moedin.IA", `configurar_alertas`) tem **o mesmo id `MoedinAgenteV2aa`** — se for publicado por engano sobrescreve o agente; o espaço no nome quebra o `for f in $(ls)` remoto com `\|\| true`. | Leitura dos scripts e dos JSONs. | Apagar `backup 1.json`; mover os antigos para `historico/`; `set -euo pipefail` e `find -print0` no script. | P | V (estático) |
| M12 | Docs: `README.md`, `docs/EXPLICACAO_DO_CODIGO.md`, `n8n/README.md`, `n8n/TESTE-WHATSAPP-IA.md`, `apps/web/README.md`, `docs/privacy-lgpd-audit.md` | A banca vai ler a versão de **junho**: `git checkout versionjune26` (README:8/283/810), migrations até 010 (364-378), "Planejamento mensal" e "Planos" vivos (3/99-111/149), receita fixa "salva como normal" (85/614), árvore sem `limite/whatsapp/onboarding/fixos/categorias` (187-214), Groq (257), Build Command `npm run build` (865), rota `/lancamentos` (510), webhook "sem auth" (775); `n8n/README.md` v2.6/98 nós/24 tools e alertas 9h/domingo "ativos"; `privacy-lgpd-audit.md` diz que exportar/excluir conta "não existem"; `AGENTE-V2.md` L28 "Wait 4s", L36 "25 tools", L115, L189, L204, L761×L806. | Leitura linha a linha (tabela completa em `relatorio-limpeza.md` §2 e `relatorio-bot.md` §3). | Reescrever README/n8n README/EXPLICACAO; apagar TESTE-WHATSAPP-IA; atualizar trechos dos demais. | M | **V** |
| M13 | `src/components/landing/hero-demo.tsx:299` | Lighthouse acessibilidade 97: "online agora"/"digitando…" (`text-xs font-bold text-white/70` sobre `#0d6b45`) tem **4,09:1** (mínimo 4,5:1). Também é `font-bold` (DESIGN.md proíbe acima de 700 — está no limite, ok). | Lighthouse 13.5.0, auditoria `color-contrast`. | `text-white/85` ou `text-sm`. | P | **V** |
| M14 | Vercel / `next.config.ts` | `moedin-ia.vercel.app` responde 200 sem redirecionar para o domínio (SEO dividido); CSP com `'unsafe-inline' 'unsafe-eval'` em `script-src` (dívida já registrada). | `curl -I`. | Redirect 308 na Vercel (Domains) ou `redirects()`; nonce de CSP fica para depois. | P | **V** |

### Baixo

| # | Onde | O que acontece | Correção | V/D |
|---|---|---|---|---|
| B1 | `src/app/(app)/limite/page.tsx:21-26` | `new Date(local).toISOString().slice(0,7)` — certo no Brasil, erra um mês em fuso UTC+. | `addMonthsClamped()` de `lib/dates.ts`. | V |
| B2 | `src/proxy-routes.test.ts` | Compara `matcher` com `PROTECTED_ROUTES` entre si, não com as pastas de `(app)/`; `/planos` está fora das duas (impacto zero: redirect servidor). | Ler `readdirSync("src/app/(app)")` no teste. | V |
| B3 | `src/app/api/cron/recurrences/route.ts:59-76` | Ordem fixa + teto de 50 s: os mesmos usuários do fim podem ficar sem catch-up todo dia, sem log. | Embaralhar/cursor + `console.error` em `stopped_early`. | D |
| B4 | `src/components/app-data-provider.tsx:373-384` | Catch-up do cliente falha em silêncio; se `CRON_SECRET` faltar na Vercel o cron dá 401 em silêncio. | `console.error`; conferir env na Vercel. | V/D |
| B5 | `src/app/(app)/dashboard/page.tsx` | Mesmas 5 consultas disparadas 2–3 vezes a cada abertura (provider + página + sino); `ai_insights` apagado/regravado a cada troca de mês sem checar erro; somas em float para comparar com orçamento. | Deduplicar fetch; só persistir mês atual; comparar em centavos. | V |
| B6 | `src/app/(app)/historico/page.tsx:398-419` | CSV sem proteção contra fórmula (`=`, `+`, `-`, `@`). | Prefixar `'`. | V |
| B7 | `src/app/(app)/whatsapp/page.tsx:43-52` | Erro nas consultas vira "Ainda não conectado" + código "••••••••" sem aviso. | Checar `error`. | V |
| B8 | Banco | 1 `auth.users` (03/04/2026) sem `profiles`; 4 perfis sem `user_settings`; 1 transação `deleted` sem `deleted_at`; `whatsapp_mute_alerts` sem chamador; FK `whatsapp_category_rules.category_id` sem índice; 3 índices redundantes; `fx_rates` sem atualização desde 01/10 (job de câmbio parou?). | SQL no `relatorio-banco.md`. | V |
| B9 | n8n | Log "out" grava texto pré-Guarda; 3 defaults diferentes de `OPENAI_MODEL`; `moedin-erros` com `N8N_ALERT_WA_ID` vazio = erro sem rastro; corrida no fallback de `Consolidar mensagens` pode responder 2×. | Ver `relatorio-bot.md`. | D |
| B10 | `src/app/(app)/categorias` (modal) | Ícones com nome acessível em inglês ("ShoppingCart", "PawPrint"); "1 parcelamentos ativos" (plural). | `aria-label` em português; pluralização. | V |
| B11 | `infra/bot/testar-local.sh:11`, `testes-seguranca.py:16` | Número pessoal do João fixo como padrão de teste; IPs de casa nos scripts/README. | Placeholder ou env. | V |
| B12 | `.env.example` | Lidas e ausentes: `SUPABASE_URL`, `EVOLUTION_INSTANCE_TOKEN`, `NEXT_PUBLIC_AI_URL`; presentes e mortas: `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_N8N_URL`, `EMAIL_VALIDATION_*`, `JWT_SECRET`, `WHATSAPP_PROVIDER`, `DEFAULT_CURRENCY` (+ as de `apps/api`/ai-service). Fallback `contato@moedin.ia` (domínio inexistente) em 3 páginas. | Ajustar o example; definir `NEXT_PUBLIC_CONTACT_EMAIL`. | V |

---

## Frente 3 — Interface e animações (detalhe)

**Lighthouse mobile, produção (`https://www.moedin-ia.com.br/`, LH 13.5.0, simulado):**

| Performance | Acessibilidade | Boas práticas | SEO |
|---|---|---|---|
| **91** | **97** | **100** | **100** |

FCP 1,1 s · LCP 3,3 s (único ponto a perder) · TBT 50 ms · CLS 0 · Speed Index 3,5 s · TTFB 20 ms · JS não usado ~87 KiB. Relatório HTML em `scratchpad/lighthouse-landing-mobile.report.html`.

Verificado no navegador (recarregar → esperar → rolar para forçar repaint → screenshot, aba visível):
- Landing 375 px escuro, 768 px claro, desktop escuro: hero completo, `opacity: 1` e `transform: none` após a animação (`clearProps` funciona), sem overflow horizontal (`scrollWidth == clientWidth`), sem erro de console. Os elementos `opacity:0` restantes estão abaixo da dobra (ScrollTrigger).
- Painel desktop claro/escuro: ok. Painel 375 px: **overflow de 14 px** (A5).
- `prefers-reduced-motion`: tratado em `globals.css:853`, `landing-motion.tsx:27` (`matchMedia` no-preference), `hero-demo.tsx:151`, `animated-money.tsx:28`, `celebrate.tsx:15`.
- Foco de teclado: `Tab` no painel → `outline: auto 1px` visível no link ativo.
- Modal de lançamento: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, botão "Fechar" com nome.
- Banner de consentimento ocupa ~35% da tela no celular na landing (não bloqueia; decisão).
- Sem menu hambúrguer na landing (decisão pendente já registrada).

---

## Frente 4 — Teste funcional (o que foi feito)

Contas criadas: **A** e **B** (Admin API, confirmadas) e **C** (cadastro pelo site com e-mail descartável do mail.tm). Todas apagadas no fim (prova abaixo).

Passou (**V**):
- Cadastro: senha "1234567" barrada no cliente; conta criada; mensagem "Confirme seu e-mail"; e-mail chegou em 10 s; link de confirmação funciona 1× (303 → `/?code=`) e na 2ª vez devolve `otp_expired` (correto).
- Login sem confirmar: "Seu e-mail ainda não foi confirmado" (correto). Cadastro com e-mail já existente: Supabase devolve usuário falso com `identities: []` e o site mostra a mesma mensagem — **não revela** que a conta existe. Login/senha corretos → `/dashboard`. Sair → `/login`; `/dashboard` sem sessão → 307 `/login` (local e produção).
- Consentimento: "Entendi" gravou `terms_version/privacy_version 1.0` + timestamps em `user_settings`.
- Novo lançamento: gasto normal 1.234,56 (gravado `1234.56`, competência `2026-10-01`); parcelado 100 em 3× começando 31/08 → parcelas 31/08, 30/09 (clamp), 3ª gerada na quitação em 12/10 com **33,34**; gasto fixo 99,90 dia 10 desde 10/08 → 3 ocorrências (08, 09, 10); receita 2.500 (ver M2). Realtime atualizou o dashboard sem recarregar.
- Dashboard × Histórico: saídas out/2026 1.334,46 = 1.234,56 + 99,90; histórico (tudo) 1.600,92 = 1.234,56 + 66,66 + 299,70; previsão fim do mês somou a parcela de 31/10. Relatório do bot bateu com o painel (R$ 321,64 depois das mudanças).
- Histórico: filtros (tipo, busca), editar (valor 1.000,01 + descrição), excluir com "Desfazer" → `status='deleted'` + `deleted_at` no banco.
- Fixos, Parcelamentos (quitar antecipado 3/3, 100%), Metas (criar, "Faltam 139 dias"), Categorias (criar com cor e ícone), Limite (1.000 → 13 linhas `budgets` out/26–out/27; sino "Nada pendente" correto porque o gasto do mês ficou abaixo), WhatsApp (código de ativação, copiar, gerar novo), Onboarding (QR + `wa.me/5519997547717?text=…`), Perfil. **Nenhum 4xx/5xx** nas chamadas ao Supabase em nenhuma tela (checado via `performance` entries), exceto o 400 esperado do login não confirmado.
- Exportar dados: rota responde JSON autenticada — mas deu **429** (A2).
- RLS (token da conta B contra dados da A): ler por id → `[]`; listar tudo → `[]`; PATCH → `[]`; DELETE → `[]`; INSERT com `user_id` de A → `42501` 403; ler `profiles` de A → `[]`; `message_logs` → `[]`; `fx_rates` → 403; RPC `whatsapp_monthly_report_v2` como anon → 401; `resolve_user_by_wa` como authenticated → 403; `whatsapp_create_transaction` → assinatura não exposta (PGRST202). Controle: A lê a própria transação → 1 linha.
- Produção (smoke): `/` 200 em 0,13 s; `moedin-ia.com.br` e `http://` → 308 `https://www.`; `/dashboard` → 307 `/login`; `/robots.txt` e `/sitemap.xml` corretos com o domínio novo; 404 em rota inexistente e em `/design-preview`; `/api/cron/recurrences`, `/api/account/export`, `/api/whatsapp/qr` → 401 sem credencial. Cabeçalhos: HSTS preload, CSP enforcing, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.

Prova da limpeza (consulta final, todas as 15 contagens = 0):

```sql
-- ids das 3 contas de teste + prefixo [TESTE-REVISAO] + wa_id 5519900000001
auth.users 0 · profiles 0 · transactions 0 · categories 0 · budgets 0 · goals 0 · fixed_expenses 0 ·
installments 0 · fixed_incomes 0 · ai_insights 0 · user_settings 0 · whatsapp_links 0 ·
whatsapp_category_rules 0 · message_logs (ids) 0 · message_logs (user_id null criados hoje) 0
```

Ordem usada: `delete message_logs` (FK `SET NULL`) → `DELETE /auth/v1/admin/users/{id}` (cascade em `profiles` e dependentes). Redis local do bot parado (chaves com TTL). Observação para o time do banco: os 2× 400 em `POST /auth/v1/admin/users` e os `generate_link` via `curl` de 12/10 que aparecem nos logs **foram desta revisão** (não é ataque).

---

## Frente 6 — Bot (teste vivo)

Ambiente: `docker compose -f docker-compose.yml -f infra/bot/docker-compose.teste-local.yml up -d --no-deps redis evolution-stub n8n`; agente importado com o n8n parado, só ele ativo, publicado; log em `n8n/files/respostas.log`. Número de teste `5519900000001` vinculado à conta A pelo código de ativação (fluxo real de `link_whatsapp_by_code`).

| Caso | Resultado |
|---|---|
| Vínculo pelo código | ✔ boas-vindas + link do painel |
| "ajuda" (rota rápida, sem IA) | ✔ |
| "gastei 12,50 no cafe" | ✔ Alimentação |
| "paguei 30 de uber e 45,90 no mercado" (2 itens) | ✔ Transporte + Mercado |
| "comprei um fone de 300 em 3x" | ✔ parcelamento 3×100, 1ª parcela lançada |
| "quanto gastei esse mês?" | ✔ relatório por categoria, total R$ 321,64 (= painel) |
| "muda o cafe pra 15" | ✘ **"Não encontrei"** (M1) |
| "excluir o mercado" com 2 candidatos | ✔ perguntou "Qual deles?"; "o de 20" → excluiu o certo |
| "isso é Academia" (categoria nova) | ✔ criou, reclassificou, aprendeu a regra |
| "me conta uma piada" | ✔ recusa de uma linha, escopo finanças |
| Bateria adversarial (12 casos, cópia do script com o número de teste) | **10/12 ✔**; casos 11-12 "sem resposta" = anti-spam disparou na 21ª mensagem em 10 min (`moedin:rl:…` = 23; resposta "⏸️ Muitas mensagens…" enviada 1×) — comportamento esperado |

Estático (subagente): 102 nós, 0 órfãos, 10 saídas de erro ligadas ao setor 7, `p_user_id` por expressão nas 25 tools, `p_origem` nas 3 destrutivas, 0 segredos literais nos 7 JSONs, `linkPreview:false` em 8/8 `sendText`, system message **idêntico** ao `SYSTEM-PROMPT-AGENTE-V2.md`, 26 tools citadas no prompt, 29 RPCs batendo com as migrations, `pdf-relatorio.js` igual ao Code node. Alertas: 9h e domingo `disabled:true`; o nó de câmbio 7h10 não envia nada — **apagar esse workflow mata o `fx_rates`**.

---

## Frente 8 — Titans e Jura.ai × Moedin-IA

Dos ~45 aprendizados do cofre, o Moedin já resolve igual ou melhor em 30, não se aplica em 10 (sem server actions, `revalidatePath`, subdomínios, push, fluxo de aprovação). Só estes valem atenção:

| Aprendizado | De | Situação no Moedin-IA | Evidência | Vale portar? |
|---|---|---|---|---|
| Vercel em UTC × Brasília em `new Date()` | Jura.ai / Titans | igual, com fresta em `limite/page.tsx:22-26` (`toISOString`) | B1 | sim, pequeno |
| Funções SECURITY DEFINER abertas para anon | Jura.ai (11/10) | igual — revogadas; as 014/017 **já rodaram** (memória estava vencida) | `has_function_privilege` | não |
| E-mails do Auth: templates, Site URL, Redirect URLs | memória `deploy-vercel` | **tem o problema** (C1 + A3) | teste real | **sim (painel)** |
| Filho de grid estoura modal (`*:min-w-0`) | Titans | outro jeito: grades viram 1 coluna no celular; sem estouro observado em 375 px | `financial-entry-modal.tsx:565…` | não (só se o iPhone mostrar) |
| `loading.tsx` com cópia oculta | Titans | igual, skeleton puro com `aria-hidden` | `(app)/loading.tsx:10` | não |
| N+1 em lista | Titans | igual — `Promise.all` + agregação em memória | `dashboard/page.tsx:166-192` | não |
| Realtime com RLS | Titans | `postgres_changes` filtrado por `user_id` + `replica identity full` + policy de SELECT nas 7 tabelas (adequado a app com login por usuário) | migrations 010/027/028 | não |
| Teste de escrita em produção sem limpeza | Titans | igual — banco único; esta revisão limpou (prova acima) | — | não (banco de teste separado seria melhor, não é bug) |
| Dado pessoal sem finalidade / trilha de auditoria | GSATI / Titans | finalidade documentada em `privacy-lgpd-audit.md`; sem `audit_log` (dono único por conta) | — | não agora (dívida para versão comercial) |
| BOM no `.env` | Jura Painel | `getSupabaseKey()` sem `trim()`; env vem do painel da Vercel | `lib/supabase/env.ts:12-17` | não |
| `getUser()` vs `getSession()`, `.maybeSingle()`, paginação >1000, soft delete, índices, `on conflict`, honeypot+rate limit, consentimento por versão, export/exclusão de conta, proxy + revalidação por rota, `<input type="date">` no iPhone | vários | igual ou melhor | ver `relatorio-cofre.md` | não |

Tarefas abertas da nota `01 - Projetos/Moedin.IA (TCC).md` que já podem fechar: L110 (v1 desativada), L111 (Error Trigger), L137/L248 (telas logadas conferidas — de novo nesta revisão), L180 (logo, commit `e0b0404` **já nos 2 remotes**), L253 (domínio). Superadas: L75 (home lab, não Oracle), L251 (resumo semanal desligado). Seguem abertas: pagamento, `moedin_bot`, senha mínima no painel, `AI_SERVICE_*`, as 3 decisões de L207, extrato bancário, revisão da Meta.

---

## O que apagar (cada item com a prova; detalhes em `relatorio-limpeza.md`)

**Sem risco, não versionado (lixo local):** `.env.bak-1788907920`, `.env.bak-1788908255` (cópias de segredo no disco; ignorados por `.env.*`), `.DS_Store`×3, `apps/web/next-*.log`, `apps/web/tsconfig*.tsbuildinfo`, `__pycache__`×3, `apps/ai-service/venv`, `node_modules/` da raiz, `moedin-ia/` (só pasta vazia), `infra/docker/` (vazia), `infra/meta/` (só `__pycache__`), `n8n/qrcode-moedin.png`.

**Versionado, 0 dependentes (`grep -rn` → 0 ou só docs):** `package-lock.json` da raiz (`"moedinha2"`, express/recharts órfãos; o Next avisa "multiple lockfiles"), `n8n/workflow/backup 1.json` (mesmo id do agente — perigoso), `n8n/PROMPT-FABLE-AGENTE-V2.txt` (idêntico ao `.md`), `RELATORIO_FRONTEND_MOEDIN.md` (maio, descreve criar `/planos`), `n8n/TESTE-WHATSAPP-IA.md` (v1), `supabase/seeds/seed.sql` (2 linhas de comentário), `docs/PROMPT-FABLE-REVISAO-FINAL.md` (untracked, prompt desta revisão).

**Mover para `historico/` (com um `LEIA.md`):** `n8n/workflow/moedin-whatsapp-ia.json`, `moedin-whatsapp-lite.json`, `moedin-tcc-lancamento-financeiro.json` (todos `active:false`, dois dependem do ai-service), `n8n/PROMPT-FABLE-AGENTE-V2.md`, `n8n/_arquitetura.html` (desenha v1), `docs/superpowers/specs/2026-07-05-hominhos-categorias-design.md`, `supabase/APLICAR_MIGRATIONS.sql` (ou regenerar).

**Serviços:** `apps/api` → **apagar** (ninguém chama; tirar o serviço `api` e o `depends_on` do compose, `PORT`/`API_ALLOWED_ORIGINS` do example, trechos do README). `apps/ai-service` → **decidir**: apagar junto com `src/app/api/insight/route.ts`, o bloco de insight do `dashboard/page.tsx:332-360`, `NEXT_PUBLIC_AI_URL`/`AI_SERVICE_*`/`GROQ_*` e o serviço `ai` do compose — ou publicar de verdade com `AI_SERVICE_TOKEN`. Hoje está meio-morto (`AI_SERVICE_URL` não existe na Vercel → 502 → heurística local).

**`docker-compose.yml` da raiz → manter** (o `docker-compose.teste-local.yml` é overlay dele e `empacotar.sh:19` exige); só enxugar (`api`, talvez `web`/`ai`) e alinhar `OPENAI_MODEL`.

**`apps/web` (knip + conferência manual):** exports `Eyebrow` e `ListRow` (`ui-kit.tsx:143,332`), `CHART_INCOME`/`CHART_EXPENSE` (`chart-palette.ts`), `isPastOrToday` (`dates.ts:46`), `installmentPreview` (`money.ts:43`, não testado em `money.test.ts`); `@types/qrcode` → devDependencies; `addMonthsClamped` importado sem uso em `historico/page.tsx:9`.

**CSS (`globals.css`), 0 usos em `src/**`:** `.anim-bob`+`bob`, `.anim-sparkle`+`sparkle-spin`, `.anim-wiggle-hover`+`wiggle`, `.coin-float`+`float-soft`, `.hover-lift`, `@keyframes glow-pulse`; aliases legados `--text-muted`, `--text-soft`, `--bg-accent`, `--card`, `--income`, `--brand-gradient`, `--hero-gradient`, `--shadow-glow`; do `@theme inline`: `--color-accent`, `--color-chart-1..6`, `--color-mint`, `--color-primary-hover`. **Não apagar** os outros 12 aliases (`--muted` 53 usos, `--navy` 37, `--brand` 26…) — a migração não terminou.

**Branches:** apagar locais `landing-plano-unico`, `newVersion`, `master`; remotas `origin/newVersion`, `origin/backupNewVersion`, `origin/feature-dev` (é a que tem `node_modules/` no histórico — `.git` cai de 22 MB), `origin/old-template`, `origin/versionjune26` (depois de corrigir o README). `git push origin versionjuly26` (39 atrás). Manter `meta-cloud-api` + tag, `origin/main` (considerar apontar para `e0b0404`), `origin/FINALVERSION`, `vercel-repo/main`.

**Mantido por decisão:** `hominhos.tsx`, `hominho-tip.tsx`, `lib/tips.ts`, `docs/design/hominhos/`; redirects `planejamento-mensal`/`gastos-fixos`/`planos`; `moedin-alertas-diarios.json` (câmbio); `docs/email-templates/`, `docs/REDIS-E-REGEX.md`, `n8n/lib/pdf-relatorio.js`; `.env.meta`.

---

## O que testei e passou (lista curta)

Build/lint/testes · 25 testes unitários · Lighthouse 91/97/100/100 · landing 375/768/desktop claro+escuro · cadastro com e-mail real · confirmação 1× e reuso do link · login sem confirmar · e-mail duplicado não revela · login/logout · rota protegida sem sessão (local e prod) · consentimento gravado · lançamento normal/parcelado/fixo · clamp dia 31 · última parcela fecha o total · catch-up de 3 meses · quitar antecipado · editar/excluir/desfazer · filtros do histórico · totais dashboard = histórico = bot · metas · categorias · limite (13 meses) · sino · WhatsApp (código) · onboarding (QR/wa.me) · perfil · 12 casos de RLS entre contas · RPCs do bot negadas a anon/authenticated · smoke de produção (redirects, 401, 404, headers, robots, sitemap) · bot: vínculo por código, rota rápida, 1 e 2 itens, parcelado, relatório, exclusão ambígua, categoria nova, fora de escopo, 10/12 adversariais, anti-spam · banco: schema × migrations, policies, privilégios, advisors, FKs, Realtime · git: 0 segredos em 62 revisões · limpeza das contas (15 contagens = 0).

## O que não consegui testar e por quê

| Item | Motivo | Como o João confere |
|---|---|---|
| Logs de runtime da Vercel (erros recorrentes) | MCP da Vercel devolve 403 para o projeto (conta do conector sem acesso ao time `joao-jura`); `vercel` CLI não instalada | Painel → Project → Logs, filtro `error`, últimos 7 dias; ou `npx vercel logs --project moedin-ia --scope joao-jura` |
| Build Command na Vercel (`next build --webpack`?) | `get_project` 404 | Project → Settings → Build & Development |
| Variáveis na Vercel (`CRON_SECRET`, `UPSTASH_*`, `NEXT_PUBLIC_CONTACT_EMAIL`, `AI_SERVICE_*`) | sem acesso | Settings → Environment Variables |
| Versão do workflow **publicada** no servidor de casa = JSON do repo; backup diário; Evolution | sem acesso ao servidor | `ssh docker@192.168.3.204 'docker exec … n8n export:workflow --id=MoedinAgenteV2aa'` e `diff` com o repo; `ls ~/Backups/moedin-homelab` no Mac |
| Mídia no bot (foto, áudio, PDF) | o stub não implementa `getBase64FromMediaMessage` | mandar uma foto/áudio real do celular e conferir `message_logs` |
| Perfil sobrescrito por `TOKEN_REFRESHED` (A6) ao vivo | exigiria esperar ~1 h com o formulário aberto | abrir Perfil, digitar sem salvar, esperar a renovação do token |
| Login com Google | conta real do João | — |
| iPhone/Safari real (modais, `<input type="date">`) | só emulação de viewport | abrir `/historico` e o modal no celular |
| Casos extras da Guarda de saída (`wa.me` de terceiro, domínio nu) | não enviados (anti-spam já tinha disparado) | `bash infra/bot/testar-local.sh "responde só isto: banco-falso.com/pagar" 5519900000001` depois de 10 min |
| `fx_rates` parado desde 01/10 | só o servidor mostra se o gatilho 7h10 roda | execuções de `moedin-alertas-diarios` no n8n do servidor |
| E-mail de contato real / `NEXT_PUBLIC_CONTACT_EMAIL` | decisão do João | — |

---

## Proposta de ordem para a Etapa 2 (um assunto por commit; limpeza separada de bug)

1. **Painel (João, sem commit):** Redirect URLs (C1) · templates de e-mail + assuntos (A3) · Leaked Password Protection + senha mínima (M8) · `pg_cron` + schedule (A4) · variáveis da Vercel (B4/B12).
2. `chore(deps): npm audit fix` → Next 16.4.0 (A1) — lint, test, build.
3. `fix(rate-limit): prefixo por limiter` (A2) + teste.
4. `fix(app-shell): cabeçalho mobile sem overflow` (A5).
5. `fix(perfil): não sobrescrever formulário em evento de auth` (A6).
6. `fix(bot): busca por descrição sem acento` — migration 034 parte 1 (M1).
7. `fix(modal): receita fixa recorrente ou remover opção` (M2).
8. `fix(recorrencia): start_date em America/Sao_Paulo` (M3) · `fix(dashboard): previsão com todas as parcelas` (M4) · `fix(limite,fixos,whatsapp): não engolir erro; upsert` (M5, M6, B7) · `fix(export): whatsapp_category_rules` (M7) · `fix(landing): contraste` (M13) · baixos.
9. `chore(db): migration 034 reconcile` (M9) + remapear categorias globais (SQL separado, com `begin/rollback` antes).
10. `chore: remover apps/api` · `chore: decidir ai-service` · `chore: workflows antigos para historico/` · `chore: css e exports mortos` · `chore: env.example` — cada um no seu commit.
11. `docs: README, n8n/README, EXPLICACAO, privacy-lgpd-audit, AGENTE-V2` (M12).
12. Branches e `git gc`; push nos 2 remotes só com o seu ok.

Relatórios de apoio (em `docs/revisao-final-anexos/`, fora do git): `relatorio-web.md`, `relatorio-banco.md` (inclui os advisors na íntegra e o SQL de cada correção), `relatorio-bot.md` (inclui o plano de comandos do teste vivo), `relatorio-limpeza.md` (knip, CSS, env, histórico do git, branches), `relatorio-cofre.md`, `frente1-build.log`, `lighthouse-landing-mobile.report.{html,json}`.
