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
      const errorData = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json(); //Corrected to return the parsed JSON
  } catch (error) {
    console.error('Fetch error:', error);
    throw error instanceof Error ? error : new Error('Произошла ошибка при запросе к серверу');
  }
};

// Добавляем функцию повторных попыток
export const retryApiRequest = async (
  url: string, 
  options: RequestInit = {}, 
  maxRetries = 3
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiRequest(options.method || 'GET', url, options.body); //Corrected to handle method and body from options
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
};