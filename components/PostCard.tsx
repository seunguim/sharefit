import { Post } from "@/types/post";
import {
  calcPricePerPerson,
  calcProgress,
  formatWon,
  isRecruitDone,
} from "@/lib/calc";

export default function PostCard({ post }: { post: Post }) {
  const pricePerPerson = calcPricePerPerson(post.totalPrice, post.targetCount);
  const percent = calcProgress(post.currentCount, post.targetCount);
  const isDone = isRecruitDone(post.currentCount, post.targetCount);

  return (
    <div className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs text-blue-400">
        상품 사진
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-blue-500">
              {post.category}
            </span>
            {isDone && (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                모집 완료
              </span>
            )}
          </div>
          <h3 className="font-medium text-gray-900">{post.title}</h3>
          <p className="text-sm text-gray-600">
            1인당 분담금:{" "}
            {pricePerPerson === null ? "-" : formatWon(pricePerPerson)}
          </p>
        </div>

        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${
                isDone ? "bg-gray-400" : "bg-blue-500"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {isDone
              ? `모집 완료 (${post.currentCount}/${post.targetCount}명)`
              : `모집현황: ${percent}% (${post.currentCount}/${post.targetCount}명 모집중)`}
          </p>
        </div>
      </div>
    </div>
  );
}
