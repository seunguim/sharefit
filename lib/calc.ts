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

/** 마감일이 지났는지. 마감일이 없으면 항상 false예요. */
export function isDeadlinePassed(deadline?: string, now: number = Date.now()): boolean {
  if (!deadline) return false;
  const t = new Date(deadline).getTime();
  return Number.isFinite(t) && t <= now;
}

/**
 * 마감까지 남은 기간 표시: "D-3", "오늘 마감". 마감일이 없거나 이미 지났으면 null이에요.
 * 날짜(내 시간대) 기준으로 세요.
 */
export function formatDeadlineLabel(deadline?: string, now: number = Date.now()): string | null {
  if (!deadline) return null;
  const end = new Date(deadline);
  if (Number.isNaN(end.getTime()) || end.getTime() <= now) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(end) - startOfDay(new Date(now))) / 86400000);
  return days <= 0 ? "오늘 마감" : `D-${days}`;
}
