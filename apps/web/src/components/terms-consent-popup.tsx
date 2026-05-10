"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ACCEPTED_KEY = "moedin_terms_accepted";
const ACCEPTED_AT_KEY = "moedin_terms_accepted_at";
const TERMS_VERSION_KEY = "moedin_terms_version";
const PRIVACY_VERSION_KEY = "moedin_privacy_version";
const TERMS_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";

const privateRoutes = [
  "/dashboard",
  "/perfil",
  "/lancamentos",
  "/historico",
  "/metas",
  "/gastos-fixos",
  "/parcelamentos",
  "/planejamento-mensal",
  "/planos",
];

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

export default function TermsConsentPopup() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const isPrivateRoute = privateRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

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
          if (!cancelled) {
            setVisible(!localAccepted);
          }
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
          setVisible(!localAccepted || isPrivateRoute);
          setMessage(
            error instanceof Error
              ? `Nao foi possivel verificar o aceite: ${error.message}`
              : "Nao foi possivel verificar o aceite."
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
  }, [isPrivateRoute]);

  useEffect(() => {
    if (!visible || isPrivateRoute) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setVisible(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPrivateRoute, visible]);

  async function handleAccept() {
    if (!accepted) return;

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
      setMessage(
        error instanceof Error
          ? `Aceite salvo localmente, mas nao foi possivel sincronizar com o Supabase: ${error.message}`
          : "Aceite salvo localmente, mas nao foi possivel sincronizar com o Supabase."
      );

      if (!isPrivateRoute) {
        setVisible(false);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!visible || checking) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-[#1A1A1A]/55 px-3 py-4 backdrop-blur-sm sm:items-center sm:px-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-consent-title"
        className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-[rgba(46,158,79,0.22)] bg-white text-[#1A1A1A] shadow-[0_30px_90px_rgba(26,26,26,0.22)]"
      >
        <div className="border-b border-[rgba(26,26,26,0.08)] bg-[linear-gradient(135deg,#ffffff_0%,#eefaf4_58%,#dff4e6_100%)] px-5 py-5 sm:px-7 sm:py-6">
          <p className="font-display text-xs font-extrabold uppercase tracking-[0.14em] text-[#2E9E4F]">
            Consentimento obrigatorio
          </p>
          <h2 id="terms-consent-title" className="mt-2 font-display text-2xl font-black leading-tight sm:text-3xl">
            Termos de Uso e Privacidade - Moedin.IA
          </h2>
        </div>

        <div className="max-h-[62vh] overflow-y-auto px-5 py-5 sm:max-h-[58vh] sm:px-7">
          <div className="space-y-4 text-base font-medium leading-7 text-[#39413c]">
            <p>
              Ao utilizar o Moedin.IA, voce concorda com o uso da plataforma para apoio no controle financeiro pessoal,
              incluindo registro de receitas e despesas, categorizacao automatica por Inteligencia Artificial, geracao
              de relatorios, graficos e alertas.
            </p>
            <p>
              As informacoes inseridas pelo usuario, como valores, datas, categorias e metas financeiras, serao
              utilizadas apenas para o funcionamento do sistema e melhoria da experiencia. O Moedin.IA nao realiza
              pagamentos, transferencias, investimentos ou operacoes bancarias.
            </p>
            <p>
              As respostas e recomendacoes geradas pela Inteligencia Artificial possuem carater informativo e podem
              conter imprecisoes. Portanto, o usuario e responsavel por revisar seus dados e tomar suas proprias
              decisoes financeiras.
            </p>
            <p>
              O sistema tratara dados pessoais conforme a LGPD, adotando medidas de seguranca para proteger as
              informacoes fornecidas. O uso do Moedin.IA implica a aceitacao dos Termos de Uso e da Politica de
              Privacidade.
            </p>
            <p>
              Versao dos Termos de Uso: {TERMS_VERSION}. Versao da Politica de Privacidade: {PRIVACY_VERSION}.
            </p>
          </div>

          {message ? (
            <div className="mt-5 rounded-2xl border border-[#f2b84b]/40 bg-[#fff7e6] px-4 py-3 text-sm font-semibold text-[#7a4d00]">
              {message}
            </div>
          ) : null}

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[20px] border border-[rgba(46,158,79,0.24)] bg-[#F2F2F2] px-4 py-4 text-base font-bold leading-6 text-[#1A1A1A]">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1 h-5 w-5 accent-[#2E9E4F]"
            />
            <span>Li e aceito os Termos de Uso e a Politica de Privacidade.</span>
          </label>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[rgba(26,26,26,0.08)] bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
          {!isPrivateRoute ? (
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="rounded-2xl border border-[rgba(26,26,26,0.12)] bg-white px-5 py-3 font-display text-sm font-extrabold text-[#1A1A1A] transition hover:border-[#2E9E4F] focus:outline-none focus:ring-4 focus:ring-[rgba(46,158,79,0.22)]"
            >
              Ver depois / Fechar
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleAccept}
            disabled={!accepted || saving}
            className="rounded-2xl bg-[#2E9E4F] px-5 py-3 font-display text-sm font-extrabold text-white shadow-[0_16px_34px_rgba(46,158,79,0.24)] transition hover:bg-[#21773b] focus:outline-none focus:ring-4 focus:ring-[rgba(46,158,79,0.28)] disabled:cursor-not-allowed disabled:bg-[#b8c8bd] disabled:shadow-none"
          >
            {saving ? "Salvando..." : "Aceitar e continuar"}
          </button>
        </div>
      </section>
    </div>
  );
}
