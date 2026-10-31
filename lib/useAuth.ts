"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

/**
 * 지금 로그인한 사람을 알려줘요. loading이 true인 동안은 아직 확인 중이에요.
 * 로그인/로그아웃하면 자동으로 바뀌어요.
 */
export function useAuth(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    try {
      const supabase = getSupabase();
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (cancelled) return;
          setUser(data.session?.user ?? null);
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!cancelled) setUser(session?.user ?? null);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // Supabase 키가 없으면 로그인 확인을 건너뛰어요. (각 화면이 자기 오류를 보여줘요)
      setLoading(false);
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return { user, loading };
}
