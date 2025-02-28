import { Telegraf } from 'telegraf';
import axios from 'axios';

interface NewsItem {
  id: number;
  title: string;
  content: string;
  date: string;
  category: 'crypto' | 'fiat';
  source: string;
}

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const CRYPTO_COMPARE_KEY = process.env.CRYPTO_COMPARE_KEY;

async function fetchCryptoNews(): Promise<NewsItem[]> {
  try {
    const response = await axios.get(`https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${CRYPTO_COMPARE_KEY}`);
    return response.data.Data.slice(0, 3).map((item: any, index: number) => ({
      id: index + 1,
      title: item.title,
      content: item.body.substring(0, 200) + '...',
      date: new Date(item.published_on * 1000).toLocaleDateString('ru-RU'),
      category: 'crypto',
      source: item.source
    }));
  } catch (error) {
    console.error('Error fetching crypto news:', error);
    return [];
  }
}

async function fetchFinanceNews(): Promise<NewsItem[]> {
  try {
    const response = await axios.get(
      `https://newsapi.org/v2/top-headlines?country=ru&category=business&apiKey=${NEWS_API_KEY}`
    );
    return response.data.articles.slice(0, 2).map((item: any, index: number) => ({
      id: index + 4,
      title: item.title,
      content: item.description || item.content,
      date: new Date(item.publishedAt).toLocaleDateString('ru-RU'),
      category: 'fiat',
      source: item.source.name
    }));
  } catch (error) {
    console.error('Error fetching finance news:', error);
    return [];
  }
}

export async function getNews(): Promise<NewsItem[]> {
  try {
    const [cryptoNews, financeNews] = await Promise.all([
      fetchCryptoNews(),
      fetchFinanceNews()
    ]);

    return [...cryptoNews, ...financeNews].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  } catch (error) {
    console.error('Error aggregating news:', error);
    return [];
  }
}
