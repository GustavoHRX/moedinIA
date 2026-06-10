import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_CATEGORIES = [
  { name: "Salário", type: "income", icon: "Banknote", color: "#2E9E4F" },
  { name: "Freelance", type: "income", icon: "Laptop", color: "#3B82F6" },
  { name: "Reembolso", type: "income", icon: "Undo2", color: "#14B8A6" },
  { name: "Investimentos", type: "income", icon: "TrendingUp", color: "#8B5CF6" },
  { name: "Outras receitas", type: "income", icon: "CirclePlus", color: "#6E746F" },
  { name: "Alimentação", type: "expense", icon: "Utensils", color: "#F97316" },
  { name: "Mercado", type: "expense", icon: "ShoppingCart", color: "#16A34A" },
  { name: "Transporte", type: "expense", icon: "Car", color: "#0EA5E9" },
  { name: "Moradia", type: "expense", icon: "House", color: "#A855F7" },
  { name: "Contas", type: "expense", icon: "ReceiptText", color: "#EAB308" },
  { name: "Saúde", type: "expense", icon: "HeartPulse", color: "#EF4444" },
  { name: "Educação", type: "expense", icon: "GraduationCap", color: "#6366F1" },
  { name: "Lazer", type: "expense", icon: "Gamepad2", color: "#EC4899" },
  { name: "Outras despesas", type: "expense", icon: "Ellipsis", color: "#6E746F" },
] as const;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
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
        icon: category.icon,
        color: category.color,
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
