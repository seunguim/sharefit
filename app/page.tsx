"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import { posts } from "@/data/posts";
import { Category } from "@/types/post";

const CATEGORIES: (Category | "전체")[] = ["전체", "생필품", "식재료", "배달비"];

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>("전체");

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesKeyword = post.title
        .toLowerCase()
        .includes(keyword.toLowerCase());
      const matchesCategory =
        category === "전체" || post.category === category;
      return matchesKeyword && matchesCategory;
    });
  }, [keyword, category]);

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
        {filteredPosts.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            조건에 맞는 공동구매 글이 없어요.
          </p>
        ) : (
          filteredPosts.map((post) => <PostCard key={post.id} post={post} />)
        )}
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
