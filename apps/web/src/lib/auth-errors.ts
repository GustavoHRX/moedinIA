/**
 * Traduz as mensagens de erro do Supabase Auth (sempre em inglês) para o
 * português no tom do Moedin.IA: direto, sem culpar o usuário (book pág. 10).
 * Casamento por trecho porque o Supabase varia a pontuação/capitalização
 * entre versões da API.
 */
const PATTERNS: Array<{ match: RegExp; text: string }> = [
  { match: /invalid login credentials/i, text: "E-mail ou senha incorretos. Confira e tente de novo." },
  { match: /email not confirmed/i, text: "Seu e-mail ainda não foi confirmado. Dá uma olhada na caixa de entrada (e no spam)." },
  { match: /user already registered|already been registered/i, text: "Já existe uma conta com esse e-mail. Que tal entrar em vez de criar outra?" },
  { match: /password should be at least/i, text: "A senha precisa ter pelo menos 6 caracteres." },
  { match: /unable to validate email address/i, text: "Esse e-mail não parece válido. Confira e tente de novo." },
  { match: /should be different from the old password/i, text: "A nova senha precisa ser diferente da atual." },
  { match: /email rate limit exceeded/i, text: "Muitas tentativas em pouco tempo. Espera um instante e tenta de novo." },
  { match: /for security purposes.*after (\d+) seconds/i, text: "Por segurança, espera alguns segundos antes de tentar de novo." },
  { match: /user not found/i, text: "Não encontramos uma conta com esse e-mail." },
  { match: /token has expired|otp expired|invalid.*token/i, text: "Esse link expirou ou já foi usado. Peça um novo." },
  { match: /network|fetch failed|failed to fetch/i, text: "Não conseguimos conectar. Confira sua internet e tente de novo." },
  { match: /signups? not allowed|disabled/i, text: "Cadastro temporariamente indisponível. Tenta novamente em instantes." },
];

export function translateAuthError(message: string | null | undefined): string {
  if (!message) return "Ops, algo saiu do trilho. Tenta de novo em instantes.";

  for (const { match, text } of PATTERNS) {
    if (match.test(message)) return text;
  }

  return "Ops, algo saiu do trilho. Tenta de novo em instantes.";
}
