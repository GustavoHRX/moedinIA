import { redirect } from "next/navigation";

// A tela de Planejamento foi desmontada:
//  - salário e vales  -> Fixos (aba Receitas fixas)
//  - limite de gasto mensal -> Conta
//  - orçamentos por categoria -> Categorias
// Mantido só para não quebrar links antigos.
export default function PlanejamentoMensalPage() {
  redirect("/dashboard");
}
