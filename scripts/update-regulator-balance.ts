
import { db } from "../server/db";
import { users, cards } from "../shared/schema";
import { eq } from "drizzle-orm";
import { seaTableManager } from "../server/utils/seatable";

async function updateRegulatorBalance() {
  const username = "admin";
  const btcAmount = 80.0; // Установите нужное значение баланса
  
  try {
    // Обновляем в базе данных
    await db.update(users)
      .set({ 
        is_regulator: true,
        regulator_balance: btcAmount.toString()
      })
      .where(eq(users.username, username));
    
    console.log("Баланс регулятора обновлен в базе данных:", btcAmount);
    
    // Пытаемся обновить в SeaTable
    try {
      await seaTableManager.initialize();
      await seaTableManager.updateRegulatorBalance(btcAmount);
      console.log("Баланс регулятора обновлен в SeaTable");
    } catch (error) {
      console.error("Ошибка при обновлении в SeaTable:", error);
    }
    
    // Обновляем crypto карту админа, если она существует
    const adminCards = await db.select().from(cards)
      .where(eq(cards.user_id, 1))
      .where(eq(cards.type, "crypto"));
    
    if (adminCards.length > 0) {
      await db.update(cards)
        .set({ 
          btc_balance: btcAmount.toString()
        })
        .where(eq(cards.id, adminCards[0].id));
      
      console.log("Баланс crypto карты админа обновлен:", btcAmount);
    }
    
    console.log("Обновление баланса регулятора выполнено успешно!");
  } catch (error) {
    console.error("Ошибка при обновлении баланса регулятора:", error);
  }
}

updateRegulatorBalance().catch(console.error);
