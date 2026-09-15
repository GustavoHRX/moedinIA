"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppData } from "@/components/app-data-provider";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, RefreshCw, Unlink } from "lucide-react";
import { ActionButton, Alert, PageFrame, PageHeader, SectionHeader, Surface } from "@/components/ui-kit";
import { useConfirm } from "@/components/confirm-dialog";
import { WHATSAPP_CONFIGURED, whatsappDeepLink, whatsappNumberDisplay } from "@/lib/whatsapp";

export default function WhatsAppPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const confirm = useConfirm();
  const { user: cachedUser, loadingUser } = useAppData();

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [activationCode, setActivationCode] = useState<string>("");
  const [waLinkedCount, setWaLinkedCount] = useState<number>(0);
  const [waLinkedAt, setWaLinkedAt] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [copied, setCopied] = useState(false);

  function showMessage(text: string, type: "success" | "error") {
    setMessage(text);
    setMessageType(type);
  }

  useEffect(() => {
    if (loadingUser) return;
    if (!cachedUser) {
      router.push("/login");
      return;
    }
    loadWhatsApp(cachedUser.id);
  }, [loadingUser, cachedUser]);

  async function loadWhatsApp(userId: string) {
    const { data: codeData } = await supabase.rpc("ensure_activation_code");
    if (codeData?.code) setActivationCode(codeData.code);

    const { data: links } = await supabase
      .from("whatsapp_links")
      .select("id, updated_at, created_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    setWaLinkedCount(links?.length ?? 0);
    setWaLinkedAt(links?.[0]?.updated_at ?? links?.[0]?.created_at ?? null);
  }

  // Vazou num print, numa tela compartilhada? Um código novo invalida o antigo
  // na hora — quem tiver o velho não consegue mais vincular.
  async function handleRegenerateCode() {
    const ok = await confirm({
      title: "Gerar um novo código?",
      message:
        "O código atual para de funcionar imediatamente. Quem já está vinculado continua vinculado.",
      confirmLabel: "Gerar novo código",
    });
    if (!ok) return;
    setRegenerating(true);
    const { data, error } = await supabase.rpc("regenerate_activation_code");
    setRegenerating(false);
    const novo = (data as { code?: string } | null)?.code;
    if (error || !novo) {
      showMessage("Não consegui gerar um novo código. Tente de novo.", "error");
      return;
    }
    setActivationCode(novo);
    showMessage("Novo código gerado. O anterior não vale mais.", "success");
  }

  // Perdeu o aparelho, trocou de número, emprestou o celular: corta o acesso.
  async function handleUnlink() {
    const ok = await confirm({
      title: "Desvincular o WhatsApp?",
      message:
        "Aquele número para de registrar e consultar seus dados. Seus lançamentos continuam aqui. Você pode vincular de novo quando quiser.",
      confirmLabel: "Desvincular",
      tone: "danger",
    });
    if (!ok) return;
    setUnlinking(true);
    const { error } = await supabase.rpc("whatsapp_unlink");
    setUnlinking(false);
    if (error) {
      showMessage("Não consegui desvincular. Tente de novo.", "error");
      return;
    }
    setWaLinkedCount(0);
    setWaLinkedAt(null);
    showMessage("WhatsApp desvinculado.", "success");
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(activationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showMessage("Não consegui copiar. Copie o código manualmente.", "error");
    }
  }

  return (
    <PageFrame>
      <PageHeader
        title="WhatsApp"
        description="Vincule seu número para lançar gastos, pedir relatórios e mais, direto pela conversa."
        eyebrow="Integração"
      />
      <div className="space-y-5">
        {message ? <Alert type={messageType}>{message}</Alert> : null}

        <Surface>
          <SectionHeader
            title="Conexão"
            description={
              WHATSAPP_CONFIGURED
                ? `Assistente do Moedin.IA no ${whatsappNumberDisplay()}.`
                : "O número do assistente ainda não foi configurado neste ambiente."
            }
          />
          {waLinkedCount > 0 ? (
            <div className="mt-3 space-y-4">
              <div className="rounded-md border border-line bg-bg-soft px-4 py-4">
                <p className="font-semibold text-primary-strong">✅ Seu WhatsApp está vinculado</p>
                <p className="mt-1 text-sm text-fg-muted">
                  Você pode lançar gastos, pedir relatório, definir limite e importar a fatura do cartão
                  direto pela conversa.
                  {waLinkedAt
                    ? ` Vinculado em ${new Date(waLinkedAt).toLocaleDateString("pt-BR")}.`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {WHATSAPP_CONFIGURED ? (
                  <a
                    href={whatsappDeepLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Abrir a conversa
                  </a>
                ) : null}
                <ActionButton type="button" tone="danger" onClick={handleUnlink} disabled={unlinking}>
                  <Unlink className="h-4 w-4" />
                  {unlinking ? "Desvinculando..." : "Desvincular"}
                </ActionButton>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              <p className="text-sm text-fg-muted">
                Ainda não conectado. A tela de conexão traz o botão que já abre a conversa com o código
                escrito, e um QR para quem está no computador.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/onboarding"
                  className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
                >
                  <MessageCircle className="h-4 w-4" />
                  Conectar o WhatsApp
                </Link>
                <div className="rounded-md border border-dashed border-line bg-bg-soft px-4 py-2.5">
                  <p className="text-[11px] text-fg-muted">Código de ativação</p>
                  <p className="font-display text-lg font-semibold tracking-[0.18em] text-fg">
                    {activationCode || "••••••••"}
                  </p>
                </div>
                <ActionButton type="button" tone="secondary" onClick={handleCopyCode} disabled={!activationCode}>
                  {copied ? "Copiado!" : "Copiar"}
                </ActionButton>
              </div>
            </div>
          )}

          <div className="mt-5 border-t border-line pt-4">
            <p className="text-sm font-semibold text-fg">Segurança do código</p>
            <p className="mt-1 text-sm text-fg-muted">
              O código de ativação é a chave da sua conta no WhatsApp: quem tiver ele consegue vincular
              o próprio número. Se aparecer num print ou numa tela compartilhada, gere outro.
            </p>
            <ActionButton
              type="button"
              tone="secondary"
              className="mt-3"
              onClick={handleRegenerateCode}
              disabled={regenerating}
            >
              <RefreshCw className="h-4 w-4" />
              {regenerating ? "Gerando..." : "Gerar novo código"}
            </ActionButton>
          </div>
        </Surface>
      </div>
    </PageFrame>
  );
}
