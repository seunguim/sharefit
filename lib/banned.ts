// 공동구매할 수 없는 물품의 단어 목록이에요.
// DB의 contains_banned_item(step7.sql)과 같은 단어예요. 바꿀 때는 두 곳을 같이 고쳐주세요.
// (화면에서 먼저 알려주기 위한 용도이고, 실제로 막는 건 DB예요.)
export const BANNED_WORDS = [
  "주류", "소주", "맥주", "와인", "위스키", "막걸리", "보드카", "양주",
  "담배", "전자담배", "니코틴",
  "의약품", "전문의약품", "처방약",
  "마약", "대마",
  "총기", "도검", "실탄",
];

/** 글에 들어 있는 금지 단어를 찾아서 돌려줘요. 없으면 null */
export function findBannedWord(text: string): string | null {
  const lower = text.toLowerCase();
  return BANNED_WORDS.find((w) => lower.includes(w.toLowerCase())) ?? null;
}

export const BANNED_NOTICE =
  "주류, 담배, 의약품, 총기·도검류, 마약류 등은 올릴 수 없어요.";
