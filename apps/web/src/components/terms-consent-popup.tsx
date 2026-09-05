"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const TERMS_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";

/**
 * Revisão externa (ago/2026): as chaves de localStorage eram globais, então o
 * aceite de um usuário valia para qualquer outro que usasse o mesmo navegador
 * — o segundo usuário nunca via o banner e nenhum aceite era gravado para ele.
 * Agora a chave é por usuário; visitantes anônimos usam o sufixo "anon".
 */
function keyFor(name: string, userId: string | null) {
  return `moedin_${name}:${userId ?? "anon"}`;
}

type ConsentSettings = {
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  terms_version: string | null;
  privacy_version: string | null;
};

function hasLocalConsent(userId: string | null) {
  try {
    return (
      window.localStorage.getItem(keyFor("terms_accepted", userId)) === "true" &&
      window.localStorage.getItem(keyFor("terms_version", userId)) === TERMS_VERSION &&
      window.localStorage.getItem(keyFor("privacy_version", userId)) === PRIVACY_VERSION
    );
  } catch {
    return false;
  }
}

function storeLocalConsent(acceptedAt: string, userId: string | null) {
  try {
    window.localStorage.setItem(keyFor("terms_accepted", userId), "true");
    window.localStorage.setItem(keyFor("terms_accepted_at", userId), acceptedAt);
    window.localStorage.setItem(keyFor("terms_version", userId), TERMS_VERSION);
    window.localStorage.setItem(keyFor("privacy_version", userId), PRIVACY_VERSION);
  } catch {
    /* storage indisponível (janela privada): o aceite no banco é a fonte de verdade */
  }
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
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function syncConsent() {
      setChecking(true);
      setMessage("");

      let localAccepted = false;

      try {
        const supabase = createClient();
        // getSession() lê o cookie local sem chamar a rede — evita um 401/422
        // no console para cada visitante anônimo. Este banner não é fronteira
        // de segurança, então não precisa da validação do getUser().
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user ?? null;

        // O consentimento local é por usuário (ver keyFor): o aceite de um não
        // vale para outro que use o mesmo navegador.
        localAccepted = hasLocalConsent(user?.id ?? null);
        setUserId(user?.id ?? null);

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
          storeLocalConsent(settings?.terms_accepted_at || new Date().toISOString(), user.id);
          if (!cancelled) setVisible(false);
          return;
        }

        if (localAccepted) {
          const acceptedAt =
            window.localStorage.getItem(keyFor("terms_accepted_at", user.id)) ||
            new Date().toISOString();
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
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;

      storeLocalConsent(acceptedAt, user?.id ?? userId);

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
      <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-strong p-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm leading-6 text-fg">
          Guardamos seus dados financeiros só para o Moedin.IA funcionar, e as respostas da IA podem
          errar — a decisão final é sempre sua.{" "}
          <Link href="/termos" className="font-semibold text-primary-strong underline hover:text-primary">
            Ler os termos
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={handleAccept}
          disabled={saving}
          className="shrink-0 rounded-md bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-4 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Entendi"}
        </button>
      </div>
      {message ? (
        <p className="mt-2 rounded-md border border-[color:var(--warning)]/40 bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] px-3 py-2 text-xs font-semibold text-warning">
          {message}
        </p>
      ) : null}
    </div>
  );
}
