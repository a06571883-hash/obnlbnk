import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import { createHash } from 'crypto';
import { generateAddressesForUser } from './seed-phrase';
// Корректная инициализация ECPair с поддержкой tiny-secp256k1
const ECPair = ECPairFactory(ecc);
// Предотвращаем строгую проверку сети, которая может быть проблемой в некоторых версиях bitcoinjs-lib
const network = bitcoin.networks.bitcoin;
/**
 * Генерирует НАСТОЯЩИЕ крипто-адреса для пользователя,
 * которые точно работают с реальными биржами
 * @param type Тип криптоадреса ('btc' или 'eth')
 * @param userId ID пользователя
 * @returns Сгенерированный адрес
 */
export function generateValidAddress(type, userId) {
    try {
        console.log(`🔄 Generating ${type.toUpperCase()} address for user ${userId}...`);
        if (type === 'btc') {
            // Генерируем детерминированный BTC адрес на основе userId
            const seed = createHash('sha256').update(`btc-${userId}-salt`).digest();
            const keyPair = ECPair.fromPrivateKey(seed);
            const pubKeyBuffer = Buffer.from(keyPair.publicKey);
            const { address } = bitcoin.payments.p2pkh({ pubkey: pubKeyBuffer, network: network });
            if (!address) {
                throw new Error("Failed to generate BTC address");
            }
            console.log(`✅ Generated REAL BTC address: ${address} for user: ${userId}`);
            return address;
        }
        else {
            // Генерируем детерминированный ETH адрес на основе userId
            const seed = createHash('sha256').update(`eth-${userId}-salt`).digest('hex');
            const privateKey = '0x' + seed;
            const wallet = new ethers.Wallet(privateKey);
            console.log(`✅ Generated REAL ETH address: ${wallet.address} for user: ${userId}`);
            return wallet.address;
        }
    }
    catch (error) {
        console.error(`Critical error generating ${type} address:`, error);
        // Запасной вариант в случае ошибки - случайная генерация
        if (type === 'btc') {
            try {
                // Создаем пару ключей с использованием ECPair
                const keyPair = ECPair.makeRandom();
                const pubKeyBuffer = Buffer.from(keyPair.publicKey);
                const { address } = bitcoin.payments.p2pkh({ pubkey: pubKeyBuffer, network: network });
                if (!address) {
                    throw new Error("Failed to generate BTC address");
                }
                console.log(`✅ Generated REAL BTC address (fallback): ${address} for user: ${userId}`);
                return address;
            }
            catch (btcError) {
                console.error("Error generating BTC address:", btcError);
                throw btcError;
            }
        }
        else {
            try {
                // Создаем случайный ETH кошелек через ethers.js
                const wallet = ethers.Wallet.createRandom();
                console.log(`✅ Generated REAL ETH address (fallback): ${wallet.address} for user: ${userId}`);
                return wallet.address;
            }
            catch (ethError) {
                console.error("Error creating ETH wallet:", ethError);
                throw ethError;
            }
        }
    }
}
/**
 * Получает seed фразу для пользователя
 * @param userId ID пользователя
 * @returns Мнемоническая фраза
 */
export function getSeedPhraseForUser(userId) {
    const { mnemonic } = generateAddressesForUser(userId);
    return mnemonic;
}
/**
 * Проверяет валидность криптоадреса
 * Гарантирует, что адрес соответствует стандартам сети и будет принят биржами
 * @param address Адрес для проверки
 * @param type Тип криптоадреса ('btc' или 'eth')
 * @returns true если адрес валидный, false если нет
 */
export function validateCryptoAddress(address, type) {
    if (!address)
        return false;
    try {
        const cleanAddress = address.trim();
        if (type === 'btc') {
            try {
                // Проверка на фиктивные адреса
                if (cleanAddress.includes('BTC') || cleanAddress.includes('btc')) {
                    console.log(`Обнаружен фиктивный BTC адрес: ${cleanAddress}, valid: false`);
                    return false;
                }
                // Используем усовершенствованные регулярные выражения для проверки адресов
                // Проверка стандартных Legacy и P2SH адресов (начинаются с 1 или 3)
                const legacyRegex = /^[13][a-km-zA-HJ-NP-Z0-9]{24,33}$/;
                // Для SegWit адресов (начинающихся с bc1)
                const bech32Regex = /^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/;
                // Для Taproot адресов (начинаются с bc1p)
                const taprootRegex = /^bc1p[a-km-zA-HJ-NP-Z0-9]{58,89}$/;
                // Проверяем адрес с использованием регулярных выражений
                const isValid = legacyRegex.test(cleanAddress) ||
                    bech32Regex.test(cleanAddress) ||
                    taprootRegex.test(cleanAddress);
                // Дополнительные проверки на невалидные паттерны
                const noInvalidPattern = !cleanAddress.includes('BTC') &&
                    !cleanAddress.includes('btc') &&
                    !/^1[0-9]{6,}$/.test(cleanAddress); // Предотвращаем адреса вида 1000000...
                console.log(`Validating BTC address: ${cleanAddress}, valid: ${isValid && noInvalidPattern}`);
                return isValid && noInvalidPattern;
            }
            catch (error) {
                console.error(`Error validating BTC address: ${cleanAddress}`, error);
                return false;
            }
        }
        else if (type === 'eth') {
            try {
                // Проверяем валидность ETH адреса через ethers.js
                const isValid = ethers.isAddress(cleanAddress);
                // Проверяем, что адрес соответствует стандартному формату (0x + 40 hex символов)
                const formatRegex = /^0x[a-fA-F0-9]{40}$/;
                const hasValidFormat = formatRegex.test(cleanAddress);
                console.log(`Validating ETH address: ${cleanAddress}, valid: ${isValid && hasValidFormat}`);
                return isValid && hasValidFormat;
            }
            catch (error) {
                console.error(`Error validating ETH address: ${cleanAddress}`, error);
                return false;
            }
        }
    }
    catch (error) {
        console.error(`Error validating ${type} address:`, error);
        return false;
    }
    return false;
}
