"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import { fetchPosts } from "@/lib/posts";
import { Category, Post } from "@/types/post";

const CATEGORIES: (Category | "전체")[] = ["전체", "생필품", "식재료", "배달비"];

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; posts: Post[] };

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>("전체");
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchPosts()
      .then((posts) => {
        if (!cancelled) setState({ kind: "ok", posts });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({
            kind: "error",
            message: e instanceof Error ? e.message : "알 수 없는 오류",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPosts = useMemo(() => {
    if (state.kind !== "ok") return [];
    return state.posts.filter((post) => {
      const matchesKeyword = post.title
        .toLowerCase()
        .includes(keyword.toLowerCase());
      const matchesCategory =
        category === "전체" || post.category === category;
      return matchesKeyword && matchesCategory;
    });
  }, [state, keyword, category]);

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <div className="flex gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="상품명 검색"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
        />
        <select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as (typeof CATEGORIES)[number])
          }
          className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {state.kind === "loading" && (
          <p className="py-10 text-center text-sm text-gray-400">
            불러오는 중...
          </p>
        )}

        {state.kind === "error" && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">글 목록을 불러오지 못했어요.</p>
            <p className="mt-1 break-words">{state.message}</p>
          </div>
        )}

        {state.kind === "ok" && filteredPosts.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">
            {state.posts.length === 0
              ? "아직 올라온 공동구매 글이 없어요. 첫 글을 써보세요!"
              : "조건에 맞는 공동구매 글이 없어요."}
          </p>
        )}

        {filteredPosts.map((post) => (
          <Link key={post.id} href={`/post/${post.id}`} className="block">
            <PostCard post={post} />
          </Link>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Link
          href="/write"
          className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow"
        >
          + 글쓰기
        </Link>
      </div>
    </main>
  );
}
