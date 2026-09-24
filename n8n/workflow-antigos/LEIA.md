Versões antigas guardadas só para consulta. **Não publique nada daqui.**

Ficam fora de `n8n/workflow/` de propósito: `agente-v2-84-nos-2026-09-16.json` tem o MESMO id do agente
no ar (`MoedinAgenteV2aa`), e `publicar-workflow.sh n8n/workflow/*.json` o importaria junto — o agente
atual só não era sobrescrito porque a ordem alfabética publicava o arquivo certo por último.
