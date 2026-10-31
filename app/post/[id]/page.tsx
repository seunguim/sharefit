"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  calcPricePerPerson,
  calcProgress,
  formatWon,
  isRecruitDone,
} from "@/lib/calc";
import { fetchAccount, fetchPost, joinPost } from "@/lib/posts";
import { getToken, saveToken } from "@/lib/tokens";
import { Account, Post } from "@/types/post";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "notfound" }
  | { kind: "ok"; post: Post; account: Account | null; joined: boolean };

// 글 정보와, 이 브라우저의 참여 토큰으로 볼 수 있는 계좌를 함께 불러옵니다.
async function loadAll(id: string): Promise<LoadState> {
  const post = await fetchPost(id);
  if (!post) return { kind: "notfound" };

  const token = getToken(id);
  const account = token ? await fetchAccount(id, token) : null;
  // 토큰이 있어도 계좌가 안 오면(다른 글의 토큰 등) 참여한 것으로 보지 않아요.
  return { kind: "ok", post, account, joined: account !== null };
}

function formatPickup(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [nickname, setNickname] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAll(id)
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
  }, [id]);

  const handleJoin = async () => {
    if (joining) return;
    const name = nickname.trim();
    if (!name) {
      setJoinError("닉네임을 입력해주세요.");
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const token = await joinPost(id, name);
      saveToken(id, token);
      setState(await loadAll(id)); // 인원·진행률·계좌를 새로 불러와요.
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "참여하지 못했어요.");
      // 다른 사람이 먼저 참여해서 정원이 찼을 수 있으니 최신 상태로 다시 보여줘요.
      try {
        setState(await loadAll(id));
      } catch {
        // 목록을 못 불러와도 위의 오류 문구는 그대로 보여줘요.
      }
    } finally {
      setJoining(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 복사가 막힌 환경에서는 계좌번호를 직접 눌러 선택해서 복사하면 돼요.
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-200"
        >
          목록으로
        </Link>
        <h1 className="text-lg font-semibold text-gray-100">공동구매 상세</h1>
      </div>

      {state.kind === "loading" && (
        <p className="py-10 text-center text-sm text-gray-400">불러오는 중...</p>
      )}

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

      {state.kind === "ok" && (
        <DetailBody
          post={state.post}
          account={state.account}
          joined={state.joined}
          nickname={nickname}
          onNicknameChange={setNickname}
          joining={joining}
          joinError={joinError}
          onJoin={handleJoin}
          copied={copied}
          onCopy={handleCopy}
        />
      )}
    </main>
  );
}

interface DetailBodyProps {
  post: Post;
  account: Account | null;
  joined: boolean;
  nickname: string;
  onNicknameChange: (value: string) => void;
  joining: boolean;
  joinError: string | null;
  onJoin: () => void;
  copied: boolean;
  onCopy: (text: string) => void;
}

function DetailBody({
  post,
  account,
  joined,
  nickname,
  onNicknameChange,
  joining,
  joinError,
  onJoin,
  copied,
  onCopy,
}: DetailBodyProps) {
  const pricePerPerson = calcPricePerPerson(post.totalPrice, post.targetCount);
  const percent = calcProgress(post.currentCount, post.targetCount);
  const isDone = isRecruitDone(post.currentCount, post.targetCount);
  const remaining = Math.max(0, post.targetCount - post.currentCount);
  const isLink = /^https?:\/\//i.test(post.productUrl);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <section className="rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm">
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
        <h2 className="mt-1 text-lg font-semibold">{post.title}</h2>

        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">총 결제 금액</dt>
          <dd>{formatWon(post.totalPrice)}</dd>
          <dt className="text-gray-500">1인당 분담금</dt>
          <dd className="font-semibold text-blue-700">
            {pricePerPerson === null ? "-" : formatWon(pricePerPerson)}
          </dd>
          <dt className="text-gray-500">픽업 장소</dt>
          <dd className="break-words">{post.pickupPlace}</dd>
          <dt className="text-gray-500">픽업 일시</dt>
          <dd>{formatPickup(post.pickupAt)}</dd>
          <dt className="text-gray-500">상품</dt>
          <dd className="break-all">
            {isLink ? (
              <a
                href={post.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                상품 링크 열기
              </a>
            ) : (
              post.productUrl
            )}
          </dd>
        </dl>

        <div className="mt-4">
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
              : `모집현황: ${percent}% (${post.currentCount}/${post.targetCount}명, ${remaining}명 더 필요해요)`}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm">
        <h3 className="text-sm font-semibold">정산 계좌</h3>
        {account ? (
          <div className="mt-2 text-sm">
            <p>
              {account.bankName} · 예금주 {account.accountHolder}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="select-all font-mono text-base">
                {account.accountNumber}
              </span>
              <button
                type="button"
                onClick={() => onCopy(account.accountNumber)}
                className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700"
              >
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              픽업 전에 1인당 분담금을 이 계좌로 보내주세요.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">
            이 글에 참여하면 정산 계좌가 공개돼요.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        {joined ? (
          <p className="rounded-lg bg-green-50 p-3 text-center text-sm text-green-700">
            이 글에 참여 중이에요.
          </p>
        ) : (
          <>
            <input
              type="text"
              value={nickname}
              onChange={(e) => onNicknameChange(e.target.value)}
              placeholder="닉네임 (필수)"
              maxLength={20}
              disabled={isDone}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none disabled:bg-gray-100"
            />
            <button
              type="button"
              onClick={onJoin}
              disabled={isDone || joining}
              className="rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow disabled:bg-gray-400"
            >
              {isDone ? "모집이 끝났어요" : joining ? "참여하는 중..." : "참여하기"}
            </button>
          </>
        )}

        {joinError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">참여하지 못했어요.</p>
            <p className="mt-1 break-words">{joinError}</p>
          </div>
        )}
      </section>
    </div>
  );
}
