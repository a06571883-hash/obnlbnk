export const apiRequest = async (method: string, url: string, body?: any) => {
  try {
    const options: RequestInit = {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/auth';
        throw new Error('Необходима авторизация');
      }
      const errorData = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    throw error instanceof Error ? error : new Error('Произошла ошибка при запросе к серверу');
  }
};

// Добавляем функцию повторных попыток с экспоненциальной задержкой
export const retryApiRequest = async (
  url: string, 
  options: RequestInit = {}, 
  maxRetries = 3
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiRequest(options.method || 'GET', url, options.body);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
};