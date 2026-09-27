import { Post } from "@/types/post";

export default function PostCard({ post }: { post: Post }) {
  const percent = Math.min(
    100,
    Math.round((post.currentCount / post.targetCount) * 100)
  );
  const isFull = post.currentCount >= post.targetCount;

  return (
    <div className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs text-blue-400">
        상품 사진
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <div>
          <span className="text-xs font-medium text-blue-500">
            {post.category}
          </span>
          <h3 className="font-medium text-gray-900">{post.title}</h3>
          <p className="text-sm text-gray-600">
            1인당 분담금: {post.pricePerPerson.toLocaleString()}원
          </p>
        </div>

        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {isFull
              ? "모집 완료"
              : `모집현황: ${percent}% (${post.currentCount}/${post.targetCount}명 모집중)`}
          </p>
        </div>
      </div>
    </div>
  );
}
