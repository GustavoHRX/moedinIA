#!/usr/bin/env bash
# RODA NO MAC. Abre um backup e PROVA que ele serve, sem tocar em nada do servidor nem do bot:
#   - descriptografa com a chave privada do Mac
#   - restaura o banco da Evolution num Postgres descartável (container temporário) e conta as tabelas da sessão
#   - abre o SQLite do n8n e roda o integrity_check
#   - confere os exports (workflows e credenciais) e os NOMES das variáveis do .env (nunca os valores)
# Uso: bash restaurar-teste.sh [arquivo.tar.gz.gpg]     (sem argumento, usa o mais novo)
set -uo pipefail
DEST="${BACKUP_DEST:-$HOME/Backups/moedin-homelab}"
ARQ="${1:-$(ls -1t "$DEST"/moedin-*.tar.gz.gpg 2>/dev/null | head -1)}"
[ -n "$ARQ" ] && [ -f "$ARQ" ] || { echo "Nenhum backup encontrado em $DEST"; exit 1; }
TRAB=$(mktemp -d); CT=moedin-restore-teste
limpar() { docker rm -f "$CT" >/dev/null 2>&1 || true; rm -rf "$TRAB"; }
trap limpar EXIT
ok() { echo "  ✔ $*"; }; ruim() { echo "  ✘ $*"; FALHOU=1; }; FALHOU=0

echo "== Backup: $(basename "$ARQ") ($(du -h "$ARQ" | cut -f1))"
gpg --batch --quiet -d "$ARQ" 2>"$TRAB/gpg.err" | tar -xz -C "$TRAB" 2>>"$TRAB/gpg.err" || { echo "  ✘ não consegui descriptografar/abrir:"; cat "$TRAB/gpg.err"; exit 1; }
ok "descriptografou com a chave privada e abriu o pacote"
sed -n '1,5p' "$TRAB/MANIFESTO.txt" | sed 's/^/     /'

echo "== Integridade das peças (sha256 do manifesto)"
( cd "$TRAB" && sed -n '/^sha256:/,$p' MANIFESTO.txt | tail -n +2 | sha256sum -c - 2>&1 | grep -v ': OK$' ) | sed 's/^/     /' | grep . && ruim "alguma peça não confere" || ok "todas as peças conferem com o manifesto"

echo "== Banco da Evolution: restaurando num Postgres descartável"
docker run -d --rm --name "$CT" -e POSTGRES_PASSWORD=teste -e POSTGRES_USER=evolution -e POSTGRES_DB=evolution postgres:16-alpine >/dev/null 2>&1 || { ruim "não consegui subir o container de teste (Docker rodando?)"; }
for i in $(seq 1 30); do docker exec "$CT" pg_isready -U evolution >/dev/null 2>&1 && break; sleep 1; done
sleep 2
gzip -dc "$TRAB/evolution.sql.gz" | docker exec -i "$CT" psql -U evolution -d evolution -q -v ON_ERROR_STOP=0 >/dev/null 2>"$TRAB/pg.err"
for t in Instance Session Webhook Setting; do
  n=$(docker exec "$CT" psql -U evolution -d evolution -Atc "select count(*) from \"$t\"" 2>/dev/null)
  [ "${n:-0}" -ge 1 ] 2>/dev/null && ok "tabela $t restaurada ($n linha)" || ruim "tabela $t vazia ou ausente"
done
docker exec "$CT" psql -U evolution -d evolution -Atc 'select name||" -> "||"\"connectionStatus\" from \"Instance\"' 2>/dev/null | sed 's/^/     instância: /'
docker exec "$CT" psql -U evolution -d evolution -Atc 'select "sessionId" is not null and length(creds)>500 from "Session" limit 1' 2>/dev/null | grep -q t && ok "credenciais do WhatsApp presentes na Session" || ruim "credenciais do WhatsApp ausentes"

echo "== SQLite do n8n"
cp "$TRAB"/n8n/database.sqlite* "$TRAB"/ 2>/dev/null
r=$(sqlite3 "$TRAB/database.sqlite" 'pragma integrity_check' 2>&1 | head -1)
[ "$r" = "ok" ] && ok "integrity_check: ok" || ruim "integrity_check: $r"
echo "     workflows no banco: $(sqlite3 "$TRAB/database.sqlite" 'select count(*) from workflow_entity' 2>&1) | credenciais: $(sqlite3 "$TRAB/database.sqlite" 'select count(*) from credentials_entity' 2>&1) | usuários: $(sqlite3 "$TRAB/database.sqlite" 'select count(*) from user' 2>&1)"

echo "== Exports do n8n"
python3 - "$TRAB" <<'PY' || ruim "exports inválidos"
import json,sys
d=sys.argv[1]
w=json.load(open(d+'/n8n/workflows.json')); c=json.load(open(d+'/n8n/credentials.cifradas.json'))
ids=sorted(x['id'] for x in w)
print('  ✔ workflows.json:', len(w), 'workflows', ids)
print('  ✔ credentials.cifradas.json:', len(c), 'credenciais (cifradas; só abrem com a N8N_ENCRYPTION_KEY do .env do backup)')
assert len(w)>=3 and len(c)>=2
PY

echo "== .env do backup (só os NOMES das variáveis)"
for v in N8N_ENCRYPTION_KEY SUPABASE_SERVICE_ROLE_KEY EVOLUTION_API_KEY POSTGRES_PASSWORD WHATSAPP_WEBHOOK_TOKEN; do
  grep -q "^$v=." "$TRAB/stack/.env" && ok "$v presente" || ruim "$v AUSENTE"
done
echo; [ "$FALHOU" = 0 ] && echo "RESULTADO: backup restaurável ✔" || { echo "RESULTADO: há problemas ✘"; exit 1; }
