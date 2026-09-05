import Link from "next/link";
import ThemedLogo from "@/components/themed-logo";

export const metadata = {
  title: "Termos de Uso e Privacidade",
};

const TERMS_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";

/**
 * Página pública com o texto completo dos Termos de Uso e da Política de
 * Privacidade. O banner de consentimento (terms-consent-popup.tsx) linka
 * pra cá em vez de despejar esse texto num modal bloqueante — ver UX-01
 * do relatório de QA de 11/ago/2026.
 */
export default function TermosPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-5 py-10 text-[var(--text)] sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="inline-flex" aria-label="Moedin.IA">
          <ThemedLogo className="h-11 w-[130px]" />
        </Link>

        <p className="mt-10 font-display text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-strong)]">
          Legal
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl">
          Termos de Uso e Política de Privacidade
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Versão dos Termos de Uso: {TERMS_VERSION} · Versão da Política de Privacidade: {PRIVACY_VERSION}
        </p>

        <div className="mt-8 space-y-5 rounded-[24px] border border-[var(--line)] bg-[var(--surface-strong)] p-6 text-base leading-7 text-[var(--muted-strong)] sm:p-8">
          <p>
            O Moedin.IA é uma ferramenta de apoio ao controle financeiro pessoal. Ao usar o app, você
            concorda com o registro de receitas e despesas, a categorização automática por
            Inteligência Artificial e a geração de relatórios, gráficos e alertas a partir dos dados
            que você informa.
          </p>
          <p>
            <strong className="text-[var(--text)]">O que fazemos com seus dados:</strong> valores,
            datas, categorias e metas ficam guardados só no seu perfil e servem só para o Moedin.IA
            funcionar e melhorar pra você. A gente não vende nem compartilha esses dados com
            terceiros para fins comerciais.
          </p>
          <p>
            <strong className="text-[var(--text)]">O que o Moedin.IA não faz:</strong> não realizamos
            pagamentos, transferências, investimentos ou qualquer operação bancária real. Tudo aqui é
            organização e visualização — o dinheiro continua onde já estava.
          </p>
          <p>
            <strong className="text-[var(--text)]">Sobre a IA:</strong> as respostas e categorizações
            geradas pela Inteligência Artificial têm caráter informativo e podem conter imprecisões.
            Você é responsável por revisar seus dados e tomar suas próprias decisões financeiras — a
            IA ajuda, mas não decide por você.
          </p>
          <p>
            <strong className="text-[var(--text)]">LGPD:</strong> tratamos seus dados pessoais
            conforme a Lei Geral de Proteção de Dados, com medidas técnicas e organizacionais para
            proteger as informações que você compartilha.
          </p>
          <p>
            <strong className="text-[var(--text)]">Seus direitos:</strong> você pode, a qualquer
            momento, acessar e baixar uma cópia completa dos seus dados e solicitar a exclusão
            definitiva da conta — ambos direto na página{" "}
            <Link href="/perfil" className="font-semibold text-[var(--brand-strong)] underline">
              Perfil
            </Link>
            , seção &quot;Privacidade e dados&quot;. Também pode pedir correção de dados ou
            esclarecimentos pelo contato abaixo.
          </p>
          <p>
            <strong className="text-[var(--text)]">Retenção:</strong> mantemos seus dados enquanto
            a conta existir. Ao apagar a conta, os dados são removidos. Os registros de mensagens
            do WhatsApp (<code>message_logs</code>) são mantidos por no máximo 180 dias para
            depuração e então descartados.
          </p>
          <p>
            <strong className="text-[var(--text)]">Compartilhamento:</strong> para funcionar, o
            Moedin.IA usa provedores de infraestrutura e de IA (Supabase, Groq e/ou OpenAI). O
            texto que você envia para categorização pode ser processado por esses provedores.
            Não vendemos nem cedemos seus dados para fins comerciais ou publicitários.
          </p>
          <p>
            <strong className="text-[var(--text)]">Contato / Encarregado (DPO):</strong>{" "}
            <a
              href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contato@moedin.ia"}`}
              className="font-semibold text-[var(--brand-strong)] underline"
            >
              {process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contato@moedin.ia"}
            </a>
          </p>
          <p>
            O uso do Moedin.IA implica a aceitação destes Termos de Uso e desta Política de
            Privacidade, nas versões indicadas acima.
          </p>
        </div>

        <Link
          href="/"
          className="mt-8 inline-flex text-sm font-semibold text-[var(--brand-strong)] hover:text-[var(--brand)]"
        >
          ← Voltar para o início
        </Link>
      </div>
    </main>
  );
}
