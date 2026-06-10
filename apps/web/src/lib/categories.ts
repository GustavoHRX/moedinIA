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
function normalizeName(name: string) {
  return name.normalize("NFD").replace(ACCENTS, "").trim().toLowerCase();
}

const VISUALS: Record<string, CategoryVisual> = {
  // Receitas
  "salario": { Icon: Banknote, color: "#2E9E4F" },
  "freelance": { Icon: Laptop, color: "#3B82F6" },
  "reembolso": { Icon: Undo2, color: "#14B8A6" },
  "investimentos": { Icon: TrendingUp, color: "#8B5CF6" },
  "outras receitas": { Icon: CirclePlus, color: "#6E746F" },
  // Despesas
  "alimentacao": { Icon: Utensils, color: "#F97316" },
  "mercado": { Icon: ShoppingCart, color: "#16A34A" },
  "transporte": { Icon: Car, color: "#0EA5E9" },
  "moradia": { Icon: House, color: "#A855F7" },
  "contas": { Icon: ReceiptText, color: "#EAB308" },
  "saude": { Icon: HeartPulse, color: "#EF4444" },
  "educacao": { Icon: GraduationCap, color: "#6366F1" },
  "lazer": { Icon: Gamepad2, color: "#EC4899" },
  "outras despesas": { Icon: Ellipsis, color: "#6E746F" },
};

const DEFAULT_VISUAL: CategoryVisual = { Icon: Tag, color: "#6E746F" };

export function categoryVisual(name: string | null | undefined): CategoryVisual {
  if (!name) return DEFAULT_VISUAL;
  return VISUALS[normalizeName(name)] ?? DEFAULT_VISUAL;
}
