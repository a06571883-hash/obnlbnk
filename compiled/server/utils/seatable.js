import { Base } from 'seatable-api';
import { SEATABLE_CONFIG } from '@shared/seatable.config';
class SeaTableManager {
    static instance;
    base = null;
    initialized = false;
    initializationAttempts = 0;
    MAX_ATTEMPTS = 3;
    constructor() { }
    static getInstance() {
        if (!SeaTableManager.instance) {
            SeaTableManager.instance = new SeaTableManager();
        }
        return SeaTableManager.instance;
    }
    async initialize() {
        if (this.initialized) {
            return;
        }
        if (!SEATABLE_CONFIG.API_TOKEN) {
            console.error('SeaTable configuration error: API token is missing');
            throw new Error('SeaTable API token is not configured');
        }
        console.log('SeaTable configuration:', {
            serverUrl: SEATABLE_CONFIG.SERVER_URL,
            workspaceId: SEATABLE_CONFIG.WORKSPACE_ID,
            baseName: SEATABLE_CONFIG.BASE_NAME,
            hasToken: !!SEATABLE_CONFIG.API_TOKEN
        });
        while (this.initializationAttempts < this.MAX_ATTEMPTS) {
            try {
                console.log(`SeaTable initialization attempt ${this.initializationAttempts + 1}/${this.MAX_ATTEMPTS}...`);
                this.base = new Base({
                    server: SEATABLE_CONFIG.SERVER_URL,
                    APIToken: SEATABLE_CONFIG.API_TOKEN,
                    workspaceID: SEATABLE_CONFIG.WORKSPACE_ID,
                    name: SEATABLE_CONFIG.BASE_NAME
                });
                await this.base.auth();
                this.initialized = true;
                console.log('SeaTable authentication successful');
                return;
            }
            catch (error) {
                this.initializationAttempts++;
                console.error('SeaTable initialization error details:', {
                    attempt: this.initializationAttempts,
                    message: error.message,
                    response: error.response?.data,
                    status: error.response?.status,
                    config: error.config,
                    fullError: JSON.stringify(error, null, 2)
                });
                if (this.initializationAttempts >= this.MAX_ATTEMPTS) {
                    const errorMessage = `SeaTable initialization failed after ${this.MAX_ATTEMPTS} attempts: ${error.message}`;
                    console.error(errorMessage, {
                        lastError: error,
                        config: SEATABLE_CONFIG
                    });
                    throw new Error(errorMessage);
                }
                // Wait before retrying (exponential backoff)
                const delay = 1000 * Math.pow(2, this.initializationAttempts);
                console.log(`Waiting ${delay}ms before next attempt...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
        if (!this.base) {
            throw new Error('SeaTable base is not initialized');
        }
    }
    async updateRegulatorBalance(btcAmount) {
        await this.ensureInitialized();
        try {
            console.log('Updating regulator balance in SeaTable...');
            const { data: { cards } } = await this.syncFromSeaTable();
            const regulatorCard = cards.find((c) => c.number === '4532 0151 1283 0005');
            if (regulatorCard) {
                await this.base.updateRow('Cards', regulatorCard._id, {
                    'btc_balance': btcAmount.toString(),
                });
                console.log('Regulator card updated successfully');
            }
            else {
                await this.base.appendRow('Cards', {
                    'number': '4532 0151 1283 0005',
                    'type': 'crypto',
                    'btc_balance': btcAmount.toString(),
                    'eth_balance': '78194.27446904',
                    'status': 'active',
                });
                console.log('New regulator card created successfully');
            }
            console.log(`Regulator balance updated to ${btcAmount} BTC`);
            return true;
        }
        catch (error) {
            console.error('Error updating regulator balance:', {
                error: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw error;
        }
    }
    async syncFromSeaTable() {
        await this.ensureInitialized();
        try {
            console.log('Starting data retrieval from SeaTable...');
            const [usersResult, cardsResult, transactionsResult] = await Promise.all([
                this.base.listRows('Users', { convertKey: true }),
                this.base.listRows('Cards', { convertKey: true }),
                this.base.listRows('Transactions', { convertKey: true })
            ]);
            console.log('SeaTable data retrieval successful', {
                usersCount: usersResult?.length || 0,
                cardsCount: cardsResult?.length || 0,
                transactionsCount: transactionsResult?.length || 0
            });
            return {
                success: true,
                data: {
                    users: usersResult,
                    cards: cardsResult,
                    transactions: transactionsResult
                }
            };
        }
        catch (error) {
            console.error('Error retrieving data from SeaTable:', {
                error: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw error;
        }
    }
    async createTable(table) {
        await this.ensureInitialized();
        try {
            console.log(`Creating table ${table.name} in SeaTable...`);
            await this.base.addTable(table.name, table.columns);
            console.log(`Table ${table.name} created successfully`);
        }
        catch (error) {
            if (error.message?.includes('already exists')) {
                console.log(`Table ${table.name} already exists`);
                return;
            }
            console.error(`Error creating table ${table.name}:`, {
                error: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw error;
        }
    }
}
export const seaTableManager = SeaTableManager.getInstance();
