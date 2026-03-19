"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardHeader from "../components/DashboardHeader";
import { Target, Plus, Pencil, Trash2, X } from "lucide-react";

type Meta = {
  id_meta: number;
  titulo: string;
  valor_alvo: number;
  valor_atual: number;
  data_limite: string;
  id_user: number;
};

export default function MetasPage() {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [mensagem, setMensagem] = useState("Carregando metas...");
  const [modalAberto, setModalAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [metaEditandoId, setMetaEditandoId] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [valorAlvo, setValorAlvo] = useState("");
  const [valorAtual, setValorAtual] = useState("");
  const [dataLimite, setDataLimite] = useState("");

  useEffect(() => {
    carregarMetas();
  }, []);

  async function carregarMetas() {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/";
      return;
    }

    try {
      const resposta = await fetch("http://localhost:8000/metas", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resposta.ok) {
        setMensagem("Erro ao carregar metas.");
        return;
      }

      const dados = await resposta.json();
      setMetas(dados);
      setMensagem(dados.length === 0 ? "Nenhuma meta cadastrada ainda." : "");
    } catch {
      setMensagem("Erro ao conectar com o backend.");
    }
  }

  function abrirNovaMeta() {
    setModoEdicao(false);
    setMetaEditandoId(null);
    setTitulo("");
    setValorAlvo("");
    setValorAtual("");
    setDataLimite("");
    setModalAberto(true);
  }

  function abrirEdicao(meta: Meta) {
    setModoEdicao(true);
    setMetaEditandoId(meta.id_meta);
    setTitulo(meta.titulo);
    setValorAlvo(String(meta.valor_alvo));
    setValorAtual(String(meta.valor_atual));
    setDataLimite(meta.data_limite);
    setModalAberto(true);
  }

  async function salvarMeta(e: React.FormEvent) {
    e.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    if (!titulo || !valorAlvo || !dataLimite) {
      alert("Preencha título, valor alvo e data limite.");
      return;
    }

    setCarregando(true);

    const body = {
      titulo,
      valor_alvo: Number(valorAlvo),
      valor_atual: Number(valorAtual || 0),
      data_limite: dataLimite,
    };

    try {
      const url = modoEdicao
        ? `http://localhost:8000/metas/${metaEditandoId}`
        : "http://localhost:8000/metas";

      const method = modoEdicao ? "PUT" : "POST";

      const resposta = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(dados.detail || "Erro ao salvar meta.");
        setCarregando(false);
        return;
      }

      setModalAberto(false);
      setTitulo("");
      setValorAlvo("");
      setValorAtual("");
      setDataLimite("");
      setModoEdicao(false);
      setMetaEditandoId(null);

      await carregarMetas();
    } catch {
      alert("Erro ao conectar com o backend.");
    } finally {
      setCarregando(false);
    }
  }

  async function excluirMeta(id: number) {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/";
      return;
    }

    const confirmar = window.confirm("Deseja excluir esta meta?");
    if (!confirmar) return;

    try {
      const resposta = await fetch(`http://localhost:8000/metas/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(dados.detail || "Erro ao excluir meta.");
        return;
      }

      await carregarMetas();
    } catch {
      alert("Erro ao conectar com o backend.");
    }
  }

  const resumo = useMemo(() => {
    const totalAlvo = metas.reduce((acc, meta) => acc + Number(meta.valor_alvo), 0);
    const totalAtual = metas.reduce((acc, meta) => acc + Number(meta.valor_atual), 0);
    return {
      totalAlvo,
      totalAtual,
      quantidade: metas.length,
    };
  }, [metas]);

  return (
    <main className="min-h-screen bg-[#F3F4F6] text-zinc-900">
      <DashboardHeader />

      <section className="mx-auto max-w-[1500px] px-6 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Metas Financeiras</h1>
          <p className="text-zinc-500">
            Crie, acompanhe e gerencie objetivos financeiros com progresso e prazo.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
          <ResumoCard titulo="Metas ativas" valor={`${resumo.quantidade}`} />
          <ResumoCard titulo="Valor alvo total" valor={`R$ ${resumo.totalAlvo.toFixed(2)}`} />
          <ResumoCard titulo="Valor acumulado" valor={`R$ ${resumo.totalAtual.toFixed(2)}`} />
          <button
            onClick={abrirNovaMeta}
            className="flex items-center justify-center gap-2 rounded-3xl bg-[#2E9E4F] px-6 py-5 text-white font-semibold shadow hover:bg-[#277F40] transition"
          >
            <Plus size={18} />
            Nova meta
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {mensagem ? (
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm text-zinc-500 xl:col-span-2">
              {mensagem}
            </div>
          ) : (
            metas.map((meta) => {
              const percentual = Math.min(
                100,
                meta.valor_alvo > 0 ? (Number(meta.valor_atual) / Number(meta.valor_alvo)) * 100 : 0
              );

              const hoje = new Date();
              const limite = new Date(meta.data_limite);
              const concluida = Number(meta.valor_atual) >= Number(meta.valor_alvo);
              const atrasada = !concluida && limite < hoje;

              let status = "Em andamento";
              let statusCor = "bg-amber-100 text-amber-700";

              if (concluida) {
                status = "Concluída";
                statusCor = "bg-green-100 text-green-700";
              } else if (atrasada) {
                status = "Atrasada";
                statusCor = "bg-red-100 text-red-700";
              }

              return (
                <div
                  key={meta.id_meta}
                  className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2E9E4F]/15 text-[#2E9E4F]">
                        <Target size={20} />
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold">{meta.titulo}</h2>
                        <p className="text-sm text-zinc-500">
                          Data limite: {meta.data_limite}
                        </p>
                      </div>
                    </div>

                    <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusCor}`}>
                      {status}
                    </span>
                  </div>

                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <p className="text-sm text-zinc-500">Progresso atual</p>
                      <p className="text-3xl font-bold">
                        R$ {Number(meta.valor_atual).toFixed(2)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-zinc-500">Meta total</p>
                      <p className="text-xl font-semibold">
                        R$ {Number(meta.valor_alvo).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="mb-3 h-3 w-full rounded-full bg-zinc-200">
                    <div
                      className="h-3 rounded-full bg-[#2E9E4F]"
                      style={{ width: `${percentual}%` }}
                    />
                  </div>

                  <p className="mb-5 text-sm text-zinc-500">
                    {percentual.toFixed(0)}% concluído
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => abrirEdicao(meta)}
                      className="flex items-center gap-2 rounded-2xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition"
                    >
                      <Pencil size={16} />
                      Editar
                    </button>

                    <button
                      onClick={() => excluirMeta(meta.id_meta)}
                      className="flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition"
                    >
                      <Trash2 size={16} />
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {modoEdicao ? "Editar meta" : "Nova meta"}
              </h2>
              <button
                onClick={() => setModalAberto(false)}
                className="rounded-full p-2 hover:bg-zinc-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={salvarMeta} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-zinc-600">Título</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Viagem, Notebook, Reserva..."
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-zinc-600">Valor alvo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valorAlvo}
                    onChange={(e) => setValorAlvo(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-zinc-600">Valor atual</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valorAtual}
                    onChange={(e) => setValorAtual(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-zinc-600">Data limite</label>
                <input
                  type="date"
                  value={dataLimite}
                  onChange={(e) => setDataLimite(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
                />
              </div>

              <button
                type="submit"
                disabled={carregando}
                className="mt-4 w-full rounded-2xl bg-[#2E9E4F] py-4 text-sm font-semibold text-white hover:bg-[#277F40] transition disabled:opacity-60"
              >
                {carregando
                  ? "Salvando..."
                  : modoEdicao
                  ? "Salvar alterações"
                  : "Criar meta"}
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