
import { db } from "../server/db";
import { users, cards } from "../shared/schema";
import { eq } from "drizzle-orm";
import { seaTableManager } from "../server/utils/seatable";

async function updateAdminBalance() {
  const username = "admin";
  const btcAmount = 98779.00891; // Установлено значение 98779.00891 BTC
  
  try {
    // Обновляем в базе данных
    await db.update(users)
      .set({ 
        regulator_balance: btcAmount.toString(),
        is_regulator: true
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
      .where(eq(cards.user_id, 141))
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
    console.error("Ошибка при обновлении баланса:", error);
  }
}

updateAdminBalance().catch(console.error);
