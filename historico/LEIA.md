# Histórico

Arquivos de versões anteriores do Moedin-IA, guardados para consulta. **Nada aqui é usado pelo sistema que está no ar** e nada aqui é publicado por script.

| Pasta | O que é | De quando |
|---|---|---|
| `n8n/workflow/moedin-tcc-lancamento-financeiro.json` | Primeiro protótipo do webhook de lançamento (v0). Confia no `user_id` do corpo da requisição; nunca foi para produção. | mai/2026 |
| `n8n/workflow/moedin-whatsapp-ia.json` | Bot v1: um `switch` de 4 intenções que chamava o `apps/ai-service`. Substituído pelo agente v2. | jun–ago/2026 |
| `n8n/workflow/moedin-whatsapp-lite.json` | Variante enxuta da v1, só texto. | jun/2026 |
| `n8n/TESTE-WHATSAPP-IA.md` | Roteiro de teste da v1. | jun/2026 |
| `n8n/_arquitetura.html` | Desenho do fluxo da v1 (com ai-service e Groq). | ago/2026 |
| `n8n/PROMPT-FABLE-AGENTE-V2.md` | O briefing usado para construir o agente v2. O estado atual está em `n8n/AGENTE-V2.md`. | set/2026 |
| `docs/RELATORIO_FRONTEND_MOEDIN.md` | Relatório da primeira versão do painel (criação da tela de planos, hoje um redirecionamento). | mai/2026 |
| `docs/2026-07-05-hominhos-categorias-design.md` | Especificação dos mascotes nas telas. Os mascotes saíram das telas em set/2026; o código deles continua em `apps/web/src/components/hominhos.tsx`. | jul/2026 |
| `supabase/APLICAR_MIGRATIONS.sql` | Consolidado das migrations 012b e 014–021 para colar no SQL Editor na auditoria de agosto. **Não cobre 022 em diante**: a fonte é `supabase/migrations/`. | set/2026 |

O que roda hoje: `n8n/workflow/moedin-agente-v2.json` (bot), `moedin-erros.json` (aviso de falha) e `moedin-alertas-diarios.json` (só a atualização de câmbio).
