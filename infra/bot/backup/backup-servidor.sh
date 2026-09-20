#!/usr/bin/env bash
# Backup do bot do Moedin.IA. RODA NO SERVIDOR (home lab). Agendado no cron às 03:30 e
# disparado também pelo Mac às 20h (puxar-backup.sh), para a cópia do dia ser fresca.
#
# Gera ~/backups/moedin-AAAAMMDD-HHMM.tar.gz.gpg contendo:
#   evolution.sql.gz  banco da Evolution (inclui a sessão do WhatsApp)  [pg_dump, consistente]
#   n8n/              workflows e credenciais (export) + cópia do SQLite do n8n
#   stack/            .env e docker-compose.yml (o .env tem a N8N_ENCRYPTION_KEY)
#   MANIFESTO.txt     data, versões, tamanhos e sha256 de cada peça
#
# CRIPTOGRAFIA: chave PÚBLICA (gpg). O servidor só consegue CRIAR backups; abrir exige a chave
# privada, que vive só no Mac. Se o servidor for invadido, os backups antigos continuam fechados.
#
# n8n: o SQLite é copiado com o container PAUSADO (~2 s), o que dá um retrato consistente para
# o SQLite se recuperar (é o mesmo estado de uma queda de energia). O trap SEMPRE despausa.
set -euo pipefail
umask 077

STACK="${STACK:-$HOME/stack}"
DEST="${DEST:-$HOME/backups}"
GUARDAR="${GUARDAR:-7}"
DESTINATARIO="${DESTINATARIO:-moedin-backup}"
N8N=stack-n8n-1
PG=stack-postgres-1

mkdir -p "$DEST"
CARIMBO=$(date +%Y%m%d-%H%M)
TRAB=$(mktemp -d)
despausar() { docker unpause "$N8N" >/dev/null 2>&1 || true; rm -rf "$TRAB"; }
trap despausar EXIT
log() { echo "$(date '+%F %T') $*"; }

log "início ($CARIMBO)"
gpg --list-keys "$DESTINATARIO" >/dev/null 2>&1 || { log "ERRO: chave pública '$DESTINATARIO' não está no gpg deste servidor"; exit 1; }

# 1) banco da Evolution
docker exec "$PG" pg_dump -U evolution -d evolution --no-owner | gzip > "$TRAB/evolution.sql.gz"
[ "$(gzip -dc "$TRAB/evolution.sql.gz" | grep -c 'CREATE TABLE')" -gt 5 ] || { log "ERRO: dump do Postgres parece vazio"; exit 1; }

# 2) n8n: exports (não param nada) e depois o SQLite com o container pausado
mkdir -p "$TRAB/n8n"
docker exec "$N8N" n8n export:workflow --all --output=/tmp/bk-wf.json >/dev/null 2>&1
docker exec "$N8N" n8n export:credentials --all --output=/tmp/bk-cr.json >/dev/null 2>&1   # continuam cifradas
docker cp "$N8N:/tmp/bk-wf.json" "$TRAB/n8n/workflows.json"
docker cp "$N8N:/tmp/bk-cr.json" "$TRAB/n8n/credentials.cifradas.json"
docker exec "$N8N" rm -f /tmp/bk-wf.json /tmp/bk-cr.json
docker pause "$N8N" >/dev/null
for f in database.sqlite database.sqlite-wal database.sqlite-shm config; do
  docker cp "$N8N:/home/node/.n8n/$f" "$TRAB/n8n/$f" >/dev/null 2>&1 || true
done
docker unpause "$N8N" >/dev/null
[ -s "$TRAB/n8n/database.sqlite" ] || { log "ERRO: não copiei o database.sqlite do n8n"; exit 1; }

# 3) configuração do stack
mkdir -p "$TRAB/stack"
cp -a "$STACK/.env" "$STACK/docker-compose.yml" "$TRAB/stack/"

# 4) manifesto
{
  echo "backup: $CARIMBO"
  echo "servidor: $(hostname)"
  echo "n8n: $(docker exec "$N8N" n8n --version 2>/dev/null)"
  echo "workflows exportados: $(python3 -c "import json;print(len(json.load(open('$TRAB/n8n/workflows.json'))))")"
  echo "instância Evolution no dump: $(gzip -dc "$TRAB/evolution.sql.gz" | grep -c '^COPY public."Instance"')"
  echo; echo "sha256:"; (cd "$TRAB" && find . -type f ! -name MANIFESTO.txt | sort | xargs sha256sum)
} > "$TRAB/MANIFESTO.txt"

# 5) empacota e criptografa com a chave pública
SAIDA="$DEST/moedin-$CARIMBO.tar.gz.gpg"
tar -C "$TRAB" -czf - . | gpg --batch --yes --trust-model always -r "$DESTINATARIO" -o "$SAIDA.parcial" -e
mv "$SAIDA.parcial" "$SAIDA"
( cd "$DEST" && sha256sum "$(basename "$SAIDA")" > "$(basename "$SAIDA").sha256" )
[ -s "$SAIDA" ] || { log "ERRO: arquivo final vazio"; exit 1; }

# 6) retenção: mantém os últimos $GUARDAR
ls -1t "$DEST"/moedin-*.tar.gz.gpg 2>/dev/null | tail -n +$((GUARDAR + 1)) | while read -r velho; do rm -f "$velho" "$velho.sha256"; done

log "ok: $(basename "$SAIDA") ($(du -h "$SAIDA" | cut -f1)); guardados: $(ls -1 "$DEST"/moedin-*.tar.gz.gpg | wc -l)"
