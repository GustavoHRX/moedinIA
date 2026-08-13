"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ACCEPTED_KEY = "moedin_terms_accepted";
const ACCEPTED_AT_KEY = "moedin_terms_accepted_at";
const TERMS_VERSION_KEY = "moedin_terms_version";
const PRIVACY_VERSION_KEY = "moedin_privacy_version";
const TERMS_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";

type ConsentSettings = {
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  terms_version: string | null;
  privacy_version: string | null;
};

function hasLocalConsent() {
  try {
    return (
      window.localStorage.getItem(ACCEPTED_KEY) === "true" &&
      window.localStorage.getItem(TERMS_VERSION_KEY) === TERMS_VERSION &&
      window.localStorage.getItem(PRIVACY_VERSION_KEY) === PRIVACY_VERSION
    );
  } catch {
    return false;
  }
}

function storeLocalConsent(acceptedAt: string) {
  window.localStorage.setItem(ACCEPTED_KEY, "true");
  window.localStorage.setItem(ACCEPTED_AT_KEY, acceptedAt);
  window.localStorage.setItem(TERMS_VERSION_KEY, TERMS_VERSION);
  window.localStorage.setItem(PRIVACY_VERSION_KEY, PRIVACY_VERSION);
}

function hasDatabaseConsent(settings: ConsentSettings | null) {
  return Boolean(
    settings?.terms_accepted_at &&
      settings?.privacy_accepted_at &&
      settings.terms_version === TERMS_VERSION &&
      settings.privacy_version === PRIVACY_VERSION
  );
}

/**
 * Banner de consentimento LGPD — não bloqueante (UX-01 do relatório de QA
 * de 11/ago/2026). Antes era um modal de tela cheia com cinco parágrafos
 * jurídicos e checkbox obrigatório na frente de qualquer coisa, inclusive
 * a landing pública. Agora é uma barra discreta no rodapé: uma frase em
 * linguagem direta, link pro texto completo em /termos, e um único botão —
 * clicar em "Entendi" já é o ato de consentimento, sem checkbox.
 *
 * O que não muda: o registro do aceite (versão + carimbo de tempo em
 * user_settings) continua idêntico ao fluxo anterior.
 */
export default function TermsConsentPopup() {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function syncConsent() {
      setChecking(true);
      setMessage("");

      const localAccepted = hasLocalConsent();

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) setVisible(!localAccepted);
          return;
        }

        const { data, error } = await supabase
          .from("user_settings")
          .select("terms_accepted_at, privacy_accepted_at, terms_version, privacy_version")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        const settings = data as ConsentSettings | null;
        if (hasDatabaseConsent(settings)) {
          storeLocalConsent(settings?.terms_accepted_at || new Date().toISOString());
          if (!cancelled) setVisible(false);
          return;
        }

        if (localAccepted) {
          const acceptedAt = window.localStorage.getItem(ACCEPTED_AT_KEY) || new Date().toISOString();
          const { error: upsertError } = await supabase.from("user_settings").upsert(
            {
              user_id: user.id,
              terms_accepted_at: acceptedAt,
              privacy_accepted_at: acceptedAt,
              terms_version: TERMS_VERSION,
              privacy_version: PRIVACY_VERSION,
            },
            { onConflict: "user_id" }
          );

          if (upsertError) throw upsertError;
          if (!cancelled) setVisible(false);
          return;
        }

        if (!cancelled) setVisible(true);
      } catch (error) {
        if (!cancelled) {
          setVisible(!localAccepted);
          setMessage(
            error instanceof Error
              ? `Não foi possível verificar o aceite: ${error.message}`
              : "Não foi possível verificar o aceite."
          );
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    syncConsent();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAccept() {
    setSaving(true);
    setMessage("");
    const acceptedAt = new Date().toISOString();

    try {
      storeLocalConsent(acceptedAt);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase.from("user_settings").upsert(
          {
            user_id: user.id,
            terms_accepted_at: acceptedAt,
            privacy_accepted_at: acceptedAt,
            terms_version: TERMS_VERSION,
            privacy_version: PRIVACY_VERSION,
          },
          { onConflict: "user_id" }
        );

        if (error) throw error;
      }

      setVisible(false);
    } catch (error) {
      // Aceite já ficou salvo localmente — não deixamos o banner travado
      // por uma falha de rede pontual com o Supabase.
      setMessage(
        error instanceof Error
          ? `Aceite salvo neste dispositivo; não sincronizou com a conta agora: ${error.message}`
          : "Aceite salvo neste dispositivo; não sincronizou com a conta agora."
      );
      setVisible(false);
    } finally {
      setSaving(false);
    }
  }

  if (!visible || checking) return null;

  return (
    <div
      role="region"
      aria-label="Aviso de privacidade"
      className="anim-pop-in fixed inset-x-3 bottom-3 z-[200] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:max-w-md"
    >
      <div className="flex flex-col gap-3 rounded-[16px] border border-[var(--line)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-strong)] sm:flex-row sm:items-center">
        <p className="flex-1 text-sm leading-6 text-[var(--muted-strong)]">
          Guardamos seus dados financeiros só para o Moedin.IA funcionar, e as respostas da IA podem
          errar — a decisão final é sempre sua.{" "}
          <Link href="/termos" className="font-semibold text-[var(--brand-strong)] underline hover:text-[var(--brand)]">
            Ler os termos
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={handleAccept}
          disabled={saving}
          className="shrink-0 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] shadow-[0_10px_28px_var(--brand-glow)] transition hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Entendi"}
        </button>
      </div>
      {message ? (
        <p className="mt-2 rounded-xl border border-[color:var(--warning)]/40 bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--warning)]">
          {message}
        </p>
      ) : null}
    </div>
  );
}
