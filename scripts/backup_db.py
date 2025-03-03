import os
import json
import psycopg2
from datetime import datetime
import shutil

# Get database URL from environment
db_url = os.getenv('DATABASE_URL')

def create_backup_dirs():
    dirs = ['backup', 'backup/zip', 'backup/sql']
    for d in dirs:
        os.makedirs(d, exist_ok=True)

def backup_database():
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    # Connect to database
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    # Get data from tables
    tables = {
        'users': 'SELECT * FROM users',
        'cards': 'SELECT * FROM cards',
        'transactions': 'SELECT * FROM transactions',
        'exchange_rates': 'SELECT * FROM exchange_rates'
    }

    backup_data = {}
    for table, query in tables.items():
        try:
            cur.execute(query)

            # Handle case where cursor description is None
            if cur.description is None:
                print(f"Warning: No columns found for table {table}")
                continue

            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
            backup_data[table] = [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            print(f"Error backing up table {table}: {str(e)}")
            continue

    # Create backup files
    backup_base = f'backup_{timestamp}'

    # Save JSON
    json_file = f'backup/{backup_base}.json'
    with open(json_file, 'w') as f:
        json.dump(backup_data, f, indent=2, default=str)

    # Create ZIP
    zip_file = f'backup/zip/{backup_base}.zip'
    shutil.make_archive(zip_file[:-4], 'zip', 'backup', f'{backup_base}.json')

    # Create SQL dump
    sql_file = f'backup/sql/{backup_base}.sql'
    with open(sql_file, 'w') as f:
        for table, data in backup_data.items():
            if not data:
                continue

            columns = data[0].keys()
            f.write(f"\n-- Table: {table}\n")
            f.write(f"INSERT INTO {table} ({', '.join(columns)}) VALUES\n")

            values = []
            for row in data:
                row_values = []
                for col in columns:
                    val = row[col]
                    if val is None:
                        row_values.append('NULL')
                    elif isinstance(val, (int, float)):
                        row_values.append(str(val))
                    else:
                        # Escape single quotes properly
                        val_str = str(val).replace("'", "''")
                        row_values.append(f"'{val_str}'")
                values.append(f"({', '.join(row_values)})")

            f.write(',\n'.join(values) + ';\n')

    cur.close()
    conn.close()

    return {
        'json': json_file,
        'zip': zip_file,
        'sql': sql_file
    }

if __name__ == '__main__':
    create_backup_dirs()
    files = backup_database()
    print("Backup completed successfully!")
    print("Files created:")
    for type_, path in files.items():
        print(f"- {type_}: {path}")