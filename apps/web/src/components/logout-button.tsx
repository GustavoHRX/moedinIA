"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton({
  className = "",
  labelClassName = "",
}: {
  className?: string;
  labelClassName?: string;
}) {
  const supabase = createClient();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className={
        className ||
        "inline-flex items-center justify-center gap-2 rounded-md border border-line bg-surface-strong px-4 py-2 text-sm font-semibold text-fg transition hover:bg-bg-soft"
      }
      aria-label="Sair"
    >
      <LogOut className="h-4 w-4 shrink-0" strokeWidth={2.4} />
      <span className={labelClassName}>Sair</span>
    </button>
  );
}
