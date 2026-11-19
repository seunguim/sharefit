export type Category =
  | "생필품"
  | "식재료"
  | "배달비"
  | "의류"
  | "가구"
  | "전자제품"
  | "일회용품"
  | "기타";

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

// 내 송금 단계: none(참여 안 함) → before(송금 전) → pending(입금 확인 대기) → confirmed(입금 확인 완료)
export type PayStatus = "none" | "before" | "pending" | "confirmed";

// 참여자 현황용. 닉네임과 송금 단계만 공개돼요.
export interface Participant {
  id: string;
  nickname: string;
  paid: boolean; // 참여자가 송금 완료를 표시했어요.
  confirmed: boolean; // 글쓴이가 입금을 확인했어요.
  isAuthor: boolean;
}

export interface Account {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

// 댓글 · 공지. 공지는 글쓴이만 올릴 수 있고 목록 맨 위에 고정돼요.
export interface Comment {
  id: string;
  nickname: string;
  body: string;
  isNotice: boolean;
  createdAt: string; // ISO 문자열
  isAuthor: boolean; // 글쓴이가 쓴 댓글이에요.
  isMine: boolean; // 내가 쓴 댓글이에요.
}
