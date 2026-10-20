#!/usr/bin/env python3
"""Evolution API de mentira, para testar o bot no Mac sem tocar no WhatsApp real.

Responde o suficiente para o workflow do agente rodar (sendText, markMessageAsRead,
sendPresence, connectionState) e ESCREVE em /saida/respostas.log tudo que o bot
tentou enviar. Nada sai para a internet.

Mídia: getBase64FromMediaMessage devolve o arquivo /saida/midia-teste/<nome> quando o
id da mensagem é "MIDIA-<nome>" (é o que infra/bot/testar-midia-local.sh manda).
"""
import base64, json, mimetypes, os, datetime

mimetypes.add_type("audio/ogg", ".ogg"); mimetypes.add_type("audio/ogg", ".opus"); mimetypes.add_type("audio/mp4", ".m4a")
from http.server import BaseHTTPRequestHandler, HTTPServer

LOG = os.environ.get("STUB_LOG", "/saida/respostas.log")

class H(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if "/instance/connectionState/" in self.path:
            return self._json(200, {"instance": {"state": "open"}})
        return self._json(200, {"ok": True})

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            body = {}
        agora = datetime.datetime.now().strftime("%H:%M:%S")
        if "/message/sendText/" in self.path:
            texto = body.get("text") or body.get("textMessage", {}).get("text") or ""
            with open(LOG, "a", encoding="utf-8") as f:
                f.write("=== %s -> %s\n%s\n\n" % (agora, body.get("number", "?"), texto))
            print("[%s] sendText (%d chars)" % (agora, len(texto)), flush=True)
            return self._json(201, {"key": {"id": "STUB" + agora.replace(":", "")}, "status": "PENDING"})
        if "/chat/getBase64FromMediaMessage/" in self.path:
            msg_id = str(((body.get("message") or {}).get("key") or {}).get("id") or "")
            nome = os.path.basename(msg_id[len("MIDIA-"):]) if msg_id.startswith("MIDIA-") else ""
            arq = os.path.join(os.path.dirname(LOG), "midia-teste", nome)
            if not nome or not os.path.isfile(arq):
                return self._json(404, {"error": "midia de teste nao encontrada: " + nome})
            mime = mimetypes.guess_type(arq)[0] or "application/octet-stream"
            with open(arq, "rb") as f:
                dados = base64.b64encode(f.read()).decode()
            print("[%s] getBase64 %s (%s)" % (agora, nome, mime), flush=True)
            return self._json(201, {"base64": dados, "mimetype": mime, "fileName": nome})
        if "/message/sendMedia/" in self.path or "/sendWhatsAppAudio/" in self.path:
            with open(LOG, "a", encoding="utf-8") as f:
                f.write("=== %s -> %s (MÍDIA: %s)\n\n" % (agora, body.get("number", "?"), body.get("fileName", "arquivo")))
            print("[%s] sendMedia" % agora, flush=True)
            return self._json(201, {"key": {"id": "STUBMEDIA"}})
        print("[%s] %s" % (agora, self.path), flush=True)
        return self._json(200, {"ok": True})

    def log_message(self, *a):
        pass

if __name__ == "__main__":
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    print("Evolution FALSA ouvindo na 8080; log em", LOG, flush=True)
    HTTPServer(("0.0.0.0", 8080), H).serve_forever()
