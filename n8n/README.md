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

## Workflow do TCC

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
