"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAppData, type AppCategory } from "@/components/app-data-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { categoryVisualFrom } from "@/lib/categories";
import {
  CATEGORY_ICONS,
  CATEGORY_PALETTE,
  categoryIconByName,
  DEFAULT_CATEGORY_COLOR,
} from "@/lib/category-palette";

type EditorState = {
  id: string | null; // null = criando nova
  name: string;
  type: "income" | "expense";
  color: string;
  icon: string;
  isDefault: boolean;
};

const EMPTY_EDITOR: EditorState = {
  id: null,
  name: "",
  type: "expense",
  color: "#10B981",
  icon: "Tag",
  isDefault: false,
};

function ColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const isCustom = !CATEGORY_PALETTE.some(
    (item) => item.hex.toLowerCase() === value.toLowerCase()
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CATEGORY_PALETTE.map((item) => {
        const selected = item.hex.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={item.hex}
            type="button"
            title={item.label}
            aria-label={`Cor ${item.label}`}
            aria-pressed={selected}
            onClick={() => onChange(item.hex)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            style={{
              backgroundColor: item.hex,
              boxShadow: selected ? `0 0 0 2px var(--surface-strong), 0 0 0 4px ${item.hex}` : "none",
            }}
          >
            {selected ? <Check className="h-4 w-4 text-[#06130D]" /> : null}
          </button>
        );
      })}
      <label
        title="Cor personalizada"
        className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-[var(--line-strong)] transition hover:scale-110"
        style={isCustom ? { backgroundColor: value, borderStyle: "solid" } : undefined}
      >
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Cor personalizada"
        />
        {isCustom ? <Check className="h-4 w-4 text-[#06130D]" /> : <span className="text-xs text-[var(--muted)]">+</span>}
      </label>
    </div>
  );
}

function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color: string;
  onChange: (iconName: string) => void;
}) {
  return (
    <div className="grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-11">
      {Object.entries(CATEGORY_ICONS).map(([iconName, Icon]) => {
        const selected = iconName === value;
        return (
          <button
            key={iconName}
            type="button"
            title={iconName}
            aria-pressed={selected}
            onClick={() => onChange(iconName)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
              selected
                ? "border-transparent"
                : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand)]"
            }`}
            style={selected ? { backgroundColor: `${color}1f`, color } : undefined}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: AppCategory;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { Icon, color } = categoryVisualFrom(
    category.name,
    category.color,
    categoryIconByName(category.icon)
  );
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-soft)] px-3 py-2.5">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}1f`, color }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text)]">
        {category.name}
      </span>
      {category.is_default ? (
        <span className="hidden shrink-0 rounded-full bg-[var(--primary-soft)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--mint)] sm:inline">
          Padrão
        </span>
      ) : null}
      <button
        type="button"
        onClick={onEdit}
        title="Editar categoria"
        className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--text)]"
      >
        <Pencil className="h-4 w-4" />
      </button>
      {!category.is_default ? (
        <button
          type="button"
          onClick={onDelete}
          title="Excluir categoria"
          className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--danger)]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export function CategoryManager({
  onMessage,
}: {
  onMessage?: (text: string, type: "success" | "error") => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const confirm = useConfirm();
  const { user, categories, refreshCategories, invalidateFinancialData } = useAppData();

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const incomeCategories = categories.filter((category) => category.type === "income");
  const expenseCategories = categories.filter((category) => category.type === "expense");

  function openCreate(type: "income" | "expense") {
    setEditor({ ...EMPTY_EDITOR, type });
  }

  function openEdit(category: AppCategory) {
    const visual = categoryVisualFrom(
      category.name,
      category.color,
      categoryIconByName(category.icon)
    );
    setEditor({
      id: category.id,
      name: category.name,
      type: category.type,
      color: category.color || visual.color || DEFAULT_CATEGORY_COLOR,
      icon: category.icon && CATEGORY_ICONS[category.icon] ? category.icon : "Tag",
      isDefault: category.is_default,
    });
  }

  async function handleSave() {
    if (!editor || !user) return;
    const name = editor.name.trim();
    if (!name) {
      onMessage?.("Dá um nome pra categoria antes de salvar.", "error");
      return;
    }

    setSaving(true);
    try {
      if (editor.id) {
        const patch: Record<string, string> = { color: editor.color, icon: editor.icon };
        if (!editor.isDefault) patch.name = name;
        const { error } = await supabase
          .from("categories")
          .update(patch)
          .eq("id", editor.id)
          .eq("user_id", user.id);
        if (error) throw error;
        onMessage?.("Categoria atualizada!", "success");
      } else {
        const duplicated = categories.some(
          (category) =>
            category.type === editor.type &&
            category.name.trim().toLowerCase() === name.toLowerCase()
        );
        if (duplicated) {
          onMessage?.("Você já tem uma categoria com esse nome.", "error");
          setSaving(false);
          return;
        }
        const { error } = await supabase.from("categories").insert({
          user_id: user.id,
          name,
          type: editor.type,
          color: editor.color,
          icon: editor.icon,
          is_default: false,
        });
        if (error) throw error;
        onMessage?.("Categoria criada! Já pode usar nos lançamentos.", "success");
      }

      await refreshCategories();
      invalidateFinancialData();
      setEditor(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar categoria.";
      onMessage?.(`Ops, algo saiu do trilho: ${message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category: AppCategory) {
    if (!user) return;
    const ok = await confirm({
      title: "Excluir categoria",
      message: `Excluir "${category.name}"? Lançamentos antigos que usam essa categoria continuam guardados.`,
      confirmLabel: "Excluir",
    });
    if (!ok) return;

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", category.id)
      .eq("user_id", user.id);

    if (error) {
      if (error.code === "23503") {
        onMessage?.(
          "Essa categoria tem lançamentos vinculados e não pode ser excluída. Você pode só mudar a cor ou o nome dela.",
          "error"
        );
      } else {
        onMessage?.(`Erro ao excluir: ${error.message}`, "error");
      }
      return;
    }

    await refreshCategories();
    invalidateFinancialData();
    onMessage?.("Categoria excluída.", "success");
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {(
          [
            { type: "expense" as const, title: "Despesas", items: expenseCategories },
            { type: "income" as const, title: "Receitas", items: incomeCategories },
          ]
        ).map((group) => (
          <div key={group.type} className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
                {group.title}
              </p>
              <button
                type="button"
                onClick={() => openCreate(group.type)}
                className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-strong)] transition hover:border-[var(--brand)] hover:bg-[var(--primary-soft)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Nova
              </button>
            </div>
            {group.items.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-5 text-center text-sm text-[var(--muted)]">
                Nada por aqui ainda. Crie sua primeira categoria!
              </p>
            ) : (
              <div className="space-y-2">
                {group.items.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    onEdit={() => openEdit(category)}
                    onDelete={() => handleDelete(category)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {editor && mounted
        ? createPortal(
            <div
              className="anim-modal-backdrop fixed inset-0 z-[100] overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-md sm:p-6"
              onClick={() => setEditor(null)}
            >
              <div className="flex min-h-full items-center justify-center">
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="anim-modal-card w-full max-w-lg space-y-4 rounded-[24px] border border-[var(--line-strong)] bg-[var(--surface-strong)] p-4 shadow-[0_28px_70px_rgba(9,42,32,0.28)] sm:p-5"
                >
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-base font-bold text-[var(--navy)]">
              {editor.id ? `Editar "${editor.name}"` : "Nova categoria"}
            </p>
            <button
              type="button"
              onClick={() => setEditor(null)}
              title="Fechar"
              className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-3">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${editor.color}1f`, color: editor.color }}
              >
                {(() => {
                  const PreviewIcon = CATEGORY_ICONS[editor.icon] ?? CATEGORY_ICONS.Tag;
                  return <PreviewIcon className="h-5 w-5" />;
                })()}
              </span>
              <label className="block flex-1 space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Nome</span>
                <input
                  className="control max-w-xs"
                  type="text"
                  placeholder="Ex: Pets, Viagens, Streaming…"
                  value={editor.name}
                  disabled={editor.isDefault}
                  onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                />
                {editor.isDefault ? (
                  <span className="text-xs text-[var(--muted)]">
                    Categorias padrão não mudam de nome — mas a cor e o ícone são seus.
                  </span>
                ) : null}
              </label>
            </div>
            {!editor.id ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Tipo</span>
                <select
                  className="control"
                  value={editor.type}
                  onChange={(event) =>
                    setEditor({ ...editor, type: event.target.value as "income" | "expense" })
                  }
                >
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </label>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-semibold text-[var(--text)]">Cor</span>
            <ColorSwatches
              value={editor.color}
              onChange={(hex) => setEditor({ ...editor, color: hex })}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-semibold text-[var(--text)]">Ícone</span>
            <IconPicker
              value={editor.icon}
              color={editor.color}
              onChange={(iconName) => setEditor({ ...editor, icon: iconName })}
            />
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setEditor(null)}
              className="btn-secondary px-5 py-2.5 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Salvando..." : editor.id ? "Salvar categoria" : "Criar categoria"}
            </button>
          </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
