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

async function translateToRussian(text: string): Promise<string> {
  try {
    const translations: { [key: string]: string } = {
      'Bitcoin': 'Биткоин',
      'Ethereum': 'Эфириум',
      'cryptocurrency': 'криптовалюта',
      'cryptocurrencies': 'криптовалюты',
      'blockchain': 'блокчейн',
      'mining': 'майнинг',
      'token': 'токен',
      'tokens': 'токены',
      'exchange': 'биржа',
      'exchanges': 'биржи',
      'wallet': 'кошелек',
      'wallets': 'кошельки',
      'trading': 'торговля',
      'market': 'рынок',
      'markets': 'рынки',
      'price': 'цена',
      'prices': 'цены',
      'increase': 'рост',
      'decrease': 'падение',
      'investment': 'инвестиции',
      'investors': 'инвесторы',
      'transaction': 'транзакция',
      'transactions': 'транзакции',
      'network': 'сеть',
      'networks': 'сети',
      'protocol': 'протокол',
      'protocols': 'протоколы',
      'decentralized': 'децентрализованный',
      'centralized': 'централизованный',
      'financial': 'финансовый',
      'finance': 'финансы',
      'technology': 'технология',
      'technologies': 'технологии',
      'platform': 'платформа',
      'platforms': 'платформы',
      'digital': 'цифровой',
      'currency': 'валюта',
      'currencies': 'валюты',
      'analysis': 'анализ',
      'analytics': 'аналитика',
      'trend': 'тренд',
      'trends': 'тренды',
      'growth': 'рост',
      'decline': 'снижение',
      'regulation': 'регулирование',
      'regulatory': 'регуляторный',
      'adoption': 'принятие',
      'development': 'развитие',
      'update': 'обновление',
      'updates': 'обновления',
      'security': 'безопасность',
      'secure': 'безопасный',
      'hack': 'взлом',
      'hacks': 'взломы',
      'innovation': 'инновация',
      'innovative': 'инновационный',
      'payment': 'платеж',
      'payments': 'платежи',
      'asset': 'актив',
      'assets': 'активы',
      'volume': 'объем',
      'volumes': 'объемы',
      'liquidity': 'ликвидность',
      'volatile': 'волатильный',
      'volatility': 'волатильность'
    };

    let translatedText = text;
    // Переводим с учетом регистра
    for (const [eng, rus] of Object.entries(translations)) {
      // Перевод слова с большой буквы
      translatedText = translatedText.replace(
        new RegExp(`\\b${eng.charAt(0).toUpperCase() + eng.slice(1)}\\b`, 'g'),
        rus.charAt(0).toUpperCase() + rus.slice(1)
      );
      // Перевод слова в нижнем регистре
      translatedText = translatedText.replace(
        new RegExp(`\\b${eng.toLowerCase()}\\b`, 'g'),
        rus.toLowerCase()
      );
    }

    return translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
}

async function fetchCryptoNews(): Promise<NewsItem[]> {
  try {
    const response = await axios.get(`https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${CRYPTO_COMPARE_KEY}`);

    const newsItems = await Promise.all(
      response.data.Data.slice(0, 10).map(async (item: any, index: number) => {
        // Переводим заголовок и содержание на русский
        const translatedTitle = await translateToRussian(item.title);
        const translatedContent = await translateToRussian(item.body.substring(0, 300) + '...');

        return {
          id: index + 1,
          title: translatedTitle,
          content: translatedContent,
          date: new Date(item.published_on * 1000).toLocaleDateString('ru-RU'),
          category: 'crypto',
          source: await translateToRussian(item.source)
        };
      })
    );

    return newsItems;
  } catch (error) {
    console.error('Error fetching crypto news:', error);
    return [];
  }
}

async function fetchFinanceNews(): Promise<NewsItem[]> {
  try {
    const response = await axios.get(
      `https://newsapi.org/v2/everything?` + 
      `q=finance OR banking OR economy OR cryptocurrency&` +
      `language=ru&` +
      `excludeDomains=rt.com,sputniknews.com,ria.ru,tass.ru&` +
      `sortBy=publishedAt&` +
      `pageSize=10&` +
      `apiKey=${NEWS_API_KEY}`
    );

    if (!response.data.articles || !Array.isArray(response.data.articles)) {
      console.error('Invalid response from NewsAPI:', response.data);
      return [];
    }

    // Фильтруем новости, исключая нежелательные источники
    const filteredArticles = response.data.articles.filter((article: any) => {
      const source = article.source.name.toLowerCase();
      return !source.includes('rt') && 
             !source.includes('sputnik') && 
             !source.includes('ria') && 
             !source.includes('tass');
    });

    return filteredArticles.slice(0, 10).map((item: any, index: number) => ({
      id: index + 11, // Начинаем с 11, так как первые 10 ID заняты крипто-новостями
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