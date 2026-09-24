# Bot na WhatsApp Cloud API (Meta)

Troca da Evolution API (não oficial, risco de o número ser banido) pela API oficial da Meta.
Branch: `meta-cloud-api`. Ponto de retorno: tag `pre-meta-cloud-api`.
Análise que originou este plano: memória do projeto `meta-cloud-api-analise` (preço, política de IA, BSUID).

## Regra que torna tudo reversível

**O bot atual não é editado.** O caminho da Meta nasce num workflow **novo, com id novo**, ligado a um
webhook novo, e roda em paralelo com a Evolution até a virada. Até a Fase 4, reverter = desligar o
workflow novo. O `MoedinAgenteV2aa` só é tocado na virada, e aí o `reverter-meta.sh` o devolve.

## Arquitetura alvo

```
Meta ──HTTPS──▶ Tailscale Funnel ──▶ proxy (só o caminho do webhook) ──▶ n8n  POST /webhook/moedin-meta
                                                                          │  valida X-Hub-Signature-256
                                                                          │  descarta webhooks de status
                                                                          ▼
                                             normalizador Meta → mesmo formato interno → agente
```
O editor do n8n continua fechado: o Funnel só publica o proxy, e o proxy só repassa o webhook.

## Fases

**Fase 0 — local, sem conta Meta, sem tocar produção**
- [ ] Simulador local da Cloud API (como o `infra/bot/evolution-stub.py`): webhook assinado, `/media`, `/messages`.
- [ ] Workflow novo `moedin-meta` (id novo): recepção, validação da assinatura sobre o corpo cru, desafio `hub.challenge`, filtro de status.
- [ ] Normalizador Meta → formato interno (texto, imagem, áudio, PDF; `user_id`/BSUID como chave, `wa_id` opcional).
- [ ] Envio: texto (`preview_url:false`), PDF (upload → id → envio), marcar como lida.
- [ ] Rodar a bateria `infra/bot/testes-seguranca.py` contra o caminho novo.

**Fase 1 — conta Meta (só o João)**
- [ ] Conta Meta for Developers, app com o produto WhatsApp, token permanente de usuário do sistema.
- [ ] Decidir o número (recomendado: chip novo, dedicado).

**Fase 2 — endpoint e templates**
- [ ] Tailscale Funnel + proxy com allowlist de caminho.
- [ ] Template *utility* do resumo semanal enviado para aprovação.
- [ ] Aviso de erro ao admin sai do WhatsApp (e-mail ou Telegram).

**Fase 3 — paralelo**
- [ ] Workflow novo ativo no número novo; Evolution continua no número antigo. Teste com o número do João.

**Fase 4 — virada**
- [ ] Site passa a mostrar o número novo (`NEXT_PUBLIC_WHATSAPP_NUMBER`). Usuários refazem o vínculo com o código.

**Fase 5 — limpeza (só depois de ~2 semanas estável)**
- [ ] Desligar Evolution e o Postgres dela. Apagar a cópia das mensagens que ela guardava.

## Banco (Supabase)
Toda migration desta frente é **aditiva** (coluna/tabela nova, nada é apagado ou renomeado) e vem com o
SQL reverso comentado no próprio arquivo. Antes de aplicar, conferir o schema real com `list_tables`
(lição do `budgets.alert_percent`, ver memória `schema-drift-migrations-a-mao`).

## Como reverter

| O que voltar | Como | Tempo |
|---|---|---|
| Só o caminho novo (Fases 0–3) | Desativar o workflow `moedin-meta` no n8n. O bot antigo nunca parou. | segundos |
| Workflows do bot | `bash infra/bot/reverter-meta.sh` (ensaio) → `--publicar`. Usa a tag, não a pasta atual. | ~1 min, bot ~20 s fora |
| Webhook na Meta | Painel do app → WhatsApp → Configuração → remover a URL do webhook. | 1 min |
| Site (Vercel) | Painel da Vercel → Deployments → deploy anterior → *Instant Rollback*. Ou `git revert` e push. | segundos |
| Código | `git switch versionjuly26` (o branch principal não recebe nada desta frente até a virada). | — |
| Banco | Rodar o SQL reverso que está no fim da migration. | minutos |
| Servidor inteiro | Backup fixado `~/Backups/moedin-homelab/fixos/pre-meta-cloud-api-20260924-2236.tar.gz.gpg` (restauração testada em 24/09). Procedimento: `infra/bot/README.md`, seção Backup. | ~30 min |

**Estado congelado na tag `pre-meta-cloud-api` (24/09/2026):** site em produção = `728d21c`; os 3
workflows ativos no servidor foram comparados nó a nó com os do repositório e eram idênticos; backup
completo restaurado com sucesso (n8n `integrity_check` ok, 4 workflows, 2 credenciais; Evolution com
instância, sessão, webhook e configurações).
