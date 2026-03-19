"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
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

const categoriasFixas = [
  "Todas",
  "Alimentação",
  "Transporte",
  "Moradia",
  "Saúde",
  "Educação",
  "Lazer",
  "Compras",
  "Outros",
];

export default function GastosPage() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [mensagem, setMensagem] = useState("Carregando lançamentos...");
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [tipoFiltro, setTipoFiltro] = useState("Todos");
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
        setMensagem("Erro ao carregar lançamentos.");
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

    if (!token) {
      return;
    }

    try {
      const resposta = await fetch("http://localhost:8000/metas", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resposta.ok) {
        return;
      }

      const dados = await resposta.json();
      setMetas(dados);
    } catch {
      // sem alerta aqui para não poluir a UX
    }
  }

  function abrirNovoLancamento() {
    setValor("");
    setDescricao("");
    setData("");
    setCategoria("Alimentação");
    setTipo("despesa");
    setMetaSelecionada("");
    setModalAberto(true);
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
        alert(dados.detail || "Erro ao salvar lançamento.");
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
      alert("Erro ao conectar com o backend.");
    } finally {
      setCarregando(false);
    }
  }

  async function excluirTransacao(id: number) {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/";
      return;
    }

    const confirmar = window.confirm("Deseja excluir este lançamento?");
    if (!confirmar) return;

    try {
      const resposta = await fetch(`http://localhost:8000/transacoes/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resposta.ok) {
        alert("Erro ao excluir lançamento.");
        return;
      }

      await carregarTransacoes();
    } catch {
      alert("Erro ao conectar com o backend.");
    }
  }

  function nomeMetaPorId(idMeta: number | null) {
    if (!idMeta) return null;
    const meta = metas.find((m) => m.id_meta === idMeta);
    return meta ? meta.titulo : null;
  }

  const transacoesFiltradas = useMemo(() => {
    return transacoes.filter((item) => {
      const bateBusca =
        item.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        item.categoria.toLowerCase().includes(busca.toLowerCase()) ||
        (nomeMetaPorId(item.id_meta) || "")
          .toLowerCase()
          .includes(busca.toLowerCase());

      const bateCategoria =
        categoriaFiltro === "Todas" || item.categoria === categoriaFiltro;

      const bateTipo = tipoFiltro === "Todos" || item.tipo === tipoFiltro;

      return bateBusca && bateCategoria && bateTipo;
    });
  }, [transacoes, busca, categoriaFiltro, tipoFiltro, metas]);

  const totalDespesas = transacoes
    .filter((t) => t.tipo === "despesa")
    .reduce((acc, t) => acc + Number(t.valor), 0);

  const totalReceitas = transacoes
    .filter((t) => t.tipo === "receita")
    .reduce((acc, t) => acc + Number(t.valor), 0);

  const quantidade = transacoes.length;

  return (
    <main className="min-h-screen bg-[#F3F4F6] text-zinc-900">
      <DashboardHeader />

      <section className="mx-auto max-w-[1500px] px-6 py-5">
        <div className="mb-5">
          <h1 className="text-3xl font-bold">Lançamentos</h1>
          <p className="text-zinc-500">
            Registre e acompanhe seus gastos e receitas de forma organizada.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
          <ResumoCard
            titulo="Total de despesas"
            valor={`R$ ${totalDespesas.toFixed(2)}`}
          />
          <ResumoCard
            titulo="Total de receitas"
            valor={`R$ ${totalReceitas.toFixed(2)}`}
          />
          <ResumoCard titulo="Registros" valor={`${quantidade}`} />

          <button
            onClick={abrirNovoLancamento}
            className="flex items-center justify-center gap-2 rounded-3xl bg-[#2E9E4F] px-6 py-5 text-white font-semibold shadow hover:bg-[#277F40] transition"
          >
            <Plus size={18} />
            Novo lançamento
          </button>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                placeholder="Buscar por descrição, categoria ou meta..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full rounded-2xl border border-zinc-300 bg-white py-3 pl-11 pr-4 outline-none focus:border-[#2E9E4F]"
              />
            </div>

            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 outline-none focus:border-[#2E9E4F]"
            >
              {categoriasFixas.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-3">
              <SlidersHorizontal size={18} className="text-zinc-400" />
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 outline-none focus:border-[#2E9E4F]"
              >
                <option value="Todos">Todos os tipos</option>
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </select>
            </div>
          </div>

          {mensagem ? (
            <div className="rounded-2xl bg-zinc-50 p-5 text-zinc-500">
              {mensagem}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-sm text-zinc-500">
                    <th className="px-4">Data</th>
                    <th className="px-4">Descrição</th>
                    <th className="px-4">Categoria</th>
                    <th className="px-4">Meta</th>
                    <th className="px-4">Tipo</th>
                    <th className="px-4">Valor</th>
                    <th className="px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {transacoesFiltradas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-zinc-500"
                      >
                        Nenhum lançamento encontrado.
                      </td>
                    </tr>
                  ) : (
                    transacoesFiltradas.map((item) => {
                      const nomeMeta = nomeMetaPorId(item.id_meta);

                      return (
                        <tr
                          key={item.id_transacao}
                          className="bg-[#F8FAFC] shadow-sm"
                        >
                          <td className="rounded-l-2xl px-4 py-4 text-sm text-zinc-600">
                            {item.data}
                          </td>

                          <td className="px-4 py-4">
                            <p className="font-semibold">{item.descricao}</p>
                          </td>

                          <td className="px-4 py-4">
                            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700">
                              {item.categoria}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            {nomeMeta ? (
                              <span className="rounded-full bg-[#2E9E4F]/10 px-3 py-1 text-sm text-[#2E9E4F]">
                                {nomeMeta}
                              </span>
                            ) : (
                              <span className="text-sm text-zinc-400">
                                Sem meta
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-sm font-medium ${
                                item.tipo === "receita"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {item.tipo}
                            </span>
                          </td>

                          <td
                            className={`px-4 py-4 font-semibold ${
                              item.tipo === "receita"
                                ? "text-[#2E9E4F]"
                                : "text-[#E11D48]"
                            }`}
                          >
                            {item.tipo === "receita" ? "+" : "-"} R${" "}
                            {Number(item.valor).toFixed(2)}
                          </td>

                          <td className="rounded-r-2xl px-4 py-4">
                            <div className="flex justify-end">
                              <button
                                onClick={() =>
                                  excluirTransacao(item.id_transacao)
                                }
                                className="rounded-xl border border-red-200 bg-white p-2 text-red-500 hover:bg-red-50 transition"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
                <label className="mb-1 block text-sm text-zinc-600">
                  Descrição
                </label>
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
                  <label className="mb-1 block text-sm text-zinc-600">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-zinc-600">
                    Data
                  </label>
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
                  <label className="mb-1 block text-sm text-zinc-600">
                    Categoria
                  </label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
                  >
                    {categoriasFixas
                      .filter((c) => c !== "Todas")
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-zinc-600">
                    Tipo
                  </label>
                  <select
                    value={tipo}
                    onChange={(e) =>
                      setTipo(e.target.value as "despesa" | "receita")
                    }
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

                {tipo === "despesa" && metaSelecionada && (
                  <p className="mt-2 text-xs text-amber-600">
                    Apenas lançamentos do tipo receita somam automaticamente no
                    progresso da meta.
                  </p>
                )}
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

function ResumoCard({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-zinc-500">{titulo}</p>
      <h2 className="mt-3 text-3xl font-semibold">{valor}</h2>
    </div>
  );
}