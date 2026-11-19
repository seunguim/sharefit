"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import { fetchPosts } from "@/lib/posts";
import { CATEGORIES as POST_CATEGORIES } from "@/lib/categories";
import { Category, Post } from "@/types/post";

const CATEGORIES: (Category | "전체")[] = ["전체", ...POST_CATEGORIES];

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
    <main className="mx-auto max-w-md px-4 pb-8 pt-6 md:max-w-6xl md:px-8 md:pt-10">
      <div className="mb-5 hidden md:block">
        <h1 className="text-3xl font-bold text-gray-900">같이 사면 더 싸요</h1>
        <p className="mt-2 text-gray-600">
          1인 가구를 위한 공동구매. 필요한 만큼만 나눠 사고, 가까운 곳에서 픽업해요.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="상품명 검색"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none md:py-3 md:text-base"
        />
        <select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as (typeof CATEGORIES)[number])
          }
          className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 md:hidden"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 hidden flex-wrap gap-2 md:flex">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              category === c
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:mt-6 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
        {state.kind === "loading" && (
          <p className="py-10 text-center text-sm text-gray-400 md:col-span-full">
            불러오는 중...
          </p>
        )}

        {state.kind === "error" && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 md:col-span-full">
            <p className="font-medium">글 목록을 불러오지 못했어요.</p>
            <p className="mt-1 break-words">{state.message}</p>
          </div>
        )}

        {state.kind === "ok" && filteredPosts.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400 md:col-span-full">
            {state.posts.length === 0
              ? "아직 올라온 공동구매 글이 없어요. 첫 글을 써보세요!"
              : "조건에 맞는 공동구매 글이 없어요."}
          </p>
        )}

        {filteredPosts.map((post) => (
          <Link key={post.id} href={`/post/${post.id}`} className="block h-full">
            <PostCard post={post} />
          </Link>
        ))}
      </div>

      <div className="mt-6 flex justify-end md:hidden">
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
