export type Category = "생필품" | "식재료" | "배달비";

export type PostStatus = "recruiting" | "done";

// 1인당 분담금은 저장하지 않고 총 결제 금액 ÷ 목표 인원으로 계산합니다.
// (lib/calc.ts 의 calcPricePerPerson)
export interface Post {
  id: string;
  title: string;
  category: Category;
  imageUrl?: string;
  productUrl: string;
  totalPrice: number;
  targetCount: number;
  currentCount: number;
  pickupPlace: string;
  pickupAt: string; // ISO 문자열
  status: PostStatus;
  authorId?: string; // 글쓴이 계정 id (더미 글은 없어요)
}

export interface Account {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}
