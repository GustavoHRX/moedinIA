"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthShell from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { PASSWORD_MAX, firstError, validatePassword } from "@/lib/auth-validation";

export default function AtualizarSenhaPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  // A página só funciona com a sessão de recuperação criada pelo link do e-mail.
  // "checking" enquanto validamos; "ready" quando há sessão; "invalid" quando o
  // link expirou / foi aberto em outro navegador (PKCE não encontra o verifier).
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "invalid">("checking");

  useEffect(() => {
    let active = true;

    (async () => {
      // 1) o @supabase/ssr tenta detectar a sessão na URL sozinho ao consultar
      //    a auth; forçamos com getSession().
      let { data } = await supabase.auth.getSession();

      // 2) fluxo PKCE (?code=...): se o auto-detect não pegou, troca manualmente.
      if (!data.session && typeof window !== "undefined") {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          try {
            const exchanged = await supabase.auth.exchangeCodeForSession(code);
            data = { session: exchanged.data.session };
            url.searchParams.delete("code");
            window.history.replaceState({}, "", url.pathname + url.search + url.hash);
          } catch {
            // código já usado ou inválido — cai no estado "invalid" abaixo
          }
        }
      }

      if (!active) return;
      setSessionState(data.session ? "ready" : "invalid");
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setSessionState("ready");
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setIsError(false);

    if (sessionState !== "ready") {
      setMessage("O link de redefinição expirou ou foi aberto em outro navegador. Peça um novo e abra no mesmo aparelho.");
      setIsError(true);
      return;
    }

    const validationError = firstError(
      validatePassword(password),
      password !== confirmPassword ? "As senhas não coincidem." : null,
    );
    if (validationError) {
      setMessage(validationError);
      setIsError(true);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(translateAuthError(error.message));
      setIsError(true);
      return;
    }

    setMessage("Senha atualizada com sucesso. Redirecionando...");
    setTimeout(() => router.push("/login"), 1200);
  }

  return (
    <AuthShell
      eyebrow="Nova senha"
      title="Defina um acesso seguro para continuar."
      description="Atualize sua senha e volte ao painel do Moedin.IA com seus dados financeiros protegidos."
      features={["Senha renovada", "Conta protegida", "Retorno ao login"]}
      spotlightTitle="Segurança"
      spotlightText="Depois de salvar a nova senha, você será levado para entrar novamente no Moedin.IA."
      hominho="timachi"
    >
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
        <KeyRound className="h-6 w-6" />
      </div>
      <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-strong)]">Atualização de senha</p>
      <h1 className="mt-3 font-display text-4xl font-bold text-[var(--navy)]">Atualizar senha</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Defina uma nova senha para continuar usando sua conta.</p>

      {sessionState === "invalid" ? (
        <div className="mt-7 space-y-4">
          <div className="alert-error rounded-2xl px-4 py-3 text-sm font-semibold">
            Não encontramos uma sessão de redefinição válida. O link pode ter expirado, já ter sido
            usado, ou ter sido aberto em um navegador diferente de onde você pediu a recuperação.
          </div>
          <Link href="/recuperar-senha" className="btn-primary inline-flex w-full items-center justify-center px-5 py-3.5">
            Pedir um novo link
          </Link>
          <p className="text-center text-sm text-[var(--muted)]">
            <Link href="/login" className="font-semibold text-[var(--brand)] hover:text-[var(--brand-strong)]">
              Voltar para login
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleUpdate} className="mt-7 space-y-4" noValidate>
          <div>
            <label htmlFor="atualizar-senha" className="mb-2 block text-sm font-semibold text-[var(--text)]">Nova senha</label>
            <input id="atualizar-senha" name="new-password" className="control" type="password" autoComplete="new-password" required minLength={8} maxLength={PASSWORD_MAX} placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label htmlFor="atualizar-confirmar" className="mb-2 block text-sm font-semibold text-[var(--text)]">Confirmar nova senha</label>
            <input id="atualizar-confirmar" name="confirm-password" className="control" type="password" autoComplete="new-password" required minLength={8} maxLength={PASSWORD_MAX} placeholder="Repita a nova senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={loading || sessionState === "checking"} className="btn-primary w-full px-5 py-3.5 disabled:opacity-70">
            {sessionState === "checking" ? "Validando link..." : loading ? "Salvando..." : "Salvar nova senha"}
          </button>
          {message ? (
            <div className={isError ? "alert-error rounded-2xl px-4 py-3 text-sm font-semibold" : "alert-info rounded-2xl px-4 py-3 text-sm font-semibold"}>
              {message}
            </div>
          ) : null}
        </form>
      )}
    </AuthShell>
  );
}
