export type Category = "생필품" | "식재료" | "배달비";

export interface Post {
  id: string;
  title: string;
  category: Category;
  imageUrl?: string;
  pricePerPerson: number;
  targetCount: number;
  currentCount: number;
}
