#!/usr/bin/env bash
# Publica um workflow no n8n do home lab, por SSH, sem passar por login.
# RODE NO MAC, na raiz do projeto:
#   bash infra/bot/publicar-workflow.sh n8n/workflow/moedin-agente-v2.json
#   bash infra/bot/publicar-workflow.sh n8n/workflow/*.json        (vários, com UMA parada só)
#
# O que faz: copia o JSON para o servidor, PARA o n8n, importa, publica e liga de novo.
# O n8n fica fora do ar uns 20 segundos. Mensagem que chegar nesse intervalo pode se perder,
# então prefira fazer fora do horário de uso.
#
# Por que parar o n8n: o CLI grava no mesmo banco SQLite que o n8n usa, e o
# "publish" só vale depois de reiniciar. Parar é o jeito seguro e previsível.
#
# Variáveis (opcionais):
#   HOMELAB=docker@192.168.3.204        usuário@endereço do servidor
#   HOMELAB_KEY=~/.ssh/moedin-homelab   chave SSH
#   HOMELAB_STACK=~/stack               pasta do docker-compose no servidor
set -euo pipefail

[ "$#" -ge 1 ] || { echo "Uso: bash infra/bot/publicar-workflow.sh caminho/do/workflow.json [outros.json ...]"; exit 1; }
ALVO="${HOMELAB:-docker@192.168.3.204}"
CHAVE="${HOMELAB_KEY:-$HOME/.ssh/moedin-homelab}"
PASTA="${HOMELAB_STACK:-~/stack}"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=10 -i "$CHAVE" "$ALVO")

IDS=()
for ARQ in "$@"; do
  [ -f "$ARQ" ] || { echo "Arquivo não encontrado: $ARQ"; exit 1; }
  ID=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['id'])" "$ARQ")
  NOME=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['name'])" "$ARQ")
  echo "==> Workflow: $NOME  ($ID)"; IDS+=("$ID")
done

echo "==> 1/5  Conferindo o servidor"
"${SSH[@]}" "cd $PASTA && docker compose ps --status running --services | grep -qx n8n" \
  || { echo "O n8n do servidor não está rodando. Nada foi alterado."; exit 1; }

echo "==> 2/5  Enviando o arquivo"
"${SSH[@]}" "umask 077; rm -rf /tmp/moedin-wf; mkdir -p /tmp/moedin-wf"
for ARQ in "$@"; do
  scp -q -o BatchMode=yes -i "$CHAVE" "$ARQ" "$ALVO:/tmp/moedin-wf/$(basename "$ARQ")"
done

echo "==> 3/5  Parando o n8n, importando e publicando"
"${SSH[@]}" "set -e; cd $PASTA
  docker compose stop n8n >/dev/null
  for f in \$(ls /tmp/moedin-wf); do
    docker compose run --rm -T -v /tmp/moedin-wf:/import n8n import:workflow --input=/import/\$f 2>&1 | grep -E 'Success|rror' || true
  done
  for id in ${IDS[*]}; do
    docker compose run --rm -T n8n publish:workflow --id=\$id 2>&1 | grep -E 'Publishing|rror' || true
  done
  rm -rf /tmp/moedin-wf"

echo "==> 4/5  Ligando o n8n"
"${SSH[@]}" "cd $PASTA && docker compose up -d n8n >/dev/null"
for i in $(seq 1 30); do
  "${SSH[@]}" "curl -sf -m 3 http://localhost:5678/healthz >/dev/null" && break
  sleep 2
done

echo "==> 5/5  Conferindo que ficou ativo"
sleep 6
for ID in "${IDS[@]}"; do
  "${SSH[@]}" "docker logs stack-n8n-1 --since 2m 2>&1 | grep -F 'Activated workflow' | grep -F '($ID)' | tail -1" \
    || { echo "ATENÇÃO: não vi a linha de ativação de $ID. Confira o log do n8n."; exit 1; }
done
echo "Pronto: ${#IDS[@]} workflow(s) publicado(s) e ativo(s)."
