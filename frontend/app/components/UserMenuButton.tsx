"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, User } from "lucide-react";

type Props = {
  nome?: string;
};

export default function UserMenuButton({ nome = "Usuário" }: Props) {
  const [aberto, setAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  function sair() {
    localStorage.removeItem("token");
    localStorage.removeItem("cpf");
    window.location.href = "/";
  }

  useEffect(() => {
    function handleClickFora(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }

    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setAberto(!aberto)}
        title="Abrir menu do usuário"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2E9E4F] text-white font-semibold shadow hover:bg-[#277F40] transition"
      >
        {nome.charAt(0).toUpperCase()}
      </button>

      {aberto && (
        <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl z-50">
          <div className="flex items-center gap-3 rounded-xl px-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2E9E4F]/15 text-[#2E9E4F]">
              <User size={18} />
            </div>

            <div>
              <p className="text-sm text-zinc-500">Conta conectada</p>
              <p className="font-semibold text-zinc-900">{nome}</p>
            </div>
          </div>

          <div className="my-2 h-px bg-zinc-200" />

          <button
            onClick={sair}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-red-500 hover:bg-red-50 transition"
          >
            <LogOut size={18} />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      )}
    </div>
  );
}