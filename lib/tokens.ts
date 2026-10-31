// 참여 토큰을 이 브라우저에만 저장합니다. (로그인 기능을 붙이기 전의 임시 방식)
// 토큰이 있으면 "이 글에 참여한 사람"으로 보고 정산 계좌를 보여줘요.
// localStorage가 막힌 환경(시크릿 창 등)에서는 저장 없이 넘어가요.

const KEY = "sharefit:tokens";

function readAll(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

export function getToken(postId: string): string | null {
  return readAll()[postId] ?? null;
}

export function saveToken(postId: string, token: string): void {
  try {
    const all = readAll();
    all[postId] = token;
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // 저장에 실패해도 화면은 계속 동작해요.
  }
}
