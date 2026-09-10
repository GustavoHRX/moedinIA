/**
 * Ponte entre o painel e o assistente do WhatsApp.
 *
 * Antes desta versão o site nunca dizia QUAL número procurar: o perfil mandava
 * "abra a conversa com o Moedin.IA" e mostrava o código, mas o número não
 * existia em lugar nenhum do projeto. Quem criava conta não tinha como começar.
 *
 * O número vem de NEXT_PUBLIC_WHATSAPP_NUMBER (precisa estar na Vercel também).
 * Sem ele, a interface mostra o código e explica que o número não foi
 * configurado, em vez de oferecer um link quebrado.
 */

/** Dígitos do número do bot, com DDI. Vazio = não configurado. */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");

export const WHATSAPP_CONFIGURED = WHATSAPP_NUMBER.length >= 12;

/** "+55 (19) 99754-7717" — só para leitura humana. */
export function whatsappNumberDisplay(): string {
  if (!WHATSAPP_CONFIGURED) return "";
  const ddi = WHATSAPP_NUMBER.slice(0, 2);
  const ddd = WHATSAPP_NUMBER.slice(2, 4);
  const rest = WHATSAPP_NUMBER.slice(4);
  const meio = rest.length > 8 ? rest.slice(0, 5) : rest.slice(0, 4);
  const fim = rest.length > 8 ? rest.slice(5) : rest.slice(4);
  return `+${ddi} (${ddd}) ${meio}-${fim}`;
}

/**
 * Link que abre a conversa com a mensagem de ativação JÁ ESCRITA. O usuário só
 * aperta enviar. `link_whatsapp_by_code` aceita o código dentro de uma frase,
 * então o texto pode ser natural.
 */
export function whatsappDeepLink(code?: string | null): string {
  const texto = code
    ? `Olá, este é o meu código de ativação: ${code}`
    : "Olá! Quero ativar o Moedin.IA.";
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`;
}
