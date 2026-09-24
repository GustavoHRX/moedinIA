#!/usr/bin/env bash
# RODA NO MAC (agendado pelo launchd às 20h). Pede um backup fresco ao servidor e traz as cópias
# para ~/Backups/moedin-homelab, conferindo o sha256 de cada uma. Guarda as últimas 14.
# Se falhar, mostra uma notificação. Se o Mac estava dormindo às 20h, o launchd roda ao acordar;
# se estava DESLIGADO, não roda: por isso o servidor também faz o seu próprio backup às 03:30.
set -uo pipefail
CHAVE="${HOMELAB_KEY:-$HOME/.ssh/moedin-homelab}"
DEST="${BACKUP_DEST:-$HOME/Backups/moedin-homelab}"
GUARDAR="${GUARDAR:-14}"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=15 -i "$CHAVE")
mkdir -p "$DEST"; LOG="$DEST/puxar.log"
log() { echo "$(date '+%F %T') $*" | tee -a "$LOG"; }
falha() { log "FALHA: $*"; osascript -e "display notification \"$*\" with title \"Backup do Moedin.IA falhou\"" 2>/dev/null || true; exit 1; }

log "início"

# Qual endereço usar. Até 24/09/2026 era fixo no IP da rede de casa, e o backup falhou 4 dias seguidos
# (20 a 23/09) com o Mac fora de casa. Agora tenta o Tailscale (funciona de qualquer rede) e cai no IP
# local. HOMELAB=... força um endereço.
if [ -n "${HOMELAB:-}" ]; then
  ALVO="$HOMELAB"
else
  ALVO=""
  for c in docker@100.76.253.59 docker@192.168.3.204; do
    if ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$CHAVE" "$c" true 2>/dev/null; then ALVO="$c"; break; fi
  done
  [ -n "$ALVO" ] || falha "servidor inalcançável pelo Tailscale e pela rede de casa (o Tailscale do Mac está ligado?)"
fi
log "servidor: $ALVO"
"${SSH[@]}" "$ALVO" 'bash ~/backup/backup.sh' >>"$LOG" 2>&1 || log "aviso: não consegui gerar backup novo agora; vou trazer os que existem"
rsync -a --ignore-existing -e "ssh -o BatchMode=yes -o ConnectTimeout=15 -i $CHAVE" \
  --include='moedin-*.tar.gz.gpg' --include='moedin-*.tar.gz.gpg.sha256' --exclude='*' \
  "$ALVO:backups/" "$DEST/" >>"$LOG" 2>&1 || falha "rsync não conseguiu buscar do servidor"

( cd "$DEST" && for h in moedin-*.sha256; do [ -e "$h" ] && shasum -a 256 -c "$h" >/dev/null 2>&1 || { echo "sha256 ruim: $h"; exit 1; }; done ) >>"$LOG" 2>&1 \
  || falha "conferência sha256 falhou (arquivo corrompido na cópia)"

ls -1t "$DEST"/moedin-*.tar.gz.gpg 2>/dev/null | tail -n +$((GUARDAR + 1)) | while read -r velho; do rm -f "$velho" "$velho.sha256"; done
MAIS_NOVO=$(ls -1t "$DEST"/moedin-*.tar.gz.gpg 2>/dev/null | head -1)
[ -n "$MAIS_NOVO" ] || falha "nenhum backup encontrado"
date '+%F %T' > "$DEST/ULTIMO_SUCESSO.txt"
log "ok: mais novo = $(basename "$MAIS_NOVO") ($(du -h "$MAIS_NOVO" | cut -f1)); total local: $(ls -1 "$DEST"/moedin-*.tar.gz.gpg | wc -l)"
