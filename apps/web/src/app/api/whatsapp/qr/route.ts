import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { WHATSAPP_CONFIGURED, whatsappDeepLink } from "@/lib/whatsapp";

/**
 * QR do link de ativação do WhatsApp, em SVG.
 *
 * Serve o caso "estou no computador e quero ativar pelo celular": o QR abre a
 * conversa com o bot já com a mensagem do código escrita.
 *
 * Gerado no servidor de propósito: mantém a biblioteca `qrcode` fora do bundle
 * do cliente e o código de ativação nunca sai para um serviço de terceiro (a
 * CSP do projeto também não permitiria uma imagem externa).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!WHATSAPP_CONFIGURED) {
    return NextResponse.json(
      { error: "whatsapp_nao_configurado", message: "NEXT_PUBLIC_WHATSAPP_NUMBER não está definida." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // A RPC devolve o código existente ou cria um na primeira vez. Roda como o
  // próprio usuário (auth.uid()), então nunca expõe o código de outra conta.
  const { data, error } = await supabase.rpc("ensure_activation_code");
  const code = (data as { code?: string } | null)?.code;
  if (error || !code) {
    return NextResponse.json({ error: "sem_codigo" }, { status: 500 });
  }

  const svg = await QRCode.toString(whatsappDeepLink(code), {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Contém o código de ativação: nunca em cache compartilhado.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
