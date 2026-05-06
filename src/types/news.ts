export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  image?: string;
  date: string;
  source: string;
  url?: string;
  likes?: number;
  comments?: number;
  isLiked?: boolean;
  category?: string;
  analysis?: string;
}
