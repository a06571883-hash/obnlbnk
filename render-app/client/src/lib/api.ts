export const apiRequest = async (url: string, options: RequestInit = {}) => {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/auth';
        throw new Error('Необходима авторизация');
      }
      const errorData = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error instanceof Error ? error : new Error('Произошла ошибка при запросе к серверу');
  }
};

export const retryApiRequest = async (
  url: string, 
  options: RequestInit = {}, 
  maxRetries = 3
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiRequest(url, options);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
};
