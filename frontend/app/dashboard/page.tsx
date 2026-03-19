"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Plus,
  Sparkles,
  X,
  Target,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import DashboardHeader from "../components/DashboardHeader";

type Transacao = {
  id_transacao: number;
  valor: number;
  descricao: string;
  data: string;
  categoria: string;
  tipo: "receita" | "despesa";
  id_user: number;
  id_meta: number | null;
};

type Meta = {
  id_meta: number;
  titulo: string;
  valor_alvo: number;
  valor_atual: number;
  data_limite: string;
  id_user: number;
};

const CORES = ["#F59E0B", "#0EA5E9", "#4CAF50", "#E91E63", "#9333EA", "#14B8A6"];

const categoriasFixas = [
  "Alimentação",
  "Transporte",
  "Moradia",
  "Saúde",
  "Educação",
  "Lazer",
  "Compras",
  "Outros",
];

export default function DashboardPage() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [mensagem, setMensagem] = useState("Carregando dashboard...");
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState("");
  const [categoria, setCategoria] = useState("Alimentação");
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");
  const [metaSelecionada, setMetaSelecionada] = useState("");

  useEffect(() => {
    carregarTransacoes();
    carregarMetas();
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
        setMensagem("Erro ao carregar os dados.");
        return;
      }

      const dados = await resposta.json();
      setTransacoes(dados);
      setMensagem("");
    } catch {
      setMensagem("Erro ao conectar com o backend.");
    }
  }

  async function carregarMetas() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const resposta = await fetch("http://localhost:8000/metas", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resposta.ok) return;

      const dados = await resposta.json();
      setMetas(dados);
    } catch {
      // silencioso
    }
  }

  async function criarTransacao(e: React.FormEvent) {
    e.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    if (!valor || !descricao || !data || !categoria) {
      alert("Preencha todos os campos.");
      return;
    }

    setCarregando(true);

    try {
      const resposta = await fetch("http://localhost:8000/transacoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          valor: Number(valor),
          descricao,
          data,
          categoria,
          tipo,
          id_meta: metaSelecionada ? Number(metaSelecionada) : null,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(dados.detail || "Erro ao salvar transação");
        setCarregando(false);
        return;
      }

      setValor("");
      setDescricao("");
      setData("");
      setCategoria("Alimentação");
      setTipo("despesa");
      setMetaSelecionada("");
      setModalAberto(false);

      await carregarTransacoes();
      await carregarMetas();
    } catch {
      alert("Erro ao conectar com o backend");
    } finally {
      setCarregando(false);
    }
  }

  const receitas = useMemo(() => {
    return transacoes
      .filter((t) => t.tipo === "receita")
      .reduce((acc, t) => acc + Number(t.valor), 0);
  }, [transacoes]);

  const despesas = useMemo(() => {
    return transacoes
      .filter((t) => t.tipo === "despesa")
      .reduce((acc, t) => acc + Number(t.valor), 0);
  }, [transacoes]);

  const saldo = receitas - despesas;

  const distribuicao = useMemo(() => {
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

  const totalDistribuicao = distribuicao.reduce((acc, item) => acc + item.value, 0);

  const insightIA = useMemo(() => {
    if (transacoes.length === 0) {
      return [
        "Cadastre seus primeiros lançamentos para a IA começar a gerar dicas.",
        "Quando houver dados suficientes, mostraremos padrões de gasto e oportunidades de economia.",
        "Seu painel inteligente ficará mais útil conforme você usar o sistema.",
      ];
    }

    const maiorCategoria = [...distribuicao].sort((a, b) => b.value - a.value)[0];
    const dicas: string[] = [];

    if (maiorCategoria) {
      dicas.push(
        `Sua maior categoria atual é ${maiorCategoria.name}, com R$ ${maiorCategoria.value.toFixed(2)}.`
      );
    }

    if (despesas > receitas) {
      dicas.push("Suas despesas estão maiores que suas receitas. Vale revisar os gastos variáveis.");
    } else {
      dicas.push("Seu saldo está positivo. Continue mantendo esse equilíbrio financeiro.");
    }

    if (despesas > 0 && receitas > 0) {
      const percentual = (despesas / receitas) * 100;
      dicas.push(`Hoje suas despesas representam ${percentual.toFixed(0)}% da sua receita.`);
    }

    return dicas;
  }, [transacoes, distribuicao, despesas, receitas]);

  const metasDestaque = metas.slice(0, 3);

  return (
    <main className="min-h-screen bg-[#F3F4F6] text-zinc-900">
      <DashboardHeader />

      <section className="mx-auto max-w-[1500px] px-6 py-5">
        {mensagem ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-zinc-500 shadow-sm">
            {mensagem}
          </div>
        ) : (
          <>
            <div className="mb-6 flex justify-end">
              <button
                onClick={() => setModalAberto(true)}
                className="flex items-center gap-2 rounded-2xl bg-[#2E9E4F] px-6 py-4 text-sm font-semibold text-white shadow hover:bg-[#277F40] transition"
              >
                <Plus size={18} />
                Adicionar gasto ou receita
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <div className="xl:col-span-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-zinc-500">Receita mensal</p>
                <h2 className="mt-3 text-4xl font-semibold text-[#2E9E4F]">
                  R$ {receitas.toFixed(2)}
                </h2>
              </div>

              <div className="xl:col-span-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-zinc-500">Despesa mensal</p>
                <h2 className="mt-3 text-4xl font-semibold text-[#E11D48]">
                  R$ {despesas.toFixed(2)}
                </h2>
              </div>

              <div className="xl:col-span-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-zinc-500">Saldo geral</p>
                    <h2 className="mt-3 text-4xl font-semibold text-zinc-900">
                      R$ {saldo.toFixed(2)}
                    </h2>
                  </div>
                  <Eye className="text-zinc-400" size={18} />
                </div>
              </div>

              <div className="xl:col-span-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm min-h-[520px]">
                <div className="h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distribuicao}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={80}
                        outerRadius={130}
                        paddingAngle={3}
                      >
                        {distribuicao.map((_, index) => (
                          <Cell key={index} fill={CORES[index % CORES.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="-mt-16 text-center">
                  <p className="text-4xl font-bold">R$ {despesas.toFixed(2)}</p>
                  <p className="text-sm text-zinc-500">Total</p>
                </div>
              </div>

              <div className="xl:col-span-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm min-h-[520px]">
                <h3 className="mb-5 text-xl font-semibold">Distribuição de Gastos</h3>

                <div className="space-y-5">
                  {distribuicao.length === 0 ? (
                    <p className="text-zinc-500">Nenhuma despesa cadastrada ainda.</p>
                  ) : (
                    distribuicao.map((item, index) => (
                      <div key={item.name} className="flex items-start gap-3">
                        <span
                          className="mt-1 h-4 w-4 rounded-full"
                          style={{ backgroundColor: CORES[index % CORES.length] }}
                        />
                        <div className="flex-1">
                          <p className="text-sm text-zinc-500">{item.name}</p>
                          <p className="text-3xl font-medium">R$ {item.value.toFixed(2)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-8 border-t border-zinc-200 pt-5 text-right">
                  <p className="text-sm text-zinc-500">Total</p>
                  <p className="text-3xl font-semibold">R$ {totalDistribuicao.toFixed(2)}</p>
                </div>
              </div>

              <div className="xl:col-span-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm min-h-[520px]">
                <h3 className="mb-5 text-xl font-semibold">Metas em destaque</h3>

                <div className="space-y-4">
                  {metasDestaque.length === 0 ? (
                    <p className="text-zinc-500">Nenhuma meta cadastrada ainda.</p>
                  ) : (
                    metasDestaque.map((meta) => {
                      const percentual = Math.min(
                        100,
                        meta.valor_alvo > 0
                          ? (Number(meta.valor_atual) / Number(meta.valor_alvo)) * 100
                          : 0
                      );

                      return (
                        <div key={meta.id_meta} className="rounded-2xl border border-zinc-200 p-4">
                          <div className="mb-3 flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2E9E4F]/15 text-[#2E9E4F]">
                              <Target size={16} />
                            </div>
                            <div>
                              <p className="font-semibold">{meta.titulo}</p>
                              <p className="text-xs text-zinc-500">
                                Limite: {meta.data_limite}
                              </p>
                            </div>
                          </div>

                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="text-zinc-500">
                              R$ {Number(meta.valor_atual).toFixed(2)}
                            </span>
                            <span className="font-medium text-zinc-900">
                              R$ {Number(meta.valor_alvo).toFixed(2)}
                            </span>
                          </div>

                          <div className="h-3 w-full rounded-full bg-zinc-200">
                            <div
                              className="h-3 rounded-full bg-[#2E9E4F]"
                              style={{ width: `${percentual}%` }}
                            />
                          </div>

                          <p className="mt-2 text-xs text-zinc-500">
                            {percentual.toFixed(0)}% concluído
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-[#2E9E4F]" />
                  <h3 className="text-xl font-semibold">Dicas da IA para você</h3>
                </div>

                <button className="rounded-2xl border border-[#2E9E4F] px-4 py-2 text-sm font-medium text-[#2E9E4F] hover:bg-[#2E9E4F]/10 transition">
                  Pedir nova dica
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                {insightIA.map((dica, index) => (
                  <div
                    key={index}
                    className={`rounded-2xl px-4 py-4 text-sm ${
                      index === 0
                        ? "bg-[#2E9E4F]/20 text-zinc-800"
                        : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {dica}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Novo lançamento</h2>
              <button
                onClick={() => setModalAberto(false)}
                className="rounded-full p-2 hover:bg-zinc-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={criarTransacao} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-zinc-600">Descrição</label>
                <input
                  type="text"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Mercado, Uber, Salário..."
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-zinc-600">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-zinc-600">Data</label>
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-zinc-600">Categoria</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
                  >
                    {categoriasFixas.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-zinc-600">Tipo</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as "despesa" | "receita")}
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
                  >
                    <option value="despesa">Despesa</option>
                    <option value="receita">Receita</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-zinc-600">
                  Vincular a uma meta (opcional)
                </label>
                <select
                  value={metaSelecionada}
                  onChange={(e) => setMetaSelecionada(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
                >
                  <option value="">Nenhuma</option>

                  {metas.map((meta) => (
                    <option key={meta.id_meta} value={meta.id_meta}>
                      {meta.titulo}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={carregando}
                className="mt-4 w-full rounded-2xl bg-[#2E9E4F] py-4 text-sm font-semibold text-white hover:bg-[#277F40] transition disabled:opacity-60"
              >
                {carregando ? "Salvando..." : "Salvar lançamento"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}