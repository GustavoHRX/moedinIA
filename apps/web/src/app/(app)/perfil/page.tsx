"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ActionButton, PageFrame, PageHeader, SectionHeader, Surface } from "@/components/ui-kit";

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

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.push("/login");
      return;
    }

    setUserId(user.id);
    setEmail(user.email || "");

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setLoading(false);

    if (error) {
      setMessage(`Erro ao carregar perfil: ${error.message}`);
      return;
    }

    const profile = data as Profile;
    setFullName(profile.full_name || "");
    setPhone(profile.phone || "");
    setCurrency(profile.currency || "BRL");
    setTimezone(profile.timezone || "America/Sao_Paulo");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

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
      setMessage(`Erro ao salvar perfil: ${error.message}`);
      return;
    }

    setMessage("Perfil salvo com sucesso.");
  }

  return (
    <PageFrame>
      <PageHeader
        title="Perfil e conta"
        description="Atualize dados pessoais e preferências de conta."
        eyebrow="Conta"
      />
      <div className="space-y-5">

      {message ? (
        <div className="alert-info rounded-2xl px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Surface>
          <SectionHeader title="Dados pessoais" eyebrow="Preferências" />

          {loading ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Carregando perfil...</p>
          ) : (
            <form onSubmit={handleSave} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
                  type="text"
                  placeholder="Nome"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <input
                  className="rounded-2xl border border-[var(--line)] bg-[var(--bg-soft)] px-4 py-3 text-[var(--muted)] outline-none"
                  type="text"
                  value={email}
                  disabled
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
                  type="text"
                  placeholder="Celular"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <input
                  className="rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
                  type="text"
                  placeholder="Moeda"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                />
              </div>

              <input
                className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
                type="text"
                placeholder="Fuso horário"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />

              <ActionButton
                type="submit"
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </ActionButton>
            </form>
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
              <p className="text-xs text-[var(--muted)]">ID do usuário</p>
              <p className="break-all text-sm font-semibold text-[var(--text)]">{userId || "-"}</p>
            </div>
          </div>
        </Surface>
      </section>
      </div>
    </PageFrame>
  );
}
