#!/usr/bin/env python3
"""Gera o workflow do bot para a WhatsApp Cloud API (Meta) a partir do agente atual.

    python3 infra/meta/gerar-workflow-meta.py

Lê  n8n/workflow/moedin-agente-v2.json  (o agente que roda na Evolution)
Grava n8n/workflow/moedin-agente-meta.json

Por que gerar em vez de copiar à mão: o "cérebro" (agente, ferramentas, prompt, Redis, RPCs) é um só.
Só as pontas mudam — como a mensagem entra, como a mídia é baixada, como a resposta sai. Quando o
agente mudar, rode este script de novo e as duas versões continuam iguais por dentro.

O que muda em relação ao agente da Evolution:
  - id, nome e webhook próprios (POST e GET em /webhook/moedin-meta). O workflow nasce DESATIVADO.
  - Entrada: assinatura X-Hub-Signature-256 (HMAC-SHA256 do corpo CRU com META_APP_SECRET), fail-closed.
  - GET de verificação da Meta (hub.challenge com META_VERIFY_TOKEN).
  - Responde 200 à Meta logo depois de validar a assinatura. Os "Responder ..." seguintes viram NoOp:
    a Meta reenvia webhook que demora ou volta erro, e isso faria o agente rodar duas vezes.
  - Normalizador lê o formato da Meta; webhooks de status (entregue/lido) são ignorados.
  - Mídia: id -> URL temporária -> download com o token (antes: base64 numa chamada só).
  - Envio: POST /{phone_number_id}/messages. PDF: upload para /media e envio por id.
  - Sem resumo semanal: na Meta ele seria template pago (decisão do João, 24/09/2026).

Variáveis de ambiente que o workflow lê (no servidor, no .env do stack):
  META_GRAPH_URL (padrão https://graph.facebook.com), META_GRAPH_VERSION (padrão v25.0),
  META_PHONE_NUMBER_ID, META_ACCESS_TOKEN, META_APP_SECRET, META_VERIFY_TOKEN.
"""
import copy
import json
import re
import uuid
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ORIGEM = RAIZ / "n8n/workflow/moedin-agente-v2.json"
DESTINO = RAIZ / "n8n/workflow/moedin-agente-meta.json"

WF_ID = "MoedinAgenteMeta"  # 16 caracteres, como os ids do n8n
WF_NOME = "Moedin.IA — Agente WhatsApp (Meta Cloud API)"
PATH = "moedin-meta"
NS = uuid.UUID("7d3b6a52-4e0c-4f1e-9a8e-6f0c2b9e1a11")  # ids estáveis entre execuções do gerador

GRAPH = "{{ ($env.META_GRAPH_URL || 'https://graph.facebook.com') }}/{{ $env.META_GRAPH_VERSION || 'v25.0' }}"
AUTH = [{"name": "Authorization", "value": "=Bearer {{ $env.META_ACCESS_TOKEN }}"},
        {"name": "Content-Type", "value": "application/json"}]
MAX_MIDIA = 15 * 1024 * 1024


def uid(nome: str) -> str:
    return str(uuid.uuid5(NS, nome))


wf = json.loads(ORIGEM.read_text())
nodes = {n["name"]: n for n in wf["nodes"]}
C = wf["connections"]


def no(nome, tipo, versao, params, pos, **extra):
    n = {"parameters": params, "id": uid(nome), "name": nome, "type": tipo, "typeVersion": versao, "position": pos}
    n.update(extra)
    return n


def liga(origem, *saidas):
    """saidas: lista (uma por saída do nó) de listas de nomes de destino."""
    C[origem] = {"main": [[{"node": d, "type": "main", "index": 0} for d in saida] for saida in saidas]}


def renomeia(antigo, novo):
    n = nodes.pop(antigo)
    n["name"] = novo
    nodes[novo] = n
    if antigo in C:
        C[novo] = C.pop(antigo)
    for v in C.values():
        for saida in v.get("main", []):
            for c in saida or []:
                if c["node"] == antigo:
                    c["node"] = novo
    for m in nodes.values():  # referências $('Nome') em expressões
        s = json.dumps(m["parameters"], ensure_ascii=False)
        if f"$('{antigo}')" in s:
            m["parameters"] = json.loads(s.replace(f"$('{antigo}')", f"$('{novo}')"))


def http(params_extra, url, metodo="POST"):
    p = {"method": metodo, "url": url, "sendHeaders": True, "headerParameters": {"parameters": copy.deepcopy(AUTH)}}
    p.update(params_extra)
    return p


# ---------------------------------------------------------------------------------------------
# 1. Entrada: webhook POST com corpo cru + verificação da assinatura
# ---------------------------------------------------------------------------------------------
wh = nodes["Webhook WhatsApp"]
wh["parameters"] = {"httpMethod": "POST", "path": PATH, "responseMode": "responseNode", "options": {"rawBody": True}}
wh["webhookId"] = uid("webhook-post")
x, y = wh["position"]

nodes["Guard: token do webhook"]["parameters"] = {"jsCode": r"""// Guard fail-closed da Meta. Sem META_APP_SECRET no ambiente, ou sem a assinatura certa, NADA passa.
// A assinatura (X-Hub-Signature-256) é o HMAC-SHA256 do CORPO CRU, byte a byte, com o app secret.
// Por isso o webhook guarda o corpo cru (opção rawBody): refazer o JSON a partir do objeto já lido
// mudaria espaços/escapes e a conta nunca bateria.
const item = $input.first();
const headers = item.json.headers || {};
const recebida = String(headers['x-hub-signature-256'] || '').trim().toLowerCase();
const calculada = 'sha256=' + String(item.json.assinatura_calculada || '').toLowerCase();
const segredo = String($env.META_APP_SECRET || '').trim();

// Comparação em tempo constante (não para no primeiro caractere diferente).
let diferenca = recebida.length ^ calculada.length;
for (let i = 0; i < calculada.length; i++) diferenca |= (recebida.charCodeAt(i) || 0) ^ calculada.charCodeAt(i);

const autorizado = segredo.length > 0 && recebida.length > 0 && diferenca === 0;
const { raw, assinatura_calculada, ...resto } = item.json;
return [{ json: { ...resto, autorizado } }];"""}
renomeia("Guard: token do webhook", "Guard: assinatura Meta")

corpo = no("Corpo cru (Meta)", "n8n-nodes-base.code", 2, {"jsCode": r"""// Lê o corpo cru que o webhook guardou em binário, para o HMAC ser calculado sobre os bytes originais.
const item = $input.first();
let raw = '';
try {
  raw = (await this.helpers.getBinaryDataBuffer(0, 'data')).toString('utf8');
} catch (e) {
  raw = ''; // sem corpo cru => assinatura não bate => 401
}
return [{ json: { ...item.json, raw } }];"""}, [x + 200, y - 120])
hmac = no("HMAC do corpo (Meta)", "n8n-nodes-base.crypto", 1, {
    "action": "hmac", "type": "SHA256", "value": "={{ $json.raw }}",
    "dataPropertyName": "assinatura_calculada", "secret": "={{ $env.META_APP_SECRET || '' }}", "encoding": "hex",
}, [x + 400, y - 120])
for n in (corpo, hmac):
    nodes[n["name"]] = n
liga("Webhook WhatsApp", ["Corpo cru (Meta)"])
liga("Corpo cru (Meta)", ["HMAC do corpo (Meta)"])
liga("HMAC do corpo (Meta)", ["Guard: assinatura Meta"])
nodes["Responder 401"]["parameters"]["responseBody"] = (
    "={{ JSON.stringify({ error: 'unauthorized', message: 'assinatura X-Hub-Signature-256 ausente ou inválida' }) }}")

# Responde 200 logo após validar: a Meta reenvia o que demora e o agente pode levar até 120 s.
ok200 = no("Responder 200 à Meta", "n8n-nodes-base.respondToWebhook", 1.1, {
    "respondWith": "json", "responseBody": "={{ JSON.stringify({ ok: true }) }}", "options": {"responseCode": 200}},
    [x + 800, y - 240])
nodes[ok200["name"]] = ok200
tv = C["Token válido?"]["main"]
liga("Token válido?", ["Responder 200 à Meta"], [c["node"] for c in tv[1]])
liga("Responder 200 à Meta", ["Normalizar payload"])

for n in list(nodes.values()):
    if n["type"].endswith("respondToWebhook") and n["name"] not in ("Responder 401", "Responder 200 à Meta"):
        n["type"], n["typeVersion"], n["parameters"] = "n8n-nodes-base.noOp", 1, {}
        n["notes"] = "Era 'Respond to Webhook'. Na Meta a resposta 200 já saiu no início (nó 'Responder 200 à Meta')."

# GET de verificação (a Meta chama uma vez, ao salvar a URL do webhook no painel)
gx, gy = x, y + 700
get_wh = no("Webhook verificação (GET)", "n8n-nodes-base.webhook", 2.1,
            {"httpMethod": "GET", "path": PATH, "responseMode": "responseNode", "options": {}},
            [gx, gy], webhookId=uid("webhook-get"))
get_code = no("Conferir verify token", "n8n-nodes-base.code", 2, {"jsCode": r"""// A Meta manda ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=... e espera o challenge de volta.
const q = $input.first().json.query || {};
const esperado = String($env.META_VERIFY_TOKEN || '').trim();
const ok = esperado.length > 0 && q['hub.mode'] === 'subscribe' && String(q['hub.verify_token'] || '') === esperado;
return [{ json: { ok, challenge: ok ? String(q['hub.challenge'] || '') : '' } }];"""}, [gx + 220, gy])
get_if = no("Verify token certo?", "n8n-nodes-base.if", 2.2, copy.deepcopy(nodes["Token válido?"]["parameters"]), [gx + 440, gy])
get_if["parameters"]["conditions"]["conditions"][0]["leftValue"] = "={{ $json.ok }}"
get_ok = no("Devolver challenge", "n8n-nodes-base.respondToWebhook", 1.1,
            {"respondWith": "text", "responseBody": "={{ $json.challenge }}", "options": {"responseCode": 200}}, [gx + 660, gy - 80])
get_no = no("Recusar verificação", "n8n-nodes-base.respondToWebhook", 1.1,
            {"respondWith": "text", "responseBody": "forbidden", "options": {"responseCode": 403}}, [gx + 660, gy + 80])
for n in (get_wh, get_code, get_if, get_ok, get_no):
    nodes[n["name"]] = n
liga(get_wh["name"], [get_code["name"]])
liga(get_code["name"], [get_if["name"]])
liga(get_if["name"], [get_ok["name"]], [get_no["name"]])

# ---------------------------------------------------------------------------------------------
# 2. Normalizador: formato da Meta -> o mesmo objeto interno que o agente já consome
# ---------------------------------------------------------------------------------------------
nodes["Normalizar payload"]["parameters"] = {"jsCode": r"""// Normaliza o webhook da WhatsApp Cloud API (Meta) no MESMO formato que a versão da Evolution produzia,
// para o resto do agente não saber de onde a mensagem veio.
// wa_id = telefone (dígitos) ou, para quem usa nome de usuário no WhatsApp, o BSUID (user_id) — desde
// abril/2026 o telefone pode não vir. O vínculo é por código de ativação, então qualquer id estável serve.
// Webhook de status (entregue/lido/falhou) e de outros números do mesmo app viram 'ignorar'.
const b = $input.first().json.body || {};
const value = b.entry?.[0]?.changes?.[0]?.value || {};
const m = value.messages?.[0] || {};
const contato = value.contacts?.[0] || {};
const nossoNumero = String(value.metadata?.phone_number_id || '');
const esperado = String($env.META_PHONE_NUMBER_ID || '');

const wa_id = String(m.from || contato.wa_id || contato.user_id || m.from_user_id || '').trim();
let tipo = 'outro', texto = '', mime = '', file_name = '', media_id = '';
switch (m.type) {
  case 'text': tipo = 'texto'; texto = m.text?.body || ''; break;
  case 'image': tipo = 'imagem'; texto = m.image?.caption || ''; mime = m.image?.mime_type || 'image/jpeg'; media_id = m.image?.id || ''; break;
  case 'audio': tipo = 'audio'; mime = m.audio?.mime_type || 'audio/ogg'; media_id = m.audio?.id || ''; break;
  case 'document':
    mime = m.document?.mime_type || ''; file_name = m.document?.filename || ''; texto = m.document?.caption || '';
    media_id = m.document?.id || '';
    tipo = (/pdf/i.test(mime) || /\.pdf$/i.test(file_name)) ? 'pdf' : 'outro';
    break;
  case 'button': tipo = 'texto'; texto = m.button?.text || ''; break;
  case 'interactive':
    tipo = 'texto'; texto = m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || ''; break;
  case 'reaction': case 'system': case 'unknown': case undefined: tipo = 'ignorar'; break;
  default: tipo = 'outro'; // sticker, location, contacts, video...
}
if (!value.messages || value.statuses || (esperado && nossoNumero && nossoNumero !== esperado)) tipo = 'ignorar';

texto = String(texto || '').trim().slice(0, 2000);
if (!/^[A-Za-z0-9._:-]{8,64}$/.test(wa_id) || !m.id) tipo = 'ignorar';
if (['imagem', 'audio', 'pdf'].includes(tipo) && !media_id) tipo = 'outro';

const tz = 'America/Sao_Paulo';
const now = new Date();
return [{ json: {
  wa_id, remote_jid: wa_id,
  from_me: false,      // a Cloud API só entrega mensagens recebidas
  is_group: false,
  nome: String(contato.profile?.name || '').trim() || 'Cliente',
  tipo, texto, mime, file_name, media_id, motivo: '', file_length: 0,
  msg_id: String(m.id || ''),
  hoje: now.toLocaleDateString('sv-SE', { timeZone: tz }),
  hoje_br: now.toLocaleDateString('pt-BR', { timeZone: tz }),
  dia_semana: now.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: tz }),
  hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz }),
} }];"""}

# ---------------------------------------------------------------------------------------------
# 3. Envio de texto: mesmo texto, outro envelope
# ---------------------------------------------------------------------------------------------
URL_MSG = "=" + GRAPH + "/{{ $env.META_PHONE_NUMBER_ID }}/messages"
PREFIXO = "JSON.stringify({ linkPreview: false, number: "
for nome in [n for n in nodes if "(Evolution)" in n]:
    n = nodes[nome]
    corpo_json = n["parameters"].get("jsonBody", "")
    if "/message/sendText/" not in n["parameters"].get("url", ""):
        continue
    assert corpo_json.count(PREFIXO) == 1 and corpo_json.rstrip().endswith("}) }}"), nome
    novo = corpo_json.replace(PREFIXO, "JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: ")
    i = novo.index(", text: ")
    novo = novo[:i] + ", type: 'text', text: { preview_url: false, body: " + novo[i + len(", text: "):]
    j = novo.rindex("})")
    novo = novo[:j] + "} })" + novo[j + 2:]
    n["parameters"] = http({"sendBody": True, "specifyBody": "json", "jsonBody": novo,
                            "options": n["parameters"].get("options", {})}, URL_MSG)
    renomeia(nome, nome.replace("(Evolution)", "(Meta)"))

# Marcar como lida
n = nodes["Marcar como lida (Evolution)"]
n["parameters"] = http({"sendBody": True, "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: $('Normalizar payload').first().json.msg_id }) }}",
    "options": {"timeout": 5000}}, URL_MSG)
renomeia("Marcar como lida (Evolution)", "Marcar como lida (Meta)")

# "Arquivo grande" agora é descoberto só ao consultar a mídia (a Meta não manda o tamanho no webhook)
nao_sup = nodes["Avisar tipo não suportado (Meta)"]["parameters"]
nao_sup["jsonBody"] = nao_sup["jsonBody"].replace(
    "$('Normalizar payload').first().json.motivo === 'grande'",
    "($('Normalizar payload').first().json.motivo === 'grande' || ($('Conferir mídia (Meta)').isExecuted && $('Conferir mídia (Meta)').first().json.grande === true))")

# ---------------------------------------------------------------------------------------------
# 4. Mídia recebida: id -> URL temporária -> arquivo -> base64 (o que os leitores já consomem)
# ---------------------------------------------------------------------------------------------
bm = nodes.pop("Baixar mídia (Evolution)")
bx, by = bm["position"]
saidas_bm = C.pop("Baixar mídia (Evolution)")["main"]  # [[Tipo de mídia], [Avisar erro]]
erro_dest = [c["node"] for c in saidas_bm[1]]
info = no("Info da mídia (Meta)", "n8n-nodes-base.httpRequest", 4.2,
          http({"options": {"timeout": 15000}}, "=" + GRAPH + "/{{ $('Normalizar payload').first().json.media_id }}", "GET"),
          [bx, by], onError="continueErrorOutput")
conferir = no("Conferir mídia (Meta)", "n8n-nodes-base.code", 2, {"jsCode": r"""// A URL que a Meta devolve vale ~5 min e exige o token. Antes de baixar:
//  - recusa arquivo acima de 15 MB (o webhook da Meta não traz o tamanho);
//  - só aceita URL do CDN da Meta (ou do simulador local), para o token nunca ir para outro lugar.
const r = $input.first().json;
const tamanho = Number(r.file_size || 0);
let host = '';
try { host = new URL(String(r.url || '')).hostname; } catch (e) {}
const graphHost = (() => { try { return new URL($env.META_GRAPH_URL || 'https://graph.facebook.com').hostname; } catch (e) { return ''; } })();
const hostOk = host.endsWith('.fbsbx.com') || host.endsWith('.whatsapp.net') || host === graphHost;
if (!hostOk) throw new Error('URL de mídia fora da Meta: ' + host);
return [{ json: { url: r.url, mimetype: r.mime_type || $('Normalizar payload').first().json.mime, grande: tamanho > """ + str(MAX_MIDIA) + r""" } }];"""},
              [bx + 220, by], onError="continueErrorOutput")
cabe = no("Mídia cabe?", "n8n-nodes-base.if", 2.2, copy.deepcopy(nodes["Token válido?"]["parameters"]), [bx + 440, by])
cabe["parameters"]["conditions"]["conditions"][0]["leftValue"] = "={{ $json.grande === false }}"
baixar = no("Baixar mídia (Meta)", "n8n-nodes-base.httpRequest", 4.2,
            {"method": "GET", "url": "={{ $json.url }}", "sendHeaders": True,
             "headerParameters": {"parameters": [AUTH[0]]},
             "options": {"timeout": 60000, "response": {"response": {"responseFormat": "file", "outputPropertyName": "data"}}}},
            [bx + 660, by - 80], onError="continueErrorOutput")
b64 = no("Mídia → base64 (Meta)", "n8n-nodes-base.code", 2, {"jsCode": r"""// Os leitores (imagem, áudio, PDF) foram escritos para o base64 que a Evolution entregava.
const buf = await this.helpers.getBinaryDataBuffer(0, 'data');
return [{ json: { base64: buf.toString('base64'), mimetype: $('Conferir mídia (Meta)').first().json.mimetype } }];"""},
          [bx + 880, by - 80])
for n in (info, conferir, cabe, baixar, b64):
    nodes[n["name"]] = n
for s, v in C.items():  # quem apontava para "Baixar mídia (Evolution)" passa a apontar para "Info da mídia"
    for saida in v.get("main", []):
        for c in saida or []:
            if c["node"] == "Baixar mídia (Evolution)":
                c["node"] = info["name"]
liga(info["name"], [conferir["name"]], erro_dest)
liga(conferir["name"], [cabe["name"]], erro_dest)
liga(cabe["name"], [baixar["name"]], ["Avisar tipo não suportado (Meta)"])
liga(baixar["name"], [b64["name"]], erro_dest)
liga(b64["name"], [c["node"] for c in saidas_bm[0]])

# ---------------------------------------------------------------------------------------------
# 5. PDF de resposta: base64 -> arquivo -> upload para /media -> envio por id
# ---------------------------------------------------------------------------------------------
ep = nodes.pop("Enviar PDF (Evolution)")
px, py = ep["position"]
saidas_pdf = C.pop("Enviar PDF (Evolution)")["main"]  # [[Registrar log do PDF], [Avisar erro]]
pdf_arquivo = no("PDF → arquivo (Meta)", "n8n-nodes-base.convertToFile", 1.1, {
    "operation": "toBinary", "sourceProperty": "base64", "binaryPropertyName": "data",
    "options": {"fileName": "={{ $json.arquivo }}", "mimeType": "application/pdf"}}, [px, py])
pdf_upload = no("Subir PDF (Meta)", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST", "url": "=" + GRAPH + "/{{ $env.META_PHONE_NUMBER_ID }}/media",
    "sendHeaders": True, "headerParameters": {"parameters": [AUTH[0]]},
    "sendBody": True, "contentType": "multipart-form-data",
    "bodyParameters": {"parameters": [
        {"name": "messaging_product", "value": "whatsapp"},
        {"name": "type", "value": "application/pdf"},
        {"parameterType": "formBinaryData", "name": "file", "inputDataFieldName": "data"}]},
    "options": {"timeout": 60000}}, [px + 220, py], onError="continueErrorOutput")
pdf_envio = no("Enviar PDF (Meta)", "n8n-nodes-base.httpRequest", 4.2, http({
    "sendBody": True, "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: $('Entrada do agente').first().json.wa_id, type: 'document', document: { id: $json.id, filename: $('Montar PDF').first().json.arquivo, caption: $('Montar PDF').first().json.legenda } }) }}",
    "options": {}}, URL_MSG), [px + 440, py], onError="continueErrorOutput")
for n in (pdf_arquivo, pdf_upload, pdf_envio):
    nodes[n["name"]] = n
for s, v in C.items():
    for saida in v.get("main", []):
        for c in saida or []:
            if c["node"] == "Enviar PDF (Evolution)":
                c["node"] = pdf_arquivo["name"]
erro_pdf = [c["node"] for c in saidas_pdf[1]]
liga(pdf_arquivo["name"], [pdf_upload["name"]])
liga(pdf_upload["name"], [pdf_envio["name"]], erro_pdf)
liga(pdf_envio["name"], [c["node"] for c in saidas_pdf[0]], erro_pdf)

# ---------------------------------------------------------------------------------------------
# 6. Fechamento: nada da Evolution pode sobrar
# ---------------------------------------------------------------------------------------------
# Notas (sticky notes) que descrevem a Evolution: acrescenta um aviso no topo de cada uma.
for n in nodes.values():
    if n["type"].endswith("stickyNote") and "Evolution" in n["parameters"].get("content", ""):
        n["parameters"]["content"] = ("> ⚠️ Versão **Meta Cloud API** gerada por `infra/meta/gerar-workflow-meta.py`: "
                                      "onde esta nota diz Evolution, leia Meta.\n\n" + n["parameters"]["content"])

sobras = [n["name"] for n in nodes.values()
          if not n["type"].endswith("stickyNote")
          and (re.search(r"EVOLUTION_|remoteJid|X-Webhook-Token|/message/send|/chat/", json.dumps(n["parameters"]))
               or "Evolution" in n["name"])]
assert not sobras, f"ainda há referência à Evolution em: {sobras}"
nomes = set(nodes)
for s, v in C.items():
    assert s in nomes, f"conexão sai de nó inexistente: {s}"
    for saida in v.get("main", []):
        for c in saida or []:
            assert c["node"] in nomes, f"{s} aponta para nó inexistente: {c['node']}"

for n in nodes.values():  # ids novos e estáveis (não colidem com os do agente da Evolution)
    n["id"] = uid("node:" + n["name"])

wf.update({"id": WF_ID, "name": WF_NOME, "nodes": list(nodes.values()), "connections": C, "pinData": {},
           "active": False, "tags": wf.get("tags", [])})
wf.pop("versionId", None)
DESTINO.write_text(json.dumps(wf, ensure_ascii=False, indent=2) + "\n")
print(f"ok: {DESTINO.relative_to(RAIZ)} — {len(nodes)} nós (origem: {len(json.loads(ORIGEM.read_text())['nodes'])})")
