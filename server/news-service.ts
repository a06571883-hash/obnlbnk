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
      `https://newsapi.org/v2/everything?q=finance OR banking OR economy&language=ru&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`
    );

    if (!response.data.articles || !Array.isArray(response.data.articles)) {
      console.error('Invalid response from NewsAPI:', response.data);
      return [];
    }

    return response.data.articles.slice(0, 3).map((item: any, index: number) => ({
      id: index + 4, 
      title: item.title,
      content: item.description || item.content || 'Подробности недоступны',
      date: new Date(item.publishedAt).toLocaleDateString('ru-RU'),
      category: 'fiat',
      source: item.source.name
    }));
  } catch (error) {
    console.error('Error fetching finance news:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('NewsAPI error details:', error.response.data);
    }
    return [];
  }
}

export async function getNews(): Promise<NewsItem[]> {
  try {
    console.log('Fetching news...');
    const [cryptoNews, financeNews] = await Promise.all([
      fetchCryptoNews(),
      fetchFinanceNews()
    ]);

    console.log(`Retrieved ${cryptoNews.length} crypto news and ${financeNews.length} finance news`);

    
    const allNews = [...cryptoNews, ...financeNews].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return allNews;
  } catch (error) {
    console.error('Error aggregating news:', error);
    return [];
  }
}