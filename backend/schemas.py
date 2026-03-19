from pydantic import BaseModel, EmailStr
from datetime import date

class RegisterIn(BaseModel):
    nome: str
    telefone: str
    email: EmailStr
    password: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class VerifyEmailIn(BaseModel):
    email: EmailStr
    codigo: str

class TransacaoIn(BaseModel):
    valor: float
    descricao: str
    data: date
    categoria: str
    tipo: str
    id_meta: int | None = None

class TransacaoOut(BaseModel):
    id_transacao: int
    valor: float
    descricao: str
    data: date
    categoria: str
    tipo: str
    id_user: int
    id_meta: int | None = None

class MetaIn(BaseModel):
    titulo: str
    valor_alvo: float
    valor_atual: float = 0
    data_limite: date

class MetaUpdate(BaseModel):
    titulo: str
    valor_alvo: float
    valor_atual: float
    data_limite: date

class MetaOut(BaseModel):
    id_meta: int
    titulo: str
    valor_alvo: float
    valor_atual: float
    data_limite: date
    id_user: int