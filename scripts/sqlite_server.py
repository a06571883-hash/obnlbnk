import subprocess
import os

if __name__ == '__main__':
    # Получаем путь к базе данных
    db_path = os.path.abspath('sqlite.db')

    # Запускаем сервер sqlite_web с указанием хоста и порта
    print(f"Starting SQLite Web server for database: {db_path}")
    print("Access the database at http://0.0.0.0:8080")

    subprocess.run([
        "sqlite_web",
        "--host", "0.0.0.0",
        "--port", "8080",
        "--no-browser",
        "--read-only",  # Для безопасности добавляем режим только для чтения
        db_path
    ])