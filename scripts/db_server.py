from flask import Flask, send_file, jsonify, render_template_string, request
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Status</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f0f0f0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { 
            color: #333;
            font-size: 24px;
            margin-top: 0;
        }
        .status {
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
        }
        .success {
            background: #e7f6e7;
            color: #0a5d0a;
        }
        .error {
            background: #ffe7e7;
            color: #c62828;
        }
        .info {
            background: #e3f2fd;
            color: #0d47a1;
            margin-top: 20px;
        }
        code {
            background: #f5f5f5;
            padding: 2px 5px;
            border-radius: 3px;
            font-family: monospace;
            word-break: break-all;
        }
        .steps {
            margin-top: 15px;
        }
        .step {
            margin-bottom: 10px;
            padding: 10px;
            background: #fafafa;
            border-radius: 5px;
        }
        @media (max-width: 480px) {
            body {
                padding: 10px;
            }
            .container {
                padding: 15px;
            }
            h1 {
                font-size: 20px;
            }
            code {
                font-size: 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Database Server Status</h1>
        {% if db_exists %}
        <div class="status success">
            ✅ База данных доступна<br>
            Размер: {{ size_mb }} MB
        </div>
        <div class="info">
            <p><strong>Инструкции по подключению:</strong></p>
            <div class="steps">
                <div class="step">1️⃣ Откройте DB Browser for SQLite</div>
                <div class="step">2️⃣ Выберите "Remote" -> "Connect to Database"</div>
                <div class="step">3️⃣ Укажите URL: <code>{{ url }}</code></div>
                <div class="step">⚠️ Важно: URL должен совпадать с доменом вашего приложения</div>
            </div>
        </div>
        {% else %}
        <div class="status error">
            ❌ База данных не найдена
        </div>
        {% endif %}
    </div>
</body>
</html>
"""

@app.route('/')
def index():
    db_path = os.path.abspath('sqlite.db')
    exists = os.path.exists(db_path)
    size_mb = round(os.path.getsize(db_path) / (1024 * 1024), 2) if exists else 0
    url = f"{request.host_url}sqlite.db"
    return render_template_string(HTML_TEMPLATE, db_exists=exists, size_mb=size_mb, url=url)

@app.route('/db-status')
def status():
    db_path = os.path.abspath('sqlite.db')
    if os.path.exists(db_path):
        return jsonify({
            'status': 'ok',
            'message': 'Database file exists',
            'size': os.path.getsize(db_path)
        })
    return jsonify({
        'status': 'error',
        'message': 'Database file not found'
    }), 404

@app.route('/sqlite.db')
def serve_db():
    db_path = os.path.abspath('sqlite.db')
    if not os.path.exists(db_path):
        return 'Database file not found', 404

    return send_file(
        db_path,
        mimetype='application/x-sqlite3',
        as_attachment=True,
        download_name='sqlite.db'
    )

if __name__ == '__main__':
    print("Starting DB server on http://0.0.0.0:5002/sqlite.db")
    print("You can check database status at http://0.0.0.0:5002/db-status")
    app.run(host='0.0.0.0', port=5002)