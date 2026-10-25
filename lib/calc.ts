// 4차시: 공동구매 계산 로직을 한곳에 모아둡니다.
// (글쓰기 폼, 상품 카드 어디서든 같은 규칙으로 계산되도록 함수로 분리)

/**
 * 1인당 분담금 = 총 결제 금액 ÷ 목표 모집 인원
 * 나누어떨어지지 않으면 올림해서, 방장이 모자라게 받는 일이 없게 합니다.
 * 입력이 올바르지 않으면(0명 이하, 금액 0원 이하 등) null을 돌려줍니다.
 */
export function calcPricePerPerson(
  totalPrice: number,
  targetCount: number
): number | null {
  if (!Number.isFinite(totalPrice) || !Number.isFinite(targetCount)) return null;
  if (totalPrice <= 0 || targetCount <= 0) return null;
  return Math.ceil(totalPrice / targetCount);
}

/**
 * 모집 진행률(%) = 현재 참여 인원 ÷ 목표 모집 인원 × 100
 * 0~100 사이로 맞추고, 소수점은 반올림합니다.
 */
export function calcProgress(
  currentCount: number,
  targetCount: number
): number {
  if (!Number.isFinite(currentCount) || !Number.isFinite(targetCount)) return 0;
  if (targetCount <= 0) return 0;
  const percent = Math.round((currentCount / targetCount) * 100);
  return Math.min(100, Math.max(0, percent));
}

/** 목표 인원에 도달하면 '모집 완료' */
export function isRecruitDone(currentCount: number, targetCount: number): boolean {
  return targetCount > 0 && currentCount >= targetCount;
}

/** 12000 -> "12,000원" */
export function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}
