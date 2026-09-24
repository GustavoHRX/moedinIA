#!/usr/bin/env python3
"""Faz o papel da Meta contra o n8n LOCAL: monta o webhook no formato da Cloud API, assina com
HMAC-SHA256 e mostra o que o bot respondeu (lido de n8n/files/respostas-meta.log, gravado pelo simulador).

  python3 infra/meta/testar-meta-local.py texto "quanto gastei esse mês?"
  python3 infra/meta/testar-meta-local.py texto "oi" 5511900000000        (outro remetente)
  python3 infra/meta/testar-meta-local.py midia img-logo imagem "o que é isso?"
  python3 infra/meta/testar-meta-local.py status                           (recibo "entregue")
  python3 infra/meta/testar-meta-local.py sem-assinatura | assinatura-errada | corpo-alterado
  python3 infra/meta/testar-meta-local.py verificar ok | verificar errado

Os segredos são os FALSOS de infra/meta/docker-compose.teste-meta.yml. Nada sai para a internet.
Atenção: o banco é o Supabase de PRODUÇÃO (ver memória teste-local-bot-stub-evolution) —
consulta é inofensiva; lançamento de teste precisa ser apagado depois.
"""
import hashlib
import hmac
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

N8N = "http://localhost:5678/webhook/moedin-meta"
SEGREDO = b"segredo-local-de-teste"
VERIFY = "verificar-local-de-teste"
PHONE_ID = "100000000000001"
LOG = Path(__file__).resolve().parents[2] / "n8n/files/respostas-meta.log"
WA_PADRAO = "5519998804130"


def envelope(valor):
    return {"object": "whatsapp_business_account", "entry": [{"id": "WABA-TESTE", "changes": [{"field": "messages", "value": {
        "messaging_product": "whatsapp",
        "metadata": {"display_phone_number": "15551660074", "phone_number_id": PHONE_ID}, **valor}}]}]}


def mensagem(wa, tipo, conteudo):
    mid = f"wamid.LOCAL{int(time.time() * 1000)}"
    return envelope({"contacts": [{"profile": {"name": "João Lucas"}, "wa_id": wa}],
                     "messages": [{"from": wa, "id": mid, "timestamp": str(int(time.time())), "type": tipo, tipo: conteudo}]})


def post(corpo_bytes, assinatura):
    req = urllib.request.Request(N8N, data=corpo_bytes, method="POST", headers={"Content-Type": "application/json"})
    if assinatura is not None:
        req.add_header("X-Hub-Signature-256", assinatura)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def assina(b):
    return "sha256=" + hmac.new(SEGREDO, b, hashlib.sha256).hexdigest()


def espera_resposta(antes, segundos=150):
    # Espera um ENVIO (" -> ") ou uma recusa do simulador — o "LIDA" chega antes do agente responder.
    for _ in range(segundos):
        novo = LOG.read_bytes()[antes:].decode("utf-8", "replace") if LOG.exists() else ""
        if " -> " in novo or "RECUSADO" in novo:
            time.sleep(2)
            print(LOG.read_bytes()[antes:].decode("utf-8", "replace"))
            return True
        time.sleep(1)
    print(f"(sem nada no simulador em {segundos} s — veja: docker logs moedin_n8n --tail=40)")
    return False


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    cmd, args = sys.argv[1], sys.argv[2:]
    antes = LOG.stat().st_size if LOG.exists() else 0

    if cmd == "verificar":
        token = VERIFY if (args[:1] or ["ok"])[0] == "ok" else "token-errado"
        url = f"{N8N}?hub.mode=subscribe&hub.verify_token={token}&hub.challenge=1234567890"
        try:
            with urllib.request.urlopen(url, timeout=15) as r:
                print("HTTP", r.status, "| corpo:", r.read().decode())
        except urllib.error.HTTPError as e:
            print("HTTP", e.code, "| corpo:", e.read().decode())
        return

    if cmd == "status":
        corpo = envelope({"statuses": [{"id": "wamid.X", "status": "delivered", "timestamp": str(int(time.time())),
                                        "recipient_id": WA_PADRAO}]})
    elif cmd == "texto":
        corpo = mensagem(args[1] if len(args) > 1 else WA_PADRAO, "text", {"body": args[0]})
    elif cmd == "midia":
        media_id, tipo = args[0], args[1]
        legenda = args[2] if len(args) > 2 else ""
        chave = {"imagem": "image", "audio": "audio", "pdf": "document"}[tipo]
        conteudo = {"id": media_id, "mime_type": {"image": "image/png", "audio": "audio/ogg", "document": "application/pdf"}[chave]}
        if legenda and chave != "audio":
            conteudo["caption"] = legenda
        if chave == "document":
            conteudo["filename"] = media_id + ".pdf"
        corpo = mensagem(WA_PADRAO, chave, conteudo)
    elif cmd in ("sem-assinatura", "assinatura-errada", "corpo-alterado"):
        corpo = mensagem(WA_PADRAO, "text", {"body": "teste de segurança: isto NÃO pode ser processado"})
    else:
        print(__doc__); sys.exit(1)

    b = json.dumps(corpo, ensure_ascii=False).encode()
    if cmd == "sem-assinatura":
        codigo, resp = post(b, None)
    elif cmd == "assinatura-errada":
        codigo, resp = post(b, "sha256=" + "0" * 64)
    elif cmd == "corpo-alterado":
        codigo, resp = post(b.replace("NÃO".encode(), "SIM".encode()), assina(b))
    else:
        codigo, resp = post(b, assina(b))
    print("HTTP", codigo, "|", resp[:200])

    if cmd in ("texto", "midia"):
        espera_resposta(antes)
    else:
        time.sleep(8)
        novo = LOG.read_bytes()[antes:].decode("utf-8", "replace") if LOG.exists() else ""
        print("simulador recebeu:", repr(novo) if novo else "NADA (esperado)")


if __name__ == "__main__":
    main()
