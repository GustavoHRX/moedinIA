import { formatCurrency } from "@/lib/formatters";

/**
 * Motor de dicas dos hominhos — funções puras que recebem os dados que cada
 * página já carrega e devolvem dicas ordenadas por relevância, no tom de voz
 * do Brand Book (pág. 10): amigo, direto, sem julgamento, sem economês.
 * O id precisa ser estável para a dispensa via localStorage funcionar —
 * inclua o "assunto" no id (ex: mês, meta) para a dica voltar quando mudar.
 */
export type HominhoTipItem = {
  id: string;
  text: string;
};

export function dashboardTips(input: {
  monthKey: string;
  expenseTotal: number;
  incomeTotal: number;
  budgetAmount: number;
  topCategory: { name: string; total: number } | null;
  transactionsCount: number;
}): HominhoTipItem[] {
  const { monthKey, expenseTotal, budgetAmount, topCategory, transactionsCount } = input;
  const tips: HominhoTipItem[] = [];

  if (transactionsCount === 0) {
    tips.push({
      id: `dash-vazio-${monthKey}`,
      text: "Nada por aqui ainda. Manda um “gastei 30 no mercado” no WhatsApp ou usa o botão de novo lançamento — a gente cuida do resto.",
    });
    return tips;
  }

  if (budgetAmount > 0 && expenseTotal > budgetAmount) {
    tips.push({
      id: `dash-estouro-${monthKey}`,
      text: `O orçamento do mês passou em ${formatCurrency(expenseTotal - budgetAmount)}. Sem julgamento — que tal dar uma olhada em ${topCategory?.name ?? "onde pesou mais"}?`,
    });
  } else if (budgetAmount > 0 && expenseTotal >= budgetAmount * 0.8) {
    const percent = Math.round((expenseTotal / budgetAmount) * 100);
    tips.push({
      id: `dash-orcamento80-${monthKey}`,
      text: `Você já usou ${percent}% do orçamento geral do mês. Ainda dá pra fechar no azul — vai com calma nos próximos dias.`,
    });
  }

  if (topCategory) {
    tips.push({
      id: `dash-topcat-${monthKey}-${topCategory.name}`,
      text: `Sua maior despesa do mês é ${topCategory.name} (${formatCurrency(topCategory.total)}). Saber pra onde o dinheiro vai já é meio caminho andado.`,
    });
  }

  tips.push({
    id: "dash-whatsapp",
    text: "Lançou pelo WhatsApp? Aparece aqui na hora, sem precisar recarregar. Pode testar.",
  });

  return tips;
}

export function historicoTips(input: {
  totalCount: number;
  monthKey: string;
}): HominhoTipItem[] {
  const { totalCount, monthKey } = input;
  if (totalCount === 0) {
    return [
      {
        id: `hist-vazio-${monthKey}`,
        text: "Seu histórico começa no primeiro lançamento. Manda seu primeiro gasto que a gente cuida do resto.",
      },
    ];
  }
  const tips: HominhoTipItem[] = [];
  if (totalCount > 50) {
    tips.push({
      id: "hist-filtros",
      text: "Com os filtros de tipo, categoria e período você acha qualquer lançamento em segundos — inclusive aquele delivery que ninguém lembra.",
    });
  }
  tips.push({
    id: "hist-editar",
    text: "Errou um valor ou categoria? É só tocar no lançamento pra editar. Nada aqui é definitivo.",
  });
  return tips;
}

export function metasTips(input: {
  goals: {
    id: string;
    title: string;
    target_amount: number;
    current_amount: number;
    deadline: string | null;
    status: string;
  }[];
  todayISO: string;
}): HominhoTipItem[] {
  const { goals, todayISO } = input;
  const active = goals.filter((goal) => goal.status === "active");

  if (active.length === 0) {
    return [
      {
        id: "metas-vazio",
        text: "Meta visível é meta mais perto. Começa com algo pequeno — uma reserva de R$ 500 já muda o jogo.",
      },
    ];
  }

  const tips: HominhoTipItem[] = [];

  const almost = active.find(
    (goal) => goal.target_amount > 0 && goal.current_amount / goal.target_amount >= 0.8
  );
  if (almost) {
    tips.push({
      id: `metas-quase-${almost.id}`,
      text: `Faltam ${formatCurrency(Math.max(almost.target_amount - almost.current_amount, 0))} pra bater a meta “${almost.title}”. Tá quase!`,
    });
  }

  const overdue = active.find((goal) => goal.deadline && goal.deadline < todayISO);
  if (overdue) {
    tips.push({
      id: `metas-prazo-${overdue.id}`,
      text: `A meta “${overdue.title}” passou do prazo — acontece. Ajusta a data ou o valor e segue o jogo.`,
    });
  }

  tips.push({
    id: "metas-progresso",
    text: "Guardou dinheiro? Atualiza o progresso da meta — ver a barra encher é metade da motivação.",
  });

  return tips;
}

export function gastosFixosTips(input: {
  fixed: { id: string; title: string; amount: number; due_day: number; is_active: boolean }[];
  todayDay: number;
}): HominhoTipItem[] {
  const { fixed, todayDay } = input;
  const active = fixed.filter((item) => item.is_active);

  if (active.length === 0) {
    return [
      {
        id: "fixos-vazio",
        text: "Aluguel, internet, academia… cadastra uma vez e o Moedin lança sozinho todo mês. Menos uma coisa pra lembrar.",
      },
    ];
  }

  const tips: HominhoTipItem[] = [];
  const dueSoon = active.filter(
    (item) => item.due_day >= todayDay && item.due_day <= todayDay + 7
  );
  if (dueSoon.length > 0) {
    const biggest = dueSoon.reduce((a, b) => (a.amount >= b.amount ? a : b));
    tips.push({
      id: `fixos-vencendo-d${todayDay}`,
      text:
        dueSoon.length === 1
          ? `“${biggest.title}” vence nos próximos dias (${formatCurrency(biggest.amount)}). Já deixa separado.`
          : `${dueSoon.length} contas vencem nos próximos 7 dias — a maior é “${biggest.title}” (${formatCurrency(biggest.amount)}).`,
    });
  }

  const total = active.reduce((sum, item) => sum + item.amount, 0);
  tips.push({
    id: "fixos-total",
    text: `Seus gastos fixos somam ${formatCurrency(total)} por mês. Bom ter esse número na cabeça na hora de planejar.`,
  });

  return tips;
}

export function parcelamentosTips(input: {
  installments: {
    id: string;
    title: string;
    installment_amount: number;
    total_installments: number;
    paid_installments: number;
    is_active: boolean;
  }[];
}): HominhoTipItem[] {
  const active = input.installments.filter((item) => item.is_active);

  if (active.length === 0) {
    return [
      {
        id: "parc-vazio",
        text: "Comprou parcelado? Cadastra aqui que a gente acompanha cada parcela e te mostra quanto ainda falta.",
      },
    ];
  }

  const tips: HominhoTipItem[] = [];
  const closest = active
    .filter((item) => item.total_installments > item.paid_installments)
    .sort(
      (a, b) =>
        a.total_installments - a.paid_installments - (b.total_installments - b.paid_installments)
    )[0];

  if (closest) {
    const remaining = closest.total_installments - closest.paid_installments;
    tips.push({
      id: `parc-fim-${closest.id}-${remaining}`,
      text:
        remaining === 1
          ? `Última parcela de “${closest.title}”! Mês que vem sobram ${formatCurrency(closest.installment_amount)} no seu bolso.`
          : `Faltam ${remaining} parcelas de “${closest.title}”. Quando acabar, ${formatCurrency(closest.installment_amount)} voltam pro seu mês.`,
    });
  }

  const monthlyTotal = active.reduce((sum, item) => sum + item.installment_amount, 0);
  tips.push({
    id: "parc-total",
    text: `Suas parcelas somam ${formatCurrency(monthlyTotal)} por mês. Vale conferir antes de assumir um parcelamento novo.`,
  });

  return tips;
}

export function planejamentoTips(input: {
  monthKey: string;
  hasSalary: boolean;
  hasCategoryBudgets: boolean;
}): HominhoTipItem[] {
  const { monthKey, hasSalary, hasCategoryBudgets } = input;
  const tips: HominhoTipItem[] = [];

  if (!hasSalary) {
    tips.push({
      id: `plan-salario-${monthKey}`,
      text: "Informa teu salário e o dia do pagamento — com isso o painel consegue te dizer quanto dá pra gastar até o fim do mês.",
    });
  } else if (!hasCategoryBudgets) {
    tips.push({
      id: `plan-orcamentos-${monthKey}`,
      text: "Que tal definir orçamento por categoria? Assim você recebe o alerta antes de estourar, não depois.",
    });
  }

  tips.push({
    id: `plan-rotina-${monthKey}`,
    text: "Revisar o planejamento no comecinho do mês leva 2 minutos e evita susto no dia 30.",
  });

  return tips;
}
