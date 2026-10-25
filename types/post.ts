export type Category = "생필품" | "식재료" | "배달비";

// 4차시: 1인당 분담금은 직접 적지 않고, 총 결제 금액 ÷ 목표 인원으로 계산합니다.
// (lib/calc.ts 의 calcPricePerPerson)
export interface Post {
  id: string;
  title: string;
  category: Category;
  imageUrl?: string;
  totalPrice: number;
  targetCount: number;
  currentCount: number;
}
