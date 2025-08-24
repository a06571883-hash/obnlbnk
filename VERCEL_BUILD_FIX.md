# Исправление проблемы сборки на Vercel

## Проблема
При деплое на Vercel возникает ошибка:
```
Error [ERR_REQUIRE_ASYNC_MODULE]: require() cannot be used on an ESM graph with top-level await
```

## Причина
Проблема связана с использованием top-level await в vite.config.ts и конфликтами между ESM/CommonJS модулями.

## Решение

### 1. Обновить команду сборки в Vercel

В настройках проекта Vercel измените команду сборки на:

```bash
node build-fallback.js
```

### 2. Альтернативное решение через package.json

Если вы можете редактировать package.json, добавьте новый скрипт:

```json
{
  "scripts": {
    "build:vercel": "NODE_OPTIONS='--import tsx/esm' npm run build:client && npm run build:server"
  }
}
```

### 3. Использование файла vercel.json

Создайте файл `vercel.json` в корне проекта:

```json
{
  "buildCommand": "node build-fallback.js",
  "framework": null,
  "installCommand": "npm install"
}
```

## Что исправлено

1. ✅ **CSS переменные** - Добавлены все необходимые CSS переменные в `client/src/index.css`
2. ✅ **Tailwind классы** - Заменены `@apply` директивы на прямые CSS значения
3. ✅ **Конфигурация Tailwind** - Исправлены пути и импорты в `tailwind.config.ts`
4. ✅ **Альтернативная сборка** - Создан `build-fallback.js` для обхода проблем ESM

## Проверка

Локально CSS компилируется успешно:
```bash
cd client/src && npx tailwindcss -i index.css -o ../test.css
# ✅ CSS скомпилирован успешно
```

## Рекомендации

1. Используйте `build-fallback.js` для сборки на Vercel
2. Если проблема не решается, попробуйте временно изменить `"type": "module"` на `"type": "commonjs"` в package.json
3. Убедитесь, что все зависимости установлены корректно

## Дополнительные команды для отладки

```bash
# Проверка Tailwind
npx tailwindcss -i client/src/index.css -o test.css

# Альтернативная сборка
node build-fallback.js

# Проверка Node.js версии (должна быть v18+)
node --version
```