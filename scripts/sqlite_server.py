import subprocess
import os

if __name__ == '__main__':
    # Получаем путь к базе данных
    db_path = os.path.abspath('working.db')

    # Запускаем сервер sqlite_web с указанием хоста и порта
    print(f"Starting SQLite Web server for database: {db_path}")
    print("Access the database at http://0.0.0.0:8080")

    subprocess.run([
        "sqlite_web",
        "--host", "0.0.0.0",
        "--port", "8080",
        "--no-browser",
        "--read-only",  # Для безопасности добавляем режим только для чтения
        "--theme", "dark",  # Темная тема для лучшей читаемости
        "--rows-per-page", "50",  # Оптимизация для мобильных устройств
        "--url-prefix", "/db",  # Префикс для отделения от основного приложения
        "--css",  # Добавляем дополнительные стили для мобильной версии
        """
        @media (max-width: 768px) {
            .container { padding: 10px; }
            .table-responsive { overflow-x: auto; }
            .navbar-brand { font-size: 1.2rem; }
        }
        """,
        db_path
    ])