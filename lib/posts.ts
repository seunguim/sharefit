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
 * 글쓰기 (로그인 필요). 글, 정산 계좌, 글쓴이의 참여를 DB 함수 하나로 한 번에 저장합니다.
 * 돌려주는 값은 새 글의 id예요.
 */
export async function createPost(input: NewPostInput): Promise<string> {
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
  const result = data as { post_id: string } | null;
  if (!result) throw new Error("저장 결과를 받지 못했어요.");
  return result.post_id;
}

/** 참여하기 (로그인 필요). 인원 +1, 정원이 차면 '모집 완료'는 DB가 처리해요. 한 계정은 한 번만 참여할 수 있어요. */
export async function joinPost(postId: string): Promise<void> {
  const { error } = await getSupabase().rpc("join_post", {
    p_post_id: postId,
  });
  if (error) throw new Error(error.message);
}

/** 내가 이 글에 참여했는지 (로그인한 상태에서만 부르세요) */
export async function hasJoined(postId: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc("has_joined", {
    p_post_id: postId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

/** 정산 계좌. 이 글에 참여한 내 계정이 아니면 null (로그인한 상태에서만 부르세요) */
export async function fetchAccount(postId: string): Promise<Account | null> {
  const { data, error } = await getSupabase().rpc("get_account", {
    p_post_id: postId,
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

/** 내가 참여한 글 목록 (최근 참여한 순, 로그인한 상태에서만 부르세요) */
export async function fetchMyPosts(): Promise<Post[]> {
  const { data, error } = await getSupabase().rpc("my_participations");
  if (error) throw new Error(error.message);

  const ids = ((data ?? []) as { post_id: string }[]).map((r) => r.post_id);
  if (ids.length === 0) return [];

  const { data: rows, error: postError } = await getSupabase()
    .from("posts")
    .select(POST_COLUMNS)
    .in("id", ids);
  if (postError) throw new Error(postError.message);

  const byId = new Map(
    ((rows ?? []) as unknown as PostRow[]).map((r) => [r.id, toPost(r)])
  );
  // rpc가 준 순서(최근 참여 순)를 그대로 유지해요.
  return ids.flatMap((id) => {
    const post = byId.get(id);
    return post ? [post] : [];
  });
}
