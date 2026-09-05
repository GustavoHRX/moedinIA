import { redirect } from "next/navigation";

// "Gastos fixos" foi fundido com "Receitas fixas" na tela Fixos.
// Mantido só para não quebrar links antigos.
export default function GastosFixosPage() {
  redirect("/fixos");
}
