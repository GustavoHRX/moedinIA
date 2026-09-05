import { redirect } from "next/navigation";

// A tela de planos saiu do painel — o plano agora aparece no Perfil.
// Mantemos a rota só para não quebrar links antigos.
export default function PlanosPage() {
  redirect("/perfil");
}
