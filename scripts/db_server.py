from flask import Flask, send_file
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

@app.route('/sqlite.db')
def serve_db():
    db_path = os.path.abspath('sqlite.db')
    return send_file(
        db_path,
        mimetype='application/x-sqlite3',
        as_attachment=True,
        download_name='sqlite.db'
    )

if __name__ == '__main__':
    print("Starting DB server on http://0.0.0.0:5000/sqlite.db")
    app.run(host='0.0.0.0', port=5000)
