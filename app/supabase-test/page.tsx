"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

// 연결 확인용 임시 페이지입니다. 6차시 연결이 끝나면 지워도 돼요.
interface PostRow {
  id: string;
  title: string;
  total_price: number;
  target_count: number;
  current_count: number;
  price_per_person: number;
  status: string;
}

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; rows: PostRow[] };

export default function SupabaseTestPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await getSupabase()
          .from("posts")
          .select(
            "id, title, total_price, target_count, current_count, price_per_person, status"
          )
          .order("created_at", { ascending: true });

        if (error) {
          setState({ kind: "error", message: error.message });
          return;
        }
        setState({ kind: "ok", rows: (data ?? []) as PostRow[] });
      } catch (e) {
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "알 수 없는 오류",
        });
      }
    }
    load();
  }, []);

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-200"
        >
          홈
        </Link>
        <h1 className="text-lg font-semibold text-gray-100">Supabase 연결 확인</h1>
      </div>

      {state.kind === "loading" && (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      )}

      {state.kind === "error" && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">연결에 실패했어요.</p>
          <p className="mt-1 break-words">{state.message}</p>
        </div>
      )}

      {state.kind === "ok" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-green-500">
            연결 성공! posts 테이블에서 {state.rows.length}개를 읽었어요.
          </p>
          {state.rows.length === 0 && (
            <p className="text-sm text-gray-400">
              테이블은 있는데 글이 없어요. seed.sql을 실행했는지 확인해보세요.
            </p>
          )}
          {state.rows.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800"
            >
              <p className="font-medium">{r.title}</p>
              <p className="text-gray-600">
                총 {r.total_price.toLocaleString("ko-KR")}원 · 1인당{" "}
                {r.price_per_person.toLocaleString("ko-KR")}원 ·{" "}
                {r.current_count}/{r.target_count}명 ({r.status})
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
