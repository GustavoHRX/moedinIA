export type CategoryRelation = { name: string } | { name: string }[] | null | undefined;

export function categoryName(category: CategoryRelation, fallback = "Sem categoria") {
  if (Array.isArray(category)) return category[0]?.name ?? fallback;
  return category?.name ?? fallback;
}
