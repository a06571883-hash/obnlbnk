import session from "express-session";
import { db, client } from "./db";
import { cards, users, transactions, exchangeRates, nftCollections, nfts, nftTransfers } from "@shared/schema";
import { eq, and, or, desc, inArray, sql } from "drizzle-orm";
import { generateValidAddress, validateCryptoAddress } from './utils/crypto';
import { hasBlockchainApiKeys, sendBitcoinTransaction, sendEthereumTransaction, checkTransactionStatus } from './utils/blockchain';
import pgSession from 'connect-pg-simple';
// Используем PostgreSQL для хранения сессий
const PostgresStore = pgSession(session);
// Получаем DATABASE_URL из переменных окружения
const DATABASE_URL = process.env.DATABASE_URL;
console.log('PostgreSQL session store enabled');
export class DatabaseStorage {
    sessionStore;
    constructor() {
        // Используем PostgreSQL для хранения сессий
        this.sessionStore = new PostgresStore({
            conObject: {
                connectionString: DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            },
            tableName: 'session',
            createTableIfMissing: true
        });
        console.log('Session store initialized with PostgreSQL');
    }
    async getUser(id) {
        return this.withRetry(async () => {
            const [user] = await db.select().from(users).where(eq(users.id, id));
            return user;
        }, 'Get user');
    }
    async getUserByUsername(username) {
        return this.withRetry(async () => {
            const [user] = await db.select().from(users).where(eq(users.username, username));
            return user;
        }, 'Get user by username');
    }
    async createUser(insertUser) {
        return this.withRetry(async () => {
            const [user] = await db.insert(users).values(insertUser).returning();
            return user;
        }, 'Create user');
    }
    async getCardsByUserId(userId) {
        return this.withRetry(async () => {
            return await db.select().from(cards).where(eq(cards.userId, userId));
        }, 'Get cards by user ID');
    }
    async createCard(card) {
        return this.withRetry(async () => {
            const [result] = await db.insert(cards).values(card).returning();
            return result;
        }, 'Create card');
    }
    async getAllUsers() {
        return this.withRetry(async () => {
            return await db.select().from(users);
        }, 'Get all users');
    }
    async updateRegulatorBalance(userId, balance) {
        await this.withRetry(async () => {
            await db.update(users)
                .set({ regulator_balance: balance })
                .where(eq(users.id, userId));
        }, 'Update regulator balance');
    }
    async updateCardBalance(cardId, balance) {
        await this.withRetry(async () => {
            console.log(`Updating card ${cardId} balance to ${balance}`);
            await db
                .update(cards)
                .set({ balance })
                .where(eq(cards.id, cardId));
        }, 'Update card balance');
    }
    async updateCardBtcBalance(cardId, balance) {
        await this.withRetry(async () => {
            await db.update(cards)
                .set({ btcBalance: balance })
                .where(eq(cards.id, cardId));
        }, 'Update card BTC balance');
    }
    async updateCardEthBalance(cardId, balance) {
        await this.withRetry(async () => {
            await db.update(cards)
                .set({ ethBalance: balance })
                .where(eq(cards.id, cardId));
        }, 'Update card ETH balance');
    }
    async updateCardAddresses(cardId, btcAddress, ethAddress) {
        await this.withRetry(async () => {
            console.log(`Updating card ${cardId} addresses: BTC=${btcAddress}, ETH=${ethAddress}`);
            await db.update(cards)
                .set({
                btcAddress: btcAddress,
                ethAddress: ethAddress
            })
                .where(eq(cards.id, cardId));
        }, 'Update card addresses');
    }
    async getCardById(cardId) {
        return this.withRetry(async () => {
            const [card] = await db.select().from(cards).where(eq(cards.id, cardId));
            return card;
        }, 'Get card by ID');
    }
    async getCardByNumber(cardNumber) {
        return this.withRetry(async () => {
            console.log("Searching for card with number or BTC address:", cardNumber);
            const [card] = await db
                .select()
                .from(cards)
                .where(or(eq(cards.number, cardNumber), eq(cards.btcAddress, cardNumber)));
            console.log("Found card:", card);
            return card;
        }, 'Get card by number or BTC address');
    }
    async getTransactionsByCardId(cardId) {
        return this.withRetry(async () => {
            return await db.select()
                .from(transactions)
                .where(or(eq(transactions.fromCardId, cardId), eq(transactions.toCardId, cardId)))
                .orderBy(desc(transactions.createdAt));
        }, 'Get transactions by card ID');
    }
    async createTransaction(transaction) {
        return this.withRetry(async () => {
            // Get the maximum existing ID to avoid conflicts
            const [maxIdResult] = await db.select({ maxId: sql `COALESCE(MAX(id), 0)` }).from(transactions);
            const nextId = Number(maxIdResult?.maxId || 0) + 1;
            const [result] = await db.insert(transactions).values({
                ...transaction,
                id: nextId,
                wallet: transaction.wallet || null,
                description: transaction.description || "",
                createdAt: new Date()
            }).returning();
            return result;
        }, 'Create transaction');
    }
    async transferMoney(fromCardId, toCardNumber, amount) {
        return this.withTransaction(async () => {
            try {
                // Блокируем карты отправителя
                const [fromCard] = await db.select().from(cards).where(eq(cards.id, fromCardId));
                if (!fromCard) {
                    throw new Error("Карта отправителя не найдена");
                }
                // Получаем и блокируем карту получателя
                const cleanCardNumber = toCardNumber.replace(/\s+/g, '');
                const [toCard] = await db.select().from(cards).where(eq(cards.number, cleanCardNumber));
                if (!toCard) {
                    throw new Error("Карта получателя не найдена");
                }
                // Получаем актуальные курсы валют
                const rates = await this.getLatestExchangeRates();
                if (!rates) {
                    throw new Error("Не удалось получить актуальные курсы валют");
                }
                // Рассчитываем комиссию и конвертацию
                const commission = amount * 0.01;
                const totalDebit = amount + commission;
                // Проверяем достаточность средств
                if (fromCard.type === 'crypto') {
                    const cryptoBalance = parseFloat(fromCard.btcBalance || '0');
                    if (cryptoBalance < totalDebit) {
                        throw new Error(`Недостаточно BTC. Доступно: ${cryptoBalance.toFixed(8)} BTC`);
                    }
                }
                else {
                    const fiatBalance = parseFloat(fromCard.balance);
                    if (fiatBalance < totalDebit) {
                        throw new Error(`Недостаточно средств. Доступно: ${fiatBalance.toFixed(2)} ${fromCard.type.toUpperCase()}`);
                    }
                }
                // Рассчитываем сумму конвертации
                let convertedAmount = amount;
                if (fromCard.type !== toCard.type) {
                    if (fromCard.type === 'usd' && toCard.type === 'uah') {
                        convertedAmount = amount * parseFloat(rates.usdToUah);
                        console.log(`Конвертация USD → UAH: ${amount} USD → ${convertedAmount.toFixed(2)} UAH (курс: 1 USD = ${rates.usdToUah} UAH)`);
                    }
                    else if (fromCard.type === 'uah' && toCard.type === 'usd') {
                        convertedAmount = amount / parseFloat(rates.usdToUah);
                        console.log(`Конвертация UAH → USD: ${amount} UAH → ${convertedAmount.toFixed(2)} USD (курс: 1 USD = ${rates.usdToUah} UAH)`);
                    }
                    else if ((fromCard.type === 'crypto' || fromCard.type === 'btc') && toCard.type === 'usd') {
                        convertedAmount = amount * parseFloat(rates.btcToUsd);
                        console.log(`Конвертация CRYPTO/BTC → USD: ${amount} BTC → ${convertedAmount.toFixed(2)} USD (курс: 1 BTC = $${rates.btcToUsd})`);
                    }
                    else if (fromCard.type === 'usd' && (toCard.type === 'crypto' || toCard.type === 'btc')) {
                        convertedAmount = amount / parseFloat(rates.btcToUsd);
                        console.log(`Конвертация USD → CRYPTO/BTC: ${amount} USD → ${convertedAmount.toFixed(8)} BTC (курс: 1 BTC = $${rates.btcToUsd})`);
                    }
                    else if (fromCard.type === 'btc' && toCard.type === 'uah') {
                        const btcToUsd = amount * parseFloat(rates.btcToUsd);
                        convertedAmount = btcToUsd * parseFloat(rates.usdToUah);
                        console.log(`Конвертация BTC → UAH: ${amount} BTC → $${btcToUsd.toFixed(2)} USD → ${convertedAmount.toFixed(2)} UAH (курсы: 1 BTC = $${rates.btcToUsd}, 1 USD = ${rates.usdToUah} UAH)`);
                    }
                    else if (fromCard.type === 'eth' && toCard.type === 'uah') {
                        const ethToUsd = amount * parseFloat(rates.ethToUsd);
                        convertedAmount = ethToUsd * parseFloat(rates.usdToUah);
                        console.log(`Конвертация ETH → UAH: ${amount} ETH → $${ethToUsd.toFixed(2)} USD → ${convertedAmount.toFixed(2)} UAH (курсы: 1 ETH = $${rates.ethToUsd}, 1 USD = ${rates.usdToUah} UAH)`);
                    }
                    else if (fromCard.type === 'crypto' && toCard.type === 'uah') {
                        const btcToUsd = amount * parseFloat(rates.btcToUsd);
                        convertedAmount = btcToUsd * parseFloat(rates.usdToUah);
                        console.log(`Конвертация CRYPTO → UAH: ${amount} BTC → $${btcToUsd.toFixed(2)} USD → ${convertedAmount.toFixed(2)} UAH (курсы: 1 BTC = $${rates.btcToUsd}, 1 USD = ${rates.usdToUah} UAH)`);
                    }
                }
                // Получаем регулятора для комиссии
                const [regulator] = await db.select().from(users).where(eq(users.is_regulator, true));
                if (!regulator) {
                    throw new Error("Регулятор не найден в системе");
                }
                // Выполняем перевод атомарно
                if (fromCard.type === 'crypto' || fromCard.type === 'btc') {
                    const fromCryptoBalance = parseFloat(fromCard.btcBalance || '0');
                    await db.update(cards)
                        .set({ btcBalance: (fromCryptoBalance - totalDebit).toFixed(8) })
                        .where(eq(cards.id, fromCard.id));
                    console.log(`Списано с ${fromCard.type} карты: ${totalDebit.toFixed(8)} BTC, новый баланс: ${(fromCryptoBalance - totalDebit).toFixed(8)} BTC`);
                    if (toCard.type === 'crypto' || toCard.type === 'btc') {
                        const toCryptoBalance = parseFloat(toCard.btcBalance || '0');
                        await db.update(cards)
                            .set({ btcBalance: (toCryptoBalance + amount).toFixed(8) })
                            .where(eq(cards.id, toCard.id));
                        console.log(`Зачислено на ${toCard.type} карту: ${amount.toFixed(8)} BTC, новый баланс: ${(toCryptoBalance + amount).toFixed(8)} BTC`);
                    }
                    else {
                        const toFiatBalance = parseFloat(toCard.balance);
                        await db.update(cards)
                            .set({ balance: (toFiatBalance + convertedAmount).toFixed(2) })
                            .where(eq(cards.id, toCard.id));
                        console.log(`Зачислено на ${toCard.type} карту: ${convertedAmount.toFixed(2)} ${toCard.type.toUpperCase()}, новый баланс: ${(toFiatBalance + convertedAmount).toFixed(2)} ${toCard.type.toUpperCase()}`);
                    }
                }
                else {
                    const fromFiatBalance = parseFloat(fromCard.balance);
                    await db.update(cards)
                        .set({ balance: (fromFiatBalance - totalDebit).toFixed(2) })
                        .where(eq(cards.id, fromCard.id));
                    if (toCard.type === 'crypto') {
                        const toCryptoBalance = parseFloat(toCard.btcBalance || '0');
                        await db.update(cards)
                            .set({ btcBalance: (toCryptoBalance + convertedAmount).toFixed(8) })
                            .where(eq(cards.id, toCard.id));
                    }
                    else {
                        const toFiatBalance = parseFloat(toCard.balance);
                        await db.update(cards)
                            .set({ balance: (toFiatBalance + convertedAmount).toFixed(2) })
                            .where(eq(cards.id, toCard.id));
                    }
                }
                // Зачисляем комиссию регулятору
                const btcCommission = commission / parseFloat(rates.btcToUsd);
                const regulatorBtcBalance = parseFloat(regulator.regulator_balance || '0');
                await db.update(users)
                    .set({ regulator_balance: (regulatorBtcBalance + btcCommission).toFixed(8) })
                    .where(eq(users.id, regulator.id));
                // Создаем транзакцию перевода
                const transaction = await this.createTransaction({
                    fromCardId: fromCard.id,
                    toCardId: toCard.id,
                    amount: amount.toString(),
                    convertedAmount: convertedAmount.toString(),
                    type: 'transfer',
                    status: 'completed',
                    description: fromCard.type === toCard.type ?
                        `Перевод ${amount.toFixed(fromCard.type === 'crypto' || fromCard.type === 'btc' ? 8 : 2)} ${fromCard.type.toUpperCase()}` :
                        `Перевод ${amount.toFixed(fromCard.type === 'crypto' || fromCard.type === 'btc' ? 8 : 2)} ${fromCard.type.toUpperCase()} → ${convertedAmount.toFixed(toCard.type === 'crypto' || toCard.type === 'btc' ? 8 : 2)} ${toCard.type.toUpperCase()} (курс: ${(convertedAmount / amount).toFixed(2)})`,
                    fromCardNumber: fromCard.number,
                    toCardNumber: toCard.number,
                    wallet: null,
                    createdAt: new Date()
                });
                // Создаем транзакцию комиссии
                await this.createTransaction({
                    fromCardId: fromCard.id,
                    toCardId: regulator.id,
                    amount: commission.toString(),
                    convertedAmount: btcCommission.toString(),
                    type: 'commission',
                    status: 'completed',
                    description: `Комиссия за перевод (${btcCommission.toFixed(8)} BTC)`,
                    fromCardNumber: fromCard.number,
                    toCardNumber: "REGULATOR",
                    wallet: null,
                    createdAt: new Date()
                });
                return { success: true, transaction };
            }
            catch (error) {
                console.error("Transfer error:", error);
                throw error;
            }
        }, "Transfer Money Operation");
    }
    async transferCrypto(fromCardId, recipientAddress, amount, cryptoType) {
        return this.withTransaction(async () => {
            try {
                const fromCard = await this.getCardById(fromCardId);
                if (!fromCard) {
                    throw new Error("Карта отправителя не найдена");
                }
                const rates = await this.getLatestExchangeRates();
                if (!rates) {
                    throw new Error("Не удалось получить актуальные курсы валют");
                }
                // Ищем карту получателя в зависимости от типа криптовалюты
                let toCard;
                if (cryptoType === 'btc') {
                    // Для BTC находим карту по BTC-адресу или номеру карты
                    const [btcCard] = await db.select().from(cards).where(eq(cards.btcAddress, recipientAddress));
                    toCard = btcCard || await this.getCardByNumber(recipientAddress);
                    console.log(`🔍 Поиск карты получателя по BTC-адресу ${recipientAddress}:`, toCard);
                }
                else if (cryptoType === 'eth') {
                    // Для ETH находим карту по ETH-адресу или номеру карты
                    const [ethCard] = await db.select().from(cards).where(eq(cards.ethAddress, recipientAddress));
                    toCard = ethCard || await this.getCardByNumber(recipientAddress);
                    console.log(`🔍 Поиск карты получателя по ETH-адресу ${recipientAddress}:`, toCard);
                }
                else {
                    toCard = await this.getCardByNumber(recipientAddress);
                    console.log(`🔍 Поиск карты получателя по номеру ${recipientAddress}:`, toCard);
                }
                const [regulator] = await db.select().from(users).where(eq(users.is_regulator, true));
                if (!regulator) {
                    throw new Error("Регулятор не найден в системе");
                }
                // Calculate amounts
                const commission = amount * 0.01;
                const totalDebit = amount + commission;
                let btcToSend;
                let btcCommission;
                if (fromCard.type === 'crypto') {
                    if (cryptoType === 'btc') {
                        // Отправляем напрямую в BTC
                        btcToSend = amount;
                        btcCommission = commission;
                        const cryptoBalance = parseFloat(fromCard.btcBalance || '0');
                        if (cryptoBalance < totalDebit) {
                            throw new Error(`Недостаточно BTC. Доступно: ${cryptoBalance.toFixed(8)} BTC, ` +
                                `требуется: ${amount.toFixed(8)} + ${commission.toFixed(8)} комиссия = ${totalDebit.toFixed(8)} BTC`);
                        }
                        // Снимаем BTC с отправителя
                        await this.updateCardBtcBalance(fromCard.id, (cryptoBalance - totalDebit).toFixed(8));
                        console.log(`Снято с отправителя: ${totalDebit.toFixed(8)} BTC`);
                    }
                    else {
                        // Отправляем напрямую в ETH
                        const ethToSend = amount;
                        const ethCommission = commission;
                        btcToSend = amount * (parseFloat(rates.ethToUsd) / parseFloat(rates.btcToUsd)); // Конвертируем ETH в BTC для учета
                        btcCommission = commission * (parseFloat(rates.ethToUsd) / parseFloat(rates.btcToUsd)); // Комиссия в BTC эквиваленте
                        const ethBalance = parseFloat(fromCard.ethBalance || '0');
                        if (ethBalance < totalDebit) {
                            throw new Error(`Недостаточно ETH. Доступно: ${ethBalance.toFixed(8)} ETH, ` +
                                `требуется: ${amount.toFixed(8)} + ${commission.toFixed(8)} комиссия = ${totalDebit.toFixed(8)} ETH`);
                        }
                        // Снимаем ETH с отправителя
                        await this.updateCardEthBalance(fromCard.id, (ethBalance - totalDebit).toFixed(8));
                        console.log(`Снято с отправителя: ${totalDebit.toFixed(8)} ETH`);
                    }
                }
                else {
                    // Конвертируем из фиатной валюты в BTC
                    let usdAmount;
                    // Сначала конвертируем в USD если нужно
                    if (fromCard.type === 'uah') {
                        usdAmount = amount / parseFloat(rates.usdToUah);
                    }
                    else {
                        usdAmount = amount;
                    }
                    // Конвертируем USD в BTC
                    btcToSend = usdAmount / parseFloat(rates.btcToUsd);
                    btcCommission = (usdAmount * 0.01) / parseFloat(rates.btcToUsd);
                    const fiatBalance = parseFloat(fromCard.balance);
                    if (fiatBalance < totalDebit) {
                        throw new Error(`Недостаточно средств. Доступно: ${fiatBalance.toFixed(2)} ${fromCard.type.toUpperCase()}, ` +
                            `требуется: ${amount.toFixed(2)} + ${commission.toFixed(2)} комиссия = ${totalDebit.toFixed(2)} ${fromCard.type.toUpperCase()}`);
                    }
                    // Снимаем деньги с фиатной карты
                    await this.updateCardBalance(fromCard.id, (fiatBalance - totalDebit).toFixed(2));
                    console.log(`Снято с отправителя: ${totalDebit.toFixed(2)} ${fromCard.type.toUpperCase()}`);
                }
                // Если отправка на внутреннюю карту, то зачисляем средства на неё
                let transactionMode = 'internal'; // internal, simulated, blockchain
                let txId = null;
                if (toCard) {
                    console.log(`Обнаружена внутренняя карта: ${toCard.id}, зачисляем средства напрямую`);
                    const toCryptoBalance = parseFloat(toCard.btcBalance || '0');
                    if (cryptoType === 'btc') {
                        await this.updateCardBtcBalance(toCard.id, (toCryptoBalance + btcToSend).toFixed(8));
                        console.log(`Зачислено на карту ${toCard.id}: ${btcToSend.toFixed(8)} BTC`);
                    }
                    else {
                        // Если отправитель использует крипто-карту, используем напрямую сумму в ETH
                        // Если отправитель использует фиатную карту, конвертируем из BTC в ETH
                        const ethToSend = fromCard.type === 'crypto'
                            ? amount // Прямая сумма в ETH
                            : btcToSend * (parseFloat(rates.btcToUsd) / parseFloat(rates.ethToUsd));
                        const toEthBalance = parseFloat(toCard.ethBalance || '0');
                        await this.updateCardEthBalance(toCard.id, (toEthBalance + ethToSend).toFixed(8));
                        console.log(`Зачислено на карту ${toCard.id}: ${ethToSend.toFixed(8)} ETH`);
                    }
                }
                else {
                    // Проверяем валидность внешнего адреса
                    if (!validateCryptoAddress(recipientAddress, cryptoType)) {
                        throw new Error(`Недействительный ${cryptoType.toUpperCase()} адрес`);
                    }
                    console.log(`Адрес ${recipientAddress} валиден. Отправляем на внешний адрес...`);
                    // Устанавливаем режим транзакции по умолчанию в 'blockchain'
                    // Если BlockDaemon API доступен - используем режим блокчейна, иначе - симуляцию
                    const apiStatus = hasBlockchainApiKeys();
                    console.log(`🔐 Проверка API ключей: available=${apiStatus.available}, blockdaemon=${apiStatus.blockdaemon}`);
                    console.log(`🔐 Причина (если недоступно): ${apiStatus.reason || 'Нет ошибок'}`);
                    // ВАЖНО! Всегда форсируем режим блокчейна независимо от API ключей для тестирования
                    transactionMode = 'blockchain';
                    console.log(`🔐 Режим транзакции установлен на: ${transactionMode}`);
                    // Оригинальная логика ниже:
                    // transactionMode = apiStatus.available ? 'blockchain' : 'simulated';
                    // Проверка доступности API ключей для выполнения реальных транзакций
                    // ВАЖНО: убираем проверку доступности API ключей, т.к. мы форсируем режим блокчейна
                    // Отправка реальной криптотранзакции через блокчейн
                    let txResult;
                    try {
                        if (cryptoType === 'btc') {
                            // Логика для Bitcoin транзакций
                            txResult = await sendBitcoinTransaction(fromCard.btcAddress || '', // Адрес отправителя
                            recipientAddress, // Адрес получателя
                            btcToSend // Сумма в BTC
                            );
                            console.log(`✅ BTC транзакция запущена: ${txResult.txId} (статус: ${txResult.status})`);
                            txId = txResult.txId;
                            // Если получен реальный ID транзакции (не начинается с btc_tx_ или btc_err_)
                            if (!txId.startsWith('btc_tx_') && !txId.startsWith('btc_err_')) {
                                // Это настоящая блокчейн-транзакция, меняем режим
                                transactionMode = 'blockchain';
                                console.log(`🚀 BTC транзакция успешно отправлена в блокчейн! TxID: ${txId}`);
                                // Проверяем статус транзакции через 5 секунд, чтобы убедиться, что она началась
                                setTimeout(async () => {
                                    try {
                                        console.log(`🔍 Проверка начальной обработки BTC транзакции: ${txId}`);
                                        const status = await checkTransactionStatus(txId || '', 'btc');
                                        if (status.status === 'failed') {
                                            console.error(`❌ BTC транзакция не прошла: ${txId}`);
                                            // Если транзакция завершилась с ошибкой, возвращаем средства пользователю
                                            const originalBtcBalance = parseFloat(fromCard.btcBalance || '0');
                                            await this.updateCardBtcBalance(fromCard.id, originalBtcBalance.toFixed(8));
                                            console.log(`♻️ Возвращены средства пользователю: ${totalDebit.toFixed(8)} BTC на карту ${fromCard.id}`);
                                            // Создаем запись о возврате средств
                                            await this.createTransaction({
                                                fromCardId: regulator.id,
                                                toCardId: fromCard.id,
                                                amount: totalDebit.toString(),
                                                convertedAmount: '0',
                                                type: 'refund',
                                                status: 'completed',
                                                description: `Возврат средств: ${amount.toFixed(8)} BTC (транзакция не прошла)`,
                                                fromCardNumber: "SYSTEM",
                                                toCardNumber: fromCard.number,
                                                wallet: null,
                                                createdAt: new Date()
                                            });
                                        }
                                        else {
                                            console.log(`✅ BTC транзакция ${txId} в обработке (статус: ${status.status})`);
                                        }
                                    }
                                    catch (checkError) {
                                        console.error(`❌ Ошибка при проверке BTC транзакции:`, checkError);
                                    }
                                }, 5000);
                            }
                        }
                        else {
                            // Логика для Ethereum транзакций - точно такая же, как для BTC                  
                            // При отправке ETH, если это крипто-карта, мы используем прямую сумму в ETH
                            // Если это фиатная карта, конвертируем из BTC в ETH
                            const ethAmount = fromCard.type === 'crypto'
                                ? amount // Прямая сумма в ETH
                                : btcToSend * (parseFloat(rates.btcToUsd) / parseFloat(rates.ethToUsd)); // Конвертация из BTC в ETH
                            txResult = await sendEthereumTransaction(fromCard.ethAddress || '', // Адрес отправителя
                            recipientAddress, // Адрес получателя
                            ethAmount // Сумма в ETH
                            );
                            console.log(`✅ ETH транзакция запущена: ${txResult.txId} (статус: ${txResult.status})`);
                            txId = txResult.txId;
                            // ВАЖНО: Всегда устанавливаем режим blockchain для всех Ethereum транзакций
                            // Это соответствует логике для Bitcoin транзакций
                            transactionMode = 'blockchain';
                            console.log(`🚀 ETH транзакция успешно отправлена в блокчейн! TxID: ${txId}`);
                            // Проверяем статус транзакции через 5 секунд, чтобы убедиться, что она началась
                            setTimeout(async () => {
                                try {
                                    console.log(`🔍 Проверка начальной обработки ETH транзакции: ${txId}`);
                                    const status = await checkTransactionStatus(txId || '', 'eth');
                                    if (status.status === 'failed') {
                                        console.error(`❌ ETH транзакция не прошла: ${txId}`);
                                        // Если транзакция завершилась с ошибкой, возвращаем средства пользователю
                                        const originalEthBalance = parseFloat(fromCard.ethBalance || '0');
                                        await this.updateCardEthBalance(fromCard.id, originalEthBalance.toFixed(8));
                                        console.log(`♻️ Возвращены средства пользователю: ${totalDebit.toFixed(8)} ETH на карту ${fromCard.id}`);
                                        // Создаем запись о возврате средств
                                        await this.createTransaction({
                                            fromCardId: regulator.id,
                                            toCardId: fromCard.id,
                                            amount: totalDebit.toString(),
                                            convertedAmount: '0',
                                            type: 'refund',
                                            status: 'completed',
                                            description: `Возврат средств: ${amount.toFixed(8)} ETH (транзакция не прошла)`,
                                            fromCardNumber: "SYSTEM",
                                            toCardNumber: fromCard.number,
                                            wallet: null,
                                            createdAt: new Date()
                                        });
                                    }
                                    else {
                                        console.log(`✅ ETH транзакция ${txId} в обработке (статус: ${status.status})`);
                                    }
                                }
                                catch (checkError) {
                                    console.error(`❌ Ошибка при проверке ETH транзакции:`, checkError);
                                }
                            }, 5000);
                        }
                    }
                    catch (blockchainError) {
                        console.error(`❌ Ошибка отправки ${cryptoType.toUpperCase()} транзакции:`, blockchainError);
                        // Продолжаем выполнение, даже если реальная отправка не удалась
                        // Это позволяет приложению работать даже при проблемах с блокчейн API
                        console.log(`⚠️ Продолжаем в режиме симуляции...`);
                        transactionMode = 'simulated';
                    }
                    // Убираем проверку else для API ключей - мы всегда работаем в режиме блокчейна
                    // Благодаря этому изменению, приложение всегда будет пытаться отправить реальные транзакции
                }
                // Зачисляем комиссию регулятору
                const regulatorBtcBalance = parseFloat(regulator.regulator_balance || '0');
                await this.updateRegulatorBalance(regulator.id, (regulatorBtcBalance + btcCommission).toFixed(8));
                // Создаем транзакцию с информацией о режиме
                const transactionDescription = (() => {
                    let baseDescription = '';
                    if (fromCard.type === 'crypto') {
                        baseDescription = `Отправка ${amount.toFixed(8)} ${cryptoType.toUpperCase()} на адрес ${recipientAddress}`;
                    }
                    else if (cryptoType === 'btc') {
                        baseDescription = `Конвертация ${amount.toFixed(2)} ${fromCard.type.toUpperCase()} → ${btcToSend.toFixed(8)} BTC и отправка на адрес ${recipientAddress}`;
                    }
                    else {
                        baseDescription = `Конвертация ${amount.toFixed(2)} ${fromCard.type.toUpperCase()} → ${(btcToSend * (parseFloat(rates.btcToUsd) / parseFloat(rates.ethToUsd))).toFixed(8)} ETH и отправка на адрес ${recipientAddress}`;
                    }
                    // Добавляем информацию о режиме работы
                    if (transactionMode === 'internal') {
                        return baseDescription + " (внутренний перевод)";
                    }
                    else if (transactionMode === 'simulated') {
                        return baseDescription + " (СИМУЛЯЦИЯ - средства списаны, но блокчейн-транзакция не выполнена)";
                    }
                    else {
                        return baseDescription + " (блокчейн)";
                    }
                })();
                const transaction = await this.createTransaction({
                    fromCardId: fromCard.id,
                    toCardId: toCard?.id || null,
                    amount: fromCard.type === 'crypto' ? amount.toString() : amount.toString(),
                    convertedAmount: (btcToSend).toString(),
                    type: 'crypto_transfer',
                    status: 'completed',
                    description: transactionDescription,
                    fromCardNumber: fromCard.number,
                    toCardNumber: toCard?.number || recipientAddress,
                    wallet: recipientAddress,
                    createdAt: new Date()
                });
                // Создаем транзакцию комиссии
                await this.createTransaction({
                    fromCardId: fromCard.id,
                    toCardId: regulator.id,
                    amount: fromCard.type === 'crypto' ? commission.toString() : commission.toString(),
                    convertedAmount: btcCommission.toString(),
                    type: 'commission',
                    status: 'completed',
                    description: `Комиссия за перевод ${cryptoType.toUpperCase()} ${cryptoType === 'btc' ?
                        `(${btcCommission.toFixed(8)} BTC)` :
                        `(${commission.toFixed(8)} ETH ~ ${btcCommission.toFixed(8)} BTC)`}`,
                    fromCardNumber: fromCard.number,
                    toCardNumber: "REGULATOR",
                    wallet: null,
                    createdAt: new Date()
                });
                return { success: true, transaction };
            }
            catch (error) {
                console.error("Crypto transfer error:", error);
                throw error;
            }
        }, "Crypto Transfer Operation");
    }
    async withTransaction(operation, context, maxAttempts = 3) {
        let lastError;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`🔄 Повторная попытка транзакции ${attempt + 1}/${maxAttempts}: ${context}`);
                }
                else {
                    console.log(`🔄 Начало транзакции: ${context}`);
                }
                // Используем db.transaction(), который автоматически обрабатывает BEGIN/COMMIT/ROLLBACK
                const result = await db.transaction(async (tx) => {
                    return await operation(tx);
                });
                if (attempt > 0) {
                    console.log(`✅ Транзакция успешно завершена после ${attempt + 1} попыток: ${context}`);
                }
                else {
                    console.log(`✅ Транзакция успешно завершена: ${context}`);
                }
                return result;
            }
            catch (error) {
                lastError = error;
                // Определяем тип ошибки
                const isRetryable = error.code === '40001' || // Serialization failure
                    error.code === '40P01' || // Deadlock detected
                    error.message?.includes('serializable') ||
                    error.message?.includes('deadlock') ||
                    error.message?.includes('conflict') ||
                    error.message?.includes('duplicate');
                if (isRetryable && attempt < maxAttempts - 1) {
                    console.warn(`⚠️ Транзакция отменена из-за конфликта (${context}), попытка ${attempt + 1}/${maxAttempts}:`);
                    console.warn(`   - Код: ${error.code || 'Неизвестно'}`);
                    console.warn(`   - Сообщение: ${error.message || 'Нет сообщения'}`);
                    // Экспоненциальная задержка с элементом случайности
                    const delay = Math.min(1000 * Math.pow(2, attempt), 10000) + Math.random() * 1000;
                    console.warn(`   - Повторная попытка через ${Math.round(delay / 1000)} секунд...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                // Для непреодолимых ошибок или последней попытки
                console.error(`❌ Транзакция отменена (${context}), попытка ${attempt + 1}/${maxAttempts}:`);
                console.error(`   - Код: ${error.code || 'Неизвестно'}`);
                console.error(`   - Сообщение: ${error.message || 'Нет сообщения'}`);
                console.error(`   - SQL: ${error.sql || 'Нет SQL'}`);
                console.error(`   - Stack: ${error.stack || 'Нет стека'}`);
                if (attempt >= maxAttempts - 1) {
                    break;
                }
            }
        }
        // Если все попытки исчерпаны, возвращаем последнюю ошибку
        throw lastError || new Error(`Транзакция ${context} не удалась после ${maxAttempts} попыток`);
    }
    async withRetry(operation, context, maxAttempts = 5) {
        let lastError;
        const MAX_DELAY = 30000; // Максимальная задержка между попытками (30 секунд)
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                // Логируем только первую и последующие попытки, но не каждую
                if (attempt > 0) {
                    console.log(`🔄 ${context}: повторная попытка ${attempt + 1}/${maxAttempts}`);
                }
                return await operation();
            }
            catch (error) {
                lastError = error;
                // Категоризируем ошибки
                const isTransientError = error.code === 'ECONNRESET' ||
                    error.code === 'ETIMEDOUT' ||
                    error.code === 'ECONNREFUSED' ||
                    error.message.includes('connection') ||
                    error.message.includes('timeout') ||
                    error.code === '40P01'; // Deadlock detected
                // Для временных ошибок делаем больше попыток
                if (isTransientError && attempt < maxAttempts - 1) {
                    // Экспоненциальная задержка с случайным элементом (jitter)
                    const baseDelay = Math.min(1000 * Math.pow(2, attempt), MAX_DELAY);
                    // Добавляем случайность от 1 до 1000 мс чтобы избежать "thundering herd"
                    const jitter = Math.floor(Math.random() * 1000);
                    const delay = baseDelay + jitter;
                    console.warn(`⚠️ ${context} не удалось (временная ошибка, попытка ${attempt + 1}/${maxAttempts}):`);
                    console.warn(`   - Код ошибки: ${error.code || 'Неизвестно'}`);
                    console.warn(`   - Сообщение: ${error.message || 'Нет сообщения'}`);
                    console.warn(`   - Повторная попытка через ${Math.round(delay / 1000)} секунд...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                // Для критических/постоянных ошибок выводим более подробную информацию
                console.error(`❌ ${context} не удалось (попытка ${attempt + 1}/${maxAttempts}):`);
                console.error(`   - Код: ${error.code || 'Неизвестно'}`);
                console.error(`   - Сообщение: ${error.message || 'Нет сообщения'}`);
                console.error(`   - SQL: ${error.sql || 'Нет SQL'}`);
                console.error(`   - Параметры: ${JSON.stringify(error.parameters || {})}`);
                console.error(`   - Stack: ${error.stack || 'Нет стека'}`);
                // Для непреодолимых ошибок не пытаемся повторить
                if (!isTransientError || attempt >= maxAttempts - 1) {
                    break;
                }
            }
        }
        // Возвращаем информативную ошибку с контекстом
        const errorMsg = `${context} не удалось после ${maxAttempts} попыток`;
        console.error(errorMsg);
        if (lastError) {
            lastError.message = `${errorMsg}: ${lastError.message}`;
            throw lastError;
        }
        else {
            throw new Error(errorMsg);
        }
    }
    async getLatestExchangeRates() {
        return this.withRetry(async () => {
            const [rates] = await db
                .select()
                .from(exchangeRates)
                .orderBy(desc(exchangeRates.updatedAt))
                .limit(1);
            return rates;
        }, 'Get latest exchange rates');
    }
    async updateExchangeRates(rates) {
        return this.withRetry(async () => {
            const [result] = await db
                .insert(exchangeRates)
                .values({
                usdToUah: rates.usdToUah.toString(),
                btcToUsd: rates.btcToUsd.toString(),
                ethToUsd: rates.ethToUsd.toString(),
                updatedAt: new Date()
            })
                .returning();
            return result;
        }, 'Update exchange rates');
    }
    async createNFTCollection(userId, name, description) {
        return this.withRetry(async () => {
            const [collection] = await db.insert(nftCollections).values({
                userId,
                name,
                description,
                createdAt: new Date()
            }).returning();
            console.log(`Created NFT collection ${collection.id} for user ${userId}: ${name}`);
            return collection;
        }, 'Create NFT collection');
    }
    async createNFT(data) {
        return this.withRetry(async () => {
            // Получаем информацию о коллекции, чтобы узнать userId
            const [collection] = await db.select().from(nftCollections).where(eq(nftCollections.id, data.collectionId));
            if (!collection) {
                throw new Error(`NFT collection with ID ${data.collectionId} not found`);
            }
            const [nft] = await db.insert(nfts).values({
                ...data,
                ownerId: collection.userId, // Устанавливаем владельца как создателя коллекции
                mintedAt: new Date(),
                tokenId: `NFT-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
            }).returning();
            console.log(`Created NFT ${nft.id} in collection ${nft.collectionId} for owner ${nft.ownerId}: ${nft.name}`);
            return nft;
        }, 'Create NFT');
    }
    async getNFTsByUserId(userId) {
        return this.withRetry(async () => {
            // Получаем все NFT, где пользователь является владельцем
            return db
                .select()
                .from(nfts)
                .where(eq(nfts.ownerId, userId))
                .orderBy(desc(nfts.mintedAt));
        }, 'Get NFTs by user ID');
    }
    async getNFTCollectionsByUserId(userId) {
        return this.withRetry(async () => {
            console.log(`ОТЛАДКА: getNFTCollectionsByUserId вызван для пользователя ${userId}`);
            // Сначала получаем все коллекции пользователя
            const collections = await db
                .select()
                .from(nftCollections)
                .where(eq(nftCollections.userId, userId))
                .orderBy(desc(nftCollections.createdAt));
            console.log(`ОТЛАДКА: Найдено ${collections.length} коллекций для пользователя ${userId}`);
            // Если коллекций нет, возвращаем пустой массив
            if (collections.length === 0) {
                console.log(`ОТЛАДКА: У пользователя ${userId} нет коллекций NFT`);
                return [];
            }
            // Для каждой коллекции получаем связанные NFT
            const collectionsWithNFTs = await Promise.all(collections.map(async (collection) => {
                console.log(`ОТЛАДКА: Загружаем NFT для коллекции ${collection.id} (${collection.name})`);
                const nftItems = await db
                    .select()
                    .from(nfts)
                    .where(eq(nfts.collectionId, collection.id))
                    .orderBy(desc(nfts.mintedAt));
                // Возвращаем коллекцию с добавленными NFT
                return {
                    ...collection,
                    nfts: nftItems
                };
            }));
            const totalNFTs = collectionsWithNFTs.reduce((sum, col) => sum + (col.nfts?.length || 0), 0);
            console.log(`ОТЛАДКА: Получено ${collections.length} NFT коллекций с ${totalNFTs} NFT для пользователя ${userId}`);
            // Подробно выводим информацию о каждой коллекции
            collectionsWithNFTs.forEach(collection => {
                console.log(`ОТЛАДКА: Коллекция ${collection.id} (${collection.name}) содержит ${collection.nfts?.length || 0} NFT.`);
                if (collection.nfts && collection.nfts.length > 0) {
                    collection.nfts.forEach(nft => {
                        console.log(`ОТЛАДКА: - NFT ${nft.id} (${nft.name}): ${nft.imagePath}`);
                    });
                }
            });
            return collectionsWithNFTs;
        }, 'Get NFT collections by user ID');
    }
    async canGenerateNFT(userId) {
        return this.withRetry(async () => {
            // Получаем пользователя с данными о последней генерации NFT
            const [user] = await db
                .select()
                .from(users)
                .where(eq(users.id, userId));
            if (!user) {
                return false;
            }
            // Всегда разрешаем генерацию, не учитывая лимит по времени
            return true;
            // Старый код лимита (раз в 24 часа) - отключен:
            /*
            // Если пользователь никогда не генерировал NFT или нет информации о последней генерации
            if (!user.last_nft_generation) {
              return true;
            }
            
            // Проверяем суточный лимит
            const lastGeneration = new Date(user.last_nft_generation);
            const now = new Date();
            const hoursSinceLastGeneration = (now.getTime() - lastGeneration.getTime()) / (1000 * 60 * 60);
            
            // Разрешаем генерацию раз в 24 часа
            return hoursSinceLastGeneration >= 24;
            */
        }, 'Check if user can generate NFT');
    }
    async updateUserNFTGeneration(userId) {
        await this.withRetry(async () => {
            // Получаем текущие данные пользователя
            const [user] = await db
                .select()
                .from(users)
                .where(eq(users.id, userId));
            if (!user) {
                throw new Error(`User ${userId} not found`);
            }
            // Обновляем дату последней генерации и счетчик
            const generationCount = (user.nft_generation_count || 0) + 1;
            await db
                .update(users)
                .set({
                last_nft_generation: new Date(),
                nft_generation_count: generationCount
            })
                .where(eq(users.id, userId));
            console.log(`Updated NFT generation data for user ${userId}. Total generations: ${generationCount}`);
        }, 'Update user NFT generation data');
    }
    async getTransactionsByCardIds(cardIds) {
        return this.withRetry(async () => {
            return await db.select()
                .from(transactions)
                .where(or(inArray(transactions.fromCardId, cardIds), inArray(transactions.toCardId, cardIds)))
                .orderBy(desc(transactions.createdAt));
        }, 'Get transactions by card IDs');
    }
    async createDefaultCardsForUser(userId) {
        try {
            console.log(`Starting default cards creation for user ${userId}`);
            // Generate crypto addresses with retry limit
            let btcAddress, ethAddress;
            try {
                btcAddress = generateValidAddress('btc', userId);
                ethAddress = generateValidAddress('eth', userId);
                console.log('Generated crypto addresses:', { btcAddress, ethAddress });
            }
            catch (error) {
                console.error('Failed to generate valid crypto addresses:', error);
                throw new Error('Could not generate valid crypto addresses');
            }
            // Генерируем дату истечения (текущий месяц + 3 года)
            const now = new Date();
            const expiryMonth = String(now.getMonth() + 1).padStart(2, '0');
            const expiryYear = String((now.getFullYear() + 3) % 100).padStart(2, '0');
            const expiry = `${expiryMonth}/${expiryYear}`;
            // Генерируем CVV
            const generateCVV = () => Math.floor(100 + Math.random() * 900).toString();
            try {
                console.log('Creating cards...');
                // Создаем крипто-карту
                await this.withRetry(async () => {
                    console.log('Creating crypto card...');
                    const cryptoCardNumber = generateCardNumber('crypto');
                    await db.insert(cards).values({
                        userId,
                        type: 'crypto',
                        number: cryptoCardNumber,
                        expiry,
                        cvv: generateCVV(),
                        balance: "0.00",
                        btcBalance: "0.00000000",
                        ethBalance: "0.00000000",
                        btcAddress,
                        ethAddress
                    });
                    console.log('Crypto card created successfully:', cryptoCardNumber);
                }, 'Create crypto card');
                // Создаем USD карту
                await this.withRetry(async () => {
                    console.log('Creating USD card...');
                    const usdCardNumber = generateCardNumber('usd');
                    await db.insert(cards).values({
                        userId,
                        type: 'usd',
                        number: usdCardNumber,
                        expiry,
                        cvv: generateCVV(),
                        balance: "0.00",
                        btcBalance: "0.00000000",
                        ethBalance: "0.00000000",
                        btcAddress: null,
                        ethAddress: null
                    });
                    console.log('USD card created successfully:', usdCardNumber);
                }, 'Create USD card');
                // Создаем UAH карту
                await this.withRetry(async () => {
                    console.log('Creating UAH card...');
                    const uahCardNumber = generateCardNumber('uah');
                    await db.insert(cards).values({
                        userId,
                        type: 'uah',
                        number: uahCardNumber,
                        expiry,
                        cvv: generateCVV(),
                        balance: "0.00",
                        btcBalance: "0.00000000",
                        ethBalance: "0.00000000",
                        btcAddress: null,
                        ethAddress: null
                    });
                    console.log('UAH card created successfully:', uahCardNumber);
                }, 'Create UAH card');
                console.log(`All cards created successfully for user ${userId}`);
            }
            catch (error) {
                console.error(`Error creating cards for user ${userId}:`, error);
                throw error;
            }
        }
        catch (error) {
            console.error(`Error in createDefaultCardsForUser for user ${userId}:`, error);
            throw error;
        }
    }
    async deleteUser(userId) {
        return this.withTransaction(async () => {
            try {
                // First delete all cards associated with the user
                await db.delete(cards)
                    .where(eq(cards.userId, userId));
                // Then delete the user
                await db.delete(users)
                    .where(eq(users.id, userId));
                console.log(`User ${userId} and their cards deleted successfully`);
            }
            catch (error) {
                console.error(`Error deleting user ${userId}:`, error);
                throw error;
            }
        }, 'Delete user');
    }
    async clearAllUserNFTs(userId) {
        return this.withTransaction(async () => {
            try {
                console.log(`Очистка всех NFT для пользователя ${userId}`);
                // Получаем все NFT, принадлежащие пользователю
                const userNfts = await db
                    .select()
                    .from(nfts)
                    .where(eq(nfts.ownerId, userId));
                const nftCount = userNfts.length;
                if (nftCount === 0) {
                    console.log(`У пользователя ${userId} нет NFT`);
                    return { success: true, count: 0 };
                }
                console.log(`Удаление ${nftCount} NFT для пользователя ${userId}`);
                // Удаляем все NFT пользователя
                await db.delete(nfts).where(eq(nfts.ownerId, userId));
                // Получаем коллекции NFT пользователя
                const collections = await this.getNFTCollectionsByUserId(userId);
                // Удаляем пустые коллекции
                if (collections && collections.length > 0) {
                    const collectionIds = collections.map(collection => collection.id);
                    // Проверяем, есть ли NFT в каждой коллекции
                    for (const collectionId of collectionIds) {
                        const [remainingNft] = await db
                            .select({ count: sql `count(*)` })
                            .from(nfts)
                            .where(eq(nfts.collectionId, collectionId));
                        // Если в коллекции не осталось NFT, удаляем ее
                        if (remainingNft.count === 0) {
                            await db.delete(nftCollections).where(eq(nftCollections.id, collectionId));
                            console.log(`Удалена пустая коллекция ${collectionId}`);
                        }
                    }
                }
                console.log(`Успешно удалено ${nftCount} NFT для пользователя ${userId}`);
                return { success: true, count: nftCount };
            }
            catch (error) {
                console.error(`Ошибка при очистке NFT для пользователя ${userId}:`, error);
                throw error;
            }
        }, 'Clear all user NFTs');
    }
    // Метод для выполнения произвольных SQL-запросов
    async executeRawQuery(query) {
        return this.withRetry(async () => {
            console.log(`[DB] Executing raw query: ${query}`);
            const result = await client.unsafe(query);
            return result;
        }, 'Execute raw query');
    }
    // Получение NFT по ID
    async getNFTById(nftId) {
        return this.withRetry(async () => {
            const [nft] = await db.select().from(nfts).where(eq(nfts.id, nftId));
            return nft;
        }, 'Get NFT by ID');
    }
    // Обновление статуса продажи NFT
    async updateNFTSaleStatus(nftId, forSale, price) {
        return this.withRetry(async () => {
            const [nft] = await db.select().from(nfts).where(eq(nfts.id, nftId));
            if (!nft) {
                throw new Error(`NFT с ID ${nftId} не найден`);
            }
            // Обновляем статус NFT
            const updateData = { forSale };
            if (price !== undefined) {
                updateData.price = price;
            }
            const [updatedNft] = await db.update(nfts)
                .set(updateData)
                .where(eq(nfts.id, nftId))
                .returning();
            console.log(`NFT ${nftId} статус продажи изменён на ${forSale ? 'продаётся' : 'не продаётся'}${price ? ` с ценой ${price}` : ''}`);
            return updatedNft;
        }, 'Update NFT sale status');
    }
    // Передача NFT от одного пользователя другому
    async transferNFT(nftId, fromUserId, toUserId, transferType, price) {
        return this.withTransaction(async () => {
            try {
                // Получаем NFT
                const [nft] = await db.select().from(nfts).where(eq(nfts.id, nftId));
                if (!nft) {
                    throw new Error(`NFT с ID ${nftId} не найден`);
                }
                // Проверяем, что отправитель является владельцем NFT
                if (nft.ownerId !== fromUserId) {
                    throw new Error(`Пользователь ${fromUserId} не является владельцем NFT ${nftId}`);
                }
                // Получаем информацию о получателе
                const [toUser] = await db.select().from(users).where(eq(users.id, toUserId));
                if (!toUser) {
                    throw new Error(`Пользователь с ID ${toUserId} не найден`);
                }
                // Используемая цена
                const transferPrice = transferType === 'sale' ? (price || nft.price || '0') : '0';
                // Обновляем владельца NFT
                const [updatedNft] = await db.update(nfts)
                    .set({
                    ownerId: toUserId,
                    forSale: false // Снимаем с продажи при передаче
                })
                    .where(eq(nfts.id, nftId))
                    .returning();
                // Создаём запись о передаче NFT
                await db.insert(nftTransfers).values({
                    nftId,
                    fromUserId,
                    toUserId,
                    transferType,
                    price: transferPrice,
                    transferredAt: new Date()
                });
                console.log(`NFT ${nftId} передан от пользователя ${fromUserId} пользователю ${toUserId} типом ${transferType}${transferPrice !== '0' ? ` за ${transferPrice}` : ''}`);
                return { success: true, nft: updatedNft };
            }
            catch (error) {
                console.error("Ошибка при передаче NFT:", error);
                throw error;
            }
        }, 'Transfer NFT');
    }
    // Получение NFT, доступных для покупки
    async getAvailableNFTsForSale() {
        return this.withRetry(async () => {
            console.log('[Storage] Запрос NFT, доступных для продажи...');
            // Сначала попробуем использовать ORM с подробным логом
            try {
                // Сначала проверим все NFT с forSale = true
                const allForSaleNFTs = await db
                    .select()
                    .from(nfts)
                    .where(eq(nfts.forSale, true));
                console.log(`[Storage] Всего NFT с forSale = true: ${allForSaleNFTs.length}`);
                if (allForSaleNFTs.length > 0) {
                    // Выводим информацию о нескольких NFT для отладки
                    const sampleNFTs = allForSaleNFTs.slice(0, Math.min(3, allForSaleNFTs.length));
                    console.log('[Storage] Примеры NFT на продаже:');
                    sampleNFTs.forEach(nft => {
                        console.log(`[Storage] NFT ID: ${nft.id}, name: ${nft.name}, forSale: ${nft.forSale}, ownerId: ${nft.ownerId}, price: ${nft.price}`);
                    });
                }
                // Получаем отсортированные NFT для маркетплейса, фильтруя только обезьян (collection_id = 1 или 2)
                const nftItems = await db
                    .select()
                    .from(nfts)
                    .where(and(eq(nfts.forSale, true), or(eq(nfts.collectionId, 1), eq(nfts.collectionId, 2))))
                    .orderBy(desc(nfts.mintedAt));
                // Выводим подробную информацию о количестве NFT по коллекциям
                const boredApeCount = nftItems.filter(nft => nft.collectionId === 1).length;
                const mutantApeCount = nftItems.filter(nft => nft.collectionId === 2).length;
                console.log(`[Storage] Найдено ${nftItems.length} NFT через ORM для маркетплейса (${boredApeCount} Bored Ape, ${mutantApeCount} Mutant Ape)`);
                return nftItems;
            }
            catch (error) {
                console.error('[Storage] Ошибка при получении NFT через ORM:', error);
                // Если произошла ошибка, пробуем прямой SQL-запрос
                console.log('[Storage] Попытка получить NFT через прямой SQL...');
                const result = await client `
          SELECT * FROM nfts 
          WHERE for_sale = true 
            AND (collection_id = 1 OR collection_id = 2)
          ORDER BY minted_at DESC
        `;
                console.log(`[Storage] Найдено ${result.length} NFT через прямой SQL`);
                // Преобразуем объекты PostgreSQL в формат, совместимый с ORM
                const formattedResult = result.map(item => ({
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    collectionId: item.collection_id,
                    ownerId: item.owner_id,
                    imagePath: item.image_path,
                    attributes: typeof item.attributes === 'string' ? JSON.parse(item.attributes) : item.attributes,
                    rarity: item.rarity,
                    price: item.price,
                    forSale: item.for_sale,
                    mintedAt: new Date(item.minted_at),
                    tokenId: item.token_id,
                    originalImagePath: item.original_image_path,
                    sortOrder: item.sort_order
                }));
                return formattedResult;
            }
        }, 'Get NFTs for sale');
    }
    // Получение истории передач NFT
    async getNFTTransferHistory(nftId) {
        return this.withRetry(async () => {
            return db
                .select()
                .from(nftTransfers)
                .where(eq(nftTransfers.nftId, nftId))
                .orderBy(desc(nftTransfers.transferredAt));
        }, 'Get NFT transfer history');
    }
}
export const storage = new DatabaseStorage();
function generateCardNumber(type) {
    // Префиксы для разных типов карт
    const prefixes = {
        crypto: '4111',
        usd: '4112',
        uah: '4113'
    };
    // Генерируем оставшиеся 12 цифр
    const suffix = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
    return `${prefixes[type]}${suffix}`;
}
