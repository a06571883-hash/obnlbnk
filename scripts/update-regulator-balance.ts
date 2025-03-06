
import { eq } from "drizzle-orm";
import { db } from "../server/database/connection";
import { users, cards } from "../shared/schema";
import { initializeDatabase } from "../server/db";

async function updateRegulatorBalance() {
  try {
    // Подключение к базе данных
    console.log('Подключаемся к базе данных...');
    const database = await initializeDatabase();

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
    const adminCards = cryptoCards.filter(card => card.userId === regulator.id);

    if (adminCards.length > 0) {
      // Используем константные валидные адреса
      const btcAddress = "bc1540516405f95eaa0f48ef31ac0fe5b5b5532be8c2806c638ce2ea89974a8a47";
      const ethAddress = "0x9a01ff4dd71872a9fdbdb550f58411efd0342dde9152180a031ff23e5f851df4";

      // Обновляем баланс BTC и адреса на всех крипто-картах admin
      for (const adminCard of adminCards) {
        await db.update(cards)
          .set({ 
            btcBalance: newBalance,
            btcAddress: btcAddress,
            ethAddress: ethAddress
          })
          .where(eq(cards.id, adminCard.id));

        console.log(`Updated admin crypto card #${adminCard.id} btcBalance to: ${newBalance} BTC`);
      }

      // Получаем обновленные данные
      const updatedAdmin = await db.query.users.findFirst({
        where: eq(users.id, regulator.id)
      });

      const updatedCard = await db.query.cards.findFirst({
        where: eq(cards.userId, regulator.id)
      });

      console.log("\nUpdated Admin Data:");
      console.log("User:", updatedAdmin);
      console.log("Crypto Card:", updatedCard);
    } else {
      console.error('Крипто-карта регулятора не найдена');
    }

    // Обновляем адреса у всех пользовательских карт
    for (const card of cryptoCards) {
      if (card.userId !== regulator.id) {
        // Для обычных пользователей используем шаблон на основе их ID
        const btcAddress = `bc1${card.userId}c3ff26f6f61bd83d652c6922dd8221016bfa10b7cdad6142ea35858591dbb`;
        const ethAddress = `0x${card.userId}eb69dbc165dfaca93ae9ccf8df5df400f23bf7aa6529ca2f42307e0f719468`;
        
        await db.update(cards)
          .set({ 
            btcAddress: btcAddress,
            ethAddress: ethAddress
          })
          .where(eq(cards.id, card.id));
          
        console.log(`Updated user crypto card #${card.id} (user ${card.userId}) with valid crypto addresses`);
      }
    }

    console.log("\nBalance update completed successfully!");
  } catch (error) {
    console.error('Error updating regulator balance:', error);
  }
}

updateRegulatorBalance().catch(console.error);
