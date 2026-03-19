"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardHeader from "../components/DashboardHeader";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Transacao = {
  id_transacao: number;
  valor: number;
  descricao: string;
  data: string;
  categoria: string;
  tipo: "receita" | "despesa";
  id_user: number;
};

const cores = ["#2E9E4F", "#4ADE80", "#86EFAC", "#166534", "#22C55E", "#15803D"];

export default function RelatoriosPage() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [mensagem, setMensagem] = useState("Carregando relatórios...");

  useEffect(() => {
    carregarTransacoes();
  }, []);

  async function carregarTransacoes() {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/";
      return;
    }

    try {
      const resposta = await fetch("http://localhost:8000/transacoes", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resposta.ok) {
        setMensagem("Erro ao carregar relatórios.");
        return;
      }

      const dados = await resposta.json();
      setTransacoes(dados);
      setMensagem("");
    } catch {
      setMensagem("Erro ao conectar com o backend.");
    }
  }

  const receitasTotais = useMemo(() => {
    return transacoes
      .filter((t) => t.tipo === "receita")
      .reduce((acc, t) => acc + Number(t.valor), 0);
  }, [transacoes]);

  const despesasTotais = useMemo(() => {
    return transacoes
      .filter((t) => t.tipo === "despesa")
      .reduce((acc, t) => acc + Number(t.valor), 0);
  }, [transacoes]);

  const saldoFinal = receitasTotais - despesasTotais;

  const dadosMensais = useMemo(() => {
    const mapa: Record<string, { mes: string; receitas: number; despesas: number }> = {};

    transacoes.forEach((t) => {
      const dataObj = new Date(t.data);
      const mes = dataObj.toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      });

      if (!mapa[mes]) {
        mapa[mes] = {
          mes,
          receitas: 0,
          despesas: 0,
        };
      }

      if (t.tipo === "receita") {
        mapa[mes].receitas += Number(t.valor);
      } else {
        mapa[mes].despesas += Number(t.valor);
      }
    });

    return Object.values(mapa);
  }, [transacoes]);

  const dadosCategorias = useMemo(() => {
    const mapa: Record<string, number> = {};

    transacoes
      .filter((t) => t.tipo === "despesa")
      .forEach((t) => {
        mapa[t.categoria] = (mapa[t.categoria] || 0) + Number(t.valor);
      });

    return Object.entries(mapa).map(([name, value]) => ({
      name,
      value,
    }));
  }, [transacoes]);

  return (
    <main className="min-h-screen bg-[#F3F4F6] text-zinc-900">
      <DashboardHeader />

      <section className="mx-auto max-w-[1500px] px-6 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-zinc-500">
            Acompanhe receitas, despesas e categorias com base nos seus dados reais.
          </p>
        </div>

        {mensagem ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm text-zinc-500">
            {mensagem}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Receitas x Despesas</h2>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosMensais}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="mes" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" />
                      <Tooltip />
                      <Bar dataKey="receitas" fill="#2E9E4F" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="despesas" fill="#E11D48" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Gastos por Categoria</h2>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dadosCategorias}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={110}
                        innerRadius={60}
                      >
                        {dadosCategorias.map((_, index) => (
                          <Cell key={index} fill={cores[index % cores.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <ResumoCard
                titulo="Receitas Totais"
                valor={`R$ ${receitasTotais.toFixed(2)}`}
                cor="text-[#2E9E4F]"
              />
              <ResumoCard
                titulo="Despesas Totais"
                valor={`R$ ${despesasTotais.toFixed(2)}`}
                cor="text-[#E11D48]"
              />
              <ResumoCard
                titulo="Saldo Final"
                valor={`R$ ${saldoFinal.toFixed(2)}`}
                cor="text-zinc-900"
              />
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function ResumoCard({
  titulo,
  valor,
  cor,
}: {
  titulo: string;
  valor: string;
  cor: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-zinc-500">{titulo}</p>
      <h2 className={`mt-3 text-3xl font-bold ${cor}`}>{valor}</h2>
    </div>
  );
}