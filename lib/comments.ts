import { getSupabase } from "@/lib/supabase";
import { Comment } from "@/types/post";

export const MAX_COMMENT_LENGTH = 300;

/** 댓글 목록 (공지가 먼저). 로그인하지 않아도 읽을 수 있어요. */
export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data, error } = await getSupabase().rpc("get_comments", {
    p_post_id: postId,
  });
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as {
      id: string;
      nickname: string;
      body: string;
      is_notice: boolean;
      created_at: string;
      is_author: boolean;
      is_mine: boolean;
    }[]
  ).map((r) => ({
    id: r.id,
    nickname: r.nickname,
    body: r.body,
    isNotice: r.is_notice,
    createdAt: r.created_at,
    isAuthor: r.is_author,
    isMine: r.is_mine,
  }));
}

/** 댓글 쓰기. 참여자·글쓴이만 가능하고, 공지는 글쓴이만 가능해요. */
export async function addComment(
  postId: string,
  body: string,
  isNotice: boolean,
): Promise<void> {
  const { error } = await getSupabase().rpc("add_comment", {
    p_post_id: postId,
    p_body: body,
    p_is_notice: isNotice,
  });
  if (error) throw new Error(error.message);
}

/** 댓글 지우기. 쓴 사람과 글쓴이만 가능해요. */
export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await getSupabase().rpc("delete_comment", {
    p_comment_id: commentId,
  });
  if (error) throw new Error(error.message);
}
