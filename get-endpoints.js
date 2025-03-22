/**
 * Скрипт для получения списка эндпоинтов в Neon
 */

import { default as fetch } from 'node-fetch';

// API ключ Neon из переменной окружения
const NEON_API_KEY = process.env.NEON_API_KEY;
if (!NEON_API_KEY) {
  console.error('Необходимо указать NEON_API_KEY в переменных окружения');
  process.exit(1);
}

async function getProjects() {
  try {
    console.log('Получение списка проектов...');
    
    const response = await fetch('https://console.neon.tech/api/v2/projects', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${NEON_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка получения списка проектов: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.projects;
  } catch (error) {
    console.error('Ошибка при получении проектов:', error);
    return [];
  }
}

async function getEndpoints(projectId) {
  try {
    console.log(`Получение списка эндпоинтов для проекта ${projectId}...`);
    
    const response = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}/endpoints`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${NEON_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка получения списка эндпоинтов: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.endpoints;
  } catch (error) {
    console.error('Ошибка при получении эндпоинтов:', error);
    return [];
  }
}

async function main() {
  try {
    // Получаем список проектов
    const projects = await getProjects();
    
    if (projects.length === 0) {
      console.log('Проекты не найдены');
      return;
    }
    
    console.log('Найдены проекты:');
    for (const project of projects) {
      console.log(`- ${project.name} (ID: ${project.id})`);
      
      // Получаем список эндпоинтов для проекта
      const endpoints = await getEndpoints(project.id);
      
      if (endpoints.length === 0) {
        console.log('  Эндпоинты не найдены');
        continue;
      }
      
      console.log('  Эндпоинты:');
      for (const endpoint of endpoints) {
        console.log(`  - ID: ${endpoint.id}`);
        console.log(`    Хост: ${endpoint.host}`);
        console.log(`    Статус: ${endpoint.suspended ? 'Спящий' : 'Активный'}`);
        console.log(`    Тип: ${endpoint.type}`);
        console.log(`    Регион: ${endpoint.region_id}`);
      }
    }
  } catch (error) {
    console.error('Ошибка в основной функции:', error);
  }
}

// Запускаем скрипт
main();