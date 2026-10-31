import { getSupabase } from "@/lib/supabase";
import { Account, Category, Post, PostStatus } from "@/types/post";

// 초반에는 대전역 부근의 고정 좌표를 씁니다. (계획서: 위치 API는 단계적으로 연동)
const DEFAULT_LOCATION = { lat: 36.3326, lng: 127.4342 };

interface PostRow {
  id: string;
  title: string;
  category: Category;
  product_url: string;
  image_url: string | null;
  total_price: number;
  target_count: number;
  current_count: number;
  pickup_place: string;
  pickup_at: string;
  status: PostStatus;
}

const POST_COLUMNS =
  "id, title, category, product_url, image_url, total_price, target_count, current_count, pickup_place, pickup_at, status";

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    imageUrl: row.image_url ?? undefined,
    productUrl: row.product_url,
    totalPrice: row.total_price,
    targetCount: row.target_count,
    currentCount: row.current_count,
    pickupPlace: row.pickup_place,
    pickupAt: row.pickup_at,
    status: row.status,
  };
}

/** 게시글 목록 (최신순) */
export async function fetchPosts(): Promise<Post[]> {
  const { data, error } = await getSupabase()
    .from("posts")
    .select(POST_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PostRow[]).map(toPost);
}

/** 게시글 한 개. 없으면 null */
export async function fetchPost(id: string): Promise<Post | null> {
  const { data, error } = await getSupabase()
    .from("posts")
    .select(POST_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toPost(data as unknown as PostRow) : null;
}

export interface NewPostInput {
  title: string;
  category: Category;
  productUrl: string;
  totalPrice: number;
  targetCount: number;
  pickupPlace: string;
  pickupAt: string; // ISO 문자열
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

/**
 * 글쓰기. 글, 정산 계좌, 방장의 참여를 DB 함수 하나로 한 번에 저장합니다.
 * 돌려주는 token은 방장이 자기 글의 계좌를 다시 볼 때 쓰는 참여 토큰이에요.
 */
export async function createPost(
  input: NewPostInput
): Promise<{ postId: string; token: string }> {
  const { data, error } = await getSupabase().rpc("create_post", {
    p_title: input.title,
    p_category: input.category,
    p_product_url: input.productUrl,
    p_total_price: input.totalPrice,
    p_target_count: input.targetCount,
    p_pickup_place: input.pickupPlace,
    p_pickup_at: input.pickupAt,
    p_bank_name: input.bankName,
    p_account_number: input.accountNumber,
    p_account_holder: input.accountHolder,
    p_lat: DEFAULT_LOCATION.lat,
    p_lng: DEFAULT_LOCATION.lng,
  });

  if (error) throw new Error(error.message);
  const result = data as { post_id: string; token: string } | null;
  if (!result) throw new Error("저장 결과를 받지 못했어요.");
  return { postId: result.post_id, token: result.token };
}

/** 참여하기. 인원 +1, 정원이 차면 '모집 완료'는 DB가 처리해요. 참여 토큰을 돌려줍니다. */
export async function joinPost(
  postId: string,
  nickname: string
): Promise<string> {
  const { data, error } = await getSupabase().rpc("join_post", {
    p_post_id: postId,
    p_nickname: nickname,
  });

  if (error) throw new Error(error.message);
  if (typeof data !== "string") throw new Error("참여 결과를 받지 못했어요.");
  return data;
}

/** 정산 계좌. 이 글에 참여한 사람의 토큰이 아니면 null */
export async function fetchAccount(
  postId: string,
  token: string
): Promise<Account | null> {
  const { data, error } = await getSupabase().rpc("get_account", {
    p_post_id: postId,
    p_token: token,
  });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    bank_name: string;
    account_number: string;
    account_holder: string;
  }[];
  if (rows.length === 0) return null;
  return {
    bankName: rows[0].bank_name,
    accountNumber: rows[0].account_number,
    accountHolder: rows[0].account_holder,
  };
}
