from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
import random

from db import get_db
from schemas import (
    RegisterIn,
    LoginIn,
    TokenOut,
    VerifyEmailIn,
    TransacaoIn,
    MetaIn,
    MetaUpdate,
)
from security import hash_password, verify_password, create_access_token, decode_access_token
app = FastAPI(title="Moedin.IA API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


@app.get("/")
def root():
    return {"status": "ok", "message": "Moedin.IA API rodando"}


def limpar_cpf(cpf: str) -> str:
    return "".join(filter(str.isdigit, cpf))


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
    exists_email = db.execute(
        text("SELECT id FROM app_user WHERE email = :email"),
        {"email": data.email}
    ).fetchone()

    if exists_email:
        raise HTTPException(status_code=409, detail="Email já cadastrado")

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
        text("""
        SELECT id, password_hash, email_verificado
        FROM app_user
        WHERE email = :email
        """),
        {"email": data.email}
    ).fetchone()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")



    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token}

@app.get("/me")
def get_me(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    user = db.execute(
        text("""
        SELECT id, nome, email, telefone
        FROM app_user
        WHERE id = :id
        """),
        {"id": user_id}
    ).mappings().fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    return user

@app.post("/auth/resend-code")
def resend_code(email: str, db: Session = Depends(get_db)):
    user = db.execute(
        text("""
        SELECT id
        FROM app_user
        WHERE email = :email
        """),
        {"email": email}
    ).fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    codigo = str(random.randint(100000, 999999))

    db.execute(
        text("""
        UPDATE app_user
        SET codigo_verificacao = :codigo,
            email_verificado = FALSE
        WHERE id = :id
        """),
        {"codigo": codigo, "id": user.id}
    )

    db.commit()

    return {
        "message": "Novo código gerado com sucesso",
        "codigo_debug": codigo
    }


@app.post("/transacoes")
def criar_transacao(
    data: TransacaoIn,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    if data.tipo not in ["receita", "despesa"]:
        raise HTTPException(status_code=400, detail="Tipo deve ser receita ou despesa")

    meta_id = data.id_meta

    if meta_id is not None:
        meta = db.execute(
            text("""
            SELECT id_meta, id_user
            FROM meta
            WHERE id_meta = :id_meta AND id_user = :id_user
            """),
            {"id_meta": meta_id, "id_user": user_id}
        ).fetchone()

        if not meta:
            raise HTTPException(status_code=404, detail="Meta não encontrada")

    row = db.execute(
        text("""
        INSERT INTO transacao (valor, descricao, data, categoria, tipo, id_user, id_meta)
        VALUES (:valor, :descricao, :data, :categoria, :tipo, :id_user, :id_meta)
        RETURNING id_transacao
        """),
        {
            "valor": data.valor,
            "descricao": data.descricao,
            "data": data.data,
            "categoria": data.categoria,
            "tipo": data.tipo,
            "id_user": user_id,
            "id_meta": meta_id
        }
    ).fetchone()

    if meta_id is not None and data.tipo == "receita":
        db.execute(
            text("""
            UPDATE meta
            SET valor_atual = valor_atual + :valor
            WHERE id_meta = :id_meta AND id_user = :id_user
            """),
            {"valor": data.valor, "id_meta": meta_id, "id_user": user_id}
        )

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
        SELECT id_transacao, valor, descricao, data, categoria, tipo, id_user, id_meta
        FROM transacao
        WHERE id_user = :id_user
        ORDER BY data DESC, id_transacao DESC
        """),
        {"id_user": user_id}
    ).mappings().all()

    return rows

@app.post("/metas")
def criar_meta(
    data: MetaIn,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    row = db.execute(
        text("""
        INSERT INTO meta (titulo, valor_alvo, valor_atual, data_limite, id_user)
        VALUES (:titulo, :valor_alvo, :valor_atual, :data_limite, :id_user)
        RETURNING id_meta
        """),
        {
            "titulo": data.titulo,
            "valor_alvo": data.valor_alvo,
            "valor_atual": data.valor_atual,
            "data_limite": data.data_limite,
            "id_user": user_id
        }
    ).fetchone()

    db.commit()

    return {"message": "Meta criada com sucesso", "id_meta": row.id_meta}


@app.get("/metas")
def listar_metas(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    rows = db.execute(
        text("""
        SELECT id_meta, titulo, valor_alvo, valor_atual, data_limite, id_user
        FROM meta
        WHERE id_user = :id_user
        ORDER BY data_limite ASC, id_meta DESC
        """),
        {"id_user": user_id}
    ).mappings().all()

    return rows


@app.put("/metas/{id_meta}")
def editar_meta(
    id_meta: int,
    data: MetaUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    exists = db.execute(
        text("""
        SELECT id_meta
        FROM meta
        WHERE id_meta = :id_meta AND id_user = :id_user
        """),
        {"id_meta": id_meta, "id_user": user_id}
    ).fetchone()

    if not exists:
        raise HTTPException(status_code=404, detail="Meta não encontrada")

    db.execute(
        text("""
        UPDATE meta
        SET titulo = :titulo,
            valor_alvo = :valor_alvo,
            valor_atual = :valor_atual,
            data_limite = :data_limite
        WHERE id_meta = :id_meta AND id_user = :id_user
        """),
        {
            "titulo": data.titulo,
            "valor_alvo": data.valor_alvo,
            "valor_atual": data.valor_atual,
            "data_limite": data.data_limite,
            "id_meta": id_meta,
            "id_user": user_id
        }
    )

    db.commit()

    return {"message": "Meta atualizada com sucesso"}


@app.delete("/metas/{id_meta}")
def excluir_meta(
    id_meta: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    exists = db.execute(
        text("""
        SELECT id_meta
        FROM meta
        WHERE id_meta = :id_meta AND id_user = :id_user
        """),
        {"id_meta": id_meta, "id_user": user_id}
    ).fetchone()

    if not exists:
        raise HTTPException(status_code=404, detail="Meta não encontrada")

    db.execute(
        text("""
        DELETE FROM meta
        WHERE id_meta = :id_meta AND id_user = :id_user
        """),
        {"id_meta": id_meta, "id_user": user_id}
    )

    db.commit()

    return {"message": "Meta excluída com sucesso"}


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

security = HTTPBearer()

def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Token inválido")

    return int(payload["sub"])