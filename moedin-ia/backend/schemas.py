from pydantic import BaseModel, EmailStr
from datetime import date

class RegisterIn(BaseModel):
    nome: str
    telefone: str
    email: EmailStr | None = None
    password: str

class LoginIn(BaseModel):
    telefone: str
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TransacaoIn(BaseModel):
    valor: float
    descricao: str
    data: date
    categoria: str
    tipo: str

class TransacaoOut(BaseModel):
    id_transacao: int
    valor: float
    descricao: str
    data: date
    categoria: str
    tipo: str
    id_user: int