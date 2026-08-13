"use client";

import { useCallback } from "react";
import { useAppData } from "@/components/app-data-provider";
import { categoryVisualFrom, normalizeName, type CategoryVisual } from "@/lib/categories";
import { categoryIconByName } from "@/lib/category-palette";

/**
 * Resolve o visual (ícone + cor) de uma categoria pelo nome, priorizando a
 * cor/ícone salvos no banco (via AppDataProvider) e caindo para o mapa padrão.
 */
export function useCategoryVisual(): (name: string | null | undefined) => CategoryVisual {
  const { categories } = useAppData();

  return useCallback(
    (name: string | null | undefined) => {
      if (!name) return categoryVisualFrom(name);
      const normalized = normalizeName(name);
      const match = categories.find((category) => normalizeName(category.name) === normalized);
      return categoryVisualFrom(name, match?.color, categoryIconByName(match?.icon));
    },
    [categories]
  );
}
