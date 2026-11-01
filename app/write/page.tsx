"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import PostForm, { emptyValues, FormValues, ImageChange } from "@/components/PostForm";
import { createPost } from "@/lib/posts";
import { deletePostImage, uploadPostImage } from "@/lib/storage";
import { useAuth } from "@/lib/useAuth";

export default function WritePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const handleSubmit = async (values: FormValues, image: ImageChange) => {
    if (!user) throw new Error("로그인이 필요해요.");

    // 사진을 먼저 올리고, 그 주소를 글과 함께 저장해요.
    const imageUrl = image.file ? await uploadPostImage(user.id, image.file) : null;
    try {
      // 글 + 정산 계좌 + 글쓴이의 참여를 DB에 한 번에 저장합니다. (로그인 필요)
      const postId = await createPost({
        title: values.title.trim(),
        category: values.category,
        productUrl: values.productUrl.trim(),
        totalPrice: Number(values.totalPrice),
        targetCount: Number(values.targetCount),
        pickupPlace: values.pickupPlace.trim(),
        pickupAt: new Date(values.pickupAt).toISOString(),
        bankName: values.bankName.trim(),
        accountNumber: values.accountNumber,
        accountHolder: values.accountHolder.trim(),
        imageUrl,
      });
      router.push(`/post/${postId}`);
    } catch (err) {
      // 글 저장이 실패하면 방금 올린 사진도 지워서 쓰레기 파일이 남지 않게 해요.
      if (imageUrl) await deletePostImage(imageUrl);
      throw err;
    }
  };

  if (authLoading) {
    return (
      <main className="mx-auto max-w-md px-4 pt-6">
        <p className="py-10 text-center text-sm text-gray-400">불러오는 중...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 pt-6">
        <h1 className="text-lg font-semibold text-gray-100">공동구매 글쓰기</h1>
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-700">
          <p>글을 쓰려면 로그인이 필요해요.</p>
          <Link
            href="/login?next=/write"
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
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-200"
        >
          뒤로가기
        </Link>
        <h1 className="text-lg font-semibold text-gray-100">공동구매 글쓰기</h1>
      </div>

      <PostForm
        initialValues={emptyValues}
        submitLabel="글쓰기"
        submittingLabel="저장하는 중..."
        onSubmit={handleSubmit}
      />
    </main>
  );
}
