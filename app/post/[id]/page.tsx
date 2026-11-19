"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  calcPricePerPerson,
  calcProgress,
  formatDeadlineLabel,
  formatWon,
  isDeadlinePassed,
  isRecruitDone,
} from "@/lib/calc";
import {
  confirmPayment,
  deletePost,
  fetchAccount,
  fetchMyPayment,
  fetchParticipants,
  fetchPost,
  joinPost,
  leavePost,
  setPaid,
} from "@/lib/posts";
import CommentSection from "@/components/CommentSection";
import { deletePostImage } from "@/lib/storage";
import { useAuth } from "@/lib/useAuth";
import { Account, Participant, PayStatus, Post } from "@/types/post";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "notfound" }
  | {
      kind: "ok";
      post: Post;
      account: Account | null;
      payStatus: PayStatus; // 내 송금 단계 ("none"이면 아직 참여하지 않은 거예요)
      participants: Participant[];
    };

// 글 정보, 참여자 현황, 그리고 로그인한 사람의 참여 여부 · 송금 단계 · 정산 계좌를 함께 불러옵니다.
async function loadAll(id: string, loggedIn: boolean): Promise<LoadState> {
  const post = await fetchPost(id);
  if (!post) return { kind: "notfound" };

  const participants = await fetchParticipants(id);
  if (!loggedIn) {
    return { kind: "ok", post, account: null, payStatus: "none", participants };
  }

  const payStatus = await fetchMyPayment(id);
  const account = payStatus !== "none" ? await fetchAccount(id) : null;
  return { kind: "ok", post, account, payStatus, participants };
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

// 진행 순서 중 지금 어디쯤인지 (1 모집 → 2 송금 → 3 입금 확인·주문 → 4 픽업)
function currentStep(isDone: boolean, participants: Participant[]): number {
  if (!isDone) return 1;
  if (participants.length > 0 && participants.every((p) => p.confirmed)) return 4;
  if (participants.some((p) => p.paid && !p.confirmed)) return 3;
  return 2;
}

const STEPS = ["모집", "송금", "입금 확인 · 주문", "픽업"];

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const userId = user?.id ?? null;
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [joining, setJoining] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false); // 송금 표시 · 입금 확인 처리 중
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authLoading) return; // 로그인 여부를 확인한 뒤에 불러와요.
    let cancelled = false;
    loadAll(id, userId !== null)
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

  // 어떤 동작이든 끝나면 최신 상태로 다시 불러와요. (오류가 나도 최신 상태를 보여줘요.)
  const refresh = async () => {
    try {
      setState(await loadAll(id, true));
    } catch {
      // 목록을 못 불러와도 위의 오류 문구는 그대로 보여줘요.
    }
  };

  const handleJoin = async () => {
    if (joining || !user) return;
    setJoining(true);
    setActionError(null);
    try {
      await joinPost(id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "참여하지 못했어요.");
    }
    await refresh(); // 다른 사람이 먼저 참여해서 정원이 찼을 수도 있어요.
    setJoining(false);
  };

  const handleLeave = async () => {
    if (leaving) return;
    if (!window.confirm("이 공동구매 참여를 취소할까요?")) return;
    setLeaving(true);
    setActionError(null);
    try {
      await leavePost(id);
      setCopied(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "참여를 취소하지 못했어요.");
    }
    await refresh();
    setLeaving(false);
  };

  // 참여자: 송금 완료 표시하기 / 되돌리기
  const handlePaid = async (paid: boolean) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await setPaid(id, paid);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "송금 상태를 바꾸지 못했어요.");
    }
    await refresh();
    setBusy(false);
  };

  // 글쓴이: 참여자의 입금 확인하기 / 취소하기
  const handleConfirm = async (participantId: string, confirmed: boolean) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await confirmPayment(participantId, confirmed);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "입금 확인을 바꾸지 못했어요.");
    }
    await refresh();
    setBusy(false);
  };

  // 글쓴이: 내 글 삭제 (다른 참여자가 없을 때만 DB가 허락해요.)
  const handleDelete = async () => {
    if (deleting) return;
    if (!window.confirm("이 글을 삭제할까요? 삭제하면 되돌릴 수 없어요.")) return;
    setDeleting(true);
    setActionError(null);
    try {
      const imageUrl = await deletePost(id);
      if (imageUrl) {
        try {
          await deletePostImage(imageUrl);
        } catch {
          // 사진 파일을 못 지워도 글은 이미 삭제됐어요.
        }
      }
      router.push("/");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "글을 삭제하지 못했어요.");
      setDeleting(false);
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
    <main className="mx-auto max-w-md px-4 pb-8 pt-6 md:max-w-5xl md:px-8 md:pt-10">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          목록으로
        </Link>
        <h1 className="text-lg font-semibold text-gray-900 md:text-2xl">공동구매 상세</h1>
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
          payStatus={state.payStatus}
          participants={state.participants}
          loggedIn={user !== null}
          isAuthor={user !== null && state.post.authorId === user.id}
          loginHref={`/login?next=${encodeURIComponent(`/post/${id}`)}`}
          joining={joining}
          leaving={leaving}
          busy={busy}
          actionError={actionError}
          copied={copied}
          onJoin={handleJoin}
          onLeave={handleLeave}
          onPaid={handlePaid}
          onConfirm={handleConfirm}
          onCopy={handleCopy}
          deleting={deleting}
          onDelete={handleDelete}
        />
      )}
    </main>
  );
}

interface DetailBodyProps {
  post: Post;
  account: Account | null;
  payStatus: PayStatus;
  participants: Participant[];
  loggedIn: boolean;
  isAuthor: boolean;
  loginHref: string;
  joining: boolean;
  leaving: boolean;
  busy: boolean;
  actionError: string | null;
  copied: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onPaid: (paid: boolean) => void;
  onConfirm: (participantId: string, confirmed: boolean) => void;
  onCopy: (text: string) => void;
  deleting: boolean;
  onDelete: () => void;
}

function DetailBody({
  post,
  account,
  payStatus,
  participants,
  loggedIn,
  isAuthor,
  loginHref,
  joining,
  leaving,
  busy,
  actionError,
  copied,
  onJoin,
  onLeave,
  onPaid,
  onConfirm,
  onCopy,
  deleting,
  onDelete,
}: DetailBodyProps) {
  const pricePerPerson = calcPricePerPerson(post.totalPrice, post.targetCount);
  const percent = calcProgress(post.currentCount, post.targetCount);
  const isDone = isRecruitDone(post.currentCount, post.targetCount);
  const closed = !isDone && isDeadlinePassed(post.deadline); // 정원은 안 찼지만 마감일이 지남
  const deadlineLabel = formatDeadlineLabel(post.deadline);
  const onlyAuthorJoined = participants.every((p) => p.isAuthor);
  const remaining = Math.max(0, post.targetCount - post.currentCount);
  const isLink = /^https?:\/\//i.test(post.productUrl);
  const joined = payStatus !== "none";
  const step = currentStep(isDone, participants);
  const waitingCount = participants.filter((p) => p.paid && !p.confirmed).length;

  const groups = [
    {
      key: "before",
      label: "송금 전",
      tone: "text-gray-500",
      list: participants.filter((p) => !p.paid),
    },
    {
      key: "pending",
      label: "입금 확인 대기",
      tone: "text-amber-600",
      list: participants.filter((p) => p.paid && !p.confirmed),
    },
    {
      key: "confirmed",
      label: "입금 확인 완료",
      tone: "text-green-700",
      list: participants.filter((p) => p.confirmed),
    },
  ];

  return (
    <div className="flex flex-col gap-4 pb-4 md:grid md:grid-cols-[minmax(0,1fr)_22rem] md:items-start md:gap-6">
      {/* 컴퓨터 화면: 왼쪽(글 내용·진행 순서·참여자·댓글)과 오른쪽(참여 버튼·픽업 안내·계좌·내 송금) 두 칸. 휴대폰: order 순서대로 한 줄. */}
      <div className="contents md:flex md:flex-col md:gap-4">
      <section className="order-1 rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm">
        {post.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.imageUrl}
            alt={`${post.title} 사진`}
            className="mb-3 max-h-64 w-full rounded-lg object-cover"
          />
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-blue-500">
            {post.category}
          </span>
          {isDone && (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              모집 완료
            </span>
          )}
          {closed && (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              모집 마감
            </span>
          )}
          {!isDone && deadlineLabel && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              {deadlineLabel}
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
          <dt className="text-gray-500">모집 마감</dt>
          <dd>
            {post.deadline
              ? formatPickup(post.deadline)
              : "마감일 없음 (정원이 찰 때까지)"}
          </dd>
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
                isDone || closed ? "bg-gray-400" : "bg-blue-500"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {isDone
              ? `모집 완료 (${post.currentCount}/${post.targetCount}명)`
              : closed
              ? `모집 마감 (${post.currentCount}/${post.targetCount}명) · 마감일이 지나 더 참여할 수 없어요`
              : `모집현황: ${percent}% (${post.currentCount}/${post.targetCount}명, ${remaining}명 더 필요해요)`}
          </p>
        </div>
      </section>

      <section className="order-3 rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm">
        <h3 className="text-sm font-semibold">진행 순서</h3>
        <ol className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px]">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const state = n < step ? "done" : n === step ? "now" : "todo";
            return (
              <li key={label} className="flex flex-col items-center gap-1">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    state === "now"
                      ? "bg-blue-600 text-white"
                      : state === "done"
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {state === "done" ? "✓" : n}
                </span>
                <span
                  className={
                    state === "now" ? "font-semibold text-blue-700" : "text-gray-500"
                  }
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-gray-500">
          정원이 차면 참여자가 정산 계좌로 송금하고, 글쓴이가 입금을 확인한 뒤
          주문해요. 주문한 상품은 정해진 장소와 시간에 나눠 받아요.
        </p>
      </section>

      <section className="order-6 rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm">
        <h3 className="text-sm font-semibold">참여자 현황</h3>
        {isAuthor && waitingCount > 0 && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
            입금 확인을 기다리는 참여자가 {waitingCount}명 있어요. 입금을
            확인했다면 이름 옆의 "입금 확인"을 눌러주세요.
          </p>
        )}
        {participants.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">아직 참여자가 없어요.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-3 text-sm">
            {groups.map((group) => (
              <div key={group.key}>
                <p className={`text-xs font-medium ${group.tone}`}>
                  {group.label} ({group.list.length}명)
                </p>
                <ul className="mt-1 flex flex-col gap-1">
                  {group.list.length === 0 ? (
                    <li className="text-xs text-gray-400">없음</li>
                  ) : (
                    group.list.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">
                          {p.nickname}
                          {p.isAuthor && (
                            <span className="ml-1 text-xs text-gray-400">
                              (글쓴이)
                            </span>
                          )}
                        </span>
                        {isAuthor && !p.isAuthor && group.key === "pending" && (
                          <button
                            type="button"
                            onClick={() => onConfirm(p.id, true)}
                            disabled={busy}
                            className="shrink-0 rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                          >
                            입금 확인
                          </button>
                        )}
                        {isAuthor && !p.isAuthor && group.key === "confirmed" && (
                          <button
                            type="button"
                            onClick={() => onConfirm(p.id, false)}
                            disabled={busy}
                            className="shrink-0 text-xs text-gray-500 underline disabled:opacity-60"
                          >
                            확인 취소
                          </button>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="order-7">
      <CommentSection
        postId={post.id}
        loggedIn={loggedIn}
        isAuthor={isAuthor}
        joined={joined}
        loginHref={loginHref}
      />
      </div>
      </div>

      <div className="contents md:flex md:flex-col md:gap-4">
      {isDone && joined && (
        <section className="order-2 rounded-xl border border-blue-300 bg-blue-50 p-4 text-blue-900 shadow-sm">
          <h3 className="text-sm font-semibold">🎉 모집이 완료됐어요! 픽업 안내</h3>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-blue-700">장소</dt>
            <dd className="break-words font-medium">{post.pickupPlace}</dd>
            <dt className="text-blue-700">일시</dt>
            <dd className="font-medium">{formatPickup(post.pickupAt)}</dd>
          </dl>
          {!isAuthor && payStatus === "before" && (
            <p className="mt-2 text-xs text-blue-800">
              아직 송금 전이에요. 아래 정산 계좌로{" "}
              {pricePerPerson === null ? "분담금" : formatWon(pricePerPerson)}을
              보내고 "송금 완료했어요"를 눌러주세요.
            </p>
          )}
        </section>
      )}

      <section className="order-4 rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm">
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
              {isAuthor
                ? "참여자가 이 계좌로 송금해요."
                : "픽업 전에 1인당 분담금을 이 계좌로 보내주세요."}
            </p>
          </div>
        ) : joined ? (
          <p className="mt-2 text-sm text-gray-500">
            등록된 정산 계좌가 없어요.
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-500">
            이 글에 참여하면 정산 계좌가 공개돼요.
          </p>
        )}
      </section>

      {joined && !isAuthor && (
        <section className="order-5 rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm">
          <h3 className="text-sm font-semibold">내 송금 상태</h3>
          {payStatus === "before" && (
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                아직 송금 전이에요. 위 계좌로{" "}
                {pricePerPerson === null ? "분담금" : formatWon(pricePerPerson)}을
                보낸 뒤 눌러주세요.
              </p>
              <button
                type="button"
                onClick={() => onPaid(true)}
                disabled={busy}
                className="mt-2 w-full rounded-full bg-green-600 px-5 py-2 text-sm font-medium text-white shadow disabled:opacity-60"
              >
                {busy ? "표시하는 중..." : "송금 완료했어요"}
              </button>
            </div>
          )}
          {payStatus === "pending" && (
            <div className="mt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
                  입금 확인 대기 중
                </span>
                <button
                  type="button"
                  onClick={() => onPaid(false)}
                  disabled={busy}
                  className="text-xs text-gray-500 underline disabled:opacity-60"
                >
                  {busy ? "바꾸는 중..." : "송금 전으로 되돌리기"}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                글쓴이가 입금을 확인하면 "입금 확인 완료"로 바뀌어요.
              </p>
            </div>
          )}
          {payStatus === "confirmed" && (
            <div className="mt-2">
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                입금 확인 완료 ✓
              </span>
              <p className="mt-2 text-xs text-gray-500">
                글쓴이가 입금을 확인했어요. 정해진 시간에 픽업하세요.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="order-8 flex flex-col gap-2 md:order-1">
        {joined ? (
          <>
            <p className="rounded-lg bg-green-50 p-3 text-center text-sm text-green-700">
              {isAuthor ? "내가 쓴 글이에요." : "이 글에 참여 중이에요."}
            </p>
            {isAuthor && (
              <Link
                href={`/post/${post.id}/edit`}
                className="rounded-full border border-gray-300 px-5 py-2 text-center text-sm text-gray-700 hover:bg-gray-50"
              >
                글 수정
              </Link>
            )}
            {isAuthor && (
              <>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting || !onlyAuthorJoined}
                  className="rounded-full border border-red-300 px-5 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {deleting ? "삭제하는 중..." : "글 삭제"}
                </button>
                {!onlyAuthorJoined && (
                  <p className="text-center text-xs text-gray-400">
                    다른 참여자가 있으면 삭제할 수 없어요. 모두 참여를 취소한 뒤에 삭제할 수 있어요.
                  </p>
                )}
              </>
            )}
            {!isAuthor && (
              <button
                type="button"
                onClick={onLeave}
                disabled={leaving || payStatus === "confirmed"}
                className="rounded-full border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {leaving ? "취소하는 중..." : "참여 취소"}
              </button>
            )}
            {!isAuthor && payStatus === "confirmed" && (
              <p className="text-center text-xs text-gray-400">
                입금이 확인된 뒤에는 참여를 취소할 수 없어요.
              </p>
            )}
          </>
        ) : isDone || closed ? (
          <p className="rounded-full bg-gray-400 px-5 py-3 text-center text-sm font-medium text-white">
            {closed ? "모집 기간이 끝났어요" : "모집이 끝났어요"}
          </p>
        ) : !loggedIn ? (
          <Link
            href={loginHref}
            className="rounded-full bg-blue-600 px-5 py-3 text-center text-sm font-medium text-white shadow"
          >
            로그인하고 참여하기
          </Link>
        ) : (
          <button
            type="button"
            onClick={onJoin}
            disabled={joining}
            className="rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow disabled:bg-gray-400"
          >
            {joining ? "참여하는 중..." : "참여하기"}
          </button>
        )}

        {actionError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">처리하지 못했어요.</p>
            <p className="mt-1 break-words">{actionError}</p>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
