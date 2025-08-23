import axios from 'axios';
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const CRYPTO_COMPARE_KEY = process.env.CRYPTO_COMPARE_KEY;
async function fetchCryptoNews() {
    try {
        const response = await axios.get(`https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${CRYPTO_COMPARE_KEY}`);
        const newsItems = response.data.Data.slice(0, 10).map((item, index) => ({
            id: index + 1,
            title: item.title,
            content: item.body.substring(0, 300) + '...',
            date: new Date(item.published_on * 1000).toLocaleDateString('en-US'),
            category: 'crypto',
            source: item.source
        }));
        return newsItems;
    }
    catch (error) {
        console.error('Error fetching crypto news:', error);
        return [];
    }
}
async function fetchFinanceNews() {
    try {
        const response = await axios.get(`https://newsapi.org/v2/everything?` +
            `q=finance OR banking OR economy OR cryptocurrency&` +
            `language=en&` +
            `excludeDomains=rt.com,sputniknews.com,ria.ru,tass.ru&` +
            `sortBy=publishedAt&` +
            `pageSize=10&` +
            `apiKey=${NEWS_API_KEY}`);
        if (!response.data.articles || !Array.isArray(response.data.articles)) {
            console.error('Invalid response from NewsAPI:', response.data);
            return [];
        }
        // Filter out unwanted sources
        const filteredArticles = response.data.articles.filter((article) => {
            const source = article.source.name.toLowerCase();
            return !source.includes('rt') &&
                !source.includes('sputnik') &&
                !source.includes('ria') &&
                !source.includes('tass');
        });
        return filteredArticles.slice(0, 10).map((item, index) => ({
            id: index + 11,
            title: item.title,
            content: item.description || item.content || 'Details not available',
            date: new Date(item.publishedAt).toLocaleDateString('en-US'),
            category: 'fiat',
            source: item.source.name
        }));
    }
    catch (error) {
        console.error('Error fetching finance news:', error);
        if (axios.isAxiosError(error) && error.response) {
            console.error('NewsAPI error details:', error.response.data);
        }
        return [];
    }
}
export async function getNews() {
    try {
        console.log('Загрузка новостей...');
        const [cryptoNews, financeNews] = await Promise.all([
            fetchCryptoNews(),
            fetchFinanceNews()
        ]);
        console.log(`Получено ${cryptoNews.length} крипто-новостей и ${financeNews.length} финансовых новостей`);
        const allNews = [...cryptoNews, ...financeNews].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return allNews;
    }
    catch (error) {
        console.error('Ошибка агрегации новостей:', error);
        return [];
    }
}
