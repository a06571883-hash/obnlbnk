const login = async (username: string, password: string) => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Ошибка входа' }));
        throw new Error(errorData.error || 'Ошибка при входе в систему');
      }

      return await response.json();
    } catch (error) {
      console.error('Login error:', error);
      throw error instanceof Error ? error : new Error('Произошла ошибка при входе');
    }
  };