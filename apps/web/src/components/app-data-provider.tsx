"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { catchUpRecurrences } from "@/lib/recurrence-catchup";
import { todayDateInput } from "@/lib/dates";

export type AppCategory = {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string | null;
  icon: string | null;
  is_default: boolean;
};

export type AppProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  currency: string | null;
  timezone: string | null;
};

type AppDataContextValue = {
  user: User | null;
  profile: AppProfile | null;
  categories: AppCategory[];
  loadingUser: boolean;
  loadingProfile: boolean;
  loadingCategories: boolean;
  profileLoaded: boolean;
  categoriesLoaded: boolean;
  financialVersion: number;
  /** Último lançamento inserido via Realtime (ex: WhatsApp) — para destaque visual. */
  lastRealtimeArrival: { id: string; at: number } | null;
  refreshUser: () => Promise<User | null>;
  refreshProfile: () => Promise<AppProfile | null>;
  refreshCategories: () => Promise<AppCategory[]>;
  updateProfileCache: (profile: AppProfile) => void;
  getFinancialCache: <T>(key: string, maxAgeMs?: number) => T | null;
  setFinancialCache: <T>(key: string, data: T) => void;
  clearFinancialCache: (key?: string) => void;
  invalidateFinancialData: () => void;
  getCategoriesByType: (type: "income" | "expense") => AppCategory[];
};

type FinancialCacheEntry = {
  data: unknown;
  updatedAt: number;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);
const DEFAULT_FINANCIAL_CACHE_TTL = 60_000;

async function ensureDefaultCategories(): Promise<AppCategory[] | null> {
  const response = await fetch("/api/categories/ensure", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { categories?: AppCategory[] };
  return payload.categories ?? null;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const initializedRef = useRef(false);
  const userRequestRef = useRef<Promise<User | null> | null>(null);
  const profileRequestRef = useRef<Promise<AppProfile | null> | null>(null);
  const categoriesRequestRef = useRef<Promise<AppCategory[]> | null>(null);
  const ensureAttemptedForUserRef = useRef<string | null>(null);
  const userRef = useRef<User | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [categories, setCategories] = useState<AppCategory[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [financialVersion, setFinancialVersion] = useState(0);
  const [financialCache, setFinancialCacheState] = useState<Record<string, FinancialCacheEntry>>({});
  const [lastRealtimeArrival, setLastRealtimeArrival] = useState<{ id: string; at: number } | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const loadUser = useCallback(async () => {
    if (userRequestRef.current) return userRequestRef.current;

    setLoadingUser(true);
    userRequestRef.current = (async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        setUser(currentUser);
        return currentUser;
      } catch {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;

        setUser(currentUser);
        return currentUser;
      }
    })()
      .finally(() => {
        setLoadingUser(false);
        userRequestRef.current = null;
      });

    return userRequestRef.current;
  }, [supabase]);

  const loadProfile = useCallback(
    async (fallbackUser?: User | null) => {
      if (profileRequestRef.current) return profileRequestRef.current;

      const currentUser = fallbackUser ?? userRef.current;
      if (!currentUser) {
        setProfile(null);
        setProfileLoaded(true);
        setLoadingProfile(false);
        return null;
      }

      setLoadingProfile(true);
      setProfileLoaded(false);

      const request = (async () => {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, full_name, email, phone, currency, timezone")
            .eq("id", currentUser.id)
            .maybeSingle();

          if (error) throw error;

          const nextProfile = (data as AppProfile | null) ?? {
            id: currentUser.id,
            full_name: currentUser.user_metadata?.full_name ?? null,
            email: currentUser.email ?? null,
            phone: currentUser.user_metadata?.phone ?? null,
            currency: "BRL",
            timezone: "America/Sao_Paulo",
          };

          setProfile(nextProfile);
          setProfileLoaded(true);
          return nextProfile;
        } finally {
          setLoadingProfile(false);
          profileRequestRef.current = null;
        }
      })();

      profileRequestRef.current = request;
      return request;
    },
    [supabase]
  );

  const loadCategories = useCallback(
    async (fallbackUser?: User | null) => {
      if (categoriesRequestRef.current) return categoriesRequestRef.current;

      const currentUser = fallbackUser ?? userRef.current;
      if (!currentUser) {
        setCategories([]);
        setCategoriesLoaded(true);
        setLoadingCategories(false);
        return [];
      }

      setLoadingCategories(true);
      setCategoriesLoaded(false);

      const request = (async () => {
        try {
          const { data, error } = await supabase
            .from("categories")
            .select("id, name, type, color, icon, is_default")
            .eq("user_id", currentUser.id)
            .order("is_default", { ascending: false })
            .order("name", { ascending: true });

          if (error) throw error;

          let nextCategories = (data ?? []) as AppCategory[];
          const hasIncome = nextCategories.some((category) => category.type === "income");
          const hasExpense = nextCategories.some((category) => category.type === "expense");

          if ((!hasIncome || !hasExpense) && ensureAttemptedForUserRef.current !== currentUser.id) {
            ensureAttemptedForUserRef.current = currentUser.id;
            const ensuredCategories = await ensureDefaultCategories();
            if (ensuredCategories) {
              nextCategories = ensuredCategories;
            }
          }

          setCategories(nextCategories);
          setCategoriesLoaded(true);
          return nextCategories;
        } finally {
          setLoadingCategories(false);
          categoriesRequestRef.current = null;
        }
      })();

      categoriesRequestRef.current = request;
      return request;
    },
    [supabase]
  );

  const refreshUser = useCallback(async () => {
    const currentUser = await loadUser();
    if (currentUser) {
      await Promise.all([loadProfile(currentUser), loadCategories(currentUser)]);
    } else {
      setProfile(null);
      setCategories([]);
      setProfileLoaded(true);
      setCategoriesLoaded(true);
      setFinancialCacheState({});
    }
    return currentUser;
  }, [loadCategories, loadProfile, loadUser]);

  const refreshProfile = useCallback(() => loadProfile(), [loadProfile]);
  const refreshCategories = useCallback(() => loadCategories(), [loadCategories]);
  const getCategoriesByType = useCallback(
    (type: "income" | "expense") =>
      categories.filter((category) => category.type === type),
    [categories]
  );

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    refreshUser().catch(() => {
      setUser(null);
      setProfile(null);
      setCategories([]);
      setProfileLoaded(true);
      setCategoriesLoaded(true);
      setLoadingUser(false);
      setLoadingProfile(false);
      setLoadingCategories(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;

      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setCategories([]);
        setFinancialCacheState({});
        setProfileLoaded(true);
        setCategoriesLoaded(true);
        setLoadingProfile(false);
        setLoadingCategories(false);
        return;
      }

      void Promise.all([loadProfile(nextUser), loadCategories(nextUser)]).catch(() => {
        setLoadingProfile(false);
        setLoadingCategories(false);
      });
    });

    return () => subscription.unsubscribe();
  }, [loadCategories, loadProfile, refreshUser, supabase]);

  // Realtime: atualiza o site automaticamente quando lançamentos mudam
  // (ex: registro/exclusão feitos pelo WhatsApp), sem precisar recarregar.
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`rt-transactions-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newId = (payload.new as { id?: string })?.id;
            if (newId) setLastRealtimeArrival({ id: newId, at: Date.now() });
          }
          setFinancialCacheState({});
          setFinancialVersion((version) => version + 1);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, user?.id]);

  // Catch-up de recorrências: gera as transações vencidas de gastos fixos e
  // parcelamentos que ficaram para trás (o app só gerava na criação). Roda uma
  // vez por usuário por dia; se criar algo, atualiza os dados na tela.
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    const guardKey = `moedin-catchup:${userId}:${todayDateInput()}`;
    try {
      if (window.sessionStorage.getItem(guardKey)) return;
    } catch {
      /* sessionStorage indisponível: segue e roda mesmo assim */
    }

    let cancelled = false;
    void (async () => {
      try {
        const created = await catchUpRecurrences(supabase, userId);
        try {
          window.sessionStorage.setItem(guardKey, "1");
        } catch {}
        if (!cancelled && created > 0) {
          setFinancialCacheState({});
          setFinancialVersion((version) => version + 1);
        }
      } catch {
        /* silencioso: catch-up nunca deve travar o app */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, user?.id]);

  const value = useMemo<AppDataContextValue>(
    () => ({
      user,
      profile,
      categories,
      loadingUser,
      loadingProfile,
      loadingCategories,
      profileLoaded,
      categoriesLoaded,
      financialVersion,
      lastRealtimeArrival,
      refreshUser,
      refreshProfile,
      refreshCategories,
      updateProfileCache: (nextProfile) => {
        setProfile(nextProfile);
        setProfileLoaded(true);
      },
      getFinancialCache: <T,>(key: string, maxAgeMs = DEFAULT_FINANCIAL_CACHE_TTL) => {
        const entry = financialCache[key];
        if (!entry) return null;
        if (Date.now() - entry.updatedAt > maxAgeMs) return null;
        return entry.data as T;
      },
      setFinancialCache: <T,>(key: string, data: T) => {
        setFinancialCacheState((current) => ({
          ...current,
          [key]: { data, updatedAt: Date.now() },
        }));
      },
      clearFinancialCache: (key) => {
        if (!key) {
          setFinancialCacheState({});
          return;
        }

        setFinancialCacheState((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      },
      invalidateFinancialData: () => {
        setFinancialCacheState({});
        setFinancialVersion((version) => version + 1);
      },
      getCategoriesByType,
    }),
    [
      categories,
      categoriesLoaded,
      financialCache,
      financialVersion,
      lastRealtimeArrival,
      getCategoriesByType,
      loadingCategories,
      loadingProfile,
      loadingUser,
      profile,
      profileLoaded,
      refreshCategories,
      refreshProfile,
      refreshUser,
      user,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return context;
}
