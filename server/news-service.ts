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

// Fallback новости, если API ключи отсутствуют
function getFallbackNews(): NewsItem[] {
  return [
    {
      id: 1,
      title: "Bitcoin достиг нового исторического максимума",
      content: "Крупнейшая криптовалюта мира продолжает демонстрировать рост на фоне увеличения институционального интереса...",
      date: new Date().toLocaleDateString('en-US'),
      category: 'crypto',
      source: 'Demo News'
    },
    {
      id: 2,
      title: "Центральные банки изучают цифровые валюты",
      content: "Множество центральных банков по всему миру активно исследуют возможности внедрения цифровых валют центробанков...",
      date: new Date(Date.now() - 86400000).toLocaleDateString('en-US'),
      category: 'fiat',
      source: 'Demo News'
    },
    {
      id: 3,
      title: "Новые инновации в блокчейн технологиях",
      content: "Разработчики представили новые решения для масштабирования блокчейн сетей, что может значительно улучшить производительность...",
      date: new Date(Date.now() - 2*86400000).toLocaleDateString('en-US'),
      category: 'crypto',
      source: 'Demo News'
    },
    {
      id: 4,
      title: "Регулирование криптовалют: новые правила",
      content: "Правительства разных стран продолжают работу над созданием четкого правового поля для криптовалютного рынка...",
      date: new Date(Date.now() - 3*86400000).toLocaleDateString('en-US'),
      category: 'fiat',
      source: 'Demo News'
    },
    {
      id: 5,
      title: "NFT рынок показывает стабильный рост",
      content: "Рынок невзаимозаменяемых токенов продолжает развиваться, привлекая внимание художников, коллекционеров и инвесторов...",
      date: new Date(Date.now() - 4*86400000).toLocaleDateString('en-US'),
      category: 'crypto',
      source: 'Demo News'
    }
  ];
}


async function fetchCryptoNews(): Promise<NewsItem[]> {
  try {
    if (!CRYPTO_COMPARE_KEY) {
      console.log('CRYPTO_COMPARE_KEY не найден, используем demo новости');
      return getFallbackNews().filter(item => item.category === 'crypto');
    }

    const response = await axios.get(`https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${CRYPTO_COMPARE_KEY}`);

    const newsItems = response.data.Data.slice(0, 10).map((item: any, index: number) => ({
      id: index + 1,
      title: item.title,
      content: item.body.substring(0, 300) + '...',
      date: new Date(item.published_on * 1000).toLocaleDateString('en-US'),
      category: 'crypto',
      source: item.source
    }));

    return newsItems;
  } catch (error) {
    console.error('Error fetching crypto news:', error);
    return getFallbackNews().filter(item => item.category === 'crypto');
  }
}

async function fetchFinanceNews(): Promise<NewsItem[]> {
  try {
    if (!NEWS_API_KEY) {
      console.log('NEWS_API_KEY не найден, используем demo новости');
      return getFallbackNews().filter(item => item.category === 'fiat');
    }

    const response = await axios.get(
      `https://newsapi.org/v2/everything?` + 
      `q=finance OR banking OR economy OR cryptocurrency&` +
      `language=en&` +
      `excludeDomains=rt.com,sputniknews.com,ria.ru,tass.ru&` +
      `sortBy=publishedAt&` +
      `pageSize=10&` +
      `apiKey=${NEWS_API_KEY}`
    );

    if (!response.data.articles || !Array.isArray(response.data.articles)) {
      console.error('Invalid response from NewsAPI:', response.data);
      return getFallbackNews().filter(item => item.category === 'fiat');
    }

    // Filter out unwanted sources
    const filteredArticles = response.data.articles.filter((article: any) => {
      const source = article.source.name.toLowerCase();
      return !source.includes('rt') && 
             !source.includes('sputnik') && 
             !source.includes('ria') && 
             !source.includes('tass');
    });

    return filteredArticles.slice(0, 10).map((item: any, index: number) => ({
      id: index + 11, 
      title: item.title,
      content: item.description || item.content || 'Details not available',
      date: new Date(item.publishedAt).toLocaleDateString('en-US'),
      category: 'fiat',
      source: item.source.name
    }));
  } catch (error) {
    console.error('Error fetching finance news:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('NewsAPI error details:', error.response.data);
    }
    return getFallbackNews().filter(item => item.category === 'fiat');
  }
}

export async function getNews(): Promise<NewsItem[]> {
  try {
    console.log('Загрузка новостей...');
    const [cryptoNews, financeNews] = await Promise.all([
      fetchCryptoNews(),
      fetchFinanceNews()
    ]);

    console.log(`Получено ${cryptoNews.length} крипто-новостей и ${financeNews.length} финансовых новостей`);

    const allNews = [...cryptoNews, ...financeNews].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return allNews;
  } catch (error) {
    console.error('Ошибка агрегации новостей:', error);
    return [];
  }
}
