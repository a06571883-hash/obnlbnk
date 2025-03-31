const fs = require('fs');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Получаем все пути к изображениям Mutant Ape из базы данных
    const result = await pool.query(
      "SELECT id, name, image_path FROM nfts WHERE collection_id = 2 AND for_sale = true"
    );

    const records = result.rows;
    console.log(`Всего записей Mutant Ape в базе данных: ${records.length}`);

    // Проверяем наличие файлов для каждого пути
    let missingFiles = 0;
    let existingFiles = 0;

    for (const record of records) {
      const filePath = '.' + record.image_path;
      if (!fs.existsSync(filePath)) {
        missingFiles++;
        if (missingFiles <= 5) {
          console.log(`Отсутствует файл для NFT ID ${record.id}: ${record.image_path}`);
        }
      } else {
        existingFiles++;
      }
    }

    console.log(`Файлы существуют: ${existingFiles}`);
    console.log(`Файлы отсутствуют: ${missingFiles}`);
  } catch (error) {
    console.error('Ошибка при проверке файлов:', error);
  } finally {
    pool.end();
  }
}

main();