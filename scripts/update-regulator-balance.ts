import { eq } from "drizzle-orm";
import { db } from "../server/database/connection";
import { users, cards } from "../shared/schema";

async function updateAdminBalance() {
  try {
    console.log("Testing database connection...");
    await db.select().from(users).limit(1);
    console.log("Successfully connected to database");

    const btcAmount = 98779.00891; // Требуемое значение BTC
    const userId = 141; // ID админа

    // Обновляем запись пользователя
    console.log(`Обновляем баланс для пользователя ${userId} до ${btcAmount} BTC`);
    await db.update(users)
      .set({ 
        regulator_balance: btcAmount.toString(),
        is_regulator: true
      })
      .where(eq(users.id, userId));

    // Проверяем что обновление прошло успешно
    const updatedUser = await db.select().from(users).where(eq(users.id, userId));
    console.log(`Обновлено: ${updatedUser[0].id}, баланс: ${updatedUser[0].regulator_balance}`);

    // Получаем ID пользователя из базы (already have userId)

    console.log(`ID пользователя ${userId}: ${userId}`);

    // Обновляем crypto карту админа, если она существует
    const adminCards = await db.select().from(cards)
      .where(eq(cards.userId, userId))
      .where(eq(cards.type, "crypto"));

    console.log(`Найдено ${adminCards.length} крипто-карт`);

    if (adminCards.length > 0) {
      const cardId = adminCards[0].id;

      // Обновляем баланс BTC на карте
      await db.update(cards)
        .set({ btcBalance: btcAmount.toString() })
        .where(eq(cards.id, cardId));

      console.log(`Updated admin crypto card #${cardId} btcBalance to: ${btcAmount} BTC`);
    } else {
      console.log("Admin crypto card not found");
    }

    // Выводим обновленные данные для проверки
    const adminUser = await db.select().from(users)
      .where(eq(users.id, userId));

    const updatedCards = await db.select().from(cards)
      .where(eq(cards.userId, userId))
      .where(eq(cards.type, "crypto"));

    console.log("\nUpdated Admin Data:");
    console.log("User:", adminUser[0]);
    console.log("Crypto Card:", updatedCards[0]);

    console.log("\nBalance update completed successfully!");
  } catch (error) {
    console.error("Error updating balance:", error);
  }
}

updateAdminBalance().catch(console.error);