import {
  Banknote,
  Car,
  CirclePlus,
  Ellipsis,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  House,
  Laptop,
  ReceiptText,
  ShoppingCart,
  Tag,
  TrendingUp,
  Undo2,
  Utensils,
  type LucideIcon,
} from "lucide-react";

export type CategoryRelation = { name: string } | { name: string }[] | null | undefined;

export function categoryName(category: CategoryRelation, fallback = "Sem categoria") {
  if (Array.isArray(category)) return category[0]?.name ?? fallback;
  return category?.name ?? fallback;
}

export type CategoryVisual = { Icon: LucideIcon; color: string };

// Normaliza nome: remove acentos e baixa caixa, para casar com ou sem acento.
const ACCENTS = new RegExp("[\\u0300-\\u036f]", "g");
export function normalizeName(name: string) {
  return name.normalize("NFD").replace(ACCENTS, "").trim().toLowerCase();
}

// Cores da paleta curada do Brand Book v1.3 (ver lib/category-palette.ts)
const VISUALS: Record<string, CategoryVisual> = {
  // Receitas
  "salario": { Icon: Banknote, color: "#34D399" },
  "freelance": { Icon: Laptop, color: "#60A5FA" },
  "reembolso": { Icon: Undo2, color: "#14B8A6" },
  "investimentos": { Icon: TrendingUp, color: "#6EE7B7" },
  "outras receitas": { Icon: CirclePlus, color: "#94A3B8" },
  // Despesas
  "alimentacao": { Icon: Utensils, color: "#FB923C" },
  "mercado": { Icon: ShoppingCart, color: "#10B981" },
  "transporte": { Icon: Car, color: "#0EA5E9" },
  "moradia": { Icon: House, color: "#818CF8" },
  "contas": { Icon: ReceiptText, color: "#FBBF24" },
  "saude": { Icon: HeartPulse, color: "#F87171" },
  "educacao": { Icon: GraduationCap, color: "#A78BFA" },
  "lazer": { Icon: Gamepad2, color: "#F472B6" },
  "outras despesas": { Icon: Ellipsis, color: "#94A3B8" },
};

const DEFAULT_VISUAL: CategoryVisual = { Icon: Tag, color: "#94A3B8" };

export function categoryVisual(name: string | null | undefined): CategoryVisual {
  if (!name) return DEFAULT_VISUAL;
  return VISUALS[normalizeName(name)] ?? DEFAULT_VISUAL;
}

/**
 * Resolve o visual de uma categoria priorizando o que está salvo no banco
 * (categories.color / categories.icon) e caindo para o mapa padrão acima.
 * `resolveIcon` converte o nome salvo (ex: "Banknote") em componente.
 */
export function categoryVisualFrom(
  name: string | null | undefined,
  dbColor?: string | null,
  dbIcon?: LucideIcon | null
): CategoryVisual {
  const fallback = categoryVisual(name);
  return {
    Icon: dbIcon ?? fallback.Icon,
    color: dbColor || fallback.color,
  };
}
