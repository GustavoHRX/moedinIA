"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, MessageCircle, QrCode, Smartphone } from "lucide-react";
import { useAppData } from "@/components/app-data-provider";
import { createClient } from "@/lib/supabase/client";
import { ActionButton, Alert, IconBox, PageFrame, PageHeader, SectionHeader, Surface } from "@/components/ui-kit";
import { Skeleton } from "@/components/skeleton";
import { WHATSAPP_CONFIGURED, whatsappDeepLink, whatsappNumberDisplay } from "@/lib/whatsapp";

/**
 * Tela de conexão com o WhatsApp.
 *
 * Existe porque o fluxo tinha um buraco: quem criava conta caía no dashboard e
 * nada dizia que o assistente existia, nem qual número procurar. O código de
 * ativação vivia escondido no fim do perfil.
 *
 * Aqui o caminho é um só: abrir a conversa (ou ler o QR), enviar a mensagem que
 * já vem escrita, e a página detecta a ativação sozinha — sem o usuário precisar
 * voltar e recarregar nada.
 */
export default function OnboardingPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { user: cachedUser, loadingUser } = useAppData();

  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [linked, setLinked] = useState(false);
  /** true quando a ativação foi detectada com a página aberta (mostra a festa). */
  const [justLinked, setJustLinked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [erro, setErro] = useState("");
  const linkedRef = useRef(false);

  const checkLink = useCallback(
    async (userId: string) => {
      const { count, error } = await supabase
        .from("whatsapp_links")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (error) return false;
      return (count ?? 0) > 0;
    },
    [supabase],
  );

  // Carga inicial: código + situação do vínculo.
  useEffect(() => {
    if (loadingUser) return;
    if (!cachedUser) {
      router.push("/login");
      return;
    }
    let cancelado = false;

    (async () => {
      const jaVinculado = await checkLink(cachedUser.id);
      if (cancelado) return;
      if (jaVinculado) {
        linkedRef.current = true;
        setLinked(true);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc("ensure_activation_code");
      if (cancelado) return;
      const c = (data as { code?: string } | null)?.code;
      if (error || !c) setErro("Não consegui gerar seu código de ativação. Recarregue a página.");
      else setCode(c);
      setLoading(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [loadingUser, cachedUser, router, supabase, checkLink]);

  // Enquanto não vinculou, pergunta ao banco a cada 3s. Para sozinho ao detectar
  // ou quando a aba sai de foco (não fica consultando em aba esquecida aberta).
  useEffect(() => {
    if (loading || linked || !cachedUser) return;

    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible" || linkedRef.current) return;
      const ok = await checkLink(cachedUser.id);
      if (ok) {
        linkedRef.current = true;
        setLinked(true);
        setJustLinked(true);
      }
    }, 3000);

    return () => window.clearInterval(id);
  }, [loading, linked, cachedUser, checkLink]);

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setErro("Não consegui copiar. Copie o código manualmente.");
    }
  }

  if (loading) {
    return (
      <PageFrame>
        <PageHeader eyebrow="Integração" title="Conectar o WhatsApp" />
        <Surface>
          <Skeleton className="h-40 w-full" />
        </Surface>
      </PageFrame>
    );
  }

  if (linked) {
    return (
      <PageFrame>
        <PageHeader eyebrow="Integração" title="Conectar o WhatsApp" />
        <Surface>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <IconBox size="lg" shape="circle" tone="brand">
              <CheckCircle2 className="h-6 w-6" />
            </IconBox>
            <div>
              <p className="font-display text-xl font-semibold text-fg">
                {justLinked ? "Ativado com sucesso! 🎉" : "Seu WhatsApp já está conectado"}
              </p>
              <p className="mt-2 max-w-md text-sm text-fg-muted">
                Agora é só mandar mensagem como você fala: &quot;gastei 35,90 no mercado&quot;,
                &quot;quanto gastei esse mês&quot;, &quot;qual meu limite&quot;. Também entendo áudio,
                foto de comprovante e PDF de fatura.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/dashboard" className="btn-primary inline-flex items-center px-5 py-2.5 text-sm">
                Ir para o painel
              </Link>
              {WHATSAPP_CONFIGURED ? (
                <a
                  href={whatsappDeepLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary inline-flex items-center px-5 py-2.5 text-sm"
                >
                  Abrir a conversa
                </a>
              ) : null}
            </div>
          </div>
        </Surface>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Integração"
        title="Conectar o WhatsApp"
        description="Dois minutos. Depois disso você registra gastos sem abrir o site."
      />

      {erro ? <Alert type="error">{erro}</Alert> : null}

      {!WHATSAPP_CONFIGURED ? (
        <Alert type="warning">
          O número do assistente ainda não foi configurado neste ambiente. Defina{" "}
          <span className="font-semibold">NEXT_PUBLIC_WHATSAPP_NUMBER</span> para liberar o botão e o
          QR. Seu código de ativação já está pronto abaixo.
        </Alert>
      ) : null}

      <Surface>
        <SectionHeader
          title="1. Abra a conversa com o Moedin.IA"
          description={
            WHATSAPP_CONFIGURED
              ? `A mensagem já vai escrita com o seu código. Você só aperta enviar. Número: ${whatsappNumberDisplay()}`
              : "Assim que o número for configurado, o botão aparece aqui."
          }
        />
        <div className="mt-4 grid gap-5 md:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            {WHATSAPP_CONFIGURED ? (
              <a
                href={whatsappDeepLink(code)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm"
              >
                <MessageCircle className="h-4 w-4" />
                Abrir conversa no WhatsApp
              </a>
            ) : null}

            <div>
              <p className="text-xs text-fg-muted">Ou mande você mesmo este código</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="rounded-md border-2 border-dashed border-[var(--brand)] bg-bg-soft px-6 py-4">
                  <p className="font-display text-3xl font-semibold tracking-[0.2em] text-fg">
                    {code || "••••••••"}
                  </p>
                </div>
                <ActionButton type="button" tone="secondary" onClick={copiarCodigo} disabled={!code}>
                  {copied ? "Copiado!" : "Copiar código"}
                </ActionButton>
              </div>
            </div>

            <p className="flex items-start gap-2 text-sm text-fg-muted">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
              Funciona com qualquer número, inclusive WhatsApp Business. O código prova que a conta é
              sua, então não compartilhe com ninguém.
            </p>
          </div>

          {WHATSAPP_CONFIGURED ? (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-lg border border-line bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/whatsapp/qr?v=${encodeURIComponent(code)}`}
                  alt="QR code para abrir a conversa do Moedin.IA no WhatsApp"
                  width={168}
                  height={168}
                  className="h-[168px] w-[168px]"
                />
              </div>
              <p className="flex items-center gap-1.5 text-xs text-fg-muted">
                <QrCode className="h-3.5 w-3.5" />
                No computador? Leia com o celular
              </p>
            </div>
          ) : null}
        </div>
      </Surface>

      <Surface tone="muted">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--brand)]" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-fg">2. Aguardando sua mensagem…</p>
            <p className="text-sm text-fg-muted">
              Assim que você enviar, esta tela confirma sozinha. Pode deixar aberta.
            </p>
          </div>
        </div>
      </Surface>

      <div className="flex justify-center">
        <Link href="/dashboard" className="text-sm text-fg-muted underline underline-offset-4 hover:text-fg">
          Conectar depois
        </Link>
      </div>
    </PageFrame>
  );
}
