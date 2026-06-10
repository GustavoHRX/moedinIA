# Teste — Lançamento por WhatsApp com IA

Fluxo: `Webhook → identifica usuário pelo telefone → roteia texto/imagem/áudio → ai-service interpreta → grava em transactions → responde`.

## 1. Pré-requisitos

No arquivo `.env` da raiz (copie de `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://lopdzmrlkykolnzdlfuq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<sua service role key>
OPENAI_API_KEY=<sua key>   # opcional — sem ela, usa fallback regex
OPENAI_MODEL=gpt-4o-mini
```

Suba os serviços:

```
docker compose up --build
```

## 2. Importar o workflow no n8n

1. Abra `http://localhost:5678`
2. Menu → **Import from File** → `n8n/workflow/moedin-whatsapp-ia.json`
3. **Active** o workflow (toggle no topo)
4. A URL do webhook fica: `http://localhost:5678/webhook/moedin-whatsapp`
   (em teste, use `/webhook-test/moedin-whatsapp` com o workflow aberto e "Listen for test event")

## 3. Cadastrar um usuário de teste

A autenticação é por telefone. Crie uma conta no app (`/cadastro`) preenchendo o **Celular**,
ou rode no SQL editor do Supabase (use um id de auth.users real):

```sql
-- confira o telefone gravado
select id, full_name, phone from public.profiles;
-- garanta categorias padrão: faça login no app uma vez (cria automático)
```

## 4. Testar via curl (sem Evolution API)

**Texto:**
```bash
curl -X POST http://localhost:5678/webhook/moedin-whatsapp \
  -H "Content-Type: application/json" \
  -d '{ "telefone": "5511999999999", "tipo": "texto", "text": "gastei 50 no mercado hoje" }'
```

**Imagem (comprovante):**
```bash
curl -X POST http://localhost:5678/webhook/moedin-whatsapp \
  -H "Content-Type: application/json" \
  -d '{ "telefone": "5511999999999", "tipo": "imagem", "image_base64": "<base64>", "mime": "image/jpeg" }'
```

**Áudio:**
```bash
curl -X POST http://localhost:5678/webhook/moedin-whatsapp \
  -H "Content-Type: application/json" \
  -d '{ "telefone": "5511999999999", "tipo": "audio", "audio_base64": "<base64>", "filename": "audio.ogg" }'
```

Resposta esperada (sucesso):
```json
{ "ok": true, "mensagem": "✅ Gasto de R$ 50.00 em Mercado registrado com sucesso." }
```

Se o telefone não estiver cadastrado:
```json
{ "ok": false, "mensagem": "Numero nao cadastrado..." }
```

## 5. Testar o ai-service isolado (sem n8n)

```bash
curl -X POST http://localhost:8000/parse-text \
  -H "Content-Type: application/json" \
  -d '{ "text": "recebi 1200 de salario" }'
```

## 6. Conectar a Evolution API (quando tiver)

O node `global` já lê o formato Evolution (`remoteJid`, `messageType`). Aponte o webhook da
sua instância Evolution para `.../webhook/moedin-whatsapp`. Para **imagem/áudio reais**, adicione
antes dos nodes de IA um HTTP Request que baixa o base64:
`POST {host}/chat/getBase64FromMediaMessage/{instancia}` com `{ "message": { "key": { "id": "<id>" } } }`,
e ligue a saída no campo `image_base64`/`audio_base64`.
```
