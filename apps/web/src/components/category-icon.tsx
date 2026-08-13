"use client";

import { useCategoryVisual } from "@/components/use-category-visual";

export function CategoryIcon({
  name,
  size = 16,
  box = 36,
  className = "",
}: {
  name: string | null | undefined;
  size?: number;
  box?: number;
  className?: string;
}) {
  const resolveVisual = useCategoryVisual();
  const { Icon, color } = resolveVisual(name);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: box, height: box, backgroundColor: `${color}1f`, color }}
    >
      <Icon style={{ width: size, height: size }} />
    </span>
  );
}
