"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle, X } from "lucide-react";
import { useAppData } from "@/components/app-data-provider";
import { createClient } from "@/lib/supabase/client";
import { IconBox, Surface } from "@/components/ui-kit";

const DISMISS_KEY = "moedin:wa-card-dispensado-ate";
const DIAS_DISPENSA = 7;

/**
 * Convite para conectar o WhatsApp, no topo do painel.
 *
 * O código de ativação vivia só no fim do perfil, então quem criava conta nunca
 * descobria que o assistente existia. Este card é a descoberta; a tela de
 * /onboarding é o passo a passo.
 *
 * Some sozinho quando a conta já tem vínculo, e "agora não" adia por uma semana
 * para não virar barulho para quem não quer usar o WhatsApp.
 */
export default function WhatsAppConnectCard() {
  const supabase = useMemo(() => createClient(), []);
  const { user, loadingUser } = useAppData();
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    if (loadingUser || !user) return;

    let cancelado = false;
    (async () => {
      try {
        const ate = window.localStorage.getItem(DISMISS_KEY);
        if (ate && Date.now() < Number(ate)) return;
      } catch {
        /* localStorage indisponível: segue e mostra */
      }

      const { count, error } = await supabase
        .from("whatsapp_links")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Em caso de erro não inventa card: melhor não mostrar do que mostrar errado.
      if (!cancelado && !error && (count ?? 0) === 0) setMostrar(true);
    })();

    return () => {
      cancelado = true;
    };
  }, [loadingUser, user, supabase]);

  if (!mostrar) return null;

  function dispensar() {
    setMostrar(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DIAS_DISPENSA * 86400_000));
    } catch {
      /* sem localStorage: volta no próximo carregamento, tudo bem */
    }
  }

  return (
    <Surface className="relative overflow-hidden">
      <button
        type="button"
        onClick={dispensar}
        aria-label="Dispensar por uma semana"
        className="absolute right-3 top-3 rounded-md p-1.5 text-fg-soft transition-colors hover:bg-bg-soft hover:text-fg"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col gap-4 pr-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <IconBox size="lg" shape="circle" tone="brand">
            <MessageCircle className="h-5 w-5" />
          </IconBox>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-fg">
              Registre seus gastos pelo WhatsApp
            </p>
            <p className="mt-1 text-sm text-fg-muted">
              Mande &quot;gastei 35,90 no mercado&quot; e pronto. Leva dois minutos para conectar, e
              funciona com áudio, foto de comprovante e PDF de fatura.
            </p>
          </div>
        </div>
        <Link
          href="/onboarding"
          className="btn-primary inline-flex shrink-0 items-center justify-center px-5 py-2.5 text-sm"
        >
          Conectar agora
        </Link>
      </div>
    </Surface>
  );
}
