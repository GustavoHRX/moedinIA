#!/usr/bin/env bash
# Cria (ou atualiza) a credencial "Anthropic account" dentro do n8n, com o id fixo que o workflow
# do agente usa (MoedinAnthropic01). A chave sai do .env direto para dentro do container: não passa
# pela tela, pelo histórico do shell nem por arquivo no host.
#
#   bash infra/bot/importar-credencial-anthropic.sh local      (n8n do Mac, ambiente de teste)
#   bash infra/bot/importar-credencial-anthropic.sh servidor   (n8n do home lab)
#
# O n8n é PARADO antes: o CLI grava no mesmo SQLite que o n8n usa (ver n8n/README.md, cuidado 2).
# No servidor isso deixa o bot uns 20 s fora do ar; rode junto com o publicar-workflow.sh.
set -euo pipefail
cd "$(dirname "$0")/../.."
ONDE="${1:?uso: importar-credencial-anthropic.sh local|servidor}"

# roda dentro do container: monta o JSON com a chave do ambiente, importa e apaga o arquivo
DENTRO='set -e
[ -n "${ANTHROPIC_API_KEY:-}" ] || { echo "ANTHROPIC_API_KEY vazia no .env — rode antes infra/bot/chave-anthropic.sh"; exit 1; }
umask 077
node -e '"'"'require("fs").writeFileSync("/tmp/cred.json", JSON.stringify([{ id: "MoedinAnthropic01", name: "Anthropic account", type: "anthropicApi", data: { apiKey: process.env.ANTHROPIC_API_KEY, url: "https://api.anthropic.com" } }]))'"'"'
n8n import:credentials --input=/tmp/cred.json 2>&1 | grep -E "Success|rror" || true
rm -f /tmp/cred.json'

case "$ONDE" in
  local)
    set -a; . ./.env; set +a
    D=(docker compose -f docker-compose.yml -f infra/bot/docker-compose.teste-local.yml)
    "${D[@]}" stop n8n >/dev/null 2>&1 || true
    "${D[@]}" run --rm --no-deps -T -e ANTHROPIC_API_KEY --entrypoint sh n8n -c "$DENTRO" 2>&1 | grep -v "Container\|orphan"
    ;;
  servidor)
    ALVO="${HOMELAB:-docker@100.76.253.59}"
    CHAVE_SSH="${HOMELAB_KEY:-$HOME/.ssh/moedin-homelab}"
    PASTA="${HOMELAB_STACK:-~/stack}"
    printf '%s' "$DENTRO" | ssh -o BatchMode=yes -o ConnectTimeout=10 -i "$CHAVE_SSH" "$ALVO" "
      set -e; cd $PASTA; set -a; . ./.env; set +a
      SCRIPT=\$(cat)
      docker compose stop n8n >/dev/null
      docker compose run --rm -T -e ANTHROPIC_API_KEY --entrypoint sh n8n -c \"\$SCRIPT\" 2>&1 | grep -v Container || true
      docker compose up -d n8n >/dev/null"
    ;;
  *) echo "uso: importar-credencial-anthropic.sh local|servidor"; exit 1 ;;
esac
echo "Pronto ($ONDE). Se o n8n local estava ligado, suba de novo com o compose de teste."
