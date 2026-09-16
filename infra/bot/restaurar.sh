#!/usr/bin/env bash
# Sobe o bot no servidor a partir do pacote gerado pelo empacotar.sh.
# RODE ESTE AQUI NO SERVIDOR, dentro da pasta moedin-bot:
#   bash restaurar.sh
set -euo pipefail

cd "$(dirname "$0")"
[ -f docker-compose.yml ] || { echo "Rode dentro da pasta moedin-bot."; exit 1; }
[ -f .env ] || { echo "Falta o .env (deveria ter vindo no pacote)."; exit 1; }
command -v docker >/dev/null || { echo "Docker não está instalado. Veja o README."; exit 1; }

echo "==> 1/4  Subindo banco e Redis"
docker compose up -d evolution_db redis
echo "    esperando o Postgres aceitar conexão..."
for i in $(seq 1 30); do
  docker exec moedin_evolution_db pg_isready -U evolution >/dev/null 2>&1 && break
  sleep 2
done

echo "==> 2/4  Restaurando a base da Evolution (com a sessão do WhatsApp)"
if [ -f evolution.sql ]; then
  docker exec -i moedin_evolution_db psql -U evolution -d evolution -q < evolution.sql
  echo "    instâncias restauradas: $(docker exec moedin_evolution_db psql -U evolution -d evolution -tAc 'select count(*) from "Instance";' 2>/dev/null || echo '?')"
else
  echo "    sem evolution.sql — a instância vai precisar de novo pareamento por QR."
fi

echo "==> 3/4  Subindo Evolution e n8n"
docker compose up -d
echo "    esperando o n8n responder..."
for i in $(seq 1 60); do
  curl -sf -m 2 http://127.0.0.1:5678/healthz >/dev/null 2>&1 && break
  sleep 2
done

echo "==> 4/4  Conferindo"
set -a; . ./.env; set +a
echo -n "    n8n:       "; curl -s -m 5 http://127.0.0.1:5678/healthz || echo "SEM RESPOSTA"
echo
echo -n "    WhatsApp:  "
curl -s -m 10 http://127.0.0.1:8080/instance/fetchInstances -H "apikey: $EVOLUTION_API_KEY" \
  | python3 -c "import sys,json
try:
    d=json.load(sys.stdin)
    for i in d: print(i.get('name'), '->', i.get('connectionStatus'), i.get('ownerJid') or '')
except Exception: print('não consegui ler (a Evolution pode ainda estar subindo)')" 2>/dev/null || echo "?"

echo
echo "Se o status acima for 'open', o bot já está no ar e não precisa de mais nada."
echo "Se for 'close' ou 'connecting', refaça o pareamento pelo QR:"
echo "  curl -s http://127.0.0.1:8080/instance/connect/\$EVOLUTION_INSTANCE -H \"apikey: \$EVOLUTION_API_KEY\""
echo
echo "Falta um passo obrigatório: apontar o webhook da Evolution para o n8n."
echo "Rode (uma vez só):"
cat <<'FIM'
  set -a; . ./.env; set +a
  curl -X POST http://127.0.0.1:8080/webhook/set/$EVOLUTION_INSTANCE \
    -H "apikey: $EVOLUTION_API_KEY" -H 'Content-Type: application/json' \
    -d "{\"webhook\":{\"enabled\":true,\"url\":\"http://n8n:5678/webhook/moedin-agente\",
         \"headers\":{\"Content-Type\":\"application/json\",\"X-Webhook-Token\":\"$WHATSAPP_WEBHOOK_TOKEN\"},
         \"byEvents\":false,\"base64\":true,\"events\":[\"MESSAGES_UPSERT\"]}}"
FIM
echo
echo "Para abrir o editor do n8n, no SEU computador:"
echo "  ssh -L 5678:127.0.0.1:5678 \$USER@SEU_SERVIDOR"
echo "  e acesse http://localhost:5678"
