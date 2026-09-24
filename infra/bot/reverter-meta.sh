#!/usr/bin/env bash
# Volta os workflows do bot para a versão de ANTES da migração para a WhatsApp Cloud API.
# RODE NO MAC, na raiz do projeto:
#   bash infra/bot/reverter-meta.sh              ensaio: extrai e confere, NÃO publica nada
#   bash infra/bot/reverter-meta.sh --publicar   publica de verdade (n8n fica ~20 s fora)
#
# De onde vem a versão antiga: da tag git `pre-meta-cloud-api` (24/09/2026), cujos workflows foram
# conferidos contra o servidor e eram idênticos aos que estavam no ar. Não depende do estado atual da
# pasta n8n/workflow/ nem do branch em que você está.
#
# O que este script NÃO faz (ver docs/META-CLOUD-API.md, "Como reverter"):
#   - desligar o webhook no painel da Meta;
#   - reverter o site (Vercel) ou migrations do Supabase;
#   - restaurar o servidor inteiro (para isso: backup fixado em ~/Backups/moedin-homelab/fixos/).
set -euo pipefail

TAG="${TAG:-pre-meta-cloud-api}"
WORKFLOWS=(moedin-agente-v2.json moedin-alertas-diarios.json moedin-erros.json)
cd "$(git rev-parse --show-toplevel)"

git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || { echo "A tag $TAG não existe neste clone (git fetch --tags)."; exit 1; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
echo "==> Extraindo os workflows da tag $TAG ($(git rev-parse --short "$TAG^{commit}"))"
for w in "${WORKFLOWS[@]}"; do
  git show "$TAG:n8n/workflow/$w" > "$TMP/$w"
  python3 - "$TMP/$w" <<'EOF'
import json, sys
w = json.load(open(sys.argv[1]))
assert w.get("id") and w.get("nodes"), "JSON sem id ou sem nós"
evo = sum(1 for n in w["nodes"] if "Evolution" in n["name"])
print(f"    ok  {w['id']:<18} {len(w['nodes']):>3} nós  ({evo} de Evolution)  {w['name']}")
EOF
done

if [ "${1:-}" != "--publicar" ]; then
  echo "==> Ensaio concluído. Nada foi publicado. Para valer: bash infra/bot/reverter-meta.sh --publicar"
  exit 0
fi

read -r -p "Publicar a versão de $TAG no servidor agora? O bot fica ~20 s fora. [digite SIM] " ok
[ "$ok" = "SIM" ] || { echo "Cancelado."; exit 1; }
bash infra/bot/publicar-workflow.sh "$TMP"/*.json
echo "==> Workflows revertidos. Lembre de desligar o webhook no painel da Meta, se estiver ligado."
