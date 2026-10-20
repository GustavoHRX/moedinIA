#!/usr/bin/env bash
# Manda uma FOTO, um PDF ou um ÁUDIO de teste para o bot LOCAL e mostra a resposta.
# A Evolution falsa entrega o arquivo quando o n8n pede o download (getBase64FromMediaMessage).
# Nada sai pelo WhatsApp. Chama a IA de verdade (Claude para foto/PDF, Whisper para áudio): custa centavos.
#
#   bash infra/bot/testar-midia-local.sh caminho/comprovante.png ["legenda"]
#   bash infra/bot/testar-midia-local.sh caminho/fatura.pdf
#   bash infra/bot/testar-midia-local.sh caminho/audio.m4a
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
ARQ="${1:?uso: testar-midia-local.sh arquivo [legenda] [wa_id]}"; LEG="${2:-}"; WA="${3:-5519998804130}"
NOME="$(date +%s)-$(basename "$ARQ")"
mkdir -p n8n/files/midia-teste && cp "$ARQ" "n8n/files/midia-teste/$NOME"
LOG="n8n/files/respostas.log"; ANTES=$( [ -f "$LOG" ] && wc -c < "$LOG" || echo 0 )
BODY=$(python3 - "$NOME" "$LEG" "$WA" "$EVOLUTION_INSTANCE" <<'PY'
import json, mimetypes, os, sys
nome, leg, wa, inst = sys.argv[1:5]
mime = mimetypes.guess_type(nome)[0] or "application/octet-stream"
tam = os.path.getsize("n8n/files/midia-teste/" + nome)
if mime.startswith("image/"):
    msg, tipo = {"imageMessage": {"mimetype": mime, "caption": leg, "fileLength": tam}}, "imageMessage"
elif mime.startswith("audio/"):
    msg, tipo = {"audioMessage": {"mimetype": mime, "seconds": 5, "ptt": True, "fileLength": tam}}, "audioMessage"
else:
    msg, tipo = {"documentMessage": {"mimetype": mime, "fileName": nome, "caption": leg, "fileLength": tam}}, "documentMessage"
print(json.dumps({"event": "messages.upsert", "instance": inst, "data": {
    "key": {"remoteJid": wa + "@s.whatsapp.net", "fromMe": False, "id": "MIDIA-" + nome},
    "pushName": "Teste", "message": msg, "messageType": tipo}}))
PY
)
echo "### você mandou: $(basename "$ARQ")${LEG:+ (legenda: $LEG)}"
curl -s -m 180 -X POST "http://localhost:5678/webhook/moedin-agente" \
  -H "Content-Type: application/json" -H "X-Webhook-Token: $WHATSAPP_WEBHOOK_TOKEN" -d "$BODY" >/dev/null
for _ in $(seq 1 90); do
  AGORA=$( [ -f "$LOG" ] && wc -c < "$LOG" || echo 0 )
  [ "$AGORA" -gt "$ANTES" ] && { sleep 2; tail -c +$((ANTES + 1)) "$LOG"; rm -f "n8n/files/midia-teste/$NOME"; exit 0; }
  sleep 1
done
rm -f "n8n/files/midia-teste/$NOME"
echo "(sem resposta em 90 s — veja: docker logs moedin_n8n --tail=30)"
