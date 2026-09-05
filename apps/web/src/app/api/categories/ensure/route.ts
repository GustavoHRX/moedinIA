import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

// Cores da paleta curada do Brand Book v1.3 (lib/category-palette.ts)
const DEFAULT_CATEGORIES = [
  { name: "Salário", type: "income", icon: "Banknote", color: "#34D399" },
  { name: "Freelance", type: "income", icon: "Laptop", color: "#60A5FA" },
  { name: "Reembolso", type: "income", icon: "Undo2", color: "#14B8A6" },
  { name: "Investimentos", type: "income", icon: "TrendingUp", color: "#6EE7B7" },
  { name: "Outras receitas", type: "income", icon: "CirclePlus", color: "#94A3B8" },
  { name: "Alimentação", type: "expense", icon: "Utensils", color: "#FB923C" },
  { name: "Mercado", type: "expense", icon: "ShoppingCart", color: "#10B981" },
  { name: "Transporte", type: "expense", icon: "Car", color: "#0EA5E9" },
  { name: "Moradia", type: "expense", icon: "House", color: "#818CF8" },
  { name: "Contas", type: "expense", icon: "ReceiptText", color: "#FBBF24" },
  { name: "Saúde", type: "expense", icon: "HeartPulse", color: "#F87171" },
  { name: "Educação", type: "expense", icon: "GraduationCap", color: "#A78BFA" },
  { name: "Lazer", type: "expense", icon: "Gamepad2", color: "#F472B6" },
  { name: "Outras despesas", type: "expense", icon: "Ellipsis", color: "#94A3B8" },
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

  const limited = await enforceRateLimit("ensure", user.id);
  if (limited) return limited;

  const { data: existing, error: listError } = await supabase
    .from("categories")
    .select("id, name, type, color, icon, is_default")
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
    .select("id, name, type, color, icon, is_default");

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
