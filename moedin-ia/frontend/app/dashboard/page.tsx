"use client";

import { useEffect, useState } from "react";

type Transacao = {
  id_transacao: number;
  valor: number;
  descricao: string;
  data: string;
  categoria: string;
  tipo: "receita" | "despesa";
  id_user: number;
};

export default function DashboardPage() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [mensagem, setMensagem] = useState("Carregando...");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState("");
  const [categoria, setCategoria] = useState("");
  const [tipo, setTipo] = useState("despesa");

  async function carregarTransacoes() {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/";
      return;
    }

    try {
      const resposta = await fetch("http://localhost:8000/transacoes", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resposta.ok) {
        setMensagem("Erro ao carregar transações");
        return;
      }

      const dados = await resposta.json();
      setTransacoes(dados);
      setMensagem("");
    } catch {
      setMensagem("Erro ao conectar com o backend");
    }
  }

  async function criarTransacao(e: React.FormEvent) {
    e.preventDefault();

    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/";
      return;
    }

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
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(dados.detail || "Erro ao criar transação");
        return;
      }

      setValor("");
      setDescricao("");
      setData("");
      setCategoria("");
      setTipo("despesa");

      carregarTransacoes();
    } catch {
      alert("Erro ao conectar com o backend");
    }
  }

  async function excluirTransacao(id: number) {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/";
      return;
    }

    try {
      const resposta = await fetch(`http://localhost:8000/transacoes/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resposta.ok) {
        alert("Erro ao excluir transação");
        return;
      }

      carregarTransacoes();
    } catch {
      alert("Erro ao conectar com o backend");
    }
  }

  function sair() {
    localStorage.removeItem("token");
    localStorage.removeItem("telefone");
    window.location.href = "/";
  }

  useEffect(() => {
    carregarTransacoes();
  }, []);

  const receitas = transacoes
    .filter((t) => t.tipo === "receita")
    .reduce((total, t) => total + Number(t.valor), 0);

  const despesas = transacoes
    .filter((t) => t.tipo === "despesa")
    .reduce((total, t) => total + Number(t.valor), 0);

  const saldo = receitas - despesas;

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-3xl font-bold text-emerald-400">Dashboard</h1>
            <p className="text-zinc-400 text-sm">Moedin.IA</p>
          </div>

          <button
            onClick={sair}
            className="bg-red-500 hover:bg-red-600 rounded-xl px-4 py-2 font-medium"
          >
            Sair
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-zinc-400 text-sm">Receitas</p>
            <h2 className="text-2xl font-bold text-emerald-400">
              R$ {receitas.toFixed(2)}
            </h2>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-zinc-400 text-sm">Despesas</p>
            <h2 className="text-2xl font-bold text-red-400">
              R$ {despesas.toFixed(2)}
            </h2>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-zinc-400 text-sm">Saldo</p>
            <h2 className="text-2xl font-bold text-white">
              R$ {saldo.toFixed(2)}
            </h2>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h3 className="text-xl font-semibold mb-4">Nova Transação</h3>

            <form onSubmit={criarTransacao} className="space-y-3">
              <input
                type="number"
                step="0.01"
                placeholder="Valor"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3"
              />

              <input
                type="text"
                placeholder="Descrição"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3"
              />

              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3"
              />

              <input
                type="text"
                placeholder="Categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3"
              />

              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3"
              >
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </select>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-xl py-3 font-semibold text-black"
              >
                Salvar Transação
              </button>
            </form>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h3 className="text-xl font-semibold mb-4">Histórico</h3>

            {mensagem ? (
              <p className="text-zinc-400">{mensagem}</p>
            ) : transacoes.length === 0 ? (
              <p className="text-zinc-400">Nenhuma transação cadastrada.</p>
            ) : (
              <div className="space-y-3">
                {transacoes.map((t) => (
                  <div
                    key={t.id_transacao}
                    className="bg-zinc-800 rounded-xl p-4 border border-zinc-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{t.descricao}</p>
                        <p className="text-sm text-zinc-400">{t.categoria}</p>
                        <p className="text-sm text-zinc-500">{t.data}</p>
                      </div>

                      <div className="text-right">
                        <p
                          className={`font-bold ${
                            t.tipo === "receita"
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          R$ {Number(t.valor).toFixed(2)}
                        </p>
                        <button
                          onClick={() => excluirTransacao(t.id_transacao)}
                          className="text-sm text-red-400 mt-2 hover:underline"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}