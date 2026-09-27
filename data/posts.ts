import { Post } from "@/types/post";

// 2차시: DB 연동 전이라 더미 데이터로 화면만 먼저 완성합니다.
// (Supabase 연동은 6~8차시 예정)
export const posts: Post[] = [
  {
    id: "1",
    title: "몬스터 에너지 드링크 36개입",
    category: "식재료",
    pricePerPerson: 1900,
    targetCount: 10,
    currentCount: 6,
  },
  {
    id: "2",
    title: "떡볶이 및 피자 배달",
    category: "배달비",
    pricePerPerson: 8000,
    targetCount: 10,
    currentCount: 7,
  },
  {
    id: "3",
    title: "코스트코 화장지 30롤",
    category: "생필품",
    pricePerPerson: 5500,
    targetCount: 8,
    currentCount: 3,
  },
  {
    id: "4",
    title: "삼겹살 대용량 팩 5kg",
    category: "식재료",
    pricePerPerson: 12000,
    targetCount: 6,
    currentCount: 6,
  },
];
