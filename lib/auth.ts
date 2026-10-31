import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

// Supabase가 영어로 주는 오류 문구를 한국어로 바꿔요. 모르는 문구는 그대로 보여줘요.
function toKoreanMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 맞지 않아요.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "이미 가입된 이메일이에요. 로그인해주세요.";
  }
  if (m.includes("at least") && m.includes("character")) {
    return "비밀번호는 6자 이상으로 입력해주세요.";
  }
  if (m.includes("email not confirmed")) {
    return "메일 인증이 아직 안 됐어요. 받은 편지함에서 인증 링크를 눌러주세요.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "요청이 너무 많아요. 잠시 후에 다시 시도해주세요.";
  }
  if (m.includes("valid email") || m.includes("invalid email")) {
    return "올바른 이메일 주소를 입력해주세요.";
  }
  return message;
}

/**
 * 회원가입. 닉네임은 계정 정보(user_metadata)에 같이 저장해요.
 * 돌려주는 needsConfirm이 true면, 이메일 인증을 해야 로그인이 되는 설정이에요.
 */
export async function signUp(
  email: string,
  password: string,
  nickname: string
): Promise<{ needsConfirm: boolean }> {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: { data: { nickname } },
  });
  if (error) throw new Error(toKoreanMessage(error.message));
  return { needsConfirm: data.session === null };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(toKoreanMessage(error.message));
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw new Error(toKoreanMessage(error.message));
}

/** 화면에 보여줄 이름. 가입할 때 쓴 닉네임, 없으면 이메일 앞부분 */
export function displayName(user: User): string {
  const nickname = user.user_metadata?.nickname;
  if (typeof nickname === "string" && nickname.trim()) return nickname.trim();
  return (user.email ?? "").split("@")[0] || "회원";
}
