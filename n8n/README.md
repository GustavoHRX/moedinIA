# n8n local

Este diretório guarda a instalação local do n8n usada pelo Docker Compose.

- `data/`: banco SQLite, credenciais e configurações locais do n8n. Não versionar.
- `workflow/`: espaço para exportar/importar workflows em JSON.
- `files/`: arquivos locais que workflows podem ler em `/files` dentro do container. Não versionar.

## Rodar

Na raiz do projeto:

```bash
docker compose up -d n8n
```

Acesse:

```text
http://localhost:5678
```

## Agente de WhatsApp v2 (atual)

Workflow ativo em produção local: `workflow/moedin-agente-v2.json` — **v2.6**, 98 nós e 24 tools
que chamam RPCs do Supabase. Documentação completa, testes e limitações em **`AGENTE-V2.md`**;
system prompt em `SYSTEM-PROMPT-AGENTE-V2.md`. Endpoint: `POST /webhook/moedin-agente`.

Dois workflows acompanham: `workflow/moedin-alertas-diarios.json` (vencimento e limite às 9h,
resumo semanal domingo 20h, cotações de câmbio às 7h10) e `workflow/moedin-erros.json`.

> **Editar não basta: tem que publicar.** O n8n 2.36 separa rascunho de versão publicada, e o
> webhook continua executando a publicada. Depois de importar ou editar, clique em **Publish**.

> **Antes de mexer na "Rota rápida?"**, leia a seção 13 do `AGENTE-V2.md`: respostas curtas como
> "ok", "tudo" e "sim" precisam continuar indo para o agente, senão a confirmação de importação de
> fatura quebra.

> Nunca abra `data/database.sqlite` com `sqlite3` no host nem rode `n8n import/update` pelo CLI
> com o container rodando — corrompeu o banco em 08/09/2026 (ver `AGENTE-V2.md`, seção 8).

## Workflow do TCC (v0, histórico)

Workflow importado:

```text
Moedin TCC - Lancamento financeiro por webhook
```

Arquivo:

```text
n8n/workflow/moedin-tcc-lancamento-financeiro.json
```

Endpoint ativo:

```text
POST http://localhost:5678/webhook/moedin-tcc-lancamento
```

Payload esperado:

```json
{
  "user_id": "uuid-do-usuario-no-supabase",
  "text": "gastei R$ 35,90 no mercado hoje",
  "external_id": "msg-001"
}
```

Exemplos de mensagens aceitas:

```text
gastei R$ 35,90 no mercado hoje
paguei 120,00 de internet em 04/05/2026
recebi R$ 2500,00 de salario
```

O workflow:

1. Recebe a mensagem por webhook.
2. Extrai valor, tipo, data e descricao.
3. Registra a mensagem em `message_logs`.
4. Cria o lancamento em `transactions` com `source = n8n`.
5. Responde com o JSON processado.

Para gravar no Supabase, preencha no `.env`:

```env
SUPABASE_SERVICE_ROLE_KEY=
```

Depois reinicie o n8n:

```bash
docker compose restart n8n
```

## Logs

```bash
docker compose logs -f n8n
```

## Parar

```bash
docker compose stop n8n
```

Para apagar a instalação local do n8n, pare o container e remova a pasta `n8n/data`.
