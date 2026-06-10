"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData, type AppProfile } from "@/components/app-data-provider";
import { createClient } from "@/lib/supabase/client";
import { ActionButton, Alert, PageFrame, PageHeader, SectionHeader, Surface } from "@/components/ui-kit";
import { Skeleton } from "@/components/skeleton";

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
  const [copied, setCopied] = useState(false);

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

    const { count } = await supabase
      .from("whatsapp_links")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    setWaLinkedCount(count ?? 0);
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

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Surface>
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
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-2xl font-black text-white">
                  {initials || "U"}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-black text-[var(--navy)]">{fullName || "Sem nome"}</p>
                  <p className="truncate text-sm text-[var(--muted)]">{email}</p>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-[var(--text)]">Nome</span>
                    <input
                      className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
                      type="text"
                      placeholder="Seu nome"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-[var(--text)]">E-mail</span>
                    <input
                      className="w-full rounded-2xl border border-[var(--line)] bg-[var(--bg-soft)] px-4 py-3 text-[var(--muted)] outline-none"
                      type="text"
                      value={email}
                      disabled
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-[var(--text)]">Celular</span>
                    <input
                      className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
                      type="text"
                      placeholder="(11) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                    <span className="text-xs text-[var(--muted)]">Usado para reconhecer você ao lançar pelo WhatsApp.</span>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-[var(--text)]">Moeda</span>
                    <select
                      className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
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
                  <span className="text-sm font-semibold text-[var(--text)]">Fuso horário</span>
                  <input
                    className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
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

        <Surface>
          <SectionHeader title="Resumo da conta" eyebrow="Suporte" />

          <div className="mt-4 space-y-2">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-soft)] px-4 py-3">
              <p className="text-xs text-[var(--muted)]">Plano</p>
              <p className="font-semibold text-[var(--text)]">Gratuito</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-soft)] px-4 py-3">
              <p className="text-xs text-[var(--muted)]">Moeda</p>
              <p className="font-semibold text-[var(--text)]">{currency}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-soft)] px-4 py-3">
              <p className="text-xs text-[var(--muted)]">Fuso horário</p>
              <p className="font-semibold text-[var(--text)]">{timezone}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-soft)] px-4 py-3">
              <p className="text-xs text-[var(--muted)]">WhatsApp</p>
              <p className="text-sm font-semibold text-[var(--text)]">
                {waLinkedCount > 0 ? (
                  <span className="text-[var(--brand-strong)]">✅ Vinculado</span>
                ) : (
                  <span className="text-[var(--muted)]">Não vinculado</span>
                )}
              </p>
            </div>
          </div>
        </Surface>
      </section>

      <Surface>
        <SectionHeader title="Ativar no WhatsApp" eyebrow="Integração" />
        {waLinkedCount > 0 ? (
          <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-soft)] px-4 py-4">
            <p className="font-semibold text-[var(--brand-strong)]">✅ Seu WhatsApp já está vinculado!</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Já pode lançar gastos, pedir o relatório do mês e excluir lançamentos direto pelo WhatsApp. 💰
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <p className="text-sm text-[var(--muted)]">
              Pra usar o Moedin.IA pelo WhatsApp, mande o código abaixo para o nosso número.
              Funciona com qualquer número, inclusive WhatsApp Business.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border-2 border-dashed border-[var(--brand)] bg-[var(--bg-soft)] px-6 py-4">
                <p className="text-xs text-[var(--muted)]">Seu código de ativação</p>
                <p className="font-display text-3xl font-black tracking-[0.2em] text-[var(--navy)]">
                  {activationCode || "••••••••"}
                </p>
              </div>
              <ActionButton type="button" onClick={handleCopyCode} disabled={!activationCode}>
                {copied ? "Copiado!" : "Copiar código"}
              </ActionButton>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--text)]">
              <li>Abra a conversa com o Moedin.IA no WhatsApp.</li>
              <li>Mande o código <span className="font-bold">{activationCode || "..."}</span>.</li>
              <li>Pronto! Você recebe a confirmação e já pode lançar seus gastos. 🎉</li>
            </ol>
          </div>
        )}
      </Surface>
      </div>
    </PageFrame>
  );
}
