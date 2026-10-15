# n8n — o bot do Moedin-IA

Esta pasta guarda os workflows do bot de WhatsApp e a documentação dele.

| Caminho | O que é |
|---|---|
| `workflow/moedin-agente-v2.json` | O agente: recebe a mensagem, identifica o usuário, lê mídia e chama as ferramentas. **v2.15**, 103 nós, 27 ferramentas. Webhook: `POST /webhook/moedin-agente`. |
| `workflow/moedin-erros.json` | Disparado quando o agente falha: avisa o número configurado em `N8N_ALERT_WA_ID`. |
| `workflow/moedin-alertas-diarios.json` | Hoje só atualiza as cotações de câmbio às 7h10. Os gatilhos de alerta das 9h e do resumo de domingo estão desligados: o bot não manda mensagem por iniciativa própria. **Não apagar**: sem ele a conversão de moeda estrangeira para de atualizar. |
| `AGENTE-V2.md` | Arquitetura, decisões, testes e histórico de versões do agente. |
| `SYSTEM-PROMPT-AGENTE-V2.md` | O prompt do agente. É idêntico ao que está dentro do workflow. |
| `lib/pdf-relatorio.js` | Fonte do gerador de PDF do relatório. O mesmo código está colado no nó "Montar PDF". |
| `data/`, `files/` | Banco local do n8n e arquivos de teste. Não são versionados. |

As versões antigas do bot (v0 e v1) estão em [`../historico/`](../historico/LEIA.md).

## Onde o bot roda

Em produção, num servidor doméstico, junto com a Evolution API e o Redis. O que está no ar, como publicar e como fazer backup está em [`../infra/bot/README.md`](../infra/bot/README.md).

Para publicar uma mudança:

```bash
bash infra/bot/publicar-workflow.sh n8n/workflow/moedin-agente-v2.json
```

## Três cuidados

1. **Salvar não basta, tem que publicar.** O n8n separa rascunho de versão publicada, e o webhook executa a publicada.
2. **Nunca abrir `data/database.sqlite` pelo computador com o container ligado**, nem rodar `n8n import` com ele ligado. Isso já corrompeu o banco uma vez (seção 8 do `AGENTE-V2.md`). Importar só pela tela do n8n ou com o container parado.
3. **Antes de mexer no nó "Rota rápida?"**, ler a seção 13 do `AGENTE-V2.md`. Respostas curtas como "ok", "tudo" e "sim" precisam continuar indo para o agente, senão a confirmação de importação de fatura quebra.

## Testar no computador

O ambiente de teste troca a Evolution por um simulador, então nada sai pelo WhatsApp:

```bash
docker compose -f docker-compose.yml -f infra/bot/docker-compose.teste-local.yml \
  up -d --no-deps redis evolution-stub n8n
bash infra/bot/testar-local.sh "gastei 30 no mercado"
python3 infra/bot/testes-seguranca.py
```

O `--no-deps` é obrigatório. O banco é o de produção: apague os lançamentos de teste depois.
