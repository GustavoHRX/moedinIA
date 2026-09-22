#!/usr/bin/env bash
# Manda uma mensagem de teste para o bot LOCAL (n8n do Mac) e mostra a resposta.
# Nada sai pelo WhatsApp: a Evolution local é o stub (infra/bot/evolution-stub.py).
#
#   bash infra/bot/testar-local.sh "gastei 30 no mercado"
#   bash infra/bot/testar-local.sh "ajuda" 5519998804130     (outro número)
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
TXT="${1:?uso: testar-local.sh \"mensagem\" [wa_id]}"
WA="${2:-5519998804130}"
LOG="n8n/files/respostas.log"
ANTES=$( [ -f "$LOG" ] && wc -c < "$LOG" || echo 0 )
BODY=$(python3 -c "
import json,sys,time
print(json.dumps({'event':'messages.upsert','instance':'$EVOLUTION_INSTANCE','data':{
 'key':{'remoteJid':'$WA@s.whatsapp.net','fromMe':False,'id':'LOCAL'+str(int(time.time()*1000))},
 'pushName':'João Lucas','message':{'conversation':sys.argv[1]},'messageType':'conversation'}}))" "$TXT")
echo "### você: $TXT"
curl -s -m 180 -X POST "http://localhost:5678/webhook/moedin-agente" \
  -H "Content-Type: application/json" -H "X-Webhook-Token: $WHATSAPP_WEBHOOK_TOKEN" -d "$BODY" >/dev/null
for _ in $(seq 1 60); do
  AGORA=$( [ -f "$LOG" ] && wc -c < "$LOG" || echo 0 )
  [ "$AGORA" -gt "$ANTES" ] && { tail -c +$((ANTES + 1)) "$LOG"; exit 0; }
  sleep 1
done
echo "(sem resposta em 60 s — veja: docker logs moedin_n8n --tail=30)"
