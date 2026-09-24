#!/usr/bin/env bash
# Primeiro teste da Cloud API: manda o template "hello_world" do número de teste da Meta para o seu WhatsApp.
# RODE NA RAIZ DO PROJETO, depois de preencher .env.meta (modelo em infra/meta/meta.env.exemplo):
#   bash infra/meta/testar-envio.sh
# Não imprime o token. Não toca no bot em produção.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
[ -f .env.meta ] || { echo "Falta o arquivo .env.meta na raiz (copie infra/meta/meta.env.exemplo)."; exit 1; }
set -a; . ./.env.meta; set +a
for v in META_PHONE_NUMBER_ID META_ACCESS_TOKEN META_TEST_TO; do
  [ -n "${!v:-}" ] || { echo "Falta preencher $v no .env.meta"; exit 1; }
done
V="${META_GRAPH_VERSION:-v25.0}"
echo "==> Enviando hello_world de $META_PHONE_NUMBER_ID para ...${META_TEST_TO: -4}"
RESP=$(curl -sS -w '\n%{http_code}' "https://graph.facebook.com/$V/$META_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer $META_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d "{\"messaging_product\":\"whatsapp\",\"to\":\"$META_TEST_TO\",\"type\":\"template\",\"template\":{\"name\":\"hello_world\",\"language\":{\"code\":\"en_US\"}}}")
CODE=$(echo "$RESP" | tail -1); BODY=$(echo "$RESP" | sed '$d')
echo "HTTP $CODE"; echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
case "$CODE" in
  200) echo "==> Aceito pela Meta. Confira o seu WhatsApp: deve chegar 'Hello World'." ;;
  401) echo "==> Token inválido ou vencido (o temporário dura ~24 h). Gere outro no painel." ;;
  *)   echo "==> A Meta recusou. A mensagem de erro acima diz o motivo. Erro 131030 = seu número não está na lista de destinatários de teste." ;;
esac
