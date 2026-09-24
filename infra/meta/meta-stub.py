#!/usr/bin/env python3
"""WhatsApp Cloud API de mentira, para testar o workflow da Meta no Mac sem conta na Meta.

Imita as rotas que o bot usa e RECUSA (400/401) o que a Meta real recusaria, para o teste pegar
envelope errado em vez de aceitar qualquer coisa:

  POST /{versão}/{phone_number_id}/messages   texto, documento, "marcar como lida"
  GET  /{versão}/{media_id}                   devolve a URL temporária da mídia
  GET  /arquivos/{media_id}                   o arquivo (exige o token, como a Meta)
  POST /{versão}/{phone_number_id}/media      upload de arquivo (multipart)

Tudo que o bot tentou enviar vai para STUB_LOG (padrão /saida/respostas-meta.log).
Mídias recebidas de teste: coloque o arquivo em STUB_MIDIA/<media_id> (padrão /midia).
"""
import datetime
import json
import os
import re
from http.server import BaseHTTPRequestHandler, HTTPServer

LOG = os.environ.get("STUB_LOG", "/saida/respostas-meta.log")
MIDIA = os.environ.get("STUB_MIDIA", "/midia")
TOKEN = os.environ.get("STUB_TOKEN", "token-local-de-teste")
PHONE_ID = os.environ.get("STUB_PHONE_ID", "100000000000001")
BASE = os.environ.get("STUB_BASE_URL", "http://meta-stub:8080")
MIMES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".pdf": "application/pdf",
         ".ogg": "audio/ogg", ".m4a": "audio/mp4"}


def agora():
    return datetime.datetime.now().strftime("%H:%M:%S")


def registra(linha):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(linha)
    print(linha.strip().splitlines()[0], flush=True)


def arquivo_da_midia(media_id):
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,80}", media_id or ""):
        return None
    for nome in os.listdir(MIDIA) if os.path.isdir(MIDIA) else []:
        if nome == media_id or os.path.splitext(nome)[0] == media_id:
            return os.path.join(MIDIA, nome)
    return None


class H(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _erro(self, code, msg, codigo_meta=100):
        registra(f"=== {agora()} RECUSADO {code}: {msg}\n\n")
        return self._json(code, {"error": {"message": msg, "type": "OAuthException", "code": codigo_meta}})

    def _autorizado(self):
        return self.headers.get("Authorization", "") == f"Bearer {TOKEN}"

    def do_GET(self):
        if not self._autorizado():
            return self._erro(401, "token ausente ou inválido", 190)
        m = re.fullmatch(r"/arquivos/([^/?]+)", self.path)
        if m:
            caminho = arquivo_da_midia(m.group(1))
            if not caminho:
                return self._erro(404, "mídia não encontrada")
            dados = open(caminho, "rb").read()
            self.send_response(200)
            self.send_header("Content-Type", MIMES.get(os.path.splitext(caminho)[1], "application/octet-stream"))
            self.send_header("Content-Length", str(len(dados)))
            self.end_headers()
            return self.wfile.write(dados)
        m = re.fullmatch(r"/v\d+\.\d+/([^/?]+)", self.path)
        if m:
            caminho = arquivo_da_midia(m.group(1))
            if not caminho:
                return self._erro(404, "media_id desconhecido")
            tamanho = os.path.getsize(caminho)
            if os.path.basename(caminho).startswith("grande"):
                tamanho = 20 * 1024 * 1024  # simula arquivo acima do limite
            return self._json(200, {"messaging_product": "whatsapp", "id": m.group(1),
                                    "url": f"{BASE}/arquivos/{m.group(1)}", "file_size": tamanho,
                                    "mime_type": MIMES.get(os.path.splitext(caminho)[1], "application/octet-stream"),
                                    "sha256": "stub"})
        return self._erro(404, "rota desconhecida no simulador: " + self.path)

    def do_POST(self):
        if not self._autorizado():
            return self._erro(401, "token ausente ou inválido", 190)
        n = int(self.headers.get("Content-Length") or 0)
        cru = self.rfile.read(n)
        m = re.fullmatch(r"/v\d+\.\d+/([^/?]+)/(messages|media)", self.path)
        if not m:
            return self._erro(404, "rota desconhecida no simulador: " + self.path)
        if m.group(1) != PHONE_ID:
            return self._erro(400, f"phone_number_id errado: {m.group(1)}")

        if m.group(2) == "media":
            tipo = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in tipo or b'name="messaging_product"' not in cru or b'name="file"' not in cru:
                return self._erro(400, "upload precisa ser multipart com messaging_product e file")
            if b"%PDF" not in cru:
                return self._erro(400, "o arquivo enviado não é um PDF")
            mid = "MEDIASTUB" + agora().replace(":", "")
            registra(f"=== {agora()} UPLOAD de mídia ({n} bytes) -> id {mid}\n\n")
            return self._json(200, {"id": mid})

        try:
            b = json.loads(cru or b"{}")
        except Exception:
            return self._erro(400, "corpo não é JSON")
        if b.get("messaging_product") != "whatsapp":
            return self._erro(400, "messaging_product precisa ser 'whatsapp'")
        if b.get("status") == "read":
            if not b.get("message_id"):
                return self._erro(400, "marcar como lida sem message_id")
            registra(f"=== {agora()} LIDA {b['message_id']}\n\n")
            return self._json(200, {"success": True})
        para, tipo = b.get("to"), b.get("type")
        if not para:
            return self._erro(400, "falta o destinatário (to)")
        if tipo == "text":
            corpo = (b.get("text") or {}).get("body")
            if not isinstance(corpo, str) or not corpo.strip():
                return self._erro(400, "text.body vazio")
            if len(corpo) > 4096:
                return self._erro(400, f"text.body passa de 4096 caracteres ({len(corpo)})")
            registra(f"=== {agora()} -> {para}\n{corpo}\n\n")
        elif tipo == "document":
            doc = b.get("document") or {}
            if not (doc.get("id") or doc.get("link")):
                return self._erro(400, "document sem id nem link")
            registra(f"=== {agora()} -> {para} (DOCUMENTO: {doc.get('filename')} | {doc.get('caption', '')[:80]})\n\n")
        else:
            return self._erro(400, f"tipo não suportado pelo simulador: {tipo}")
        return self._json(200, {"messaging_product": "whatsapp", "contacts": [{"input": para, "wa_id": para}],
                                "messages": [{"id": "wamid.STUB" + agora().replace(":", "")}]})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"meta-stub ouvindo em :8080 (phone_id {PHONE_ID})", flush=True)
    HTTPServer(("0.0.0.0", 8080), H).serve_forever()
