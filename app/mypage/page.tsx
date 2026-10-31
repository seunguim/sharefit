"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import { displayName, signOut } from "@/lib/auth";
import { fetchMyPosts } from "@/lib/posts";
import { useAuth } from "@/lib/useAuth";
import { Post } from "@/types/post";

type ListState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; posts: Post[] };

export default function MyPage() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [list, setList] = useState<ListState>({ kind: "loading" });
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    if (userId === null) return;
    let cancelled = false;
    fetchMyPosts()
      .then((posts) => {
        if (!cancelled) setList({ kind: "ok", posts });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setList({
            kind: "error",
            message: e instanceof Error ? e.message : "알 수 없는 오류",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleLogout = async () => {
    setLogoutError(null);
    try {
      await signOut();
      setList({ kind: "loading" });
    } catch (e) {
      setLogoutError(e instanceof Error ? e.message : "로그아웃하지 못했어요.");
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-4 pt-6">
        <p className="py-10 text-center text-sm text-gray-400">불러오는 중...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 pt-6">
        <h1 className="text-lg font-semibold text-gray-100">내 정보</h1>
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-700">
          <p>로그인하면 내가 참여한 공동구매를 볼 수 있어요.</p>
          <Link
            href="/login?next=/mypage"
            className="mt-3 inline-block rounded-full bg-blue-600 px-5 py-2 font-medium text-white shadow"
          >
            로그인 / 회원가입
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <h1 className="text-lg font-semibold text-gray-100">내 정보</h1>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm">
        <div className="min-w-0">
          <p className="truncate font-medium">{displayName(user)}</p>
          <p className="truncate text-xs text-gray-500">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
        >
          로그아웃
        </button>
      </div>
      {logoutError && (
        <p className="mt-2 text-sm text-red-400">{logoutError}</p>
      )}

      <h2 className="mt-6 text-sm font-semibold text-gray-200">
        내가 참여한 공동구매
      </h2>
      <div className="mt-2 flex flex-col gap-3 pb-4">
        {list.kind === "loading" && (
          <p className="py-6 text-center text-sm text-gray-400">
            불러오는 중...
          </p>
        )}
        {list.kind === "error" && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">목록을 불러오지 못했어요.</p>
            <p className="mt-1 break-words">{list.message}</p>
          </div>
        )}
        {list.kind === "ok" && list.posts.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">
            아직 참여한 글이 없어요.
          </p>
        )}
        {list.kind === "ok" &&
          list.posts.map((post) => (
            <Link key={post.id} href={`/post/${post.id}`} className="block">
              <PostCard post={post} />
            </Link>
          ))}
      </div>
    </main>
  );
}
