/**
 * AUDITORIA A-6: validação client-side dos formulários de autenticação.
 * Antes os inputs não tinham nem `required` — submeter o cadastro vazio
 * disparava uma requisição ao Supabase que voltava "Anonymous sign-ins are
 * disabled" e era traduzida como "Cadastro temporariamente indisponível",
 * escondendo a causa real. Estas funções barram o envio antes da rede e
 * devolvem uma mensagem no tom do produto.
 *
 * Isto NÃO substitui as validações do servidor (Supabase Auth) nem as
 * constraints do banco — é só a primeira linha, para UX e para não gastar
 * requisição à toa.
 */

export const EMAIL_MAX = 254;
export const NAME_MAX = 150;
export const PHONE_MAX = 20;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // limite do bcrypt usado pelo Supabase

// Regex de e-mail deliberadamente simples: só descarta lixo óbvio. A validação
// real é o Supabase mandar (ou não) o e-mail de confirmação.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(raw: string): string | null {
  const email = raw.trim();
  if (!email) return "Informe seu e-mail.";
  if (email.length > EMAIL_MAX) return "Esse e-mail é longo demais.";
  if (!EMAIL_RE.test(email)) return "Esse e-mail não parece válido.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Informe sua senha.";
  if (password.length < PASSWORD_MIN)
    return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX)
    return `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`;
  return null;
}

// No login não exigimos tamanho mínimo (a conta pode ter sido criada quando a
// regra era 6): só checa que não está vazia.
export function validateLoginPassword(password: string): string | null {
  if (!password) return "Informe sua senha.";
  if (password.length > PASSWORD_MAX) return "Senha inválida.";
  return null;
}

export function validateFullName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return "Informe seu nome.";
  if (name.length > NAME_MAX) return "Esse nome é longo demais.";
  return null;
}

// Telefone é opcional (só necessário para o WhatsApp). Se preenchido, precisa
// ter 10 ou 11 dígitos (fixo ou celular BR).
export function validatePhoneOptional(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length < 10 || digits.length > 13)
    return "Telefone inválido. Use DDD + número, ex: (11) 99999-9999.";
  return null;
}

export function firstError(...errors: Array<string | null>): string | null {
  return errors.find((error) => error) ?? null;
}
