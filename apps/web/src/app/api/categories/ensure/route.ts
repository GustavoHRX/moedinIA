import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_CATEGORIES = [
  { name: "Salario", type: "income" },
  { name: "Freelance", type: "income" },
  { name: "Reembolso", type: "income" },
  { name: "Investimentos", type: "income" },
  { name: "Outras receitas", type: "income" },
  { name: "Alimentacao", type: "expense" },
  { name: "Mercado", type: "expense" },
  { name: "Transporte", type: "expense" },
  { name: "Moradia", type: "expense" },
  { name: "Contas", type: "expense" },
  { name: "Saude", type: "expense" },
  { name: "Educacao", type: "expense" },
  { name: "Lazer", type: "expense" },
  { name: "Outras despesas", type: "expense" },
] as const;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Usuario nao autenticado." }, { status: 401 });
  }

  const { data: existing, error: listError } = await supabase
    .from("categories")
    .select("id, name, type")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 400 });
  }

  const existingCategories = existing ?? [];
  const hasIncome = existingCategories.some((category) => category.type === "income");
  const hasExpense = existingCategories.some((category) => category.type === "expense");
  const missingDefaults = DEFAULT_CATEGORIES.filter(
    (category) =>
      (category.type === "income" && !hasIncome) ||
      (category.type === "expense" && !hasExpense)
  );

  if (missingDefaults.length === 0) {
    return NextResponse.json({ categories: existingCategories });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("categories")
    .insert(
      missingDefaults.map((category) => ({
        user_id: user.id,
        name: category.name,
        type: category.type,
        is_default: true,
      }))
    )
    .select("id, name, type");

  if (insertError) {
    if (insertError.code === "42501") {
      return NextResponse.json({
        categories: existingCategories,
        warning:
          "O Supabase bloqueou a criacao das categorias padrao por RLS. Revise as policies da tabela categories.",
      });
    }

    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  const categories = [...existingCategories, ...(inserted ?? [])].sort((a, b) => {
    if (a.type !== b.type) return a.type === "income" ? -1 : 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return NextResponse.json({ categories });
}
