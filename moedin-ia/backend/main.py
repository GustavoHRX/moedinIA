from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

from db import get_db
from schemas import RegisterIn, LoginIn, TokenOut, TransacaoIn
from security import hash_password, verify_password, create_access_token, decode_access_token

app = FastAPI(title="Moedin.IA API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


@app.get("/")
def root():
    return {"status": "ok", "message": "Moedin.IA API rodando"}


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Token inválido")

    return int(payload["sub"])


@app.post("/auth/register", response_model=TokenOut)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    exists = db.execute(
        text("SELECT id FROM app_user WHERE telefone = :t"),
        {"t": data.telefone}
    ).fetchone()

    if exists:
        raise HTTPException(status_code=409, detail="Telefone já cadastrado")

    password_hash = hash_password(data.password)

    row = db.execute(
        text("""
        INSERT INTO app_user (nome, telefone, email, password_hash)
        VALUES (:nome, :telefone, :email, :ph)
        RETURNING id
        """),
        {
            "nome": data.nome,
            "telefone": data.telefone,
            "email": data.email,
            "ph": password_hash
        }
    ).fetchone()

    db.commit()

    token = create_access_token({"sub": str(row.id)})
    return {"access_token": token}


@app.post("/auth/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.execute(
        text("SELECT id, password_hash FROM app_user WHERE telefone = :t"),
        {"t": data.telefone}
    ).fetchone()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token}


@app.post("/transacoes")
def criar_transacao(
    data: TransacaoIn,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    if data.tipo not in ["receita", "despesa"]:
        raise HTTPException(status_code=400, detail="Tipo deve ser receita ou despesa")

    row = db.execute(
        text("""
        INSERT INTO transacao (valor, descricao, data, categoria, tipo, id_user)
        VALUES (:valor, :descricao, :data, :categoria, :tipo, :id_user)
        RETURNING id_transacao
        """),
        {
            "valor": data.valor,
            "descricao": data.descricao,
            "data": data.data,
            "categoria": data.categoria,
            "tipo": data.tipo,
            "id_user": user_id
        }
    ).fetchone()

    db.commit()

    return {
        "message": "Transação criada com sucesso",
        "id_transacao": row.id_transacao
    }


@app.get("/transacoes")
def listar_transacoes(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    rows = db.execute(
        text("""
        SELECT id_transacao, valor, descricao, data, categoria, tipo, id_user
        FROM transacao
        WHERE id_user = :id_user
        ORDER BY data DESC, id_transacao DESC
        """),
        {"id_user": user_id}
    ).mappings().all()

    return rows


@app.delete("/transacoes/{id_transacao}")
def deletar_transacao(
    id_transacao: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    exists = db.execute(
        text("""
        SELECT id_transacao
        FROM transacao
        WHERE id_transacao = :id_transacao AND id_user = :id_user
        """),
        {"id_transacao": id_transacao, "id_user": user_id}
    ).fetchone()

    if not exists:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    db.execute(
        text("""
        DELETE FROM transacao
        WHERE id_transacao = :id_transacao AND id_user = :id_user
        """),
        {"id_transacao": id_transacao, "id_user": user_id}
    )

    db.commit()

    return {"message": "Transação removida com sucesso"}