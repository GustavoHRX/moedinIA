import {
  Baby,
  Banknote,
  Briefcase,
  Bus,
  Car,
  CirclePlus,
  Coffee,
  CreditCard,
  Dumbbell,
  Ellipsis,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Laptop,
  Music,
  PawPrint,
  PiggyBank,
  Plane,
  ReceiptText,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  Undo2,
  Utensils,
  Wallet,
  Wifi,
  type LucideIcon,
} from "lucide-react";

/**
 * Paleta curada de cores de categorias — derivada do Brand Book v1.3.
 * Começa na sequência oficial de gráficos (pág. 15) e expande com tons
 * harmônicos, todos legíveis sobre o fundo dark #0C1210.
 */
export const CATEGORY_PALETTE: { hex: string; label: string }[] = [
  { hex: "#10B981", label: "Verde Moedin" },
  { hex: "#34D399", label: "Esmeralda" },
  { hex: "#6EE7B7", label: "Menta" },
  { hex: "#14B8A6", label: "Teal" },
  { hex: "#2DD4BF", label: "Teal claro" },
  { hex: "#A3E635", label: "Lima" },
  { hex: "#FBBF24", label: "Âmbar" },
  { hex: "#FB923C", label: "Laranja" },
  { hex: "#F87171", label: "Coral" },
  { hex: "#F472B6", label: "Rosa" },
  { hex: "#A78BFA", label: "Violeta" },
  { hex: "#818CF8", label: "Índigo" },
  { hex: "#60A5FA", label: "Azul" },
  { hex: "#0EA5E9", label: "Ciano" },
  { hex: "#FACC15", label: "Amarelo" },
  { hex: "#94A3B8", label: "Neutro" },
];

export const DEFAULT_CATEGORY_COLOR = "#94A3B8";

/** Ícones disponíveis no seletor de categorias (traço Lucide, padrão do book pág. 07). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Banknote,
  Wallet,
  PiggyBank,
  TrendingUp,
  Laptop,
  Briefcase,
  Undo2,
  CirclePlus,
  Utensils,
  Coffee,
  ShoppingCart,
  ShoppingBag,
  Car,
  Bus,
  Plane,
  House,
  ReceiptText,
  CreditCard,
  HeartPulse,
  Dumbbell,
  GraduationCap,
  Gamepad2,
  Music,
  Smartphone,
  Wifi,
  Shirt,
  Gift,
  Baby,
  PawPrint,
  Sparkles,
  Ellipsis,
  Tag,
};

export function categoryIconByName(icon: string | null | undefined): LucideIcon | null {
  if (!icon) return null;
  return CATEGORY_ICONS[icon] ?? null;
}
