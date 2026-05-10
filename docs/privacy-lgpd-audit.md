# Auditoria técnica de privacidade e LGPD - Moedin.IA

> Este documento é uma auditoria técnica e não constitui aconselhamento jurídico. A validação final de bases legais, textos contratuais, política de privacidade e termos deve ser feita com apoio jurídico.

## 1. Resumo executivo

O projeto Moedin.IA possui uma base técnica inicial positiva para privacidade e proteção de dados: usa Supabase Auth, sessão por cookies via `@supabase/ssr`, middleware/proxy para rotas privadas, RLS nas tabelas financeiras principais e queries filtradas por usuário autenticado.

Os pontos mais importantes a evoluir são direitos do titular, documentação de incidentes, controle do uso futuro de IA/WhatsApp e endurecimento de ambientes com n8n/service role. O aceite de Termos de Uso e Política de Privacidade já possui persistência técnica em `user_settings`, mantendo `localStorage` apenas como apoio de UX.

Classificação técnica geral: base adequada para MVP autenticado, mas incompleta para uma operação madura com dados financeiros pessoais e automações externas.

## 2. Dados pessoais tratados

| Dado | Onde é salvo | Uso aparente | Necessidade para a finalidade |
|---|---|---|---|
| Nome completo | `profiles.full_name`, Supabase Auth metadata no cadastro | Identificação da conta e personalização | Necessário/razoável |
| E-mail | Supabase Auth e `profiles.email` | Login, recuperação de senha, identificação | Necessário |
| Telefone | `profiles.phone`, Auth metadata no cadastro | Perfil e futura integração WhatsApp | Razoável, mas deve ser opcional se WhatsApp não estiver ativo |
| Avatar | `profiles.avatar_url` | Perfil | Opcional, hoje não parece usado no frontend |
| Moeda | `profiles.currency` | Preferência de exibição | Necessário/razoável |
| Fuso horário | `profiles.timezone` | Datas e competência mensal | Necessário/razoável |
| Categorias | `categories` | Organização de receitas/despesas | Necessário |
| Transações financeiras | `transactions` | Histórico, dashboard, gráficos e saldo | Necessário e sensível pelo contexto financeiro |
| Observações de transações | `transactions.notes` | Detalhes livres do usuário | Necessário, mas campo livre pode conter dados sensíveis extras |
| Metas financeiras | `goals` | Planejamento de objetivos | Necessário para a funcionalidade |
| Orçamentos | `budgets` | Controle de limites mensais | Necessário |
| Controle mensal | `monthly_controls` | Salário, renda extra, saldo inicial, benefícios, notas | Necessário para planejamento; contém dados financeiros sensíveis |
| Gastos fixos | `fixed_expenses` | Recorrências e geração de transações vencidas | Necessário |
| Parcelamentos | `installments` | Compras parceladas e progresso | Necessário |
| Preferências | `user_settings` | Notificações, relatórios e tema | Necessário/razoável |
| Logs de mensagens | `message_logs` | Base futura WhatsApp/n8n | Alto cuidado: pode conter texto livre e dados financeiros |
| Aceite de termos | `user_settings` e `localStorage`: `moedin_terms_accepted`, `moedin_terms_accepted_at`, versões atuais | Comprovação de aceite e UX | Necessário para governança de consentimento |

## 3. Base técnica de segurança atual

### Autenticação e sessão

- O frontend usa `createBrowserClient` em `apps/web/src/lib/supabase/client.ts`.
- Server/middleware usam `createServerClient` em `apps/web/src/lib/supabase/server.ts` e `apps/web/src/lib/supabase/middleware.ts`.
- O proxy em `apps/web/src/proxy.ts` encaminha todas as rotas protegidas para o middleware Supabase.
- Usuário sem sessão é redirecionado para `/login` nas rotas privadas:
  - `/dashboard`
  - `/perfil`
  - `/lancamentos`
  - `/historico`
  - `/metas`
  - `/gastos-fixos`
  - `/parcelamentos`
  - `/planejamento-mensal`
  - `/planos`
- Usuário logado é redirecionado de `/login`, `/cadastro` e `/recuperar-senha` para `/dashboard`.
- `/atualizar-senha` não está na lista de rotas públicas redirecionadas nem protegidas. Isso é aceitável para fluxo de reset, mas deve ser revisado para garantir que só funcione com sessão/token válido do Supabase.

### RLS e acesso ao banco

As migrations habilitam RLS e policies por usuário nas tabelas principais:

| Tabela | RLS | Policy observada |
|---|---:|---|
| `profiles` | Sim | `auth.uid() = id` para select/update; migration adicional cria insert próprio |
| `user_settings` | Sim | `auth.uid() = user_id` |
| `categories` | Sim | `auth.uid() = user_id` |
| `transactions` | Sim | `auth.uid() = user_id` |
| `goals` | Sim | `auth.uid() = user_id` |
| `budgets` | Sim | `auth.uid() = user_id` |
| `monthly_controls` | Sim | `auth.uid() = user_id` |
| `fixed_expenses` | Sim | `auth.uid() = user_id` |
| `installments` | Sim | `auth.uid() = user_id` |

As queries do frontend também filtram por usuário nas leituras principais com `.eq("user_id", user.id)` ou usam `user_id` no payload de insert. Isso reduz risco operacional, mas a proteção decisiva continua sendo o RLS.

### Chaves e secrets

- Não foi encontrado uso de `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- O frontend usa somente `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `.gitignore` já bloqueia `.env` e `.env.*`, preservando `!.env.example`.
- Existe `.env` local na raiz e `apps/web/.env.local`; a raiz possui `.env.example` sem chaves reais.
- `docker-compose.yml` injeta `SUPABASE_SERVICE_ROLE_KEY` no n8n, o que é compatível com backend/automação, mas exige isolamento forte do n8n.
- O n8n tem fallback local para `N8N_ENCRYPTION_KEY` com valor previsível (`moedin_local_change_me_32_chars_key`). Para produção, isso deve ser obrigatório e secreto.

### Cookies e storage

- Cookies de sessão são gerenciados pelo Supabase SSR.
- Não há cookies próprios encontrados no código.
- Há `localStorage` para tema (`moedin-theme`) e aceite de termos (`moedin_terms_accepted`, `moedin_terms_accepted_at`).
- O popup de termos/cookies é exibido globalmente no layout. Em páginas públicas pode ser adiado; em rotas internas fica bloqueante até o aceite. Para usuário logado, o aceite é salvo em `user_settings`.

## 4. Pontos conformes

- Supabase Auth está integrado no cliente, server e middleware.
- Rotas internas principais estão protegidas por proxy/middleware.
- Rotas de login/cadastro/recuperação redirecionam usuário logado para dashboard.
- RLS está habilitado nas tabelas financeiras e de perfil principais.
- Policies usam `auth.uid()` para isolar dados por usuário.
- Service role não aparece no bundle/frontend.
- `.gitignore` bloqueia envs e logs.
- Há texto inicial avisando que IA é informativa, pode conter imprecisões e que o sistema não realiza pagamento, transferência, investimento ou operação bancária.
- Histórico usa exclusão lógica para transações (`status = deleted`, `deleted_at`), reduzindo remoções acidentais.

## 5. Riscos encontrados

### Alto

1. n8n com service role
   - O service role bypassa RLS.
   - O workflow recebe `user_id` no payload; se o webhook ficar público sem autenticação/assinatura, alguém poderia tentar gravar dados em usuários indevidos.
   - Recomendação: autenticar webhook, validar ownership, evitar aceitar `user_id` livre, usar token por usuário/canal ou mapear remetente autenticado.

2. Ausência de fluxo de exclusão de conta
   - O usuário consegue editar perfil e excluir/soft-delete alguns registros, mas não há solicitação de exclusão de conta/dados.

### Médio

1. Direitos do titular incompletos
   - Não há exportação de dados.
   - Não há revogação/renovação de aceite.
   - Não há central de privacidade no perfil.

2. Campos livres podem conter dados sensíveis
   - `notes`, `description`, `raw_text` e textos de metas podem armazenar dados pessoais adicionais.
   - Falta aviso contextual para o usuário não inserir senhas, documentos ou dados de terceiros.

3. Logs de middleware
   - O middleware faz `console.warn` em falha de auth. Hoje imprime mensagem de erro, não dados financeiros, mas deve ser padronizado para não vazar tokens ou payloads em produção.

4. Rota `/atualizar-senha`
   - Não está no matcher do proxy. Pode ser intencional pelo fluxo de reset, mas vale validar comportamento quando acessada sem token.

### Baixo

1. Preferência de tema em `localStorage`
   - Baixo impacto de privacidade.

2. `profiles.avatar_url` existe sem uso claro
   - Campo opcional; manter se houver roadmap de perfil.

3. Documentação de privacidade/segurança ausente
   - Não existe `SECURITY.md` nem `PRIVACY_CHECKLIST.md`.

## 6. Recomendações prioritárias

1. Manter governança de versão dos termos e política
   - Atualizar `terms_version` e `privacy_version` quando os documentos mudarem.
   - Reexibir quando a versão mudar.

2. Endurecer n8n/WhatsApp
   - Não expor webhook sem autenticação.
   - Não confiar em `user_id` vindo do payload.
   - Usar assinatura HMAC ou token por integração.
   - Sanitizar e minimizar `message_logs.raw_text`.
   - Garantir `N8N_ENCRYPTION_KEY` forte e sem fallback em produção.

3. Implementar área de privacidade no perfil
   - Exportar dados.
   - Solicitar exclusão da conta.
   - Revogar consentimentos futuros.
   - Ver versões aceitas.

4. Criar documentação interna
   - `SECURITY.md`
   - `PRIVACY_CHECKLIST.md`
   - Plano básico de incidente.

## 7. Checklist LGPD técnico

| Item | Status | Observação |
|---|---|---|
| Autenticação segura | Parcialmente OK | Supabase Auth integrado |
| Rotas privadas protegidas | OK | Proxy cobre principais rotas internas |
| Redirecionar usuário logado fora de login/cadastro | OK | `/login`, `/cadastro`, `/recuperar-senha` |
| RLS nas tabelas principais | OK | Policies por `auth.uid()` |
| Queries filtradas por usuário | OK | Leituras principais usam `user_id` |
| Service role fora do frontend | OK | Encontrado apenas docs/docker/n8n |
| `.env` ignorado | OK | `.gitignore` cobre `.env` e `.env.*` |
| `.env.example` | OK | Criado na raiz |
| Consentimento de termos | OK | Popup e checkbox |
| Consentimento auditável em banco | OK | Migration em `user_settings` |
| Versão dos termos/política | OK | Versão atual 1.0 |
| Aviso de IA informativa | Parcialmente OK | Texto existe no popup |
| Aviso de não operação bancária | OK | Texto existe no popup |
| Edição de perfil | OK | Tela `/perfil` |
| Exclusão de lançamentos | Parcial | Transações têm soft delete; fixos/parcelas/orçamentos têm delete |
| Exclusão de conta | Pendente | Não implementado |
| Exportação de dados | Pendente | Não implementado |
| Revogação de aceite | Pendente | Não implementado |
| Logs sem dados financeiros | Parcial | Não há logs financeiros evidentes, mas n8n precisa política |
| Plano de incidente | Pendente | Criar documentação |

## 8. Próximos passos

1. Criar `.env.example` em `apps/web` se o deploy usar diretório isolado.
2. Criar `SECURITY.md` com canal de reporte, escopo, SLA interno e rotação de secrets.
3. Criar `PRIVACY_CHECKLIST.md` com rotina antes de novas features de IA/WhatsApp.
4. Validar a migration `004_user_settings_consent.sql` no Supabase antes de produção pública.
5. Adicionar tela/seção "Privacidade" em `/perfil`.
6. Definir fluxo de exportação e exclusão de conta.
7. Proteger webhooks n8n com assinatura/token e deixar de aceitar `user_id` livre.
8. Revisar `/atualizar-senha` em ambiente real para confirmar que acesso sem token não permite alteração.
9. Definir política de retenção para `message_logs`, transações excluídas e backups.
10. Validar textos finais de Termos de Uso e Política de Privacidade com jurídico.

## 9. Status da implementação do aceite

Implementado em código:

- Migration `supabase/migrations/004_user_settings_consent.sql` adiciona em `user_settings` os campos `terms_accepted_at`, `privacy_accepted_at`, `terms_version` e `privacy_version`.
- Versões atuais no frontend: `terms_version = "1.0"` e `privacy_version = "1.0"`.
- O popup mantém `localStorage` para UX, mas sincroniza com `user_settings` quando houver usuário logado.
- Se o usuário estiver logado e já tiver aceite válido no banco, o popup não aparece.
- Se o usuário tiver apenas aceite local e estiver logado, o componente tenta sincronizar com o banco.
- Em rotas internas, o popup não oferece fechamento sem aceite e bloqueia a interação até aceitar.
- Em páginas públicas, o usuário deslogado ainda pode usar "Ver depois / Fechar".
