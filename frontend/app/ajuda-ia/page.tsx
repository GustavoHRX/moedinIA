"use client";

import DashboardHeader from "../components/DashboardHeader";
import { Sparkles, Bot, Lightbulb, TrendingUp } from "lucide-react";

export default function AjudaIAPage() {
  return (
    <main className="min-h-screen bg-[#F3F4F6] text-zinc-900">
      <DashboardHeader />

      <section className="mx-auto max-w-[1500px] px-6 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Ajuda com IA</h1>
          <p className="text-zinc-500">
            Área de apoio inteligente para orientar decisões financeiras.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2E9E4F]/15 text-[#2E9E4F]">
              <Bot size={22} />
            </div>

            <h2 className="text-xl font-semibold mb-2">Assistente Financeiro</h2>
            <p className="text-zinc-500 leading-7">
              Em breve você poderá conversar com a IA para receber sugestões
              sobre gastos, economia e organização financeira.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2E9E4F]/15 text-[#2E9E4F]">
              <Lightbulb size={22} />
            </div>

            <h2 className="text-xl font-semibold mb-2">Sugestões Inteligentes</h2>
            <p className="text-zinc-500 leading-7">
              O sistema poderá identificar padrões de gastos e sugerir ações
              para melhorar sua saúde financeira.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2E9E4F]/15 text-[#2E9E4F]">
              <TrendingUp size={22} />
            </div>

            <h2 className="text-xl font-semibold mb-2">Análises Automáticas</h2>
            <p className="text-zinc-500 leading-7">
              A IA poderá comparar receitas, despesas e categorias para mostrar
              alertas e oportunidades de economia.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-[#2E9E4F]/20 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2E9E4F] text-white">
              <Sparkles size={20} />
            </div>

            <div>
              <h2 className="text-xl font-semibold">Prévia do módulo de IA</h2>
              <p className="text-sm text-zinc-500">
                Tela provisória para a funcionalidade que será expandida depois.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-[#F8FAFC] p-5">
            <p className="text-zinc-700 leading-7">
              Exemplo de análise futura:
              <br />
              <span className="font-medium">
                “Seus gastos com alimentação cresceram 18% neste mês. Considere
                definir um limite semanal para melhorar o controle.”
              </span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}