"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PostForm, { FormValues, ImageChange, toLocalInput } from "@/components/PostForm";
import { fetchAccount, fetchPost, updatePost } from "@/lib/posts";
import { deletePostImage, uploadPostImage } from "@/lib/storage";
import { useAuth } from "@/lib/useAuth";
import { Post } from "@/types/post";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "notfound" }
  | { kind: "ok"; post: Post; initial: FormValues };

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (authLoading || userId === null) return;
    let cancelled = false;
    (async () => {
      const post = await fetchPost(id);
      if (!post) return { kind: "notfound" } as const;
      // 글쓴이는 첫 참여자라서 정산 계좌를 불러올 수 있어요.
      const account = await fetchAccount(id);
      const initial: FormValues = {
        title: post.title,
        category: post.category,
        productUrl: post.productUrl,
        totalPrice: String(post.totalPrice),
        targetCount: String(post.targetCount),
        pickupPlace: post.pickupPlace,
        pickupAt: toLocalInput(post.pickupAt),
        bankName: account?.bankName ?? "",
        accountNumber: account?.accountNumber ?? "",
        accountHolder: account?.accountHolder ?? "",
      };
      return { kind: "ok", post, initial } as const;
    })()
      .then((next) => {
        if (!cancelled) setState(next);
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
  }, [id, userId, authLoading]);

  const handleSubmit = async (
    values: FormValues,
    image: ImageChange,
    post: Post,
    initial: FormValues
  ) => {
    if (!user) throw new Error("로그인이 필요해요.");

    const newImageUrl = image.file ? await uploadPostImage(user.id, image.file) : null;
    try {
      // 픽업 시간을 건드리지 않았으면 원래 값을 그대로 보내요.
      const pickupAt =
        values.pickupAt === initial.pickupAt
          ? post.pickupAt
          : new Date(values.pickupAt).toISOString();

      await updatePost(id, {
        title: values.title.trim(),
        category: values.category,
        productUrl: values.productUrl.trim(),
        totalPrice: Number(values.totalPrice),
        targetCount: Number(values.targetCount),
        pickupPlace: values.pickupPlace.trim(),
        pickupAt,
        bankName: values.bankName.trim(),
        accountNumber: values.accountNumber,
        accountHolder: values.accountHolder.trim(),
        imageUrl: newImageUrl,
        clearImage: image.clear,
      });
    } catch (err) {
      if (newImageUrl) await deletePostImage(newImageUrl);
      throw err;
    }

    // 사진을 바꾸거나 지웠다면 예전 사진 파일은 정리해요.
    if (post.imageUrl && (newImageUrl || image.clear)) {
      await deletePostImage(post.imageUrl);
    }
    router.push(`/post/${id}`);
  };

  const header = (
    <div className="mb-4 flex items-center gap-3">
      <Link
        href={`/post/${id}`}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-200"
      >
        취소
      </Link>
      <h1 className="text-lg font-semibold text-gray-100">글 수정</h1>
    </div>
  );

  if (authLoading || (userId !== null && state.kind === "loading")) {
    return (
      <main className="mx-auto max-w-md px-4 pt-6">
        {header}
        <p className="py-10 text-center text-sm text-gray-400">불러오는 중...</p>
      </main>
    );
  }

  if (userId === null) {
    return (
      <main className="mx-auto max-w-md px-4 pt-6">
        {header}
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-700">
          <p>글을 수정하려면 로그인이 필요해요.</p>
          <Link
            href={`/login?next=${encodeURIComponent(`/post/${id}/edit`)}`}
            className="mt-3 inline-block rounded-full bg-blue-600 px-5 py-2 font-medium text-white shadow"
          >
            로그인하러 가기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      {header}

      {state.kind === "error" && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">글을 불러오지 못했어요.</p>
          <p className="mt-1 break-words">{state.message}</p>
        </div>
      )}

      {state.kind === "notfound" && (
        <p className="py-10 text-center text-sm text-gray-400">
          없거나 삭제된 글이에요.
        </p>
      )}

      {state.kind === "ok" && state.post.authorId !== userId && (
        <p className="py-10 text-center text-sm text-gray-400">
          내가 쓴 글만 수정할 수 있어요.
        </p>
      )}

      {state.kind === "ok" && state.post.authorId === userId && (
        <PostForm
          initialValues={state.initial}
          initialImageUrl={state.post.imageUrl ?? null}
          submitLabel="수정 완료"
          submittingLabel="저장하는 중..."
          onSubmit={(values, image) =>
            handleSubmit(values, image, state.post, state.initial)
          }
        />
      )}
    </main>
  );
}
