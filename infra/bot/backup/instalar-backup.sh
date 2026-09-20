#!/usr/bin/env bash
# RODE NO MAC, UMA VEZ (é idempotente: pode rodar de novo). Liga o backup do home lab:
#   1. cria a chave gpg "moedin-backup" no Mac (a PRIVADA fica só aqui) e instala a PÚBLICA no servidor
#   2. instala o script de backup no servidor e o agenda no cron às 03:30
#   3. instala os scripts do Mac em ~/.moedin-backup e agenda o launchd às 20:00
#      (cópia fora de Desktop/Documents: o launchd não tem permissão de ler essas pastas)
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
ALVO="${HOMELAB:-docker@192.168.3.204}"; CHAVE="${HOMELAB_KEY:-$HOME/.ssh/moedin-homelab}"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=10 -i "$CHAVE" "$ALVO")

echo "==> 1/4  Chave gpg"
if ! gpg --list-keys moedin-backup >/dev/null 2>&1; then
  gpg --batch --passphrase '' --quick-generate-key "moedin-backup" rsa4096 encr never
fi
FPR=$(gpg --list-keys --with-colons moedin-backup | awk -F: '/^fpr/ {print $10; exit}')
echo "    fingerprint: $FPR"
gpg --export "$FPR" | "${SSH[@]}" 'gpg --batch --import 2>&1 | tail -1'

echo "==> 2/4  Script e cron no servidor"
"${SSH[@]}" 'mkdir -p ~/backup ~/backups'
scp -q -o BatchMode=yes -i "$CHAVE" "$AQUI/backup-servidor.sh" "$ALVO:backup/backup.sh"
"${SSH[@]}" 'chmod 700 ~/backup/backup.sh; (crontab -l 2>/dev/null | grep -v "backup/backup.sh"; echo "30 3 * * * $HOME/backup/backup.sh >> $HOME/backups/backup.log 2>&1") | crontab - && crontab -l | grep backup'

echo "==> 3/4  Scripts do Mac"
mkdir -p "$HOME/.moedin-backup" "$HOME/Backups/moedin-homelab"
cp "$AQUI/puxar-backup.sh" "$AQUI/restaurar-teste.sh" "$HOME/.moedin-backup/"; chmod +x "$HOME/.moedin-backup/"*.sh

echo "==> 4/4  launchd às 20:00"
PLIST="$HOME/Library/LaunchAgents/com.moedin.backup.plist"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.moedin.backup</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$HOME/.moedin-backup/puxar-backup.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>20</integer><key>Minute</key><integer>0</integer></dict>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StandardOutPath</key><string>$HOME/Backups/moedin-homelab/launchd.out</string>
  <key>StandardErrorPath</key><string>$HOME/Backups/moedin-homelab/launchd.err</string>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/com.moedin.backup" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl print "gui/$(id -u)/com.moedin.backup" | grep -E "state|hour|minute|program" | head -5
echo; echo "Pronto. Backups em ~/Backups/moedin-homelab. Teste agora com:  bash ~/.moedin-backup/puxar-backup.sh"
echo "GUARDE UMA CÓPIA DA CHAVE PRIVADA fora deste Mac (sem ela, os backups não abrem se o Mac morrer):"
echo "  gpg --export-secret-keys --armor moedin-backup > moedin-backup-CHAVE-PRIVADA.asc"
