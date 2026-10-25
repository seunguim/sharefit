import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Supabase 연결을 돌려줍니다. 처음 부를 때 한 번만 만들어요.
 * 키가 없으면 여기서 오류가 나서, .env.local 설정이 빠졌다는 걸 바로 알 수 있어요.
 * (파일을 불러오는 시점이 아니라 호출하는 시점에 확인해서, 키가 없는 배포 빌드가 깨지지 않게 했어요.)
 *
 * NEXT_PUBLIC_ 키는 브라우저에 그대로 공개돼요. 공개해도 되는 anon(publishable) 키만 넣으세요.
 * service_role 키는 절대 여기에 넣으면 안 돼요.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase 키가 없어요. .env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 넣고 개발 서버를 다시 켜주세요."
    );
  }

  client = createClient(url, anonKey);
  return client;
}
