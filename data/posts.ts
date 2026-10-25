import { Post } from "@/types/post";

// 더미 데이터: 1인당 분담금은 totalPrice ÷ targetCount 로 화면에서 자동 계산됩니다.
// (Supabase 연동은 6~8차시 예정)
export const posts: Post[] = [
  {
    id: "1",
    title: "몬스터 에너지 드링크 36개입",
    category: "식재료",
    totalPrice: 19000,
    targetCount: 10,
    currentCount: 6,
  },
  {
    id: "2",
    title: "떡볶이 및 피자 배달",
    category: "배달비",
    totalPrice: 80000,
    targetCount: 10,
    currentCount: 7,
  },
  {
    id: "3",
    title: "코스트코 화장지 30롤",
    category: "생필품",
    totalPrice: 44000,
    targetCount: 8,
    currentCount: 3,
  },
  {
    id: "4",
    title: "삼겹살 대용량 팩 5kg",
    category: "식재료",
    totalPrice: 72000,
    targetCount: 6,
    currentCount: 6,
  },
];
