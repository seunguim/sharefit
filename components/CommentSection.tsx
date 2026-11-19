"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  MAX_COMMENT_LENGTH,
  addComment,
  deleteComment,
  fetchComments,
} from "@/lib/comments";
import { Comment } from "@/types/post";

interface Props {
  postId: string;
  loggedIn: boolean;
  isAuthor: boolean; // 글쓴이인가요?
  joined: boolean; // 참여 중인가요? (글쓴이도 참여자로 쳐요)
  loginHref: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function CommentSection({
  postId,
  loggedIn,
  isAuthor,
  joined,
  loginHref,
}: Props) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [asNotice, setAsNotice] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canWrite = loggedIn && (joined || isAuthor);

  const load = useCallback(async () => {
    try {
      setComments(await fetchComments(postId));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "불러오지 못했어요.");
    }
  }, [postId]);

  useEffect(() => {
    // 처음 한 번 목록을 불러와요.
    let cancelled = false;
    fetchComments(postId)
      .then((list) => {
        if (!cancelled) setComments(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "불러오지 못했어요.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const handleSubmit = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await addComment(postId, body, isAuthor && asNotice);
      setText("");
      setAsNotice(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "댓글을 올리지 못했어요.");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteComment(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "지우지 못했어요.");
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm">
      <h3 className="text-sm font-semibold">
        댓글·공지{comments ? ` (${comments.length})` : ""}
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        픽업 시간이나 장소처럼 참여자끼리 정할 일을 여기서 이야기해요.
      </p>

      {loadError && (
        <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700 break-words">
          댓글을 불러오지 못했어요. {loadError}
        </p>
      )}

      {comments === null && !loadError && (
        <p className="mt-3 text-xs text-gray-400">불러오는 중...</p>
      )}

      {comments && comments.length === 0 && (
        <p className="mt-3 text-xs text-gray-400">아직 댓글이 없어요.</p>
      )}

      {comments && comments.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`rounded-lg p-2 text-sm ${
                c.isNotice
                  ? "border border-amber-300 bg-amber-50"
                  : "bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {c.isNotice && (
                  <span className="rounded bg-amber-500 px-1.5 py-0.5 font-medium text-white">
                    공지
                  </span>
                )}
                <span className="font-medium text-gray-700">{c.nickname}</span>
                {c.isAuthor && <span>(글쓴이)</span>}
                <span>{formatTime(c.createdAt)}</span>
                {(c.isMine || isAuthor) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="ml-auto text-gray-400 underline"
                  >
                    삭제
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        {canWrite ? (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
              rows={2}
              placeholder="댓글을 입력하세요"
              className="w-full rounded-lg border border-gray-300 p-2 text-sm"
            />
            <div className="mt-1 flex items-center gap-2">
              {isAuthor && (
                <label className="flex items-center gap-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={asNotice}
                    onChange={(e) => setAsNotice(e.target.checked)}
                  />
                  공지로 올리기
                </label>
              )}
              <span className="ml-auto text-xs text-gray-400">
                {text.length}/{MAX_COMMENT_LENGTH}
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={sending || text.trim().length === 0}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:bg-gray-300"
              >
                {sending ? "올리는 중..." : "올리기"}
              </button>
            </div>
          </>
        ) : loggedIn ? (
          <p className="text-xs text-gray-500">
            이 글에 참여하면 댓글을 쓸 수 있어요.
          </p>
        ) : (
          <p className="text-xs text-gray-500">
            <Link href={loginHref} className="underline">
              로그인
            </Link>
            하고 참여하면 댓글을 쓸 수 있어요.
          </p>
        )}
        {error && (
          <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700 break-words">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
