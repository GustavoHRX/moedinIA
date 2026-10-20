#!/usr/bin/env bash
# Guarda a chave da Anthropic no .env do Mac e no .env do servidor, sem mostrar a chave na tela.
# RODE NO MAC, na raiz do projeto (pede a chave uma vez, digitação escondida):
#   bash infra/bot/chave-anthropic.sh
#
# Depois disso, quem cria a credencial dentro do n8n é o importar-credencial-anthropic.sh.
# Variáveis opcionais: HOMELAB, HOMELAB_KEY, HOMELAB_STACK (iguais às do publicar-workflow.sh).
set -euo pipefail
cd "$(dirname "$0")/../.."
ALVO="${HOMELAB:-docker@100.76.253.59}"
CHAVE_SSH="${HOMELAB_KEY:-$HOME/.ssh/moedin-homelab}"
PASTA="${HOMELAB_STACK:-~/stack}"

printf "Cole a chave da Anthropic (não aparece na tela) e aperte Enter: "
IFS= read -rs K; echo
K="$(printf '%s' "$K" | tr -d '[:space:]')"
case "$K" in sk-ant-*) ;; *) echo "Isso não parece uma chave da Anthropic (começa com sk-ant-). Nada foi gravado."; exit 1;; esac

grava() {  # $1 = arquivo .env; troca a linha se já existir, senão acrescenta
  local f="$1"; touch "$f"; chmod 600 "$f"
  grep -v '^ANTHROPIC_API_KEY=' "$f" > "$f.tmp" || true
  printf 'ANTHROPIC_API_KEY=%s\n' "$K" >> "$f.tmp"; mv "$f.tmp" "$f"; chmod 600 "$f"
}

grava .env
echo "✓ Mac: ANTHROPIC_API_KEY gravada no .env da raiz"

# servidor: a chave vai pela entrada padrão do SSH, nunca na linha de comando
printf '%s' "$K" | ssh -o BatchMode=yes -o ConnectTimeout=10 -i "$CHAVE_SSH" "$ALVO" "
  set -e; cd $PASTA; IFS= read -r K || true
  touch .env; chmod 600 .env
  grep -v '^ANTHROPIC_API_KEY=' .env > .env.tmp || true
  printf 'ANTHROPIC_API_KEY=%s\n' \"\$K\" >> .env.tmp; mv .env.tmp .env; chmod 600 .env"
echo "✓ Servidor: ANTHROPIC_API_KEY gravada em $PASTA/.env"
unset K
