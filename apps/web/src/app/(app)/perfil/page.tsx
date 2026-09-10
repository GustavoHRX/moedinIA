"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppData, type AppProfile } from "@/components/app-data-provider";
import { createClient } from "@/lib/supabase/client";
import { Check, Crown, MessageCircle, RefreshCw, Unlink, Wallet } from "lucide-react";
import { ActionButton, Alert, IconBox, PageFrame, PageHeader, SectionHeader, Surface } from "@/components/ui-kit";
import { Skeleton } from "@/components/skeleton";
import { Money } from "@/components/money";
import { formatMoneyInputValue, parseMoneyInput } from "@/lib/formatters";
import { currentMonthRef } from "@/lib/dates";
import { useConfirm } from "@/components/confirm-dialog";
import { WHATSAPP_CONFIGURED, whatsappDeepLink, whatsappNumberDisplay } from "@/lib/whatsapp";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  currency: string | null;
  timezone: string | null;
};

export default function PerfilPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const {
    user: cachedUser,
    loadingUser,
    profile: cachedProfile,
    profileLoaded,
    refreshProfile,
    updateProfileCache,
  } = useAppData();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [activationCode, setActivationCode] = useState<string>("");
  const [waLinkedCount, setWaLinkedCount] = useState<number>(0);
  const [waLinkedAt, setWaLinkedAt] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Limite de gasto mensal = orçamento geral (budgets com category_id nulo).
  // Vale todo mês: ao salvar, grava o mesmo valor para os próximos 12 meses.
  const [limitInput, setLimitInput] = useState("");
  const [limitValue, setLimitValue] = useState<number | null>(null);
  const [savingLimit, setSavingLimit] = useState(false);

  const confirm = useConfirm();

  function showMessage(text: string, type: "success" | "error") {
    setMessage(text);
    setMessageType(type);
  }

  useEffect(() => {
    loadProfile();
  }, [loadingUser, cachedUser, profileLoaded, cachedProfile]);

  async function loadProfile() {
    setLoading(true);
    if (loadingUser) return;

    const user = cachedUser;

    if (!user) {
      router.push("/login");
      return;
    }

    setEmail(user.email || "");

    if (profileLoaded && cachedProfile) {
      fillForm(cachedProfile);
      setLoading(false);
      return;
    }

    const refreshedProfile = await refreshProfile();
    if (refreshedProfile) {
      fillForm(refreshedProfile);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setLoading(false);

    if (error) {
      showMessage(`Erro ao carregar perfil: ${error.message}`, "error");
      return;
    }

    if (data) {
      fillForm(data as Profile);
    }
  }

  useEffect(() => {
    if (!cachedUser?.id) return;
    loadWhatsApp(cachedUser.id);
  }, [cachedUser?.id]);

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

    // Orçamento geral mais recente (o valor "vale todo mês")
    const { data: budgetRow } = await supabase
      .from("budgets")
      .select("amount")
      .eq("user_id", userId)
      .is("category_id", null)
      .order("month_ref", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (budgetRow?.amount != null) {
      setLimitValue(Number(budgetRow.amount));
      setLimitInput(formatMoneyInputValue(String(budgetRow.amount)));
    }
  }

  async function handleSaveLimit(e: React.FormEvent) {
    e.preventDefault();
    const userId = cachedUser?.id;
    if (!userId) return;
    const parsed = parseMoneyInput(limitInput);
    if (!parsed || parsed <= 0) {
      showMessage("Informe um valor de limite válido.", "error");
      return;
    }

    setSavingLimit(true);
    const startMonth = currentMonthRef(); // "YYYY-MM-01"
    // Reescreve o orçamento geral do mês atual e dos próximos 12.
    await supabase
      .from("budgets")
      .delete()
      .eq("user_id", userId)
      .is("category_id", null)
      .gte("month_ref", startMonth);

    const rows = Array.from({ length: 13 }, (_, i) => {
      const d = new Date(`${startMonth}T00:00:00`);
      d.setMonth(d.getMonth() + i);
      return {
        user_id: userId,
        category_id: null,
        month_ref: `${d.toISOString().slice(0, 7)}-01`,
        amount: parsed,
      };
    });
    const { error } = await supabase.from("budgets").insert(rows);
    setSavingLimit(false);

    if (error) {
      showMessage(`Erro ao salvar limite: ${error.message}`, "error");
      return;
    }
    setLimitValue(parsed);
    setLimitInput(formatMoneyInputValue(String(parsed)));
    showMessage("Limite de gasto mensal atualizado.", "success");
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

  async function handleExportData() {
    setExporting(true);
    try {
      const res = await fetch("/api/account/export");
      // 207 = exportação parcial (alguma tabela falhou). Não entregamos um
      // arquivo incompleto como se estivesse completo.
      if (res.status === 207) {
        showMessage(
          "Não consegui exportar tudo agora. Tente de novo em instantes ou fale com o suporte.",
          "error",
        );
        return;
      }
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "moedin-meus-dados.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showMessage("Seus dados foram exportados.", "success");
    } catch {
      showMessage("Não foi possível exportar agora. Tente de novo em instantes.", "error");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    const ok = await confirm({
      title: "Apagar sua conta?",
      message:
        "Isso remove em definitivo seu perfil, lançamentos, metas, orçamentos e todo o histórico. Não dá para desfazer.",
      confirmLabel: "Apagar tudo",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "APAGAR" }),
      });
      if (!res.ok) throw new Error();
      await supabase.auth.signOut().catch(() => {});
      router.replace("/");
    } catch {
      showMessage("Não foi possível apagar a conta agora. Fale com o suporte.", "error");
      setDeleting(false);
    }
  }

  function fillForm(profile: Profile | AppProfile) {
    setFullName(profile.full_name || "");
    setPhone(profile.phone || "");
    setCurrency(profile.currency || "BRL");
    setTimezone(profile.timezone || "America/Sao_Paulo");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const userId = cachedUser?.id;
    if (!userId) {
      showMessage("Usuário não autenticado.", "error");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
        currency,
        timezone,
      })
      .eq("id", userId);

    setSaving(false);

    if (error) {
      showMessage(`Erro ao salvar perfil: ${error.message}`, "error");
      return;
    }

    showMessage("Perfil salvo com sucesso.", "success");
    updateProfileCache({
      id: userId,
      full_name: fullName,
      email,
      phone,
      currency,
      timezone,
    });
  }

  const initials = (fullName || email || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <PageFrame>
      <PageHeader
        title="Perfil e conta"
        description="Seus dados e preferências, do jeitinho que você quiser."
        eyebrow="Conta"
      />
      <div className="space-y-5">

      {message ? <Alert type={messageType}>{message}</Alert> : null}

      <Surface className="border-primary/30 bg-surface ring-1 ring-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--brand)] text-white">
              <Crown className="h-5 w-5" strokeWidth={2.4} />
            </div>
            <div>
              <p className="eyebrow">Seu plano</p>
              <p className="font-display text-2xl font-semibold text-fg">Pro</p>
            </div>
          </div>
          <span className="rounded-full border border-line bg-surface-strong px-3 py-1 text-xs font-semibold text-fg">
            Sem cobrança por enquanto
          </span>
        </div>

        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {[
            "Painel completo: dashboard, histórico e planejamento",
            "Metas, orçamentos, gastos fixos e parcelamentos",
            "Registro pelo WhatsApp: texto, áudio e foto do recibo",
            "IA que categoriza e lança por você",
          ].map((item) => (
            <li key={item} className="flex gap-2 text-sm font-semibold leading-6 text-fg">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.6} />
              {item}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs font-semibold text-fg-muted">
          Durante o desenvolvimento, todo mundo fica no Pro com acesso completo. Quando a
          assinatura for lançada, você é avisado com antecedência.
        </p>
      </Surface>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Surface className="min-w-0">
          <SectionHeader title="Dados pessoais" eyebrow="Preferências" />

          {loading ? (
            <div className="mt-2 space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <>
              <div className="mt-2 mb-5 flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-2xl font-semibold text-white">
                  {initials || "U"}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-semibold text-fg">{fullName || "Sem nome"}</p>
                  <p className="truncate text-sm text-fg-muted">{email}</p>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-fg">Nome</span>
                    <input
                      className="w-full rounded-md border border-line px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-ring"
                      type="text"
                      placeholder="Seu nome"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-fg">E-mail</span>
                    <input
                      className="w-full rounded-md border border-line bg-bg-soft px-4 py-3 text-fg-muted outline-none"
                      type="text"
                      value={email}
                      disabled
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-fg">Celular</span>
                    <input
                      className="w-full rounded-md border border-line px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-ring"
                      type="text"
                      placeholder="(11) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                    <span className="text-xs text-fg-muted">Usado para reconhecer você ao lançar pelo WhatsApp.</span>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-fg">Moeda</span>
                    <select
                      className="w-full rounded-md border border-line bg-surface-strong px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-ring"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    >
                      <option value="BRL">Real (BRL)</option>
                      <option value="USD">Dólar (USD)</option>
                      <option value="EUR">Euro (EUR)</option>
                    </select>
                  </label>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-fg">Fuso horário</span>
                  <input
                    className="w-full rounded-md border border-line px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-ring"
                    type="text"
                    placeholder="America/Sao_Paulo"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  />
                </label>

                <ActionButton type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar alterações"}
                </ActionButton>
              </form>
            </>
          )}
        </Surface>

        <Surface className="min-w-0">
          <SectionHeader title="Resumo da conta" eyebrow="Suporte" />

          <div className="mt-4 space-y-2">
            <div className="rounded-md border border-line bg-bg-soft px-4 py-3">
              <p className="text-xs text-fg-muted">Plano</p>
              <p className="font-semibold text-primary-strong">Pro</p>
            </div>
            <div className="rounded-md border border-line bg-bg-soft px-4 py-3">
              <p className="text-xs text-fg-muted">Moeda</p>
              <p className="font-semibold text-fg">{currency}</p>
            </div>
            <div className="rounded-md border border-line bg-bg-soft px-4 py-3">
              <p className="text-xs text-fg-muted">Fuso horário</p>
              <p className="font-semibold text-fg">{timezone}</p>
            </div>
            <div className="rounded-md border border-line bg-bg-soft px-4 py-3">
              <p className="text-xs text-fg-muted">WhatsApp</p>
              <p className="text-sm font-semibold text-fg">
                {waLinkedCount > 0 ? (
                  <span className="text-primary-strong">✅ Vinculado</span>
                ) : (
                  <span className="text-fg-muted">Não vinculado</span>
                )}
              </p>
            </div>
          </div>
        </Surface>
      </section>

      <Surface>
        <SectionHeader
          title="Limite de gasto mensal"
          description="Um teto para o mês. O alerta de 'perto do limite' usa esse valor. Vale para todos os meses."
        />
        <form onSubmit={handleSaveLimit} className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex items-center gap-3">
            <IconBox tone="brand" size="lg">
              <Wallet className="h-5 w-5" strokeWidth={2.2} />
            </IconBox>
            {limitValue != null ? (
              <Money value={limitValue} size="lg" />
            ) : (
              <span className="text-sm text-fg-muted">Sem limite definido</span>
            )}
          </div>
          <label className="block flex-1 space-y-1.5">
            <span className="text-xs font-medium text-fg-muted">Novo valor</span>
            <input
              className="control"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 3.500,00"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              onBlur={(e) => setLimitInput(formatMoneyInputValue(e.target.value))}
            />
          </label>
          <ActionButton type="submit" disabled={savingLimit}>
            {savingLimit ? "Salvando..." : "Salvar limite"}
          </ActionButton>
        </form>
      </Surface>

      <Surface>
        <SectionHeader
          title="WhatsApp"
          eyebrow="Integração"
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

      <Surface>
        <SectionHeader title="Privacidade e dados" eyebrow="LGPD" />
        <p className="mt-1 text-sm text-fg-muted">
          Você controla seus dados. Baixe uma cópia completa a qualquer momento ou
          apague sua conta em definitivo.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <ActionButton type="button" onClick={handleExportData} disabled={exporting}>
            {exporting ? "Preparando..." : "Baixar meus dados (JSON)"}
          </ActionButton>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="rounded-md border border-[color:var(--expense,#F87171)] px-5 py-3 text-sm font-semibold text-[color:var(--expense,#F87171)] transition hover:bg-[color-mix(in_srgb,var(--expense,#F87171)_10%,transparent)] disabled:opacity-60"
          >
            {deleting ? "Apagando..." : "Apagar minha conta"}
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-fg-muted">
          Dúvidas sobre seus dados? Fale com {" "}
          <a
            href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contato@moedin.ia"}`}
            className="font-semibold text-primary-strong underline"
          >
            {process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contato@moedin.ia"}
          </a>
          . Detalhes em <a href="/termos" className="font-semibold text-primary-strong underline">Termos e Privacidade</a>.
        </p>
      </Surface>
      </div>
    </PageFrame>
  );
}
