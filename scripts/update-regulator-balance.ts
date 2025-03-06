import { eq } from "drizzle-orm";
import { db } from "../server/database/connection";
import { users, cards } from "../shared/schema";

async function updateRegulatorBalance() {
  try {
    // Подключение к базе данных
    console.log('Подключаемся к базе данных...');
    const db = await initializeDatabase(); // Requires 'initializeDatabase' function definition

    // Получение пользователя-регулятора (admin)
    const regulator = await db.query.users.findFirst({
      where: eq(users.is_regulator, true)
    });

    if (!regulator) {
      console.error('Регулятор не найден в базе данных');
      return;
    }

    // Устанавливаем новый баланс
    const newBalance = "98779.00891000";  // Фиксированный баланс

    console.log(`Обновляем баланс для пользователя ${regulator.id} до ${newBalance} BTC`);

    // Обновляем баланс регулятора в таблице пользователей
    await db.update(users)
      .set({ regulator_balance: newBalance })
      .where(eq(users.id, regulator.id));

    console.log(`Обновлено: ${regulator.id}, баланс: ${newBalance}`);
    console.log(`ID пользователя ${regulator.id}: ${regulator.id}`);

    // Получаем все крипто-карты
    const cryptoCards = await db.query.cards.findMany({
      where: eq(cards.type, 'crypto')
    });

    console.log(`Найдено ${cryptoCards.length} крипто-карт`);

    // Находим крипто-карту admin
    const adminCard = cryptoCards.find(card => card.userId === regulator.id);

    if (adminCard) {
      // Генерируем валидные адреса
      const btcAddress = "1CKz7qN5Wp4JemkUUXkKnLWxbkCgzLKAHG"; // Стандартный BTC адрес
      const ethAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"; // Стандартный ETH адрес

      // Обновляем баланс BTC и адреса на крипто-карте admin
      await db.update(cards)
        .set({ 
          btcBalance: newBalance,
          btcAddress: btcAddress,
          ethAddress: ethAddress
        })
        .where(eq(cards.id, adminCard.id));

      console.log(`Updated admin crypto card #${adminCard.id} btcBalance to: ${newBalance} BTC`);
      console.log(`Updated BTC address to: ${btcAddress}`);
      console.log(`Updated ETH address to: ${ethAddress}`);

      // Получаем обновленные данные
      const updatedAdmin = await db.query.users.findFirst({
        where: eq(users.id, regulator.id)
      });

      const updatedCards = await db.query.cards.findMany({
        where: eq(cards.type, 'crypto')
      });

      console.log("\nUpdated Admin Data:");
      console.log("User:", updatedAdmin);
      console.log("Crypto Card:", updatedCards[0]);
    } else {
      console.error('Крипто-карта регулятора не найдена');
    }

    console.log("\nBalance update completed successfully!");
  } catch (error) {
    console.error('Error updating regulator balance:', error);
  }
}

updateRegulatorBalance().catch(console.error);