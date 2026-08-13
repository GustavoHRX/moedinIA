"""
Moedin.IA - Serviço de IA

Responsável por interpretar mensagens financeiras (texto, imagem de comprovante
e áudio) e devolver uma estrutura padronizada que o n8n grava em `transactions`.

Estratégia:
- TEXTO: tenta Groq (gratuito, GROQ_API_KEY) primeiro; se falhar, OpenAI
  (OPENAI_API_KEY); se nenhum responder, cai para um parser por regex.
- IMAGEM (comprovante) e ÁUDIO: usam OpenAI (visão gpt-4o-mini / whisper-1).
- O fallback por regex garante que a demonstração nunca quebre por falta de
  crédito ou chave.
"""

import base64
import io
import json
import os
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel

# Carrega o .env geral do monorepo (moedinha codigo/.env) quando rodando local.
# No Docker as variáveis vêm do docker-compose (env_file), então isto é opcional
# e nunca deve quebrar a inicialização.
_here = Path(__file__).resolve()
for _parent in _here.parents:
    _candidate = _parent / ".env"
    if _candidate.is_file():
        load_dotenv(_candidate)
        break
load_dotenv()  # .env local da pasta atual sobrescreve, se houver

APP_TIMEZONE = ZoneInfo("America/Sao_Paulo")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Groq (gratuito, compatível com a API da OpenAI) — usado para interpretar TEXTO.
# Imagem (visão) e áudio (Whisper) continuam na OpenAI.
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")

# Categorias padrão (devem bater com apps/web/src/app/api/categories/ensure/route.ts)
INCOME_CATEGORIES = ["Salário", "Freelance", "Reembolso", "Investimentos", "Outras receitas"]
EXPENSE_CATEGORIES = [
    "Alimentação", "Mercado", "Transporte", "Moradia", "Contas",
    "Saúde", "Educação", "Lazer", "Outras despesas",
]

# Palavras-chave -> categoria (usado no fallback e como reforço)
KEYWORD_CATEGORY = {
    "mercado": "Mercado", "supermercado": "Mercado", "feira": "Mercado",
    "restaurante": "Alimentação", "lanche": "Alimentação", "ifood": "Alimentação",
    "almoco": "Alimentação", "almoço": "Alimentação", "jantar": "Alimentação",
    "uber": "Transporte", "onibus": "Transporte",
    "ônibus": "Transporte", "gasolina": "Transporte", "combustivel": "Transporte",
    "aluguel": "Moradia", "condominio": "Moradia", "condomínio": "Moradia",
    "luz": "Contas", "energia": "Contas", "agua": "Contas", "água": "Contas",
    "internet": "Contas", "telefone": "Contas", "celular": "Contas",
    "farmacia": "Saúde", "farmácia": "Saúde", "remedio": "Saúde", "médico": "Saúde",
    "medico": "Saúde", "escola": "Educação", "faculdade": "Educação", "facul": "Educação",
    "curso": "Educação", "mensalidade": "Educação", "matricula": "Educação", "matrícula": "Educação",
    "cinema": "Lazer", "netflix": "Lazer", "show": "Lazer", "viagem": "Lazer",
    "spotify": "Lazer", "streaming": "Lazer", "bar": "Lazer", "jogo": "Lazer",
    "padaria": "Alimentação", "cafe": "Alimentação", "café": "Alimentação",
    "ifood": "Alimentação", "lanche": "Alimentação",
    "estacionamento": "Transporte",
    "fatura": "Contas", "boleto": "Contas",
    "academia": "Saúde", "personal": "Saúde", "dentista": "Saúde", "exame": "Saúde",
    "moveis": "Moradia", "móveis": "Moradia",
    "roupa": "Outras despesas", "sapato": "Outras despesas", "tenis": "Outras despesas",
    "tênis": "Outras despesas", "vestuario": "Outras despesas", "vestuário": "Outras despesas",
    "maquiagem": "Outras despesas", "cabeleireiro": "Outras despesas", "salao": "Outras despesas",
    "salão": "Outras despesas", "unha": "Outras despesas", "barbeiro": "Outras despesas",
    "cosmetico": "Outras despesas", "cosmético": "Outras despesas",
    "presente": "Outras despesas", "pet": "Outras despesas", "doacao": "Outras despesas",
    "doação": "Outras despesas",
    "salario": "Salário", "salário": "Salário", "freela": "Freelance",
    "freelance": "Freelance", "reembolso": "Reembolso",
}

INCOME_HINTS = [
    "recebi", "receita", "salario", "salário", "entrada", "ganhei", "pix recebido",
    "reembolso", "freela", "freelance", "vendi", "venda", "lucro", "rendimento",
    "dividendo", "bonus", "bônus", "comissao", "comissão", "me pagaram", "depositaram",
    "caiu na conta", "investimento rendeu",
]

app = FastAPI(title="Moedin.IA - AI Service")

# CORS: o dashboard (Next.js) chama /insight direto do navegador.
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_openai_client = None
_groq_client = None


def get_openai_client():
    """Cria o client OpenAI sob demanda. Retorna None se não houver chave."""
    global _openai_client
    if not OPENAI_API_KEY:
        return None
    if _openai_client is None:
        from openai import OpenAI

        _openai_client = OpenAI(api_key=OPENAI_API_KEY)
    return _openai_client


def get_groq_client():
    """Client Groq (API compatível com OpenAI). Retorna None se não houver chave."""
    global _groq_client
    if not GROQ_API_KEY:
        return None
    if _groq_client is None:
        from openai import OpenAI

        _groq_client = OpenAI(api_key=GROQ_API_KEY, base_url=GROQ_BASE_URL)
    return _groq_client


def today_str() -> str:
    return datetime.now(APP_TIMEZONE).strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# Fallback por regex (sem IA) — reaproveita a lógica do workflow n8n original
# ---------------------------------------------------------------------------
def parse_amount(text: str) -> float:
    """Extrai valor monetário tratando formatos BR: 1.200,50 / 35,90 / 1200 / 23.50."""
    m = re.search(r"(?:r\$\s*)?(\d[\d.,]*\d|\d)", text.lower())
    if not m:
        return 0.0
    token = m.group(1)
    if "," in token:
        # vírgula é o separador decimal; pontos são milhar
        token = token.replace(".", "").replace(",", ".")
    elif token.count(".") == 1:
        _, dec = token.split(".")
        if len(dec) not in (1, 2):  # ponto é milhar (ex: 1.200)
            token = token.replace(".", "")
    else:
        token = token.replace(".", "")  # vários pontos = milhar
    try:
        return round(float(token), 2)
    except ValueError:
        return 0.0


def fallback_parse(text: str) -> dict:
    lower = text.lower()

    amount = parse_amount(lower)

    # tipo
    tipo = "income" if any(h in lower for h in INCOME_HINTS) else "expense"

    # data (ISO ou dd/mm/yyyy), senão hoje
    data = today_str()
    iso = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", text)
    br = re.search(r"\b(\d{1,2})/(\d{1,2})/(20\d{2})\b", text)
    if iso:
        data = iso.group(1)
    elif br:
        d, mth, y = br.groups()
        data = f"{y}-{mth.zfill(2)}-{d.zfill(2)}"

    # categoria por palavra-chave
    categoria = None
    for kw, cat in KEYWORD_CATEGORY.items():
        if kw in lower:
            categoria = cat
            break

    # descrição: remove R$, valor, datas, verbos e preposições comuns
    descricao = re.sub(r"r\$\s*", "", text, flags=re.IGNORECASE)
    descricao = re.sub(r"\d[\d.,]*", "", descricao)
    descricao = re.sub(r"\b20\d{2}-\d{2}-\d{2}\b|\b\d{1,2}/\d{1,2}/20\d{2}\b", "", descricao)
    descricao = re.sub(
        r"\b(gastei|paguei|comprei|recebi|receita|despesa|entrada|saida|saída|"
        r"no|na|em|de|do|da|com|reais|hoje|ontem)\b",
        "", descricao, flags=re.IGNORECASE,
    )
    descricao = re.sub(r"\s+", " ", descricao).strip() or (categoria or "Lançamento via WhatsApp")

    return {
        "tipo": tipo,
        "valor": amount,
        "categoria": categoria,
        "descricao": descricao[:255],
        "data": data,
    }


# ---------------------------------------------------------------------------
# Interpretação com OpenAI
# ---------------------------------------------------------------------------
def build_system_prompt() -> str:
    return (
        "Você é um interpretador de mensagens financeiras do app Moedin.IA. "
        "Receba uma frase em português e devolva APENAS um JSON puro (sem markdown) com as chaves: "
        "tipo, valor, categoria, descricao, data.\n"
        "REGRA DO TIPO (muito importante): o padrão é SEMPRE 'expense' (despesa). "
        "Só use 'income' (receita) quando a frase indicar CLARAMENTE dinheiro que ENTROU para a pessoa, "
        "com verbos como: recebi, ganhei, caiu, entrou, me pagaram, salário, reembolso. "
        "Pagar, gastar, comprar, ou citar um serviço/lugar (uber, mercado, ifood, farmácia, conta) é SEMPRE 'expense', "
        "mesmo que apareça a palavra 'trabalho'.\n"
        "valor: número decimal com ponto como separador (ex: 23.50). "
        "descricao: curta, descrevendo o lançamento. "
        f"data: YYYY-MM-DD; use {today_str()} se não houver data na mensagem.\n"
        "REGRA EXTRA DE TIPO: presente, presentes, mimo ou algo que a pessoa COMPRA para outra pessoa "
        "são DESPESA (expense), nunca receita — 'receber' só quando o dinheiro entra para a própria pessoa.\n"
        f"categoria: escolha SEMPRE UMA da lista do tipo correspondente. NUNCA retorne null — "
        f"se nada encaixar, use 'Outras despesas' (despesa) ou 'Outras receitas' (receita).\n"
        f"Categorias de DESPESA (tipo='expense'): {', '.join(EXPENSE_CATEGORIES)}. "
        f"Categorias de RECEITA (tipo='income'): {', '.join(INCOME_CATEGORIES)}.\n"
        "Guia de encaixe nas categorias de despesa: "
        "academia/personal/exames/dentista/médico/farmácia/remédio → Saúde; "
        "maquiagem/cabeleireiro/salão/unha/barbeiro/cosmético → Outras despesas; "
        "roupa/sapato/tênis/vestuário/acessório → Outras despesas; "
        "netflix/spotify/streaming/cinema/jogo/bar/viagem → Lazer; "
        "aluguel/condomínio/casa/móveis → Moradia; "
        "luz/água/internet/telefone/celular/fatura → Contas; "
        "uber/99/ônibus/gasolina/combustível/estacionamento → Transporte; "
        "mercado/supermercado/feira → Mercado; "
        "restaurante/lanche/ifood/almoço/jantar/padaria/café → Alimentação; "
        "presente/pet/doação/imprevisto → Outras despesas.\n"
        "Se não conseguir identificar o valor, retorne valor 0."
    )


def _chat_parse_text(client, model: str, text: str, label: str):
    """Interpreta texto via qualquer client compatível com a API da OpenAI."""
    try:
        resp = client.chat.completions.create(
            model=model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": build_system_prompt()},
                {"role": "user", "content": text},
            ],
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as exc:  # crédito esgotado, rede, rate limit, etc.
        print(f"[{label}] falhou: {exc}")
        return None


def parse_text_with_llm(text: str):
    """Tenta Groq (gratuito) primeiro; cai para OpenAI; senão devolve None."""
    groq = get_groq_client()
    if groq is not None:
        parsed = _chat_parse_text(groq, GROQ_MODEL, text, "groq_parse_text")
        if parsed is not None:
            return parsed

    openai = get_openai_client()
    if openai is not None:
        return _chat_parse_text(openai, OPENAI_MODEL, text, "openai_parse_text")

    return None


def openai_parse_image(image_base64: str, mime: str = "image/jpeg"):
    client = get_openai_client()
    if client is None:
        return None
    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": build_system_prompt()},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Esta é a foto de um comprovante/nota. Extraia o gasto principal "
                                    "(valor total, estabelecimento como descrição e data se houver).",
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime};base64,{image_base64}"},
                        },
                    ],
                },
            ],
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as exc:
        print(f"[openai_parse_image] falhou: {exc}")
        return None


def openai_transcribe(audio_base64: str, filename: str = "audio.ogg"):
    client = get_openai_client()
    if client is None:
        return None
    try:
        audio_bytes = base64.b64decode(audio_base64)
        buffer = io.BytesIO(audio_bytes)
        buffer.name = filename
        resp = client.audio.transcriptions.create(
            model="whisper-1", file=buffer, language="pt"
        )
        return resp.text
    except Exception as exc:
        print(f"[openai_transcribe] falhou: {exc}")
        return None


def _as_obj(parsed):
    """O modelo às vezes devolve uma lista (ex: vários gastos numa msg só).
    Pega o primeiro objeto válido para não quebrar."""
    if isinstance(parsed, list):
        for item in parsed:
            if isinstance(item, dict):
                return item
        return {}
    return parsed if isinstance(parsed, dict) else {}


def normalize_result(parsed: dict, fonte: str, texto_original: str) -> dict:
    """Garante que o resultado tem todos os campos válidos para gravar."""
    parsed = _as_obj(parsed)
    tipo = parsed.get("tipo")
    if tipo not in ("income", "expense"):
        tipo = "expense"

    # rede de segurança: o modelo pequeno às vezes marca "income" sem motivo
    # (ex: "1000 em facul"). Só aceita receita se houver sinal de dinheiro entrando.
    text_lower = (texto_original or "").lower()
    if tipo == "income" and not any(h in text_lower for h in INCOME_HINTS):
        tipo = "expense"

    valid_categories = INCOME_CATEGORIES if tipo == "income" else EXPENSE_CATEGORIES
    categoria = parsed.get("categoria")
    if categoria not in valid_categories:
        categoria = None

    # override determinístico por palavra-chave (alta confiança): corrige os
    # casos em que o modelo pequeno erra a categoria.
    for kw, cat in KEYWORD_CATEGORY.items():
        if cat in valid_categories and re.search(r"\b" + re.escape(kw) + r"\b", text_lower):
            categoria = cat
            break

    if categoria not in valid_categories:
        # nunca deixa sem categoria: cai na categoria "Outras"
        categoria = "Outras receitas" if tipo == "income" else "Outras despesas"

    try:
        valor = round(float(parsed.get("valor") or 0), 2)
    except (TypeError, ValueError):
        valor = 0.0

    data = parsed.get("data") or today_str()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(data)):
        data = today_str()

    descricao = (parsed.get("descricao") or texto_original or "Lançamento via WhatsApp")[:255]

    return {
        "ok": valor > 0,
        "erro": None if valor > 0 else "Não consegui identificar o valor da transação.",
        "tipo": tipo,
        "valor": valor,
        "categoria": categoria,
        "descricao": descricao,
        "data": data,
        "competence_month": f"{data[:7]}-01",
        "fonte": fonte,
        "texto_original": texto_original,
    }


# ---------------------------------------------------------------------------
# Classificação de intenção (lançamento / consulta / exclusão)
# ---------------------------------------------------------------------------
INTENTS = ("lancamento", "consulta", "excluir", "outro")

DELETE_HINTS = ["exclu", "apag", "remov", "deleta", "delete", "retir", "tira ", "tirar"]
QUERY_HINTS = ["quanto", "relatorio", "relatório", "extrato", "resumo", "balanco",
               "balanço", "meus gastos", "gastos do mes", "gastos do mês", "gastei no mes",
               "gastei esse mes", "gastei esse mês", "total gasto"]


def build_intent_prompt() -> str:
    return (
        "Você classifica mensagens de um app financeiro no WhatsApp. "
        "Devolva APENAS um JSON puro com a chave 'intent' e os campos do tipo identificado.\n"
        "intent deve ser um de: 'lancamento', 'consulta', 'excluir', 'outro'.\n"
        "- 'lancamento': a pessoa está registrando um gasto/receita (ex: 'gastei 50 no mercado', "
        "'recebi 1000 de salario'). Inclua: tipo, valor, categoria, descricao, data.\n"
        "- 'consulta': a pessoa quer ver gastos/relatório (ex: 'quanto gastei esse mês', "
        "'meu extrato', 'resumo de gastos'). Inclua: periodo ('atual' ou 'anterior').\n"
        "- 'excluir': a pessoa quer apagar um lançamento. O campo 'alvo' deve conter O TERMO da coisa a "
        "excluir, não a palavra 'descricao'. Exemplos: 'exclui o uber' -> alvo='uber'; "
        "'apaga o último' -> alvo='ultimo'; 'remove o mercado' -> alvo='mercado'.\n"
        "- 'outro': saudação ou algo não relacionado.\n"
        f"Para lançamento, siga estas regras de tipo/categoria. {build_system_prompt()}"
    )


def fallback_intent(text: str) -> dict:
    lower = text.lower()
    if any(h in lower for h in DELETE_HINTS):
        alvo = re.sub(r"\b(exclu\w*|apag\w*|remov\w*|delet\w*|retir\w*|tira\w*|o|a|os|as|meu|minha|gasto|lancamento|lançamento)\b",
                      "", lower, flags=re.IGNORECASE)
        alvo = re.sub(r"\s+", " ", alvo).strip()
        return {"intent": "excluir", "alvo": alvo or "ultimo"}
    if any(h in lower for h in QUERY_HINTS):
        periodo = "anterior" if any(w in lower for w in ["passado", "anterior", "mes passado", "mês passado"]) else "atual"
        return {"intent": "consulta", "periodo": periodo}
    # default: trata como lançamento
    return {"intent": "lancamento", **fallback_parse(text)}


def ref_date_for_periodo(periodo: str) -> str:
    """Devolve a data de referência (YYYY-MM-DD) para o relatório."""
    now = datetime.now(APP_TIMEZONE)
    if periodo == "anterior":
        # último dia do mês anterior
        first_this = now.replace(day=1)
        last_prev = first_this - timedelta(days=1)
        return last_prev.strftime("%Y-%m-%d")
    return today_str()


def llm_classify(text: str):
    client = get_groq_client() or get_openai_client()
    if client is None:
        return None
    model = GROQ_MODEL if get_groq_client() is not None else OPENAI_MODEL
    label = "groq_classify" if get_groq_client() is not None else "openai_classify"
    try:
        resp = client.chat.completions.create(
            model=model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": build_intent_prompt()},
                {"role": "user", "content": text},
            ],
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as exc:
        print(f"[{label}] falhou: {exc}")
        return None


def normalize_interpret(parsed: dict, texto: str) -> dict:
    parsed = _as_obj(parsed)
    intent = parsed.get("intent")
    if intent not in INTENTS:
        # não classificou: tenta inferir pelo fallback
        parsed = fallback_intent(texto)
        intent = parsed["intent"]

    if intent == "lancamento":
        base = normalize_result(parsed, "texto", texto)
        base["intent"] = "lancamento"
        return base
    if intent == "consulta":
        periodo = parsed.get("periodo") if parsed.get("periodo") in ("atual", "anterior") else "atual"
        return {"intent": "consulta", "periodo": periodo, "ref_date": ref_date_for_periodo(periodo),
                "texto_original": texto}
    if intent == "excluir":
        alvo = (parsed.get("alvo") or "").strip()
        # rede de segurança: modelos pequenos às vezes devolvem o nome do campo
        # ('descricao', 'alvo', 'id') em vez do termo. Nesses casos extrai do texto.
        if alvo.lower() in ("", "descricao", "descrição", "alvo", "id", "ultimo", "último"):
            alvo = fallback_intent(texto).get("alvo", "ultimo") if alvo.lower() not in ("ultimo", "último") else "ultimo"
        return {"intent": "excluir", "alvo": alvo or "ultimo", "texto_original": texto}
    return {"intent": "outro", "texto_original": texto}


# ---------------------------------------------------------------------------
# Modelos de request
# ---------------------------------------------------------------------------
class TextIn(BaseModel):
    text: str


class ImageIn(BaseModel):
    image_base64: str
    mime: str = "image/jpeg"


class AudioIn(BaseModel):
    audio_base64: str
    filename: str = "audio.ogg"


class CategoryTotalIn(BaseModel):
    name: str
    total: float


class InsightIn(BaseModel):
    month_label: str
    income_total: float
    expense_total: float
    budget_amount: float = 0
    categories: list[CategoryTotalIn] = []


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {
        "ok": True,
        "service": "moedin-ai",
        "text_provider": "groq" if GROQ_API_KEY else ("openai" if OPENAI_API_KEY else "fallback"),
        "groq_enabled": bool(GROQ_API_KEY),
        "groq_model": GROQ_MODEL,
        "openai_enabled": bool(OPENAI_API_KEY),
        "openai_model": OPENAI_MODEL,
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/parse-text")
def parse_text(body: TextIn):
    parsed = parse_text_with_llm(body.text) or fallback_parse(body.text)
    return normalize_result(parsed, "texto", body.text)


@app.post("/interpret")
def interpret(body: TextIn):
    """Classifica a intenção (lancamento/consulta/excluir/outro) e extrai os campos.

    Estratégia: excluir/consultar são detectados por palavra-chave (confiável e
    sem custo de IA). Só o que não bate vai pro LLM, que é bom em extrair os
    dados de um lançamento mas fraco em classificar intenção.
    """
    lower = body.text.lower()
    if any(h in lower for h in DELETE_HINTS):
        return normalize_interpret({"intent": "excluir"}, body.text)
    if any(h in lower for h in QUERY_HINTS):
        return normalize_interpret(fallback_intent(body.text), body.text)

    parsed = llm_classify(body.text) or fallback_intent(body.text)
    return normalize_interpret(parsed, body.text)


@app.post("/parse-image")
def parse_image(body: ImageIn):
    parsed = openai_parse_image(body.image_base64, body.mime)
    if parsed is None:
        return {
            "ok": False,
            "erro": "Processamento de imagem requer OpenAI configurada.",
            "fonte": "imagem",
        }
    return normalize_result(parsed, "imagem", "[imagem de comprovante]")


@app.post("/parse-audio")
def parse_audio(body: AudioIn):
    texto = openai_transcribe(body.audio_base64, body.filename)
    if texto is None:
        return {
            "ok": False,
            "erro": "Transcrição de áudio requer OpenAI configurada.",
            "fonte": "audio",
        }
    parsed = parse_text_with_llm(texto) or fallback_parse(texto)
    return normalize_result(parsed, "audio", texto)


INSIGHT_SYSTEM_PROMPT = (
    "Você é o Moedin.IA, um amigo que entende de grana. Receberá um resumo do mês "
    "financeiro de uma pessoa. Responda com UMA observação curta (máx. 2 frases, "
    "até 220 caracteres) em português do dia a dia: direta, acolhedora, sem "
    "julgamento, sem economês, sem emoji. Aponte o padrão mais útil (categoria "
    "que pesou, ritmo vs. orçamento, saldo) e, se couber, uma sugestão leve. "
    "Fale com 'você'. Nunca use tom alarmista."
)


def _chat_insight(client, model: str, resumo: str):
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": INSIGHT_SYSTEM_PROMPT},
                {"role": "user", "content": resumo},
            ],
            temperature=0.5,
            max_tokens=140,
        )
        texto = (resp.choices[0].message.content or "").strip()
        return texto or None
    except Exception:
        return None


@app.post("/insight")
def insight(body: InsightIn):
    """Gera 1 insight amigável do mês via LLM. Sem chave de IA, retorna ok=False
    e o front continua com as heurísticas locais (nunca quebra)."""
    saldo = body.income_total - body.expense_total
    linhas = [
        f"Mês: {body.month_label}",
        f"Receitas: R$ {body.income_total:.2f}",
        f"Despesas: R$ {body.expense_total:.2f}",
        f"Saldo: R$ {saldo:.2f}",
    ]
    if body.budget_amount > 0:
        linhas.append(f"Orçamento geral de despesas: R$ {body.budget_amount:.2f}")
    if body.categories:
        top = sorted(body.categories, key=lambda c: c.total, reverse=True)[:5]
        linhas.append(
            "Maiores despesas por categoria: "
            + "; ".join(f"{c.name} R$ {c.total:.2f}" for c in top)
        )
    resumo = "\n".join(linhas)

    texto = None
    groq = get_groq_client()
    if groq is not None:
        texto = _chat_insight(groq, GROQ_MODEL, resumo)
    if texto is None:
        openai = get_openai_client()
        if openai is not None:
            texto = _chat_insight(openai, OPENAI_MODEL, resumo)

    if texto is None:
        return {"ok": False, "erro": "Nenhum provedor de IA configurado."}
    return {"ok": True, "insight": texto}
