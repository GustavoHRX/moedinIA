#!/usr/bin/env bash
# Empacota o bot (n8n + Evolution) para subir num servidor.
# RODE ESTE AQUI NO MAC, na raiz do projeto:
#   bash infra/bot/empacotar.sh
#
# Gera ~/moedin-bot-AAAAMMDD-HHMM.tar.gz com tudo que o servidor precisa.
#
# Dois cuidados que o script já toma por você:
#  1. Para o n8n antes de copiar o banco. O SQLite dele corrompe quando é
#     copiado enquanto está sendo escrito — foi assim que o banco quebrou em
#     08/09/2026.
#  2. Usa pg_dump na base da Evolution em vez de copiar a pasta de dados. O Mac
#     é ARM e a maioria das VPS é x86; pasta de dados do Postgres não é
#     portátil entre arquiteturas, mas um dump é.
set -euo pipefail

cd "$(dirname "$0")/../.."
RAIZ="$PWD"
[ -f "$RAIZ/docker-compose.yml" ] || { echo "Rode a partir da raiz do projeto."; exit 1; }
[ -f "$RAIZ/.env" ] || { echo "Não achei o .env na raiz."; exit 1; }

CARIMBO="$(date +%Y%m%d-%H%M)"
PACOTE="$HOME/moedin-bot-$CARIMBO.tar.gz"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
DESTINO="$TMP/moedin-bot"
mkdir -p "$DESTINO/n8n"

echo "==> 1/5  Parando o n8n (o SQLite não pode ser copiado em uso)"
docker compose stop n8n >/dev/null 2>&1 || true

echo "==> 2/5  Copiando o banco e os workflows do n8n"
cp -R "$RAIZ/n8n/data" "$DESTINO/n8n/data"
# Resíduos de sessão anterior: não servem no servidor e podem confundir.
rm -f "$DESTINO/n8n/data"/database.sqlite-wal "$DESTINO/n8n/data"/database.sqlite-shm \
      "$DESTINO/n8n/data"/crash.journal 2>/dev/null || true
rm -rf "$DESTINO/n8n/data"/backup-corrompido-* 2>/dev/null || true
mkdir -p "$DESTINO/n8n/workflow" "$DESTINO/n8n/files"
cp "$RAIZ"/n8n/workflow/*.json "$DESTINO/n8n/workflow/" 2>/dev/null || true

echo "==> 3/5  Exportando a base da Evolution (preserva a sessão do WhatsApp)"
docker compose up -d evolution_db >/dev/null 2>&1 || true
sleep 3
docker exec moedin_evolution_db pg_dump -U evolution --clean --if-exists evolution \
  > "$DESTINO/evolution.sql"
echo "    $(wc -l < "$DESTINO/evolution.sql") linhas exportadas"

echo "==> 4/5  Montando o .env do servidor (só as chaves que o bot usa)"
set -a; . "$RAIZ/.env"; set +a
cat > "$DESTINO/.env" <<EOF
# Gerado por infra/bot/empacotar.sh em $CARIMBO.
# NÃO comite este arquivo. Contém segredos.

# Precisa ser exatamente esta, senão as credenciais salvas no n8n não abrem.
N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
DEFAULT_TIMEZONE=${DEFAULT_TIMEZONE:-America/Sao_Paulo}

SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

EVOLUTION_API_KEY=${EVOLUTION_API_KEY}
EVOLUTION_INSTANCE=${EVOLUTION_INSTANCE}
EVOLUTION_WA_VERSION=${EVOLUTION_WA_VERSION:-2.3000.1023204200}
EVOLUTION_INSTANCE_TOKEN=${EVOLUTION_INSTANCE_TOKEN:-}
WHATSAPP_WEBHOOK_TOKEN=${WHATSAPP_WEBHOOK_TOKEN}

OPENAI_API_KEY=${OPENAI_API_KEY}
OPENAI_MODEL=${OPENAI_MODEL:-gpt-5.4-mini}

N8N_ALERT_WA_ID=${N8N_ALERT_WA_ID:-}
MOEDIN_APP_URL=${MOEDIN_APP_URL:-https://moedin-ia.vercel.app}
EOF
chmod 600 "$DESTINO/.env"

cp "$RAIZ/infra/bot/docker-compose.yml" "$DESTINO/docker-compose.yml"
cp "$RAIZ/infra/bot/restaurar.sh" "$DESTINO/restaurar.sh"
cp "$RAIZ/infra/bot/README.md" "$DESTINO/README.md"

echo "==> 5/5  Fechando o pacote e religando o n8n local"
tar -czf "$PACOTE" -C "$TMP" moedin-bot
docker compose up -d n8n >/dev/null 2>&1 || true

echo
echo "Pronto: $PACOTE  ($(du -h "$PACOTE" | cut -f1))"
echo
echo "Agora, da sua máquina:"
echo "  scp $PACOTE usuario@SEU_SERVIDOR:~/"
echo "  ssh usuario@SEU_SERVIDOR"
echo "  tar -xzf moedin-bot-$CARIMBO.tar.gz && cd moedin-bot && bash restaurar.sh"
echo
echo "ATENÇÃO: o pacote tem segredos (service role do Supabase, chave da OpenAI)."
echo "Apague depois de usar:  rm $PACOTE"
